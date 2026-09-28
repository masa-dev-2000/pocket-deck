"""Wayland input through an explicitly approved RemoteDesktop portal session.

Uses the standard Notify methods, including on older portal implementations.
No XWayland fallback, root daemon, shell-per-event, or unsolicited prompts.
"""
import asyncio
import concurrent.futures
import threading
import uuid
import os
from dbus_next import Message, MessageType, Variant
from dbus_next.aio import MessageBus

SERVICE='org.freedesktop.portal.Desktop'
PATH='/org/freedesktop/portal/desktop'
INTERFACE='org.freedesktop.portal.RemoteDesktop'
CLIPBOARD='org.freedesktop.portal.Clipboard'
KEYCODES={'ESC':1,'TAB':15,'CTRL':29,'SHIFT':42,'ALT':56,'SUPER':125,
    'ENTER':28,'SPACE':57,'BACKSPACE':14,'DELETE':111,'LEFT':105,'UP':103,
    'RIGHT':106,'DOWN':108,'HOME':102,'END':107,'PAGEUP':104,'PAGEDOWN':109,
    'VOLUMEUP':115,'VOLUMEDOWN':114,'MUTE':113,'PLAYPAUSE':164}
KEYCODES.update(dict(zip('1234567890',range(2,12))))
KEYCODES.update(dict(zip('QWERTYUIOP',range(16,26))))
KEYCODES.update(dict(zip('ASDFGHJKL',range(30,39))))
KEYCODES.update(dict(zip('ZXCVBNM',range(44,51))))
KEYCODES.update({f'F{i}':58+i for i in range(1,11)})
KEYCODES.update({'F11':87,'F12':88})
KEYCODES.update({f'F{i}':170+i for i in range(13,25)})

class ManagedMessageBus(MessageBus):
    def _finalize(self,error=None):
        # dbus-next 0.2.3 shuts down but does not close these descriptors.
        # Keep this small compatibility boundary with the pinned library version.
        try:super()._finalize(error)
        finally:
            self._stream.close()
            self._sock.close()

