"""Persistent XTest input connection. Does not invoke a shell per input event."""
import ctypes as C
from ctypes.util import find_library
import os
import threading

SYMBOLS = {'CTRL':0xffe3,'SHIFT':0xffe1,'ALT':0xffe9,'SUPER':0xffeb,
    'ENTER':0xff0d,'TAB':0xff09,'ESC':0xff1b,'SPACE':0x20,'BACKSPACE':0xff08,
    'DELETE':0xffff,'LEFT':0xff51,'UP':0xff52,'RIGHT':0xff53,'DOWN':0xff54,
    'HOME':0xff50,'END':0xff57,'PAGEUP':0xff55,'PAGEDOWN':0xff56,
    'VOLUMEUP':0x1008ff13,'VOLUMEDOWN':0x1008ff11,'MUTE':0x1008ff12,
    'PLAYPAUSE':0x1008ff14}
SYMBOLS.update({c:ord(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})
SYMBOLS.update({f'F{i}':0xffbd+i for i in range(1,25)})

class X11Input:
    native_repeat = True
    def __init__(self, display=None):
        self.lock = threading.RLock()
        self.held_keys, self.held_buttons = {}, set()
        self.display = None
        xlib, xtst = find_library('X11'), find_library('Xtst')
        if not xlib or not xtst:
            raise RuntimeError('X11入力に必要なライブラリが見つかりません。')
        self.x = C.CDLL(xlib); self.xt = C.CDLL(xtst)
        self.x.XInitThreads.argtypes=[]; self.x.XInitThreads.restype=C.c_int
        if not self.x.XInitThreads(): raise RuntimeError('X11入力を初期化できません。')
        self.x.XOpenDisplay.argtypes=[C.c_char_p]; self.x.XOpenDisplay.restype=C.c_void_p
        self.x.XCloseDisplay.argtypes=[C.c_void_p]; self.x.XCloseDisplay.restype=C.c_int
        self.x.XFlush.argtypes=[C.c_void_p]; self.x.XFlush.restype=C.c_int
        self.x.XKeysymToKeycode.argtypes=[C.c_void_p,C.c_ulong]; self.x.XKeysymToKeycode.restype=C.c_ubyte
        self.xt.XTestQueryExtension.argtypes=[C.c_void_p]+[C.POINTER(C.c_int)]*4
        self.xt.XTestQueryExtension.restype=C.c_int
        self.xt.XTestFakeKeyEvent.argtypes=[C.c_void_p,C.c_uint,C.c_int,C.c_ulong]
        self.xt.XTestFakeKeyEvent.restype=C.c_int
        self.xt.XTestFakeButtonEvent.argtypes=[C.c_void_p,C.c_uint,C.c_int,C.c_ulong]
        self.xt.XTestFakeButtonEvent.restype=C.c_int
        self.xt.XTestFakeRelativeMotionEvent.argtypes=[C.c_void_p,C.c_int,C.c_int,C.c_ulong]
        self.xt.XTestFakeRelativeMotionEvent.restype=C.c_int
        target = display if display is not None else os.environ.get('DISPLAY','')
        if not target: raise RuntimeError('X11の画面に接続できません。')
        self.display = self.x.XOpenDisplay(target.encode())
        if not self.display: raise RuntimeError('X11の画面に接続できません。')
        values=[C.c_int() for _ in range(4)]
        if not self.xt.XTestQueryExtension(self.display,*(C.byref(v) for v in values)):
            self.x.XCloseDisplay(self.display); self.display=None
            raise RuntimeError('この画面はXTest入力に対応していません。')
        self.scroll_x = self.scroll_y = 0

    def _check(self, accepted):
        if not accepted: raise RuntimeError('X11へ入力を送信できませんでした。')

    def send_key(self, key, up):
        with self.lock:
            if not self.display: raise RuntimeError('X11入力が終了しています。')
            symbol=SYMBOLS.get(key)
            # Release the exact keycode originally pressed, even after a layout change.
            code=self.held_keys.get(key) if up else None
            if code is None: code=self.x.XKeysymToKeycode(self.display,symbol) if symbol else 0
            if not code: raise RuntimeError(f'現在のキーボード配列に{key}がありません。')
            self._check(self.xt.XTestFakeKeyEvent(self.display,code,not up,0))
            if up: self.held_keys.pop(key,None)
            else: self.held_keys[key]=code
            self.x.XFlush(self.display)

    def _button(self, button, up):
        self._check(self.xt.XTestFakeButtonEvent(self.display,button,not up,0))
        if up: self.held_buttons.discard(button)
        else: self.held_buttons.add(button)

    def send_mouse(self, kind, dx=0, dy=0):
        with self.lock:
            if not self.display: raise RuntimeError('X11入力が終了しています。')
            if kind == 'mouse_move':
                self._check(self.xt.XTestFakeRelativeMotionEvent(self.display,dx,dy,0))
            elif kind == 'mouse_down': self._button(1,False)
            elif kind == 'mouse_up': self._button(1,True)
            elif kind == 'mouse_click':
                self._button(1,False); self._button(1,True)
            elif kind == 'mouse_scroll':
                # Wire protocol uses Windows wheel units: 120 = one notch.
                # Accumulate small movements instead of dropping partial notches.
                self.scroll_x += dx; self.scroll_y += dy
                for field,positive,negative in [('scroll_y',4,5),('scroll_x',7,6)]:
                    amount=getattr(self,field)
                    while abs(amount)>=120:
                        button=positive if amount>0 else negative
                        self._button(button,False); self._button(button,True)
                        amount += -120 if amount>0 else 120
                    setattr(self,field,amount)
            else: raise ValueError('マウス操作が不正です。')
            self.x.XFlush(self.display)

    def send_text(self, text):
        from .text import paste
        paste(self,text)
    def repeat_settings(self): return .5, 1/30
    def status(self):
        from .text import available
        return {'platform':'linux','session':'x11','backend':'xtest','state':'ready',
                'keyboard':True,'pointer':True,'text':available(),'reason':''}
    def close(self):
        with self.lock:
            if not self.display: return
            for key in list(self.held_keys): self.send_key(key,True)
            for button in list(self.held_buttons): self._button(button,True)
            self.x.XFlush(self.display)
            self.x.XCloseDisplay(self.display); self.display=None
