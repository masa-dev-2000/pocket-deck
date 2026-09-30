import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import server
from input_backend import windows as windows_input

def test_app(*args,**kwargs):
    kwargs.setdefault('input_status',lambda:{'keyboard':True,'pointer':True,'text':True,'state':'ready'})
    return server.App(*args,**kwargs)

class Tests(unittest.TestCase):
    def test_wheel_configuration_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json'
            app=test_app(path,server.Keyboard(lambda *args:None))
            config=json.loads(json.dumps(app.config))
            button=config['layouts'][0]['buttons'][0]
            button.update(type='wheel',width=1,height=1,label='Wheel')
            saved=app.save(config)
            self.assertEqual(test_app(path,app.keyboard).config,saved)
            with self.assertRaises(ValueError):
                app.action({'action':'down','id':button['id'],'owner':'wheel'})

    def test_shared_modifier_and_timeout(self):
        events=[]
        k=server.Keyboard(lambda key,up:events.append((key,up)))
        k.press('one',['CTRL']); k.press('two',['CTRL','Z']); k.release('two')
        self.assertEqual(events,[('CTRL',False),('Z',False),('Z',True)])
        k.held['one'][1]=time.monotonic()-3
        k.expire()
        self.assertEqual(events[-1],('CTRL',True))
        self.assertFalse(k.held)

    def test_migration_slots_conflict_and_hold_preservation(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'config.json'
            old={'columns':3,'buttons':[{'id':'a','label':'A','keys':'A','mode':'tap','color':'#123456'}]}
            path.write_text(json.dumps(old),'utf-8')
            events=[]
            app=test_app(path,server.Keyboard(lambda k,u:events.append((k,u))))
            self.assertEqual(app.config['layouts'][0]['rows'],1)
            self.assertEqual(app.config['layouts'][0]['buttons'][0]['slot'],0)
            self.assertEqual(len(list(Path(d).glob('*.bak'))),1)
            app.action({'action':'down','id':'a','owner':'held'})
            c=json.loads(json.dumps(app.config));c['layouts'][0]['buttons'][0]['label']='Renamed'
            saved=app.save(c)
            self.assertIn('held',app.keyboard.held)
            with self.assertRaises(server.Conflict):app.save(c)
            saved['layouts'][0]['buttons'][0]['keys']='B';app.save(saved)
            self.assertFalse(app.keyboard.held)
            invalid=json.loads(json.dumps(app.config));invalid['layouts'][0]['buttons'][0]['slot']=99
            with self.assertRaises(ValueError):app.save(invalid)
            self.assertEqual(test_app(path,app.keyboard).config,app.config)

    def test_repeat_text_dedup_and_release(self):
        with tempfile.TemporaryDirectory() as d:
            events=[];texts=[]
            keyboard=server.Keyboard(lambda k,u:events.append((k,u)))
            app=test_app(Path(d)/'config.json',keyboard,texts.append)
            c=server.defaults();c['buttons'][0]={'id':'text','label':'定型文','type':'text','text':'日本語\n😀','slot':0,'width':1,'height':1,'color':'#123456'}
            app.save(server.migrate(c))
            data={'action':'text','id':'text','owner':'once'}
            app.action(data);app.action(data)
            self.assertEqual(texts,['日本語\n😀'])
            keyboard.press('held',['CTRL','A']);keyboard.repeat_at=0;keyboard.repeat()
            self.assertEqual(events[-1],('A',False))
            with self.assertRaises(ValueError):app.action(dict(data,owner='blocked'))
            keyboard.release('held');size=len(events);keyboard.repeat_at=0;keyboard.repeat()
            self.assertEqual(len(events),size)
            keyboard.press('modifier',['CTRL']);keyboard.repeat_at=0;size=len(events);keyboard.repeat()
            self.assertEqual(len(events),size)

    def test_unicode_event_encoding(self):
        captured=[]
        class Emit:
            def __call__(self,count,items,size):
                captured.extend((items[i].ki.wVk,items[i].ki.wScan,items[i].ki.dwFlags) for i in range(count))
                return count
        class User32:SendInput=Emit()
        with patch.object(windows_input.C,'WinDLL',return_value=User32(),create=True):
            windows_input.send_text('日😀\n\t')
        self.assertEqual(captured[:6],[(0,ord('日'),4),(0,ord('日'),6),(0,0xD83D,4),(0,0xD83D,6),(0,0xDE00,4),(0,0xDE00,6)])
        self.assertEqual(captured[6:],[(13,0,0),(13,0,2),(9,0,0),(9,0,2)])

    def test_keyboard_panel_and_mouse_actions(self):
        with tempfile.TemporaryDirectory() as d:
            keys=[];mouse=[]
            app=test_app(Path(d)/'config.json',server.Keyboard(lambda k,u:keys.append((k,u))),mouse_emit=lambda *args:mouse.append(args))
            app.action({'action':'key_down','key':'SHIFT','owner':'shift'})
            app.action({'action':'key_down','key':'A','owner':'letter'})
            app.action({'action':'up','owner':'letter'})
            app.action({'action':'release_all'})
            self.assertEqual(keys,[('SHIFT',False),('A',False),('A',True),('SHIFT',True)])
            app.action({'action':'key_tap','key':'ENTER','owner':'enter'})
            self.assertEqual(keys[-2:],[('ENTER',False),('ENTER',True)])
            for key in ('BOGUS','Ctrl+A',None):
                with self.assertRaises(ValueError):app.action({'action':'key_down','key':key,'owner':'invalid'})
            app.action({'action':'mouse_move','dx':15,'dy':-7,'owner':'move'})
            app.action({'action':'mouse_click','owner':'click'})
            app.action({'action':'mouse_click','owner':'click'})
            self.assertEqual(mouse,[('mouse_move',15,-7),('mouse_click',0,0)])
            for dx in (2049,1.5,True,'3'):
                with self.assertRaises(ValueError):app.action({'action':'mouse_move','dx':dx,'dy':0,'owner':'invalid-mouse'})
            self.assertEqual(len(mouse),2)

    def test_mouse_event_encoding(self):
        captured=[]
        class Emit:
            def __call__(self,count,items,size):
                captured.extend((items[i].mi.dx,items[i].mi.dy,items[i].mi.dwFlags) for i in range(count))
                return count
        class User32:SendInput=Emit()
        with patch.object(windows_input.C,'WinDLL',return_value=User32(),create=True):
            windows_input.send_mouse('mouse_move',12,-4)
            windows_input.send_mouse('mouse_click')
        self.assertEqual(captured,[(12,-4,1),(0,0,2),(0,0,4)])

    def test_span_migration_overlap_and_navigation(self):
        old=server.defaults();old['version']=2
        for b in old['buttons']:b.pop('width');b.pop('height')
        new=server.migrate(old)
        self.assertEqual(new['version'],4)
        self.assertTrue(all(b['width']==b['height']==1 for b in new['layouts'][0]['buttons']))
        new['layouts'][0]['buttons'][0]['width']=2
        with self.assertRaises(ValueError):server.validate(new)
        new['layouts'][0]['buttons']=new['layouts'][0]['buttons'][:1]
        new['layouts'][0]['buttons'][0].update(type='navigate',target='keyboard')
        server.validate(new)
        new['layouts'][0]['buttons'][0]['slot']=2
        with self.assertRaises(ValueError):server.validate(new)
        with tempfile.TemporaryDirectory() as d:
            app=test_app(Path(d)/'config.json',server.Keyboard(lambda *_:None))
            new['layouts'][0]['buttons'][0]['slot']=0;app.save(new)
            with self.assertRaises(ValueError):app.action({'action':'tap','id':'0','owner':'navigation'})

    def test_embedded_touchpad(self):
        with tempfile.TemporaryDirectory() as d:
            app=test_app(Path(d)/'config.json',server.Keyboard(lambda *_:None))
            config=server.defaults()
            config.update(columns=6,rows=6,buttons=[dict(id='pad',label='Pad',type='touchpad',slot=0,width=4,height=4,color='#234567')])
            app.save(server.migrate(config))
            self.assertEqual(test_app(app.path,app.keyboard).config['layouts'][0]['buttons'][0]['type'],'touchpad')
            for action in ('tap','down','text'):
                with self.assertRaises(ValueError):app.action(dict(action=action,id='pad',owner=action))

    def test_mouse_hold_timeout_and_late_down(self):
        emitted=[]
        with tempfile.TemporaryDirectory() as d:
            app=test_app(Path(d)/'config.json',server.Keyboard(lambda *_:None),mouse_emit=lambda *a:emitted.append(a))
            app.action({'action':'mouse_up','owner':'early'})
            app.action({'action':'mouse_down','owner':'early'})
            self.assertEqual(emitted,[])
            app.action({'action':'mouse_down','owner':'drag'})
            app.action({'action':'mouse_down','owner':'drag'})
            self.assertEqual(emitted,[('mouse_down',0,0)])
            app.mouse.held['drag']=time.monotonic()-3
            app.mouse.expire()
            self.assertEqual(emitted[-1],('mouse_up',0,0))
            app.action({'action':'mouse_down','owner':'drag'})
            self.assertFalse(app.mouse.held)
            app.action({'action':'mouse_down','owner':'next'})
            app.action({'action':'release_all'})
            self.assertFalse(app.mouse.held)
            app.action({'action':'mouse_scroll','dx':-120,'dy':120,'owner':'scroll'})
            self.assertEqual(emitted[-1],('mouse_scroll',-120,120))

    def test_http_persistence_and_actions(self):
        with tempfile.TemporaryDirectory() as d:
            events=[]
            app=test_app(Path(d)/'config.json',server.Keyboard(lambda key,up:events.append((key,up))))
            http=ThreadingHTTPServer(('127.0.0.1',0),server.handler(app))
            threading.Thread(target=http.serve_forever,daemon=True).start()
            base=f'http://127.0.0.1:{http.server_port}'
            def post(path,data):
                return urlopen(Request(base+path,json.dumps(data).encode(),{'Content-Type':'application/json'}))
            try:
                with urlopen(base+'/api/keys') as r:
                    catalog = json.load(r)
                expected=set(server.KEYS)
                if server.sys.platform=='darwin':expected-= {'F21','F22','F23','F24','VOLUMEUP','VOLUMEDOWN','MUTE','PLAYPAUSE'}
                self.assertEqual({k['key'] for k in catalog},expected)
                for k in catalog:
                    server.parse_keys(k['label'])
                for path, script in [('/', 'operator.js'), ('/editor', 'editor.js'), ('/connect', 'connect.js')]:
                    with urlopen(base+path) as r:
                        html = r.read().decode('utf-8')
                        self.assertIn(script, html)
                        if path != '/':
                            self.assertNotIn('operator.js', html)
                with urlopen(base+'/editor.js') as r:
                    self.assertNotIn("api('action'", r.read().decode('utf-8'))
                with urlopen(base+'/connect.svg') as r:
                    self.assertIn(b'<svg', r.read())
                with post('/api/action',{'action':'tap','id':'0','owner':'test'}) as r:
                    self.assertEqual(r.status,200)
                modifier='SUPER' if server.sys.platform=='darwin' else 'CTRL'
                self.assertEqual(events,[(modifier,False),('Z',False),('Z',True),(modifier,True)])
                config=server.defaults();config['columns']=5
                with post('/api/config',server.migrate(config)):pass
                self.assertEqual(test_app(app.path,app.keyboard).config['layouts'][0]['columns'],5)
                config['buttons'][0]['keys']='bogus'
                with self.assertRaises((HTTPError,ValueError)):post('/api/config',server.migrate(config))
                self.assertEqual(app.config['layouts'][0]['buttons'][0]['keys'],'Win+Z' if server.sys.platform=='darwin' else 'Ctrl+Z')
                with self.assertRaises(HTTPError):post('/api/action',{'action':'tap','id':'missing','owner':'missing'})
            finally:
                http.shutdown();http.server_close()

if __name__=='__main__':unittest.main()
