"""Windows input implementation; imported only through the OS adapter."""
import ctypes as C
from ctypes import wintypes as W

KEYS = {'CTRL': 0x11, 'SHIFT': 0x10, 'ALT': 0x12, 'WIN': 0x5B,
        'ENTER': 0x0D, 'TAB': 9, 'ESC': 27, 'SPACE': 32, 'BACKSPACE': 8,
        'DELETE': 46, 'LEFT': 37, 'UP': 38, 'RIGHT': 39, 'DOWN': 40,
        'HOME': 36, 'END': 35, 'PAGEUP': 33, 'PAGEDOWN': 34,
        'VOLUMEUP': 175, 'VOLUMEDOWN': 174, 'MUTE': 173, 'PLAYPAUSE': 179}
KEYS.update({c: ord(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'})
KEYS.update({f'F{i}': 111+i for i in range(1, 25)})
KEYS['SUPER'] = KEYS.pop('WIN')
KEYS.update({'NUMLOCK':0x90,'CAPSLOCK':0x14,'SCROLLLOCK':0x91,'INSERT':0x2d,
             'PRINTSCREEN':0x2c,'PAUSE':0x13,'APPS':0x5d,'NUMPADENTER':0x0d,
             'NUMPADDECIMAL':0x6e,'NUMPADADD':0x6b,'NUMPADSUBTRACT':0x6d,
             'NUMPADMULTIPLY':0x6a,'NUMPADDIVIDE':0x6f,
             'OEM_1':0xba,'OEM_PLUS':0xbb,'OEM_COMMA':0xbc,'OEM_MINUS':0xbd,
             'OEM_PERIOD':0xbe,'OEM_2':0xbf,'OEM_3':0xc0,'OEM_4':0xdb,
             'OEM_5':0xdc,'OEM_6':0xdd,'OEM_7':0xde,'OEM_8':0xdf,'OEM_102':0xe2})
KEYS.update({f'NUMPAD{i}':0x60+i for i in range(10)})
EXTENDED = {33, 34, 35, 36, 37, 38, 39, 40, 46, 0x5B, 173, 174, 175, 179}
EXTENDED.update((0x2d,0x2c,0x5d,0x6f))

class KEYBDINPUT(C.Structure):
    _fields_ = [('wVk', W.WORD), ('wScan', W.WORD), ('dwFlags', W.DWORD),
                ('time', W.DWORD), ('dwExtraInfo', C.c_size_t)]
class MOUSEINPUT(C.Structure):
    _fields_ = [('dx', W.LONG), ('dy', W.LONG), ('mouseData', W.DWORD),
                ('dwFlags', W.DWORD), ('time', W.DWORD), ('dwExtraInfo', C.c_size_t)]
class UNION(C.Union):
    _fields_ = [('ki', KEYBDINPUT), ('mi', MOUSEINPUT)]
class INPUT(C.Structure):
    _anonymous_ = ('u',)
    _fields_ = [('type', W.DWORD), ('u', UNION)]

def send_key(key, up, extended=None):
    user32 = C.WinDLL('user32', use_last_error=True)
    user32.SendInput.argtypes = [W.UINT, C.POINTER(INPUT), C.c_int]
    user32.SendInput.restype = W.UINT
    flags = (2 if up else 0) | (1 if (key in EXTENDED if extended is None else extended) else 0)
    item = INPUT(type=1, u=UNION(ki=KEYBDINPUT(key, 0, flags, 0, 0)))
    if user32.SendInput(1, C.byref(item), C.sizeof(INPUT)) != 1:
        raise RuntimeError('キー入力に失敗しました。対象アプリの権限を確認してください。')

def send_mouse(kind, dx=0, dy=0):
    user32=C.WinDLL('user32',use_last_error=True)
    user32.SendInput.argtypes=[W.UINT,C.POINTER(INPUT),C.c_int]
    user32.SendInput.restype=W.UINT
    if kind=='mouse_scroll':
        packets=[]
        if dy:packets.append((0,0,dy & 0xffffffff,0x800))
        if dx:packets.append((0,0,dx & 0xffffffff,0x1000))
    else:
        flags={'mouse_move':[1],'mouse_click':[2,4],'mouse_down':[2],'mouse_up':[4]}[kind]
        packets=[(dx,dy,0,f) for f in flags]
    if not packets:return
    items=(INPUT*len(packets))(*(INPUT(type=0,u=UNION(mi=MOUSEINPUT(x,y,data,f,0,0))) for x,y,data,f in packets))
    if user32.SendInput(len(items),items,C.sizeof(INPUT))!=len(items):
        if kind in ('mouse_click','mouse_down'):
            release=INPUT(type=0,u=UNION(mi=MOUSEINPUT(0,0,0,4,0,0)))
            user32.SendInput(1,C.byref(release),C.sizeof(INPUT))
        raise RuntimeError('マウス操作に失敗しました')

def send_text(text):
    user32=C.WinDLL('user32',use_last_error=True)
    user32.SendInput.argtypes=[W.UINT,C.POINTER(INPUT),C.c_int]
    user32.SendInput.restype=W.UINT
    items=[]
    for ch in text.replace('\r\n','\n').replace('\r','\n'):
        if ch in ('\n','\t'):
            key=13 if ch=='\n' else 9
            items.extend([INPUT(type=1,u=UNION(ki=KEYBDINPUT(key,0,0,0,0))),INPUT(type=1,u=UNION(ki=KEYBDINPUT(key,0,2,0,0)))])
        else:
            raw=ch.encode('utf-16-le')
            for i in range(0,len(raw),2):
                unit=int.from_bytes(raw[i:i+2],'little')
                items.extend([INPUT(type=1,u=UNION(ki=KEYBDINPUT(0,unit,4,0,0))),INPUT(type=1,u=UNION(ki=KEYBDINPUT(0,unit,6,0,0)))])
    array=(INPUT*len(items))(*items)
    if user32.SendInput(len(items),array,C.sizeof(INPUT))!=len(items):
        raise RuntimeError('文字入力を完了できませんでした。対象アプリを確認してください（自動再送しません）。')


class WindowsInput:
    def send_key(self, key, up):
        send_key(KEYS[key], up, key=='NUMPADENTER' or KEYS[key] in EXTENDED)
    def send_mouse(self, kind, dx=0, dy=0):
        send_mouse(kind, dx, dy)
    def send_text(self, text,paste_mode='standard'):
        if paste_mode not in ('standard','terminal'):raise ValueError('文字列の貼り付け先が不正です。')
        # Windows sends Unicode directly; no terminal paste shortcut is needed.
        send_text(text)
    def repeat_settings(self):
        delay, speed = W.UINT(), W.UINT()
        u = C.WinDLL('user32')
        seconds, interval = .5, 1/30
        if u.SystemParametersInfoW(0x16,0,C.byref(delay),0): seconds = .25*(delay.value+1)
        if u.SystemParametersInfoW(0xA,0,C.byref(speed),0): interval = 1/(2.5+27.5*speed.value/31)
        return seconds, interval
    def status(self):
        return {'platform':'win32','backend':'sendinput','state':'ready',
                'keyboard':True,'pointer':True,'text':True,'reason':''}
    def close(self):
        pass