class PortalInput:
    native_repeat=True
    def __init__(self, bus_factory=ManagedMessageBus):
        self._lock=threading.RLock()
        self._bus_factory=bus_factory
        self._bus=None; self._owner=None; self._session=None; self._closed=False
        self._requests={}; self._operation=None; self._devices=0
        self._state='checking'; self._reason='入力機能を確認しています…'
        self._held_keys=set(); self._held_buttons=set()
        self._scroll_x=self._scroll_y=0
        self._clipboard_supported=False;self._clipboard_enabled=False;self._clipboard_data=None
        self._legacy_clipboard=None
        self._loop=asyncio.new_event_loop()
        self._thread=threading.Thread(target=self._run,daemon=True,name='deck-portal')
        self._thread.start()
        self._probe_future=asyncio.run_coroutine_threadsafe(self._probe(),self._loop)

    def _run(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()
        tasks=asyncio.all_tasks(self._loop)
        for task in tasks: task.cancel()
        if tasks: self._loop.run_until_complete(asyncio.gather(*tasks,return_exceptions=True))
        self._loop.close()

    def _set(self,state,reason=''):
        with self._lock:
            if not self._closed:self._state,self._reason=state,reason

    async def _call(self, member, signature='', body=None, interface=INTERFACE,path=PATH,destination=SERVICE):
        reply=await asyncio.wait_for(self._bus.call(Message(destination=destination,path=path,
            interface=interface,member=member,signature=signature,body=body or [])),10)
        if reply.message_type == MessageType.ERROR:
            raise RuntimeError('入力サービスから拒否されました: '+str(reply.body[0] if reply.body else reply.error_name))
        return reply.body

    async def _probe(self):
        try:
            if not self._bus:
                self._bus=await asyncio.wait_for(self._bus_factory(negotiate_unix_fd=True).connect(),10)
                self._bus.add_message_handler(self._signal)
                # A normal method call activates an installed portal; GetNameOwner
                # alone incorrectly reports unsupported before its first launch.
                await self._call('GetAll','s',[INTERFACE],interface='org.freedesktop.DBus.Properties')
                owner=await self._call('GetNameOwner','s',[SERVICE],interface='org.freedesktop.DBus',
                    path='/org/freedesktop/DBus',destination='org.freedesktop.DBus')
                self._owner=owner[0]
                for interface in ('org.freedesktop.portal.Request','org.freedesktop.portal.Session',CLIPBOARD):
                    await self._call('AddMatch','s',[f"type='signal',sender='{SERVICE}',interface='{interface}'"],
                        interface='org.freedesktop.DBus',path='/org/freedesktop/DBus',destination='org.freedesktop.DBus')
                await self._call('AddMatch','s',["type='signal',sender='org.freedesktop.DBus',interface='org.freedesktop.DBus',member='NameOwnerChanged',arg0='"+SERVICE+"'"],
                    interface='org.freedesktop.DBus',path='/org/freedesktop/DBus',destination='org.freedesktop.DBus')
            self._owner=(await self._call('GetNameOwner','s',[SERVICE],interface='org.freedesktop.DBus',
                path='/org/freedesktop/DBus',destination='org.freedesktop.DBus'))[0]
            props=(await self._call('GetAll','s',[INTERFACE],interface='org.freedesktop.DBus.Properties'))[0]
            try:
                clipboard=(await self._call('GetAll','s',[CLIPBOARD],interface='org.freedesktop.DBus.Properties'))[0]
                self._clipboard_supported=clipboard.get('version',Variant('u',0)).value>=1
            except Exception:self._clipboard_supported=False
            if not self._clipboard_supported and not self._legacy_clipboard and os.environ.get('DISPLAY'):
                try:
                    from .xclipboard import XClipboard
                    self._legacy_clipboard=XClipboard()
                except Exception:pass
            if not (props.get('AvailableDeviceTypes',Variant('u',0)).value & 3):
                raise RuntimeError('このデスクトップはキー・マウス入力の許可に対応していません。')
            self._set('permission','「入力を許可」を押し、OSの確認画面でキー・マウス操作を許可してください。')
            return True
        except Exception as error:
            if self._bus:
                self._bus.disconnect();self._bus=None;self._owner=None
            self._set('unsupported','デスクトップの入力許可サービスを利用できません。'+str(error))
            return False

    def _signal(self,message):
        if (message.message_type == MessageType.SIGNAL and message.sender == 'org.freedesktop.DBus'
            and message.interface == 'org.freedesktop.DBus' and message.member == 'NameOwnerChanged'
            and message.body[0] == SERVICE and message.body[1] == self._owner):
            self._owner=None;self._session=None;self._devices=0
            self._clipboard_enabled=False;self._clipboard_data=None
            # Losing the broker does not prove that the compositor released
            # its virtual device. Preserve pending releases until confirmed.
            self._scroll_x=self._scroll_y=0
            for future in self._requests.values():
                if not future.done():future.set_exception(RuntimeError('入力許可サービスが終了しました。'))
            reason='入力許可サービスが終了しました。「入力を許可」から再接続してください。'
            if self._held_keys or self._held_buttons:
                reason='入力許可サービスが終了しました。保持中の入力の解除は確認できていません。OSのリモート共有を停止してから再接続してください。'
            self._set('permission',reason)
            return
        if message.message_type == MessageType.SIGNAL and message.sender==self._owner and message.interface==CLIPBOARD and message.member=='SelectionTransfer':
            session,mime,serial=message.body
            if session==self._session:self._loop.create_task(self._write_selection(session,mime,serial))
            return
        if message.message_type != MessageType.SIGNAL or message.sender != self._owner:return
        if message.interface == 'org.freedesktop.portal.Request' and message.member == 'Response':
            future=self._requests.get(message.path)
            if future and not future.done():future.set_result(message.body)
        elif message.interface == 'org.freedesktop.portal.Session' and message.member == 'Closed' and message.path == self._session:
            self._session=None;self._devices=0
            self._clipboard_enabled=False;self._clipboard_data=None
            self._set('permission','入力の許可が終了しました。「入力を許可」から再接続してください。')

    async def _request(self,member,signature,args,options):
        token='deck'+uuid.uuid4().hex
        options=dict(options,handle_token=Variant('s',token))
        sender=self._bus.unique_name.lstrip(':').replace('.','_')
        handle=PATH+'/request/'+sender+'/'+token
        future=self._loop.create_future();self._requests[handle]=future
        try:
            returned=(await self._call(member,signature,args+[options]))[0]
            # Protocol implementations must honor handle_token, so subscribe before calling.
            if returned != handle:raise RuntimeError('入力サービスの要求ハンドルが一致しません。')
            response,results=await asyncio.wait_for(future,120)
            if response != 0:raise RuntimeError('入力の許可がキャンセルまたは拒否されました。')
            return results
        except (asyncio.TimeoutError,asyncio.CancelledError):
            try:await self._call('Close',interface='org.freedesktop.portal.Request',path=handle)
            except Exception:pass
            raise
        finally:self._requests.pop(handle,None)

    def enable(self):
        with self._lock:
            if self._closed:raise RuntimeError('入力サービスが終了しています。')
            if self._state == 'ready' or self._operation and not self._operation.done():return self.status()
            self._state='pending';self._reason='OSの入力許可を待っています…'
            self._operation=asyncio.run_coroutine_threadsafe(self._enable(),self._loop)
            return self.status()

    async def _enable(self):
        session=None
        try:
            await asyncio.wrap_future(self._probe_future)
            # Re-read the owner and capabilities after a service restart. Old
            # unique bus names must never filter out the new owner's responses.
            if not await self._probe():return
            self._set('pending','OSの入力許可を待っています…')
            created=await self._request('CreateSession','a{sv}',[],
                {'session_handle_token':Variant('s','deck'+uuid.uuid4().hex)})
            session=created['session_handle'].value;self._session=session
            await self._request('SelectDevices','oa{sv}',[session],{'types':Variant('u',3)})
            if self._clipboard_supported:
                await self._call('RequestClipboard','oa{sv}',[session,{}],interface=CLIPBOARD)
            started=await self._request('Start','osa{sv}',[session,''],{})
            self._clipboard_enabled=started.get('clipboard_enabled',Variant('b',False)).value
            self._devices=started.get('devices',Variant('u',0)).value & 3
            if not self._devices:raise RuntimeError('キー・マウス操作の許可がありません。')
            self._set('ready')
        except Exception as error:
            if session:
                try:await self._call('Close',interface='org.freedesktop.portal.Session',path=session)
                except Exception:pass
            self._session=None;self._devices=0
            self._set('permission',str(error))

    def _notify(self,member,signature,body,device):
        with self._lock:
            if self._closed or self._state != 'ready' or not self._devices & device:
                raise RuntimeError('この入力操作は許可されていません。PCアプリで入力を許可してください。')
            future=asyncio.run_coroutine_threadsafe(self._call(member,'oa{sv}'+signature,
                [self._session,{}]+body),self._loop)
        # Never hold the state lock while waiting: Session.Closed arrives on the bus thread.
        try:return future.result(timeout=12)
        except Exception as error:
            future.cancel()
            self._set('permission','入力応答が途切れました。再送せず、許可を終了します。')
            asyncio.run_coroutine_threadsafe(self._drop_session(),self._loop)
            raise RuntimeError('入力応答を確認できませんでした。自動再送は行いません。') from error

    def send_key(self,key,up):
        code=KEYCODES.get(key)
        if code is None:raise ValueError('キーが不正です。')
        self._notify('NotifyKeyboardKeycode','iu',[code,0 if up else 1],1)
        if up:self._held_keys.discard(key)
        else:self._held_keys.add(key)

    def _button(self,up):
        self._notify('NotifyPointerButton','iu',[272,0 if up else 1],2)
        if up:self._held_buttons.discard(272)
        else:self._held_buttons.add(272)

    def send_mouse(self,kind,dx=0,dy=0):
        if kind == 'mouse_move':self._notify('NotifyPointerMotion','dd',[float(dx),float(dy)],2)
        elif kind == 'mouse_down':self._button(False)
        elif kind == 'mouse_up':self._button(True)
        elif kind == 'mouse_click':self._button(False);self._button(True)
        elif kind == 'mouse_scroll':
            self._scroll_x+=dx;self._scroll_y-=dy
            for field,axis in [('_scroll_y',0),('_scroll_x',1)]:
                amount=getattr(self,field)
                steps=int(amount/120)
                if steps:
                    self._notify('NotifyPointerAxisDiscrete','ui',[axis,steps],2)
                    setattr(self,field,amount-steps*120)
        else:raise ValueError('マウス操作が不正です。')

    def send_text(self,text,paste_mode='standard'):
        from .text import paste
        if not self._clipboard_enabled:
            if not self._clipboard_supported and self._legacy_clipboard:
                return paste(self,text,clipboard=lambda value:self._legacy_clipboard.set(value,wait_for_offer=True),paste_mode=paste_mode)
            raise RuntimeError('このWayland環境では文字入力のクリップボード許可を利用できません。')
        def prepare(value):
            self._clipboard_data=value.encode('utf-8')
            asyncio.run_coroutine_threadsafe(self._call('SetSelection','oa{sv}',[self._session,{'mime_types':Variant('as',['text/plain;charset=utf-8','text/plain'])}],interface=CLIPBOARD),self._loop).result(timeout=12)
        paste(self,text,clipboard=prepare,paste_mode=paste_mode)

    async def _write_selection(self,session,mime,serial):
        ok=False;descriptor=None
        try:
            if mime not in ('text/plain;charset=utf-8','text/plain') or self._clipboard_data is None:return
            data=self._clipboard_data
            reply=await asyncio.wait_for(self._bus.call(Message(destination=SERVICE,path=PATH,interface=CLIPBOARD,member='SelectionWrite',signature='ou',body=[session,serial])),10)
            if reply.message_type==MessageType.ERROR:raise RuntimeError('Clipboard transfer refused')
            descriptor=reply.unix_fds[reply.body[0]]
            await asyncio.wait_for(self._write_fd(descriptor,data),5)
            ok=True
        finally:
            if descriptor is not None:os.close(descriptor)
            try:await self._call('SelectionWriteDone','oub',[session,serial,ok],interface=CLIPBOARD)
            except Exception:pass

    async def _write_fd(self,descriptor,data):
        os.set_blocking(descriptor,False)
        offset=0
        while offset<len(data):
            try:offset+=os.write(descriptor,data[offset:])
            except BlockingIOError:
                ready=self._loop.create_future()
                def writable():
                    if not ready.done():ready.set_result(None)
                self._loop.add_writer(descriptor,writable)
                try:await ready
                finally:self._loop.remove_writer(descriptor)
    def repeat_settings(self):return .5,1/30
    def status(self):
        from .text import available
        with self._lock:
            ready=self._state == 'ready'
            return {'platform':'linux','session':'wayland','backend':'remote-desktop-portal',
                'state':self._state,'keyboard':ready and bool(self._devices&1),
                'pointer':ready and bool(self._devices&2),'text':ready and bool(self._devices&1) and bool(self._clipboard_enabled or not self._clipboard_supported and self._legacy_clipboard),
                'clipboard': 'portal' if self._clipboard_supported else 'xwayland' if self._legacy_clipboard else 'unavailable',
                'canEnable':not self._closed and self._state in ('permission','unsupported'),
                'reason':self._reason}

    async def _drop_session(self):
        session=self._session;self._session=None;self._devices=0
        self._clipboard_enabled=False;self._clipboard_data=None
        if session:
            try:await self._call('Close',interface='org.freedesktop.portal.Session',path=session)
            except Exception:pass

    async def _shutdown(self):
        if self._operation and not self._operation.done():self._operation.cancel()
        async def release():
            if self._session and self._state == 'ready':
                for key in list(self._held_keys):
                    try:await self._call('NotifyKeyboardKeycode','oa{sv}iu',[self._session,{},KEYCODES[key],0])
                    except Exception:pass
                for button in list(self._held_buttons):
                    try:await self._call('NotifyPointerButton','oa{sv}iu',[self._session,{},button,0])
                    except Exception:pass
        try:
            await asyncio.wait_for(release(),3)
        except Exception:pass
        finally:
            try:await asyncio.wait_for(self._drop_session(),1)
            except Exception:pass
            if self._bus:
                self._bus.disconnect()
                try:await asyncio.wait_for(self._bus.wait_for_disconnect(),1)
                except Exception:pass
                self._bus=None

    def close(self):
        with self._lock:
            if self._closed:return
            self._closed=True
        future=asyncio.run_coroutine_threadsafe(self._shutdown(),self._loop)
        try:future.result(timeout=6)
        except Exception:future.cancel()
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=5)
        if self._legacy_clipboard:self._legacy_clipboard.close();self._legacy_clipboard=None
