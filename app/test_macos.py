import sys
import unittest
from unittest.mock import patch
from input_backend.macos import MacInput,QuartzAPI,KEYCODES,MODIFIER_FLAGS


class FakeQuartz:
    def __init__(self):self.allowed=False;self.events=[];self.requests=0;self.failure=None
    def trusted(self):return self.allowed
    def request_access(self):self.requests+=1;return False
    def _record(self,event):
        if self.failure==event[0]:raise RuntimeError('native event failure')
        self.events.append(event)
    def key(self,code,up,flags,repeat):self._record(('key',code,up,flags,repeat))
    def mouse(self,kind,dx,dy,dragging,flags):self._record((kind,dx,dy,dragging,flags))
    def scroll(self,dx,dy,flags):self._record(('scroll',dx,dy,flags))
    def close(self):self._record(('close',))


class MacLifecycle(unittest.TestCase):
    def setUp(self):self.api=FakeQuartz();self.backend=MacInput(self.api)

    def test_permission_request_is_not_a_grant_and_never_sends_input(self):
        self.assertEqual(self.backend.status()['state'],'permission')
        self.assertEqual(self.backend.enable()['state'],'permission')
        self.assertEqual(self.api.requests,1)
        with self.assertRaisesRegex(RuntimeError,'許可'):self.backend.send_key('A',False)
        with self.assertRaises(RuntimeError):self.backend.send_mouse('mouse_move',20,10)
        self.assertEqual(self.api.events,[])
        self.api.allowed=True;self.assertEqual(self.backend.status()['state'],'ready')

    def test_command_chord_repeats_and_releases_modifiers_with_correct_flags(self):
        self.api.allowed=True
        for key,up in [('SUPER',False),('C',False),('C',False),('C',True),('SUPER',True)]:
            self.backend.send_key(key,up)
        self.assertEqual(self.api.events,[('key',55,False,1<<20,False),('key',8,False,1<<20,False),
            ('key',8,False,1<<20,True),('key',8,True,1<<20,False),('key',55,True,0,False)])
        self.assertFalse(self.backend.held_keys)

    def test_drag_motion_is_preserved_until_release_and_failed_release_can_retry(self):
        self.api.allowed=True;self.backend.send_mouse('mouse_down')
        self.backend.send_mouse('mouse_move',17,-8)
        self.assertEqual(self.api.events[-1],('mouse_move',17,-8,True,0))
        self.api.failure='mouse_up'
        with self.assertRaises(RuntimeError):self.backend.send_mouse('mouse_up')
        self.assertTrue(self.backend.button_held)
        self.api.failure=None;self.backend.send_mouse('mouse_up');self.backend.send_mouse('mouse_move',1,2)
        self.assertEqual(self.api.events[-1],('mouse_move',1,2,False,0))

    def test_subpixel_scroll_accumulates_and_horizontal_direction_is_wire_direction(self):
        self.api.allowed=True
        for _ in range(4):self.backend.send_mouse('mouse_scroll',1,-1)
        self.assertEqual(self.api.events,[('scroll',1,-1,0)])
        self.backend.send_mouse('mouse_scroll',120,120)
        self.assertEqual(self.api.events[-1],('scroll',30,30,0))

    def test_revoked_permission_keeps_unconfirmed_holds_and_recovers_for_release(self):
        self.api.allowed=True;self.backend.send_key('SHIFT',False);self.backend.send_mouse('mouse_down')
        self.api.allowed=False
        with self.assertRaises(RuntimeError):self.backend.close()
        self.assertEqual(self.backend.held_keys,{'SHIFT'});self.assertTrue(self.backend.button_held)
        self.api.allowed=True;self.backend.close()
        self.assertFalse(self.backend.held_keys);self.assertFalse(self.backend.button_held)
        self.assertEqual(self.api.events[-1],('close',))

    def test_unicode_clipboard_and_terminal_both_use_command_v_with_cleanup(self):
        from input_backend import text
        self.api.allowed=True
        with patch.object(text,'_clipboard') as clipboard:
            self.backend.send_text('日本語🙂\r\n完了',paste_mode='terminal')
            clipboard.assert_called_once_with('日本語🙂\n完了')
        self.assertEqual(self.api.events,[('key',55,False,1<<20,False),('key',9,False,1<<20,False),
            ('key',9,True,1<<20,False),('key',55,True,0,False)])
        self.assertFalse(self.backend.held_keys)

    def test_unsupported_key_does_not_generate_an_unrelated_event(self):
        self.api.allowed=True
        for key in ['F21','F24','MUTE','PLAYPAUSE']:
            with self.assertRaisesRegex(RuntimeError,'対応'):self.backend.send_key(key,False)
        self.assertEqual(self.api.events,[])

    def test_manual_release_recovers_failed_direct_click_without_closing_backend(self):
        self.api.allowed=True;self.api.failure='mouse_up'
        with self.assertRaises(RuntimeError):self.backend.send_mouse('mouse_click')
        self.assertTrue(self.backend.button_held)
        self.api.failure=None;self.backend.release_all()
        self.assertFalse(self.backend.button_held);self.assertFalse(self.backend.closed)
        self.backend.send_key('A',False);self.backend.release_all()
        self.assertFalse(self.backend.held_keys)

    def test_macos_defaults_use_command_without_rewriting_existing_configs(self):
        import server
        original=server.defaults()
        with patch.object(server.sys,'platform','darwin'):
            defaults=server.defaults()
            self.assertEqual(defaults['buttons'][2]['keys'],'Win+C')
            self.assertEqual(defaults['buttons'][1]['keys'],'Win+Shift+Z')
            self.assertEqual(next(k for k in server.key_catalog() if k['key']=='WIN')['label'],'Cmd')
            self.assertEqual(server.parse_keys('Cmd+Option+Z'),['SUPER','ALT','Z'])
            import features
            features.validate_steps([{'kind':'press','key':'Cmd'},{'kind':'release','key':'Win'},
                                     {'kind':'text','text':'released'}],server.parse_keys)
            self.assertEqual(server.migrate(original)['layouts'][0]['buttons'][2]['keys'],original['buttons'][2]['keys'])


