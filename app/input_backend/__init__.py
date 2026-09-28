"""Select OS input without importing Windows-only APIs on Linux."""
import sys
import threading
_backend = None
_lock = threading.Lock()

class UnsupportedInput:
    def __init__(self, platform=None, reason=None):
        self.platform = platform or sys.platform
        self.reason = reason or 'この環境の入力方式はまだ対応していません。配置の編集は利用できます。'
    def send_key(self, *args): raise RuntimeError(self.reason)
    def send_mouse(self, *args): raise RuntimeError(self.reason)
    def send_text(self, *args): raise RuntimeError(self.reason)
    def repeat_settings(self): return .5, 1/30
    def status(self):
        return {'platform':self.platform,'backend':None,'state':'unsupported',
                'keyboard':False,'pointer':False,'text':False,'reason':self.reason}
    def close(self): pass

def create_backend(platform=None):
    platform = platform or sys.platform
    if platform == 'win32':
        from .windows import WindowsInput
        return WindowsInput()
    if platform == 'linux':
        from .linux import create_linux_backend
        return create_linux_backend()
    return UnsupportedInput(platform)

def get_backend():
    global _backend
    with _lock:
        if _backend is None: _backend = create_backend()
        return _backend

def send_key(key, up): return get_backend().send_key(key, up)
def send_mouse(kind, dx=0, dy=0): return get_backend().send_mouse(kind, dx, dy)
def send_text(text): return get_backend().send_text(text)
