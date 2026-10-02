"""Configuration v4, image assets, cancellable sequences and Chrome bridge."""
import base64
import copy
import hashlib
import io
import json
import re
import secrets
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit


def buttons(config):
    return [item for layout in config['layouts'] for b in layout['buttons']
            for item in ([b]+b.get('items',[]) if b.get('type')=='group' else [b])]


def identifier(value):
    return isinstance(value, str) and bool(re.fullmatch(r'[A-Za-z0-9_-]{1,80}', value))


def validate_steps(steps, parse_keys):
    if not isinstance(steps, list) or not 1 <= len(steps) <= 50:
        raise ValueError('連続操作は1〜50手順です')
    held = set()
    for step in steps:
        if not isinstance(step, dict):
            raise ValueError('手順が不正です')
        kind = step.get('kind')
        if kind == 'shortcut':
            if not isinstance(step.get('keys'), str): raise ValueError('キーを選択してください')
            parse_keys(step['keys'])
        elif kind in ('press', 'release'):
            key = step.get('key')
            if not isinstance(key, str) or '+' in key: raise ValueError('キーを1つ選択してください')
            logical=parse_keys(key)[0]
            if kind == 'press': held.add(logical)
            else: held.discard(logical)
        elif kind == 'text':
            if step.get('pasteMode','standard') not in ('standard','terminal'):raise ValueError('文字列の貼り付け先が不正です')
            if held: raise ValueError('文字列の前に保持キーを離してください')
            if not isinstance(step.get('text'), str) or not 1 <= len(step['text']) <= 1000:
                raise ValueError('文字列は1〜1000文字です')
        elif kind == 'wait':
            if type(step.get('ms')) is not int or not 0 <= step['ms'] <= 10000:
                raise ValueError('待ち時間は0〜10000ミリ秒です')
        elif kind == 'click':
            if held: raise ValueError('クリックの前に保持キーを離してください')
        elif kind == 'profile':
            if held: raise ValueError('画面切り替えの前に保持キーを離してください')
            if not identifier(step.get('profileId')): raise ValueError('プロフィールを選択してください')
        else:
            raise ValueError('手順の種類が不正です')


def validate_button(b, parse_keys):
    if b['type']=='group':
        items=b.get('items')
        if not isinstance(items,list) or len(items)>200:
            raise ValueError('まとめボタンの候補は0〜200個です')
        for item in items:
            if not isinstance(item,dict) or item.get('type') not in ('shortcut','text','macro','profile','navigate'):
                raise ValueError('まとめボタンに入れられない操作です')
            if not identifier(item.get('id')) or not isinstance(item.get('label'),str) or not 1<=len(item['label'])<=60:
                raise ValueError('候補の名前またはIDが不正です')
            color=item.get('color')
            if not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color):
                raise ValueError('候補の色が不正です')
            if item['type']=='shortcut':
                if not isinstance(item.get('keys'),str):raise ValueError('キーを選択してください')
                parse_keys(item['keys'])
            elif item['type']=='text':
                if not isinstance(item.get('text'),str) or not 1<=len(item['text'])<=1000:
                    raise ValueError('文字列は1〜1000文字です')
            elif item['type']=='navigate' and item.get('target')!='layout':
                raise ValueError('移動先が不正です')
            validate_button(item,parse_keys)
    if b['type']=='wheel' and type(b.get('invertY', False)) is not bool:
        raise ValueError('上下反転の設定が不正です')
    if 'sensitivity' in b:
        if b['type'] not in ('touchpad','wheel'):
            raise ValueError('ボタンの操作感が不正です')
        sensitivity=b['sensitivity']
        allowed={'scroll'} if b['type']=='wheel' else {'cursor','scroll'}
        if not isinstance(sensitivity,dict) or not set(sensitivity)<=allowed or any(
                type(value) not in (int,float) or not .25<=value<=3 for value in sensitivity.values()):
            raise ValueError('ボタンの操作感が不正です')
    if b['type']=='text' and b.get('pasteMode','standard') not in ('standard','terminal'):
        raise ValueError('文字列の貼り付け先が不正です')
    appearance = b.get('appearance', {})
    if not isinstance(appearance, dict) or appearance.get('mode', 'label') not in ('label', 'both', 'visual'):
        raise ValueError('見た目の設定が不正です')
    icon = appearance.get('icon', '')
    if not isinstance(icon, str) or len(icon) > 16: raise ValueError('アイコンが不正です')
    asset = appearance.get('asset', '')
    if asset and (not isinstance(asset, str) or not re.fullmatch('[a-f0-9]{64}', asset)):
        raise ValueError('画像IDが不正です')
    if b['type'] == 'macro': validate_steps(b.get('steps'), parse_keys)
    if b['type'] == 'profile' and not identifier(b.get('profileId')):
        raise ValueError('プロフィールを選択してください')


