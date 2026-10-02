import base64
import copy
import io
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import shutil
import struct
import subprocess
import sys
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from PIL import Image
import server
import features
import chrome_host
import install_chrome


def test_app(*args,**kwargs):
    kwargs.setdefault('input_status',lambda:{'keyboard':True,'pointer':True,'text':True,'state':'ready'})
    return server.App(*args,**kwargs)

class Features(unittest.TestCase):
    def test_empty_group_can_be_saved_and_filled_later(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d);config=copy.deepcopy(app.config);layout=config['layouts'][0]
            layout['buttons']=[b for b in layout['buttons'] if b['slot']!=0]
            group=dict(id='empty-group',label='まとめ',type='group',slot=0,width=1,height=1,color='#294b68',items=[])
            layout['buttons'].append(group)
            app.save(config)
            self.assertEqual(app.config['layouts'][0]['buttons'][-1]['items'],[])
            filled=copy.deepcopy(app.config)
            filled['layouts'][0]['buttons'][-1]['items']=[dict(id='group-child',label='A',type='shortcut',keys='A',color='#294b68')]
            app.save(filled)
            self.assertEqual(len(app.config['layouts'][0]['buttons'][-1]['items']),1)
            emptied=copy.deepcopy(app.config);emptied['layouts'][0]['buttons'][-1]['items']=[]
            app.save(emptied)
            self.assertEqual(app.config['layouts'][0]['buttons'][-1]['items'],[])

    def test_button_sensitivity_persists_and_validates(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d)
            config=copy.deepcopy(app.config)
            button=config['layouts'][0]['buttons'][0]
            button.update(type='touchpad',sensitivity={'cursor':.25,'scroll':2.5})
            app.save(config)
            self.assertEqual(self.make_app(d).config['layouts'][0]['buttons'][0]['sensitivity'],{'cursor':.25,'scroll':2.5})
            for invalid in ({'cursor':4},{'scroll':True},{'scroll':float('nan')},{'unknown':1},1,[],{'cursor':'1'}):
                button['sensitivity']=invalid
                with self.assertRaisesRegex(ValueError,'操作感'):app.save(config)
            button.update(type='shortcut',sensitivity={'cursor':1})
            with self.assertRaisesRegex(ValueError,'操作感'):app.save(config)
            button.update(type='wheel',sensitivity={'cursor':1})
            with self.assertRaisesRegex(ValueError,'操作感'):app.save(config)
            button['sensitivity']={'scroll':.75}
            config['revision']=app.config['revision']
            app.save(config)

    def test_wheel_inversion_persists_and_rejects_non_boolean(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d)
            config=copy.deepcopy(app.config)
            button=config['layouts'][0]['buttons'][0]
            button.update(type='wheel',invertY=True)
            app.save(config)
            self.assertIs(self.make_app(d).config['layouts'][0]['buttons'][0]['invertY'],True)
            button['invertY']='true'
            with self.assertRaisesRegex(ValueError,'上下反転'):app.save(config)

    def make_app(self, directory, events=None):
        events = [] if events is None else events
        return test_app(Path(directory)/'config.json',server.Keyboard(lambda k,u:events.append(('key',k,u))),lambda t:events.append(('text',t)),lambda *args:events.append(('mouse',*args)))

    def macro(self, app, steps):
        config=copy.deepcopy(app.config)
        config['layouts'][0]['buttons'][0].update(type='macro',steps=steps)
        app.save(config)

    def wait_done(self, app):
        until=time.monotonic()+3
        while app.features.running and time.monotonic()<until:time.sleep(.005)
        self.assertFalse(app.features.running)

    def test_terminal_text_setting_survives_buttons_sequences_and_validation(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d);received=[]
            app.text_emit=lambda text,**options:received.append((text,options))
            config=copy.deepcopy(app.config);button=config['layouts'][0]['buttons'][0]
            button.update(type='text',text='端末🙂',pasteMode='terminal');app.save(config)
            app.action({'action':'text','id':button['id'],'owner':'terminal-button'})
            self.assertEqual(received,[('端末🙂',{'paste_mode':'terminal'})])
            self.macro(app,[{'kind':'text','text':'通常'},{'kind':'text','text':'端末', 'pasteMode':'terminal'}])
            app.action({'action':'execute','id':button['id'],'owner':'terminal-sequence'});self.wait_done(app)
            self.assertEqual(received[-2:],[('通常',{}),('端末',{'paste_mode':'terminal'})])
            invalid=copy.deepcopy(app.config);invalid['layouts'][0]['buttons'][0]['steps'][0]['pasteMode']='shell'
            with self.assertRaisesRegex(ValueError,'貼り付け先'):app.save(invalid)

    def test_v5_migration_and_layout_validation(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json';original=server.defaults();path.write_text(json.dumps(original),'utf-8')
            app=self.make_app(d)
            self.assertEqual(app.config['layouts'][0]['buttons'],original['buttons'])
            self.assertEqual(len(list(Path(d).glob('*.pre-v5-*.bak'))),1)
            self.assertEqual(self.make_app(d).config,app.config)
            config=copy.deepcopy(app.config);config['layouts'].append(copy.deepcopy(config['layouts'][0]))
            with self.assertRaises(ValueError):app.save(config)
            config['layouts'][-1]['id']='second'
            with self.assertRaises(ValueError):app.save(config) # duplicate button IDs
            config['layouts'][-1]['buttons']=[]
            config['layouts'][0]['buttons'][0].update(type='navigate',target='layout',layoutId='second')
            saved=app.save(config);saved['layouts'].pop()
            with self.assertRaises(ValueError):app.save(saved)
            invalid=copy.deepcopy(app.config)
            invalid['layouts'][0]['buttons'][0].update(type='navigate',target='keyboard')
            with self.assertRaisesRegex(ValueError,'移動先'):app.save(invalid)
            with self.assertRaises(ValueError):app.save(original) # stale v3 client cannot overwrite v5

    def test_existing_pages_become_editable_templates_once(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json'
            old=server.migrate(server.defaults(),existing=False)
            self.assertEqual(len(old['layouts']),1)
            old['version']=4
            old['layouts'][0]['buttons'][0].update(type='navigate',target='keyboard')
            old['layouts'][0]['buttons'][1].update(type='navigate',target='pad')
            for i in range(19):old['layouts'].append(dict(id=f'extra-{i}',name=f'追加{i}',columns=1,rows=1,buttons=[]))
            path.write_text(json.dumps(old),'utf-8')
            app=self.make_app(d)
            self.assertEqual(len(app.config['layouts']),22)
            self.assertEqual([l['name'] for l in app.config['layouts'][-2:]],['キー配列','パッド'])
            self.assertEqual(app.config['layouts'][0]['buttons'][0]['layoutId'],app.config['layouts'][-2]['id'])
            self.assertEqual(app.config['layouts'][0]['buttons'][1]['layoutId'],app.config['layouts'][-1]['id'])
            self.assertEqual(len(self.make_app(d).config['layouts']),22)
            self.assertEqual(len(list(Path(d).glob('*.pre-v5-*.bak'))),1)
            self.assertEqual(server.migrate(server.defaults(),existing=False)['layouts'][0]['name'],'メイン')

    def test_group_items_and_macro_click_dispatch(self):
        with tempfile.TemporaryDirectory() as d:
            events=[];app=self.make_app(d,events);config=copy.deepcopy(app.config);layout=config['layouts'][0]
            first,second=layout['buttons'][:2]
            items=[]
            for source in (first,second):
                item=copy.deepcopy(source)
                for field in ('slot','width','height'):item.pop(field)
                items.append(item)
            items[1].update(type='text',text='候補の文字列')
            layout['buttons']=layout['buttons'][2:]+[dict(id='group-one',label='まとめ',type='group',slot=0,width=1,height=1,color='#294b68',items=items)]
            app.save(config)
            app.action({'action':'tap','id':first['id'],'owner':'group-key'})
            app.action({'action':'text','id':second['id'],'owner':'group-text'})
            self.assertIn(('text','候補の文字列'),events)
            self.assertTrue(any(e[0]=='key' for e in events))
            invalid=copy.deepcopy(app.config);invalid['layouts'][0]['buttons'][-1]['items'][1]['id']=first['id']
            with self.assertRaisesRegex(ValueError,'重複'):app.save(invalid)
            macro=copy.deepcopy(app.config);macro['layouts'][0]['buttons'][0].update(type='macro',steps=[{'kind':'click'},{'kind':'wait','ms':1}])
            app.save(macro);app.action({'action':'execute','id':macro['layouts'][0]['buttons'][0]['id'],'owner':'click-sequence'});self.wait_done(app)
            self.assertIn(('mouse','mouse_click',0,0),events)
            app.input_status=lambda:{'keyboard':True,'pointer':False,'text':True}
            with self.assertRaises(ValueError):app.action({'action':'execute','id':macro['layouts'][0]['buttons'][0]['id'],'owner':'blocked-click'})

    def test_images(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d);buf=io.BytesIO();Image.new('RGB',(1200,600),'red').save(buf,'JPEG')
            data={'base64':base64.b64encode(buf.getvalue()).decode()};result=features.upload_asset(app,data)
            path=Path(d)/'assets'/(result['asset']+'.png')
            with Image.open(path) as im:self.assertEqual(im.size,(512,256));self.assertEqual(im.format,'PNG')
            self.assertEqual(features.upload_asset(app,data),result)
            for raw in (b'bad',b'<svg/>',b'x'*(5*1024*1024+1)):
                with self.assertRaises(ValueError):features.upload_asset(app,{'base64':base64.b64encode(raw).decode()})

    def test_sequence_order_dedup_and_stop(self):
        with tempfile.TemporaryDirectory() as d:
            events=[];app=self.make_app(d,events)
            self.macro(app,[{'kind':'press','key':'ALT'},{'kind':'shortcut','keys':'TAB'},{'kind':'wait','ms':50},{'kind':'shortcut','keys':'TAB'},{'kind':'release','key':'ALT'},{'kind':'text','text':'完了'}])
            action={'action':'execute','id':'0','owner':'macro'};app.action(action)
            self.wait_done(app)
            self.assertEqual(events,[('key','ALT',False),('key','TAB',False),('key','TAB',True),('key','TAB',False),('key','TAB',True),('key','ALT',True),('text','完了')])
            app.action(action);self.assertEqual(len(events),7)
            self.macro(app,[{'kind':'press','key':'CTRL'},{'kind':'wait','ms':10000},{'kind':'release','key':'CTRL'},{'kind':'text','text':'must not run'}])
            app.action(dict(action,owner='cancel'));time.sleep(.02)
            with self.assertRaises(ValueError):app.action({'action':'key_tap','key':'A','owner':'normal'})
            app.action({'action':'macro_cancel','owner':'stop'});self.wait_done(app)
            self.assertFalse(app.keyboard.held);self.assertEqual(events[-1],('key','CTRL',True));self.assertNotIn(('text','must not run'),events)

    def test_watchdog_and_edit_cancel(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d)
            self.macro(app,[{'kind':'press','key':'SHIFT'},{'kind':'wait','ms':10000}])
            app.action({'action':'execute','id':'0','owner':'timeout'});time.sleep(.02)
            with app.lock:app.features.job['seen']-=3;app.features.tick()
            self.wait_done(app);self.assertFalse(app.keyboard.held)
            app.action({'action':'execute','id':'0','owner':'edit'});time.sleep(.02)
            config=copy.deepcopy(app.config);config['layouts'][0]['buttons'][0]['label']='rename';app.save(config)
            self.assertTrue(app.features.running)
            config=copy.deepcopy(app.config);config['layouts'][0]['buttons'][0]['steps']=[{'kind':'wait','ms':1}];app.save(config)
            self.wait_done(app);self.assertFalse(app.keyboard.held)

    def test_invalid_steps(self):
        for steps in ([],[{'kind':'shell'}],[{'kind':'wait','ms':True}],[{'kind':'wait','ms':10001}],[{'kind':'press','key':'CTRL'},{'kind':'text','text':'x'}],[{'kind':'shortcut','keys':'BOGUS'}]):
            with self.assertRaises(ValueError):features.validate_steps(steps,server.parse_keys)

    def test_cancel_before_delayed_execute(self):
        with tempfile.TemporaryDirectory() as d:
            events=[];app=self.make_app(d,events)
            self.macro(app,[{'kind':'text','text':'must not run'}])
            app.action({'action':'macro_cancel','owner':'cancel','targetOwner':'late'})
            app.action({'action':'execute','owner':'late','id':'0'})
            self.assertFalse(app.features.running);self.assertEqual(events,[])

    def test_static_build_is_immutable_while_running(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d)
            http=ThreadingHTTPServer(('127.0.0.1',0),server.handler(app))
            threading.Thread(target=http.serve_forever,daemon=True).start()
            try:
                with patch.object(Path,'read_bytes',return_value=b'unfinished edit'):
                    for name in ('operator.js','extras.js','editor-extras.js'):
                        with urlopen(f'http://127.0.0.1:{http.server_port}/{name}') as response:
                            self.assertEqual(response.read(),app.web_assets[name])
            finally:http.shutdown();http.server_close()

    @unittest.skipUnless(sys.platform == 'win32', 'Windows GUI launcher only')
    def test_gui_launcher_native_pipes(self):
        from build_chrome import build
        executable=build();binary=executable.read_bytes()
        pe=struct.unpack_from('<I',binary,0x3c)[0]
        self.assertEqual(struct.unpack_from('<H',binary,pe+24+68)[0],2) # Windows GUI subsystem
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);shutil.copy2(executable,root/'chrome_launcher.exe');shutil.copy2(Path(__file__).parent/'chrome_host.py',root/'chrome_host.py')
            (root/'chrome-python.txt').write_text(sys.executable,encoding='utf-8')
            process=subprocess.Popen([str(root/'chrome_launcher.exe')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW)
            try:
                chrome_host.write_message(process.stdin,{'action':'register','id':'fixture','name':'Fixture'})
                replies=[];thread=threading.Thread(target=lambda:replies.append(chrome_host.read_message(process.stdout)),daemon=True);thread.start();thread.join(5)
                self.assertFalse(thread.is_alive(),'GUI launcher must forward native-message pipes')
                self.assertIn('status',replies[0])
            finally:
                process.stdin.close()
                try:process.wait(timeout=3)
                except subprocess.TimeoutExpired:process.kill();process.wait()
                process.stdout.close();process.stderr.close()

    def test_profile_bridge_ack_offline_and_persistence(self):
        with tempfile.TemporaryDirectory() as d:
            app=self.make_app(d);runtime=app.features
            runtime.bridge({'id':'work','name':'仕事用','results':[]})
            runtime.bridge({'id':'personal','name':'個人用','results':[]})
            errors=[]
            def focus():
                try:runtime.focus('work',threading.Event())
                except Exception as e:errors.append(e)
            thread=threading.Thread(target=focus);thread.start();time.sleep(.02)
            self.assertEqual(runtime.bridge({'id':'personal','name':'個人用'})['commands'],[])
            commands=runtime.bridge({'id':'work','name':'仕事用'})['commands'];self.assertEqual(len(commands),1)
            self.assertEqual(runtime.bridge({'id':'work','name':'仕事用'})['commands'],[])
            runtime.bridge({'id':'work','name':'仕事用','results':[{'id':commands[0]['id'],'ok':True}]});thread.join(1)
            self.assertFalse(thread.is_alive());self.assertFalse(errors)
            restored=self.make_app(d).features.profile_list();self.assertEqual(len(restored),2);self.assertTrue(all(not p['online'] for p in restored))
            with self.assertRaises(ValueError):runtime.focus('missing',threading.Event())

    def test_native_framing_and_installer_dry_data(self):
        stream=io.BytesIO();data={'name':'仕事用'};chrome_host.write_message(stream,data);stream.seek(0);self.assertEqual(chrome_host.read_message(stream),data)
        with self.assertRaises(ValueError):chrome_host.read_message(io.BytesIO(b'\x05\x00\x00\x00xx'))
        self.assertEqual(install_chrome.manifest('a'*32)['allowed_origins'],['chrome-extension://'+'a'*32+'/'])
        with self.assertRaises(ValueError):install_chrome.manifest('invalid')

if __name__=='__main__':unittest.main()
