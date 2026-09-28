"""Persistent X11 clipboard owner, also usable with old XWayland desktops.

This never injects input. Wayland paste keys still require the portal session.
"""
import ctypes as C
from ctypes.util import find_library
import os
import threading

class Selection(C.Structure):
    _fields_=[('type',C.c_int),('serial',C.c_ulong),('send_event',C.c_int),('display',C.c_void_p),
        ('owner',C.c_ulong),('requestor',C.c_ulong),('selection',C.c_ulong),('target',C.c_ulong),('property',C.c_ulong),('time',C.c_ulong)]
class Notify(C.Structure):
    _fields_=[('type',C.c_int),('serial',C.c_ulong),('send_event',C.c_int),('display',C.c_void_p),
        ('requestor',C.c_ulong),('selection',C.c_ulong),('target',C.c_ulong),('property',C.c_ulong),('time',C.c_ulong)]
class Event(C.Union):
    _fields_=[('request',Selection),('notify',Notify),('padding',C.c_long*24)]

class XClipboard:
    def __init__(self):
        self.x=C.CDLL(find_library('X11'));self.lock=threading.RLock();self.stop=threading.Event();self.data=b''
        self.offered=threading.Event()
        prototypes={
            'XInitThreads':([],C.c_int),'XOpenDisplay':([C.c_char_p],C.c_void_p),
            'XDefaultRootWindow':([C.c_void_p],C.c_ulong),
            'XCreateSimpleWindow':([C.c_void_p,C.c_ulong,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_uint,C.c_ulong,C.c_ulong],C.c_ulong),
            'XInternAtom':([C.c_void_p,C.c_char_p,C.c_int],C.c_ulong),
            'XSetSelectionOwner':([C.c_void_p,C.c_ulong,C.c_ulong,C.c_ulong],C.c_int),
            'XGetSelectionOwner':([C.c_void_p,C.c_ulong],C.c_ulong),
            'XChangeProperty':([C.c_void_p,C.c_ulong,C.c_ulong,C.c_ulong,C.c_int,C.c_int,C.c_void_p,C.c_int],C.c_int),
            'XSendEvent':([C.c_void_p,C.c_ulong,C.c_int,C.c_long,C.POINTER(Event)],C.c_int),
            'XPending':([C.c_void_p],C.c_int),'XNextEvent':([C.c_void_p,C.POINTER(Event)],C.c_int),
            'XSync':([C.c_void_p,C.c_int],C.c_int),'XFlush':([C.c_void_p],C.c_int),'XCloseDisplay':([C.c_void_p],C.c_int)}
        for name,(args,result) in prototypes.items():getattr(self.x,name).argtypes=args;getattr(self.x,name).restype=result
        self.x.XInitThreads();self.display=self.x.XOpenDisplay(os.environ.get('DISPLAY','').encode())
        if not self.display:raise RuntimeError('XWaylandのクリップボードへ接続できません。')
        self.window=self.x.XCreateSimpleWindow(self.display,self.x.XDefaultRootWindow(self.display),0,0,1,1,0,0,0)
        self.atoms={name:self.x.XInternAtom(self.display,name.encode(),False) for name in ['CLIPBOARD','UTF8_STRING','text/plain;charset=utf-8','text/plain','TARGETS','ATOM']}
        self.thread=threading.Thread(target=self._run,daemon=True,name='deck-clipboard');self.thread.start()

    def set(self,text,wait_for_offer=False):
        with self.lock:
            if self.stop.is_set():raise RuntimeError('文字入力が終了しています。')
            if self.x.XGetSelectionOwner(self.display,self.atoms['CLIPBOARD'])!=self.window:self.offered.clear()
            self.data=text.encode('utf-8');self.x.XSetSelectionOwner(self.display,self.atoms['CLIPBOARD'],self.window,0)
            self.x.XSync(self.display,False)
            if self.x.XGetSelectionOwner(self.display,self.atoms['CLIPBOARD'])!=self.window:raise RuntimeError('クリップボードを準備できませんでした。')
        # Old Mutter asynchronously advertises XWayland MIME formats to native
        # Wayland clients. Sending Ctrl+V before that request loses the first paste.
        if wait_for_offer and not self.offered.wait(2):raise RuntimeError('Waylandへの文字入力準備を確認できませんでした。自動再送は行いません。')

    def _run(self):
        while not self.stop.wait(.01):
            with self.lock:
                while self.x.XPending(self.display):
                    event=Event();self.x.XNextEvent(self.display,C.byref(event))
                    if event.request.type!=30:continue
                    request=event.request;property=request.property or request.target;accepted=False
                    if request.selection==self.atoms['CLIPBOARD']:
                        if request.target==self.atoms['TARGETS']:
                            formats=(C.c_ulong*4)(*(self.atoms[n] for n in ['TARGETS','UTF8_STRING','text/plain;charset=utf-8','text/plain']))
                            self.x.XChangeProperty(self.display,request.requestor,property,self.atoms['ATOM'],32,0,formats,4);accepted=True
                        elif request.target in [self.atoms[n] for n in ['UTF8_STRING','text/plain;charset=utf-8','text/plain']]:
                            data=C.create_string_buffer(self.data)
                            self.x.XChangeProperty(self.display,request.requestor,property,request.target,8,0,data,len(self.data));accepted=True
                    response=Event();response.notify=Notify(31,0,True,self.display,request.requestor,request.selection,request.target,property if accepted else 0,request.time)
                    self.x.XSendEvent(self.display,request.requestor,False,0,C.byref(response));self.x.XFlush(self.display)
                    if accepted and request.target==self.atoms['TARGETS']:self.offered.set()

    def close(self):
        self.stop.set();self.thread.join(2)
        with self.lock:
            if self.display:self.x.XCloseDisplay(self.display);self.display=None
