import io
import json
import threading
import time
import unittest
from desktop_bridge import DesktopBridge
from input_backend.text import paste,set_clipboard_provider

class DesktopText(unittest.TestCase):
    def tearDown(self):set_clipboard_provider(None)
    def test_unicode_requires_matching_ack_and_preserves_newlines(self):
        output=io.StringIO();bridge=DesktopBridge(output);errors=[]
        def write():
            try:bridge.clipboard('日本語\n😀')
            except Exception as error:errors.append(error)
        thread=threading.Thread(target=write);thread.start()
        for _ in range(100):
            if output.getvalue():break
            time.sleep(.01)
        request=json.loads(output.getvalue());self.assertEqual(request['text'],'日本語\n😀')
        bridge.receive(json.dumps({'deck':'clipboard-result','id':[],'ok':True}))
        bridge.receive(json.dumps({'deck':'clipboard-result','id':'unknown','ok':True}))
        self.assertTrue(thread.is_alive())
        bridge.receive(json.dumps({'deck':'clipboard-result','id':request['id'],'ok':True}))
        thread.join(1);self.assertFalse(thread.is_alive());self.assertEqual(errors,[])
        self.assertFalse(bridge.pending)

    def test_parent_exit_unblocks_request_without_retry(self):
        output=io.StringIO();bridge=DesktopBridge(output);errors=[]
        def write():
            try:bridge.clipboard('once')
            except Exception as error:errors.append(error)
        thread=threading.Thread(target=write);thread.start()
        for _ in range(100):
            if output.getvalue():break
            time.sleep(.01)
        bridge.close();thread.join(1)
        self.assertEqual(len(errors),1);self.assertEqual(len(output.getvalue().splitlines()),1)
        self.assertFalse(bridge.pending)

    def test_paste_prepares_clipboard_before_keys_and_releases_after_failure(self):
        events=[]
        class Input:
            def status(self):return {'keyboard':True}
            def send_key(self,key,up):
                events.append((key,up))
                if key=='V' and not up:raise RuntimeError('failed')
        set_clipboard_provider(lambda text:events.append(('clipboard',text)))
        with self.assertRaises(RuntimeError):paste(Input(),'日本語\r\n😀')
        self.assertEqual(events,[('clipboard','日本語\n😀'),('CTRL',False),('V',False),('CTRL',True)])

if __name__=='__main__':unittest.main()
