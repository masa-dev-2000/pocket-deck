"""Pocket Deck: Windows + Python standard library only."""
import argparse
import ctypes as C
from ctypes import wintypes as W
import json
import os
import copy
import shutil
from pathlib import Path
import socket
import sys
import threading
import features
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'vendor'))
import qrcode
import qrcode.image.svg
KEYS = {'CTRL': 0x11, 'SHIFT': 0x10, 'ALT': 0x12, 'WIN': 0x5B,
        'ENTER': 0x0D, 'TAB': 9, 'ESC': 27, 'SPACE': 32, 'BACKSPACE': 8,
        'DELETE': 46, 'LEFT': 37, 'UP': 38, 'RIGHT': 39, 'DOWN': 40,
        'HOME': 36, 'END': 35, 'PAGEUP': 33, 'PAGEDOWN': 34,
        'VOLUMEUP': 175, 'VOLUMEDOWN': 174, 'MUTE': 173, 'PLAYPAUSE': 179}
KEYS.update({c: ord(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})
KEYS.update({f'F{i}': 111+i for i in range(1, 25)})
EXTENDED = {33, 34, 35, 36, 37, 38, 39, 40, 46, 0x5B, 173, 174, 175, 179}

def key_catalog():
    labels = {'CTRL': ('Ctrl', 'control コントロール'), 'SHIFT': ('Shift', 'シフト'),
              'ALT': ('Alt', 'オルト'), 'WIN': ('Win', 'windows ウィンドウズ'),
              'ENTER': ('Enter', 'return 決定 改行 エンター'), 'TAB': ('Tab', 'タブ'),
              'ESC': ('Esc', 'escape エスケープ'), 'SPACE': ('Space', '空白 スペース'),
              'BACKSPACE': ('Backspace', '削除 バックスペース'), 'DELETE': ('Delete', '削除 デリート'),
              'LEFT': ('Left', '左 矢印 ←'), 'RIGHT': ('Right', '右 矢印 →'),
              'UP': ('Up', '上 矢印 ↑'), 'DOWN': ('Down', '下 矢印 ↓'),
              'HOME': ('Home', '先頭 ホーム'), 'END': ('End', '末尾 エンド'),
              'PAGEUP': ('PageUp', 'ページ 上'), 'PAGEDOWN': ('PageDown', 'ページ 下'),
              'VOLUMEUP': ('VolumeUp', '音量 上げる'), 'VOLUMEDOWN': ('VolumeDown', '音量 下げる'),
              'MUTE': ('Mute', '消音 ミュート'), 'PLAYPAUSE': ('PlayPause', '再生 一時停止')}
    return [{'key': key, 'label': labels.get(key, (key, ''))[0],
             'search': labels.get(key, (key, ''))[1]} for key in KEYS]

def parse_keys(value):
    names = [x.strip().upper() for x in value.split('+')]
    if not names or len(names) > 8 or any(n not in KEYS for n in names):
        raise ValueError('キー指定を確認してください（例: Ctrl+Shift+Z）')
    return list(dict.fromkeys(KEYS[n] for n in names))

class KEYBDINPUT(C.Structure):
    _fields_ = [('wVk', W.WORD), ('wScan', W.WORD), ('dwFlags', W.DWORD),
                ('time', W.DWORD), ('dwExtraInfo', C.c_size_t)]
class MOUSEINPUT(C.Structure):
    _fields_ = [('dx', W.LONG), ('dy', W.LONG), ('mouseData', W.DWORD),
                ('dwFlags', W.DWORD), ('time', W.DWORD), ('dwExtraInfo', C.c_size_t)]
class UNION(C.Union):
    _fields_ = [('ki', KEYBDINPUT), ('mi', MOUSEINPUT)]
class INPUT(C.Structure):
    _anonymous_ = ('u',)
    _fields_ = [('type', W.DWORD), ('u', UNION)]

def send_key(key, up):
    user32 = C.WinDLL('user32', use_last_error=True)
    user32.SendInput.argtypes = [W.UINT, C.POINTER(INPUT), C.c_int]
    user32.SendInput.restype = W.UINT
    flags = (2 if up else 0) | (1 if key in EXTENDED else 0)
    item = INPUT(type=1, u=UNION(ki=KEYBDINPUT(key, 0, flags, 0, 0)))
    if user32.SendInput(1, C.byref(item), C.sizeof(INPUT)) != 1:
        raise RuntimeError('キー入力に失敗しました。対象アプリの権限を確認してください。')

def send_mouse(kind, dx=0, dy=0):
    user32=C.WinDLL('user32',use_last_error=True)
    user32.SendInput.argtypes=[W.UINT,C.POINTER(INPUT),C.c_int]
    user32.SendInput.restype=W.UINT
    if kind=='mouse_scroll':
        packets=[]
        if dy:packets.append((0,0,dy & 0xffffffff,0x800))
        if dx:packets.append((0,0,dx & 0xffffffff,0x1000))
    else:
        flags={'mouse_move':[1],'mouse_click':[2,4],'mouse_down':[2],'mouse_up':[4]}[kind]
        packets=[(dx,dy,0,f) for f in flags]
    if not packets:return
    items=(INPUT*len(packets))(*(INPUT(type=0,u=UNION(mi=MOUSEINPUT(x,y,data,f,0,0))) for x,y,data,f in packets))
    if user32.SendInput(len(items),items,C.sizeof(INPUT))!=len(items):
        if kind in ('mouse_click','mouse_down'):
            release=INPUT(type=0,u=UNION(mi=MOUSEINPUT(0,0,0,4,0,0)))
            user32.SendInput(1,C.byref(release),C.sizeof(INPUT))
        raise RuntimeError('マウス操作に失敗しました')

class Mouse:
    def __init__(self,emit):
        self.emit=emit
        self.held={}
        self.ended={}
    def press(self,owner):
        if owner in self.ended:return
        if owner not in self.held and not self.held:self.emit('mouse_down',0,0)
        self.held[owner]=time.monotonic()
    def release(self,owner):
        self.ended[owner]=time.monotonic()
        if owner in self.held:
            # Keep the record if the OS rejects key-up, so the watchdog retries.
            if len(self.held)==1:self.emit('mouse_up',0,0)
            del self.held[owner]
    def release_all(self):
        for owner in list(self.held):self.release(owner)
    def heartbeat(self,owner):
        if owner in self.held:self.held[owner]=time.monotonic()
    def expire(self):
        now=time.monotonic()
        for owner,t in list(self.held.items()):
            if now-t>2:self.release(owner)
        self.ended={o:t for o,t in self.ended.items() if now-t<300}

class Keyboard:
    def __init__(self, emit=send_key):
        self.emit = emit
        self.held = {}
        self.lock = threading.RLock()
        self.repeat_key = None
        self.repeat_at = 0
        self.delay, self.interval = .5, 1/30
        if emit is send_key:
            delay, speed = W.UINT(), W.UINT()
            u = C.WinDLL('user32')
            if u.SystemParametersInfoW(0x16,0,C.byref(delay),0): self.delay = .25*(delay.value+1)
            if u.SystemParametersInfoW(0xA,0,C.byref(speed),0): self.interval = 1/(2.5+27.5*speed.value/31)

    def release(self, owner):
        with self.lock:
            record = self.held.pop(owner, None)
            if record:
                for key in reversed(record[0]):
                    if not any(key in r[0] for r in self.held.values()):
                        self.emit(key, True)
            if self.repeat_key is not None and not any(self.repeat_key in r[0] for r in self.held.values()):
                self.repeat_key = None

    def release_all(self):
        with self.lock:
            for owner in list(self.held):
                self.release(owner)

    def press(self, owner, keys):
        with self.lock:
            if owner in self.held:
                self.held[owner][1] = time.monotonic()
                return
            pressed = []
            self.held[owner] = [pressed, time.monotonic()]
            try:
                for key in keys:
                    if not any(key in r[0] for k, r in self.held.items() if k != owner):
                        self.emit(key, False)
                    pressed.append(key)
                    if key not in (16,17,18,91):
                        self.repeat_key=key; self.repeat_at=time.monotonic()+self.delay
            except Exception:
                self.release(owner)
                raise

    def repeat(self):
        with self.lock:
            if self.repeat_key is not None and time.monotonic()>=self.repeat_at:
                self.emit(self.repeat_key,False)
                self.repeat_at=time.monotonic()+self.interval

    def expire(self):
        with self.lock:
            for owner, (_, timestamp) in list(self.held.items()):
                if time.monotonic() - timestamp > 2:
                    self.release(owner)

def defaults():
    presets = [('元に戻す','Ctrl+Z'), ('やり直す','Ctrl+Y'), ('コピー','Ctrl+C'),
               ('貼り付け','Ctrl+V'), ('保存','Ctrl+S'), ('すべて選択','Ctrl+A'),
               ('検索','Ctrl+F'), ('新規タブ','Ctrl+T'), ('タブを閉じる','Ctrl+W'),
               ('再読み込み','F5'), ('Shift','Shift'), ('Ctrl','Ctrl')]
    return {'version':3, 'revision':0, 'columns':3, 'rows':4, 'buttons':[
        dict(id=str(i),label=n,keys=k,type='shortcut',slot=i,width=1,height=1,color='#294b68')
        for i,(n,k) in enumerate(presets)]}

def migrate(config):
    config = copy.deepcopy(config)
    if config.get('version',1) == 1:
        config.update(version=2,revision=0,rows=max(1,(len(config['buttons'])+config['columns']-1)//config['columns']))
        for i,b in enumerate(config['buttons']):
            b.update(type='shortcut',slot=i)
            b.pop('mode',None)
    if config.get('version')==2:
        config['version']=3
        for b in config['buttons']:b.update(width=1,height=1)
    if config.get('version')==3:
        config={'version':4,'revision':config['revision'],'layouts':[dict(id='main',name='メイン',columns=config['columns'],rows=config['rows'],buttons=config['buttons'])]}
    return validate(config)

def validate(config):
    return features.validate_config(config,validate_layout,parse_keys)

def validate_layout(config):
    if not isinstance(config,dict) or config.get('version') != 3:
        raise ValueError('画面を再読み込みしてください')
    for name,maximum in [('columns',12),('rows',200)]:
        if type(config.get(name)) is not int or not 1 <= config[name] <= maximum:
            raise ValueError('行数・列数が範囲外です')
    if type(config.get('revision')) is not int or config['revision'] < 0:
        raise ValueError('更新番号が不正です')
    buttons=config.get('buttons')
    if not isinstance(buttons,list) or len(buttons)>200:
        raise ValueError('ボタンは200個までです')
    ids,slots=set(),set()
    for b in buttons:
        if not isinstance(b,dict) or not all(isinstance(b.get(k),str) for k in ['id','label','type','color']):
            raise ValueError('ボタン設定が不正です')
        if not b['id'] or b['id'] in ids or len(b['id'])>80 or not 1<=len(b['label'])<=60:
            raise ValueError('名前またはIDが不正です')
        if type(b.get('slot')) is not int or not 0<=b['slot']<config['rows']*config['columns'] or b['slot'] in slots:
            raise ValueError('ボタンが枠外、または枠が重複しています')
        w,h=b.get('width'),b.get('height')
        if type(w) is not int or type(h) is not int or w<1 or h<1 or b['slot']%config['columns']+w>config['columns'] or b['slot']//config['columns']+h>config['rows']:
            raise ValueError('キーの大きさが配置の範囲外です')
        occupied={b['slot']+y*config['columns']+x for y in range(h) for x in range(w)}
        if slots & occupied:raise ValueError('キーの範囲が重なっています')
        ids.add(b['id']);slots.update(occupied)
        if b['type']=='shortcut':
            if not isinstance(b.get('keys'),str):raise ValueError('キーを選択してください')
            parse_keys(b['keys'])
        elif b['type']=='text':
            if not isinstance(b.get('text'),str) or not 1<=len(b['text'])<=1000:
                raise ValueError('文字列は1〜1000文字です')
        elif b['type']=='navigate':
            if b.get('target') not in ('keyboard','pad','layout'):raise ValueError('移動先が不正です')
        elif b['type'] in ('touchpad','wheel','macro','profile'):pass
        else:raise ValueError('入力種類が不正です')
        features.validate_button(b,parse_keys)
        if len(b['color'])!=7 or b['color'][0]!='#' or any(c not in '0123456789abcdefABCDEF' for c in b['color'][1:]):
            raise ValueError('色が不正です')
    return config

class Conflict(ValueError):pass

def send_text(text):
    user32=C.WinDLL('user32',use_last_error=True)
    user32.SendInput.argtypes=[W.UINT,C.POINTER(INPUT),C.c_int]
    user32.SendInput.restype=W.UINT
    items=[]
    for ch in text.replace('\r\n','\n').replace('\r','\n'):
        if ch in ('\n','\t'):
            key=13 if ch=='\n' else 9
            items.extend([INPUT(type=1,u=UNION(ki=KEYBDINPUT(key,0,0,0,0))),INPUT(type=1,u=UNION(ki=KEYBDINPUT(key,0,2,0,0)))])
        else:
            raw=ch.encode('utf-16-le')
            for i in range(0,len(raw),2):
                unit=int.from_bytes(raw[i:i+2],'little')
                items.extend([INPUT(type=1,u=UNION(ki=KEYBDINPUT(0,unit,4,0,0))),INPUT(type=1,u=UNION(ki=KEYBDINPUT(0,unit,6,0,0)))])
    array=(INPUT*len(items))(*items)
    if user32.SendInput(len(items),array,C.sizeof(INPUT))!=len(items):
        raise RuntimeError('文字入力を完了できませんでした。対象アプリを確認してください（自動再送しません）。')

class App:
    def __init__(self,path,keyboard,text_emit=send_text,mouse_emit=send_mouse):
        self.path,self.keyboard,self.text_emit=path,keyboard,text_emit
        self.mouse_emit=mouse_emit
        self.mouse=Mouse(mouse_emit)
        self.lock=threading.RLock()
        self.operations={}
        # A running process serves one immutable UI build. Editing source files
        # cannot expose an unfinished frontend to connected phones.
        public_files=['index.html','editor.html','connect.html','style.css','common.js',
                      'layout.js','pad.js','operator.js','editor.js','autosave.js',
                      'reorder.js','key-picker.js','draft.js','connect.js','extras.js','editor-extras.js']
        self.web_assets={name:(ROOT/name).read_bytes() for name in public_files}
        if path.exists():
            old=json.loads(path.read_text('utf-8'))
            self.config=migrate(old)
            if old.get('version')!=4:
                backup=path.with_name(path.name+'.pre-v4-'+str(time.time_ns())+'.bak')
                shutil.copy2(path,backup)
                self.write(self.config)
        else:self.config=migrate(defaults())
        self.features=features.Runtime(self)

    def write(self,config):
        temp=self.path.with_suffix('.tmp')
        temp.write_text(json.dumps(config,ensure_ascii=False,indent=2),'utf-8')
        temp.replace(self.path)

    def save(self,data):
        config=validate(copy.deepcopy(data))
        with self.lock:
            if config['revision']!=self.config['revision']:
                raise Conflict('別の編集が保存されています。入力を保持しました。最新設定を確認してください。')
            config['revision']+=1
            self.write(config)
            before={b['id']:b for b in features.buttons(self.config)}
            after={b['id']:b for b in features.buttons(config)}
            changed={i for i,b in before.items() if i not in after or
                     (b['type'],b.get('keys'),b.get('text'))!=(after[i]['type'],after[i].get('keys'),after[i].get('text'))}
            for owner,record in list(self.operations.items()):
                if record['id'] in changed:self.keyboard.release(owner)
            self.features.cancel_if_changed(config)
            self.config=config
            return copy.deepcopy(config)

    def action(self,data):
        with self.lock:
            kind=data.get('action')
            if kind=='release_all':
                self.features.cancel()
                self.keyboard.release_all();self.mouse.release_all();return
            owner=data.get('owner')
            if not isinstance(owner,str) or not 1<=len(owner)<=120:raise ValueError('操作IDが不正です')
            if kind=='mouse_up':self.mouse.release(owner);return
            if kind=='up':self.keyboard.release(owner);return
            if kind=='macro_cancel':self.features.cancel_owner(data.get('targetOwner'));return
            if kind=='heartbeat':
                self.features.heartbeat(owner)
                self.mouse.heartbeat(owner)
                with self.keyboard.lock:
                    if owner in self.keyboard.held:self.keyboard.held[owner][1]=time.monotonic()
                return
            if self.features.running:
                raise ValueError('連続操作の実行中です。停止してから操作してください')
            now=time.monotonic()
            self.operations={o:r for o,r in self.operations.items() if now-r['time']<300 or o in self.keyboard.held}
            if owner in self.operations:return
            if kind in ('key_down','key_tap'):
                key=data.get('key')
                if not isinstance(key,str) or key not in KEYS:raise ValueError('キーが不正です')
                self.operations[owner]={'id':None,'time':now}
                self.keyboard.press(owner,[KEYS[key]])
                if kind=='key_tap':self.keyboard.release(owner)
                return
            if kind=='mouse_down':
                self.operations[owner]={'id':None,'time':now}
                self.mouse.press(owner);return
            if kind in ('mouse_move','mouse_click','mouse_scroll'):
                dx,dy=data.get('dx',0),data.get('dy',0)
                if any(type(n) is not int or abs(n)>2048 for n in (dx,dy)):
                    raise ValueError('移動量が範囲外です')
                self.operations[owner]={'id':None,'time':now}
                if kind=='mouse_click' and self.mouse.held:raise ValueError('ドラッグ中です。指を離してください')
                self.mouse_emit(kind,dx if kind!='mouse_click' else 0,dy if kind!='mouse_click' else 0)
                return
            b=next((b for b in features.buttons(self.config) if b['id']==data.get('id')),None)
            if b and b['type'] in ('macro','profile'):
                if kind!='execute':raise ValueError('画面を再読み込みしてください')
                self.features.start(b,owner)
                self.operations[owner]={'id':b['id'],'time':now}
                return
            if not b or b['type'] in ('navigate','touchpad','wheel') or kind not in ('tap','down','text'):raise ValueError('登録されていない操作です')
            self.operations[owner]={'id':b['id'],'time':now}
            if b['type']=='text':
                if kind!='text':raise ValueError('画面を再読み込みしてください')
                with self.keyboard.lock:
                    if self.keyboard.held:raise ValueError('保持しているキーを離してから文字列を入力してください')
                    self.text_emit(b['text'])
            else:
                if kind=='text':raise ValueError('入力種類が異なります')
                self.keyboard.press(owner,parse_keys(b['keys']))
                if kind=='tap':self.keyboard.release(owner)

def handler(app):
    class Handler(BaseHTTPRequestHandler):
        def connect_url(self):
            address = self.connection.getsockname()[0]
            if address.startswith('127.') or address == '0.0.0.0':
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                    try:
                        probe.connect(('192.0.2.1', 80))
                        address = probe.getsockname()[0]
                    except OSError:
                        address = socket.gethostbyname(socket.gethostname())
            return f'http://{address}:{self.server.server_port}/'

        def log_message(self, *args):
            pass

        def reply(self, status, data, mime='application/json; charset=utf-8'):
            raw = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            routes = {'/': ('index.html', 'text/html'), '/index.html': ('index.html', 'text/html'),
                      '/editor': ('editor.html', 'text/html'), '/connect': ('connect.html', 'text/html'),
                      '/style.css': ('style.css', 'text/css'), '/common.js': ('common.js', 'text/javascript'),
                      '/operator.js': ('operator.js', 'text/javascript'), '/editor.js': ('editor.js', 'text/javascript'),
                      '/draft.js': ('draft.js', 'text/javascript'), '/connect.js': ('connect.js', 'text/javascript')}
            routes['/layout.js'] = ('layout.js', 'text/javascript')
            routes['/pad.js'] = ('pad.js', 'text/javascript')
            routes['/autosave.js'] = ('autosave.js', 'text/javascript')
            routes['/reorder.js'] = ('reorder.js', 'text/javascript')
            routes['/key-picker.js'] = ('key-picker.js', 'text/javascript')
            if features.handle_get(self,app):return
            if self.path in routes:
                name, mime = routes[self.path]
                self.reply(200, app.web_assets[name], mime + '; charset=utf-8')
            elif self.path == '/api/config':
                with app.lock:
                    self.reply(200, app.config)
            elif self.path == '/api/health':
                self.reply(200, {'ok': True})
            elif self.path == '/api/keys':
                self.reply(200, key_catalog())
            elif self.path == '/api/connect':
                self.reply(200, {'url': self.connect_url()})
            elif self.path == '/connect.svg':
                qr = qrcode.make(self.connect_url(), image_factory=qrcode.image.svg.SvgPathFillImage, border=4)
                self.reply(200, qr.to_string(), 'image/svg+xml')
            else:
                self.reply(404, {'error': 'Not found'})

        def do_POST(self):
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= (8*1024*1024 if self.path=='/api/assets' else 2097152) or not self.headers.get('Content-Type','').startswith('application/json'):
                    raise ValueError('リクエストが不正です')
                origin = self.headers.get('Origin')
                if origin and origin != 'http://' + self.headers.get('Host', ''):
                    self.reply(403, {'error':'接続元が異なります'})
                    return
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('リクエストが不正です')
                if features.handle_post(self,app,data):return
                if self.path == '/api/action':
                    app.action(data)
                elif self.path == '/api/config':
                    result = app.save(data)
                    self.reply(200, result)
                    return
                else:
                    self.reply(404, {'error':'Not found'})
                    return
                self.reply(200, {'ok':True})
            except Conflict as e:
                self.reply(409, {'error':str(e)})
            except (ValueError, TypeError, KeyError) as e:
                self.reply(400, {'error':str(e)})
            except Exception as e:
                self.reply(500, {'error':str(e)})
    return Handler

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='0.0.0.0')
    parser.add_argument('--data-dir', type=Path, default=ROOT)
    parser.add_argument('--managed-stdio', action='store_true')
    parser.add_argument('--chrome-host', action='store_true')
    args = parser.parse_args()
    if args.chrome_host:
        import chrome_host
        chrome_host.main(args.data_dir,args.port)
        return
    keyboard = Keyboard()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    app = App(args.data_dir/'config.json', keyboard)
    class ExclusiveServer(ThreadingHTTPServer):
        allow_reuse_address = False

        def server_bind(self):
            if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()

    server = ExclusiveServer((args.host, args.port), handler(app))
    if args.port == 8765:
        (args.data_dir/'server.pid').write_text(str(os.getpid()), encoding='ascii')
    if args.managed_stdio:
        def parent_watch():
            # EOF also releases held inputs when the desktop parent exits unexpectedly.
            sys.stdin.readline()
            server.shutdown()
        threading.Thread(target=parent_watch, daemon=True).start()
    def watchdog():
        while True:
            time.sleep(.01)
            try:
                with app.lock:
                    app.features.tick()
                    keyboard.expire()
                    keyboard.repeat()
                    app.mouse.expire()
            except Exception:
                pass
    threading.Thread(target=watchdog, daemon=True).start()
    addresses = set(socket.gethostbyname_ex(socket.gethostname())[2])
    print('Pocket Deck is running. Open on your phone:', flush=True)
    for address in sorted(addresses):
        print(f'  http://{address}:{args.port}', flush=True)
    print('Stop: Ctrl+C. Local network prototype; no authentication or encryption.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        app.features.cancel()
        keyboard.release_all()
        app.mouse.release_all()
        server.server_close()

if __name__ == '__main__':
    main()
