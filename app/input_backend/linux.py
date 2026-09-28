"""Detect actual desktop capabilities; Wayland is never treated as plain X11."""
import os
from . import UnsupportedInput

def create_linux_backend():
    if os.environ.get('WAYLAND_DISPLAY') or os.environ.get('XDG_SESSION_TYPE') == 'wayland':
        return UnsupportedInput('linux','Wayland入力の許可機能は現在実装中です。配置の編集は利用できます。')
    if os.environ.get('DISPLAY'):
        try:
            from .x11 import X11Input
            return X11Input()
        except (OSError,RuntimeError) as error:
            return UnsupportedInput('linux',str(error))
    return UnsupportedInput('linux','ログイン中のデスクトップが見つかりません。配置の編集は利用できます。')
