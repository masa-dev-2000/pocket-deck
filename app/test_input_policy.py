import tempfile
import unittest
from pathlib import Path
import server
import input_policy

class PermissionTests(unittest.TestCase):
    def test_capabilities_are_independent_and_macro_preflight_is_complete(self):
        state={'keyboard':True,'pointer':False,'text':False}
        input_policy.require(state,{'keyboard'})
        with self.assertRaises(ValueError):input_policy.require(state,{'pointer'})
        button={'type':'macro','steps':[{'kind':'shortcut'},{'kind':'text'}]}
        self.assertEqual(input_policy.requirements(button),{'keyboard','text'})
        self.assertEqual(input_policy.requirements({'type':'macro','steps':[{'kind':'click'}]}),{'pointer'})
        self.assertEqual(input_policy.requirements({'type':'profile'}),set())
    def test_server_rejects_input_before_emit_but_allows_cleanup(self):
        events=[]
        with tempfile.TemporaryDirectory() as data:
            app=server.App(Path(data)/'config.json',server.Keyboard(lambda *args:events.append(args)),mouse_emit=lambda *args:events.append(args),input_status=lambda:{'keyboard':False,'pointer':False,'text':False})
            for action in [{'action':'key_down','key':'A'},{'action':'mouse_move','dx':1,'dy':1},{'action':'down','id':app.config['layouts'][0]['buttons'][0]['id']}]:
                with self.assertRaises(ValueError):app.action({**action,'owner':'test'})
            self.assertEqual(events,[])
            app.action({'action':'up','owner':'test'})
            app.action({'action':'mouse_up','owner':'test'})
