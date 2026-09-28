"""Real private D-Bus transport, simulated portal; does not prove compositor input."""
import asyncio
import os
import sys
import threading
import time
import unittest
from unittest.mock import patch

@unittest.skipUnless(sys.platform == 'linux' and os.environ.get('DBUS_SESSION_BUS_ADDRESS'),
                     'run under an isolated dbus-run-session on Linux')
class PortalWire(unittest.TestCase):
    def setUp(self):
        self.environment=patch.dict(os.environ,{'DISPLAY':''});self.environment.start();self.addCleanup(self.environment.stop)
        from dbus_next import Message, MessageType, Variant
        from input_backend.portal import SERVICE, PATH, INTERFACE, PortalInput, ManagedMessageBus as MessageBus
        self.Message,self.Type,self.Variant=Message,MessageType,Variant
        self.service,self.path,self.interface=SERVICE,PATH,INTERFACE
        self.calls=[];self.sessions=[];self.reject=False;self.devices=3;self.clipboard=False
        self.closed=0;self.loop=asyncio.new_event_loop();self.started=threading.Event()
        def handler(message):
            if message.message_type != MessageType.METHOD_CALL:return
            if message.interface == 'org.freedesktop.DBus.Properties':
                if message.member == 'GetAll':
                    if message.body==['org.freedesktop.portal.Clipboard']:
                        return Message.new_method_return(message,'a{sv}',[{'version':Variant('u',1 if self.clipboard else 0)}])
                    return Message.new_method_return(message,'a{sv}',[{
                        'version':Variant('u',1),'AvailableDeviceTypes':Variant('u',3)}])
            if message.interface == INTERFACE:
                self.calls.append((message.member,message.body))
                if message.member in ('CreateSession','SelectDevices','Start'):
                    options=message.body[-1];sender=message.sender.lstrip(':').replace('.','_')
                    request=PATH+'/request/'+sender+'/'+options['handle_token'].value
                    results={}
                    if message.member == 'CreateSession':
                        session=PATH+'/session/'+sender+'/'+options['session_handle_token'].value
                        self.sessions.append(session);results={'session_handle':Variant('s',session)}
                    elif message.member == 'Start':results={'devices':Variant('u',self.devices),'clipboard_enabled':Variant('b',self.clipboard)}
                    response=1 if self.reject and message.member == 'Start' else 0
                    # Reply signal before method return deliberately exercises the request race.
                    self.bus.send(Message(path=request,interface='org.freedesktop.portal.Request',
                        member='Response',message_type=MessageType.SIGNAL,signature='ua{sv}',body=[response,results]))
                    return Message.new_method_return(message,'o',[request])
                return Message.new_method_return(message)
            if message.interface == 'org.freedesktop.portal.Clipboard':
                self.calls.append((message.member,message.body))
                return Message.new_method_return(message)
            if message.interface == 'org.freedesktop.portal.Session' and message.member == 'Close':
                self.closed+=1
                return Message.new_method_return(message)
        async def start():
            self.bus=await MessageBus().connect();self.bus.add_message_handler(handler)
            await self.bus.request_name(SERVICE);self.started.set()
        def run():
            asyncio.set_event_loop(self.loop);self.loop.run_until_complete(start());self.loop.run_forever()
            self.loop.close()
        self.thread=threading.Thread(target=run,daemon=True);self.thread.start()
        self.assertTrue(self.started.wait(5))
        self.input=PortalInput();self.wait_state('permission')

    def wait_state(self,state):
        for _ in range(200):
            if self.input.status()['state']==state:return
            time.sleep(.01)
        self.fail(self.input.status())

    def test_clipboard_permission_precedes_start_and_prepares_before_paste(self):
        self.clipboard=True
        asyncio.run_coroutine_threadsafe(self.input._probe(),self.input._loop).result(5)
        self.input.enable();self.wait_state('ready')
        self.assertTrue(self.input.status()['text'])
        self.input.send_text('日本語\n🙂')
        members=[name for name,_ in self.calls]
        self.assertLess(members.index('RequestClipboard'),members.index('Start'))
        self.assertLess(members.index('SetSelection'),members.index('NotifyKeyboardKeycode'))
        self.assertEqual(self.input._clipboard_data,'日本語\n🙂'.encode())

    def test_missing_clipboard_permission_never_sends_paste_keys(self):
        self.input.enable();self.wait_state('ready')
        self.assertFalse(self.input.status()['text'])
        with self.assertRaisesRegex(RuntimeError,'クリップボード許可'):self.input.send_text('do not send')
        self.assertNotIn('NotifyKeyboardKeycode',[name for name,_ in self.calls])

    def tearDown(self):
        self.input.close()
        async def disconnect():
            self.bus.disconnect();await self.bus.wait_for_disconnect()
        asyncio.run_coroutine_threadsafe(disconnect(),self.loop).result(timeout=5)
        self.loop.call_soon_threadsafe(self.loop.stop);self.thread.join(5)

    def test_permission_required_and_wire_input_and_shutdown(self):
        self.assertEqual(self.calls,[],'probe must never create a session or show a permission prompt')
        with self.assertRaises(RuntimeError):self.input.send_key('A',False)
        self.input.enable();self.input.enable();self.wait_state('ready')
        self.assertEqual([c[0] for c in self.calls],['CreateSession','SelectDevices','Start'])
        self.input.send_key('CTRL',False);self.input.send_key('A',False)
        self.input.send_key('A',True);self.input.send_key('CTRL',True)
        self.assertEqual([c[1][-2:] for c in self.calls[3:]],[[29,1],[30,1],[30,0],[29,0]])
        self.input.send_mouse('mouse_down');self.input.send_mouse('mouse_move',30,-20)
        self.input.send_mouse('mouse_up');self.input.send_mouse('mouse_scroll',0,60)
        count=len(self.calls);self.input.send_mouse('mouse_scroll',0,60)
        self.assertEqual(len(self.calls),count+1)
        self.assertEqual(self.calls[-1][1][-2:],[0,-1])
        self.input.send_key('SHIFT',False);self.input.send_mouse('mouse_down')
        self.input.close()
        self.assertEqual(self.calls[-2][1][-2:],[42,0])
        self.assertEqual(self.calls[-1][1][-2:],[272,0])
        self.assertEqual(self.closed,1)

    def test_refusal_does_not_send_input_or_retry_permission(self):
        self.reject=True;self.input.enable();self.wait_state('permission')
        self.assertIn('拒否',self.input.status()['reason'])
        self.assertEqual(self.closed,1)
        with self.assertRaises(RuntimeError):self.input.send_mouse('mouse_click')
        self.assertFalse(any(c[0].startswith('Notify') for c in self.calls))

    def test_partial_permission_is_reported_and_enforced(self):
        self.devices=1;self.input.enable();self.wait_state('ready')
        self.assertTrue(self.input.status()['keyboard']);self.assertFalse(self.input.status()['pointer'])
        with self.assertRaises(RuntimeError):self.input.send_mouse('mouse_move',1,1)
        self.input.send_key('F13',False);self.input.send_key('F13',True)
        self.assertEqual(self.calls[-1][1][-2:],[183,0])

    def test_revocation_disables_input_and_allows_explicit_reconnect(self):
        self.input.enable();self.wait_state('ready')
        closed=self.Message(path=self.sessions[-1],interface='org.freedesktop.portal.Session',
            member='Closed',message_type=self.Type.SIGNAL)
        self.loop.call_soon_threadsafe(self.bus.send,closed);self.wait_state('permission')
        with self.assertRaises(RuntimeError):self.input.send_key('A',False)
        self.input.enable();self.wait_state('ready')
        self.assertEqual(sum(c[0]=='Start' for c in self.calls),2)

if __name__=='__main__':unittest.main()
