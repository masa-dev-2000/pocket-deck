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


class Features(unittest.TestCase):
    def make_app(self, directory, events=None):
        events = [] if events is None else events
        return server.App(Path(directory)/'config.json',server.Keyboard(lambda k,u:events.append(('key',k,u))),lambda t:events.append(('text',t)),lambda *args:events.append(('mouse',*args)))

    def macro(self, app, steps):
        config=copy.deepcopy(app.config)
        config['layouts'][0]['buttons'][0].update(type='macro',steps=steps)
        app.save(config)

    def wait_done(self, app):
        until=time.monotonic()+3
        while app.features.running and time.monotonic()<until:time.sleep(.005)
        self.assertFalse(app.features.running)

    def test_v4_migration_and_layout_validation(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json';original=server.defaults();path.write_text(json.dumps(original),'utf-8')
            app=self.make_app(d)
            self.assertEqual(app.config['layouts'][0]['buttons'],original['buttons'])
            self.assertEqual(len(list(Path(d).glob('*.pre-v4-*.bak'))),1)
            self.assertEqual(self.make_app(d).config,app.config)
            config=copy.deepcopy(app.config);config['layouts'].append(copy.deepcopy(config['layouts'][0]))
            with self.assertRaises(ValueError):app.save(config)
            config['layouts'][1]['id']='second'
            with self.assertRaises(ValueError):app.save(config) # duplicate button IDs
            config['layouts'][1]['buttons']=[]
            config['layouts'][0]['buttons'][0].update(type='navigate',target='layout',layoutId='second')
            saved=app.save(config);saved['layouts'].pop()
            with self.assertRaises(ValueError):app.save(saved)
            with self.assertRaises(ValueError):app.save(original) # stale v3 client cannot overwrite v4

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
