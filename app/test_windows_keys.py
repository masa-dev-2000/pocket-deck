import unittest
from unittest.mock import patch

import server
from input_backend import windows
from input_backend.keys import WINDOWS_ONLY


class WindowsKeysTests(unittest.TestCase):
    def test_catalog_and_saved_identifiers(self):
        with patch.object(server.sys, 'platform', 'win32'):
            catalog = {item['key']: item for item in server.key_catalog()}
        self.assertTrue(WINDOWS_ONLY <= catalog.keys())
        for key in ('NUMLOCK', 'OEM_PERIOD', 'OEM_COMMA', 'OEM_2', 'NUMPADADD'):
            self.assertEqual(server.parse_keys(key), [key])
            self.assertTrue(catalog[key]['label'])
            self.assertTrue(catalog[key]['search'])
        self.assertEqual(server.parse_keys('Ctrl+Z'), ['CTRL', 'Z'])
        with patch.object(server.sys, 'platform', 'linux'):
            self.assertFalse(WINDOWS_ONLY & {item['key'] for item in server.key_catalog()})

    def test_windows_codes_and_extended_key(self):
        self.assertEqual(windows.KEYS['NUMLOCK'], 0x90)
        self.assertEqual(windows.KEYS['OEM_PERIOD'], 0xbe)
        self.assertEqual(windows.KEYS['OEM_COMMA'], 0xbc)
        self.assertEqual(windows.KEYS['OEM_2'], 0xbf)
        self.assertEqual(windows.KEYS['NUMPADADD'], 0x6b)
        sent = []
        with patch.object(windows, 'send_key', side_effect=lambda *args: sent.append(args)):
            backend = windows.WindowsInput()
            for key in ('NUMPADENTER', 'NUMPADDIVIDE', 'OEM_PERIOD'):
                backend.send_key(key, False)
                backend.send_key(key, True)
        self.assertEqual(sent, [(13, False, True), (13, True, True),
                                (0x6f, False, True), (0x6f, True, True),
                                (0xbe, False, False), (0xbe, True, False)])

    def test_lock_keys_do_not_repeat(self):
        sent = []
        keyboard = server.Keyboard(lambda key, up: sent.append((key, up)))
        keyboard.press('owner', ['NUMLOCK'])
        keyboard.repeat_at = 0
        keyboard.repeat()
        keyboard.release('owner')
        self.assertEqual(sent, [('NUMLOCK', False), ('NUMLOCK', True)])


if __name__ == '__main__':
    unittest.main()