@unittest.skipUnless(sys.platform=='darwin','native macOS ABI check; never posts input')
class NativeQuartz(unittest.TestCase):
    def test_real_frameworks_allocate_events_with_correct_types_and_fields(self):
        import ctypes as C
        api=QuartzAPI();cg=api.cg
        cg.CGEventGetType.argtypes=[C.c_void_p];cg.CGEventGetType.restype=C.c_uint32
        cg.CGEventGetFlags.argtypes=[C.c_void_p];cg.CGEventGetFlags.restype=C.c_uint64
        cg.CGEventGetIntegerValueField.argtypes=[C.c_void_p,C.c_uint32];cg.CGEventGetIntegerValueField.restype=C.c_int64
        captured=[]
        def inspect(_tap,event):
            captured.append((cg.CGEventGetType(event),cg.CGEventGetFlags(event),
                             cg.CGEventGetIntegerValueField(event,8),cg.CGEventGetIntegerValueField(event,4)))
        try:
            with patch.object(cg,'CGEventPost',side_effect=inspect):
                api.key(KEYCODES['A'],False,MODIFIER_FLAGS['SUPER'],True)
                api.mouse('mouse_move',13,-7,True,0)
                api.scroll(30,-30,0)
            self.assertEqual(captured[0],(10,1<<20,1,0))
            self.assertEqual(captured[1][0],6);self.assertEqual(captured[1][3],13)
            self.assertEqual(captured[2][0],22)
            self.assertIsInstance(api.trusted(),bool)
        finally:api.close()


if __name__=='__main__':unittest.main()
