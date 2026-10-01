import os
import unittest
from unittest.mock import patch
import server
from input_backend import create_backend, UnsupportedInput
from input_backend.windows import WindowsInput
from input_backend import windows

class InputBackends(unittest.TestCase):
    def test_saved_key_names_are_portable(self):
        self.assertEqual(server.parse_keys('Ctrl+Win+F13'), ['CTRL','SUPER','F13'])
        self.assertEqual(server.parse_keys('Ctrl+Ctrl+A'), ['CTRL','A'])
        with patch.object(windows,'send_key') as emit:
            backend=WindowsInput()
            backend.send_key('SUPER',False);backend.send_key('F13',True)
            self.assertEqual([c.args for c in emit.call_args_list],[(0x5b,False,True),(0x7c,True,False)])

    def test_unknown_platform_reports_failure_instead_of_silent_success(self):
        backend=create_backend('test-os')
        self.assertEqual(backend.status()['state'],'unsupported')
        for method,args in [('send_key',('A',False)),('send_mouse',('mouse_click',)),('send_text',('hello',))]:
            with self.assertRaises(RuntimeError):getattr(backend,method)(*args)

    def test_linux_terminal_setting_keeps_windows_unicode_input(self):
        with patch.object(windows,'send_text') as text,patch.object(windows,'send_key') as keys:
            backend=WindowsInput()
            backend.send_text('日本語\n🙂',paste_mode='terminal')
            text.assert_called_once_with('日本語\n🙂');keys.assert_not_called()
            with self.assertRaises(ValueError):backend.send_text('never send',paste_mode='shell')
            self.assertEqual(text.call_count,1)

    def test_wayland_does_not_fall_back_to_xwayland(self):
        with patch.dict(os.environ, {'WAYLAND_DISPLAY':'wayland-test','DISPLAY':':999'},clear=True):
            with patch('input_backend.x11.X11Input') as x11:
                backend=create_backend('linux')
                self.assertNotEqual(backend.status()['backend'],'xtest')
                x11.assert_not_called()
                backend.close()

    def test_failed_release_keeps_remaining_keys_and_stops_released_key_repeat(self):
        attempts=[]
        def emit(key,up):
            attempts.append((key,up))
            if (key,up)==('CTRL',True) and attempts.count(('CTRL',True))==1:
                raise RuntimeError('temporary failure')
        keyboard=server.Keyboard(emit)
        keyboard.press('owner',['CTRL','A'])
        with self.assertRaises(RuntimeError):keyboard.release('owner')
        self.assertEqual(keyboard.held['owner'][0],['CTRL'])
        self.assertIsNone(keyboard.repeat_key)
        keyboard.release_all()
        self.assertFalse(keyboard.held)
        self.assertEqual(attempts.count(('A',True)),1)
        self.assertEqual(attempts.count(('CTRL',True)),2)

if __name__ == '__main__': unittest.main()