def validate_config(config, validate_layout, parse_keys):
    if not isinstance(config, dict) or config.get('version') != 5:
        raise ValueError('画面を再読み込みしてください')
    layouts = config.get('layouts')
    if not isinstance(layouts, list) or not 1 <= len(layouts) <= 22:
        raise ValueError('配置は1〜22個です')
    ids, button_ids = set(), set()
    for layout in layouts:
        if not isinstance(layout, dict) or not identifier(layout.get('id')) or layout['id'] in ids:
            raise ValueError('配置IDが不正です')
        if not isinstance(layout.get('name'), str) or not 1 <= len(layout['name'].strip()) <= 60:
            raise ValueError('配置の名前は1〜60文字です')
        ids.add(layout['id'])
        validate_layout({**layout, 'version': 3, 'revision': config.get('revision')})
        if sum(1+len(b.get('items',[])) for b in layout['buttons'])>200:
            raise ValueError('ボタンと候補は合わせて200個までです')
        for b in buttons({'layouts':[layout]}):
            if b['id'] in button_ids: raise ValueError('ボタンIDが重複しています')
            button_ids.add(b['id'])
    for b in buttons(config):
        if b['type'] == 'navigate' and b.get('target') == 'layout' and b.get('layoutId') not in ids:
            raise ValueError('移動先の配置がありません')
    return config


class Runtime:
    def __init__(self, app):
        self.app = app
        self.job = None
        self.running = False
        self.cancel_event = threading.Event()
        self.profiles = {}
        self.requests = {}
        self.ended = {}
        self.bridge_lock = threading.RLock()
        self.profile_path = app.path.parent / 'chrome-profiles.json'
        if self.profile_path.exists():
            for p in json.loads(self.profile_path.read_text('utf-8')):
                self.profiles[p['id']] = {**p, 'seen': 0}

    def status(self):
        with self.app.lock:
            return {k: v for k, v in (self.job or {'state': 'idle'}).items() if k in ('id','owner','state','index','total','label','error')}

    def heartbeat(self, owner):
        if self.running and self.job['owner'] == owner: self.job['seen'] = time.monotonic()

    def tick(self):
        if self.running:
            if time.monotonic() - self.job['seen'] > 2 or time.monotonic() > self.job['deadline']:
                self.cancel()
            else:
                for key in list(self.app.keyboard.held):
                    if key.startswith(self.job['prefix']): self.app.keyboard.held[key][1] = time.monotonic()

    def cancel(self):
        if self.running:
            self.cancel_event.set()
            for key in list(self.app.keyboard.held):
                if key.startswith(self.job['prefix']): self.app.keyboard.release(key)

    def cancel_owner(self, owner):
        self.ended={key:value for key,value in self.ended.items() if time.monotonic()-value<300}
        if owner:
            if not isinstance(owner,str) or len(owner)>120:raise ValueError('操作IDが不正です')
            self.ended[owner]=time.monotonic()
        if not owner or (self.job and self.job['owner']==owner):self.cancel()

    def cancel_if_changed(self, config):
        if self.running:
            b = next((b for b in buttons(config) if b['id'] == self.job['button']['id']), None)
            old = self.job['button']
            if not b or any(b.get(k) != old.get(k) for k in ('type', 'steps', 'profileId')): self.cancel()

    def start(self, button, owner):
        if owner in self.ended:return
        if self.running or self.app.keyboard.held or self.app.mouse.held:
            raise ValueError('保持しているキーとパッドを離してから実行してください')
        self.cancel_event = threading.Event()
        steps = copy.deepcopy(button['steps'] if button['type'] == 'macro' else [{'kind': 'profile', 'profileId': button['profileId']}])
        self.job = dict(id=uuid.uuid4().hex, owner=owner, prefix='sequence-'+uuid.uuid4().hex+'-',
                        state='running', index=0, total=len(steps), label=button['label'],
                        steps=steps, button=copy.deepcopy(button), seen=time.monotonic(), deadline=time.monotonic()+60)
        self.running = True
        threading.Thread(target=self.run, daemon=True).start()

    def run(self):
        import server
        import input_policy
        job = self.job
        try:
            for i, step in enumerate(job['steps']):
                if self.cancel_event.is_set(): break
                input_policy.require(self.app.input_status(),input_policy.requirements(job['button']))
                with self.app.lock:
                    if self.cancel_event.is_set(): break
                    job['index'] = i + 1
                    kind = step['kind']
                    prefix = job['prefix']
                    if kind == 'shortcut':
                        self.app.keyboard.press(prefix+'tap', server.parse_keys(step['keys']))
                        self.app.keyboard.repeat_key = None
                        self.app.keyboard.release(prefix+'tap')
                    elif kind == 'press':
                        self.app.keyboard.press(prefix+step['key'].upper(), server.parse_keys(step['key']))
                        self.app.keyboard.repeat_key = None
                    elif kind == 'release': self.app.keyboard.release(prefix+step['key'].upper())
                    elif kind == 'text': self.app.emit_text(step['text'],step.get('pasteMode','standard'))
                    elif kind == 'click': self.app.mouse_emit('mouse_click',0,0)
                if kind == 'wait':
                    if self.cancel_event.wait(step['ms']/1000): break
                elif kind == 'profile': self.focus(step['profileId'], self.cancel_event)
            with self.app.lock: job['state'] = 'cancelled' if self.cancel_event.is_set() else 'done'
        except Exception as e:
            with self.app.lock: job.update(state='error', error=str(e))
        finally:
            with self.app.lock:
                try:
                    for key in list(self.app.keyboard.held):
                        if key.startswith(job['prefix']): self.app.keyboard.release(key)
                finally: self.running = False

    def profile_list(self):
        with self.bridge_lock:
            return [dict(id=p['id'], name=p['name'], online=time.monotonic()-p['seen'] < 5) for p in self.profiles.values()]

    def bridge(self, data):
        pid, name = data.get('id'), data.get('name')
        if not identifier(pid) or not isinstance(name, str) or not 1 <= len(name) <= 60:
            raise ValueError('プロフィール登録が不正です')
        with self.bridge_lock:
            old = self.profiles.get(pid)
            self.profiles[pid] = dict(id=pid, name=name, seen=time.monotonic())
            if not old or old['name'] != name:
                tmp = self.profile_path.with_suffix('.tmp')
                tmp.write_text(json.dumps([dict(id=p['id'],name=p['name']) for p in self.profiles.values()],ensure_ascii=False), 'utf-8')
                tmp.replace(self.profile_path)
            for result in data.get('results', []):
                req = self.requests.get(result.get('id'))
                if req and req['profileId'] == pid and not req['event'].is_set():
                    req['result'] = result
                    req['event'].set()
            commands = []
            for req in self.requests.values():
                if req['profileId'] == pid and not req['sent'] and time.monotonic() < req['until']:
                    req['sent'] = True
                    commands.append(dict(id=req['id'], action='focus', expires=time.time()+max(0,req['until']-time.monotonic())))
            return {'commands': commands}

    def focus(self, pid, cancelled):
        with self.bridge_lock:
            p = self.profiles.get(pid)
            if not p or time.monotonic()-p['seen'] >= 5: raise ValueError('Chromeプロフィールが未接続です。対象のChromeを開いてください')
            request = dict(id=uuid.uuid4().hex,profileId=pid,event=threading.Event(),sent=False,until=time.monotonic()+3)
            self.requests[request['id']] = request
        try:
            while not request['event'].wait(.05):
                if cancelled.is_set(): raise ValueError('操作を停止しました')
                if time.monotonic() >= request['until']: raise ValueError('Chromeの切り替えを確認できませんでした（自動再送しません）')
            if not request['result'].get('ok'): raise ValueError(request['result'].get('error', '切り替えできませんでした'))
        finally:
            with self.bridge_lock: self.requests.pop(request['id'],None)


def upload_asset(app, data):
    from PIL import Image, ImageOps
    try: raw = base64.b64decode(data.get('base64', ''), validate=True)
    except Exception: raise ValueError('画像データが不正です')
    if not 0 < len(raw) <= 5*1024*1024: raise ValueError('画像は5MBまでです')
    try:
        with Image.open(io.BytesIO(raw)) as im:
            if im.format not in ('PNG','JPEG','WEBP') or im.width*im.height > 25_000_000:
                raise ValueError('PNG・JPEG・WebPの2500万画素以下の画像を選んでください')
            image = ImageOps.exif_transpose(im).convert('RGBA')
            image.thumbnail((512,512))
            out = io.BytesIO(); image.save(out,format='PNG')
    except ValueError: raise
    except Exception: raise ValueError('画像を読み込めませんでした')
    content = out.getvalue(); digest = hashlib.sha256(content).hexdigest()
    directory = app.path.parent / 'assets'; directory.mkdir(exist_ok=True)
    path = directory / (digest+'.png')
    if not path.exists():
        tmp = directory / (uuid.uuid4().hex+'.tmp'); tmp.write_bytes(content); tmp.replace(path)
    return {'asset':digest}


def handle_get(handler, app):
    path = urlsplit(handler.path).path
    if path in ('/extras.js','/editor-extras.js'):
        handler.reply(200,app.web_assets[path[1:]],'text/javascript; charset=utf-8')
    elif path == '/api/sequence': handler.reply(200,app.features.status())
    elif path == '/api/profiles': handler.reply(200,app.features.profile_list())
    elif re.fullmatch(r'/assets/[a-f0-9]{64}\.png',path):
        file = app.path.parent/path[1:]
        if file.exists(): handler.reply(200,file.read_bytes(),'image/png')
        else: handler.reply(404,{'error':'画像がありません'})
    else: return False
    return True


def handle_post(handler, app, data):
    if handler.path == '/api/assets': handler.reply(200,upload_asset(app,data))
    elif handler.path == '/api/bridge':
        token_path = app.path.parent/'chrome-bridge.token'
        token = token_path.read_text('ascii').strip() if token_path.exists() else ''
        if handler.client_address[0] not in ('127.0.0.1','::1') or not token or not secrets.compare_digest(handler.headers.get('X-Deck-Token',''),token):
            handler.reply(403,{'error':'連携の認証に失敗しました'})
        else: handler.reply(200,app.features.bridge(data))
    else: return False
    return True
