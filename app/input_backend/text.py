"""Unicode text via the desktop clipboard, then the selected OS input backend."""
import os
import shutil
import subprocess

_clipboard=None
def set_clipboard_provider(provider):
    global _clipboard
    _clipboard=provider

def available():
    if _clipboard:return True
    return bool(shutil.which('wl-copy' if os.environ.get('WAYLAND_DISPLAY') else 'xclip'))

def paste(backend,text,clipboard=None):
    if not backend.status()['keyboard']:raise RuntimeError('文字入力にはキー入力の許可が必要です。')
    text=text.replace('\r\n','\n').replace('\r','\n')
    if clipboard:clipboard(text)
    elif _clipboard:_clipboard(text)
    else:
        wayland=bool(os.environ.get('WAYLAND_DISPLAY'))
        command=shutil.which('wl-copy' if wayland else 'xclip')
        if not command:raise RuntimeError('PCアプリから起動してください。文字入力用の接続がありません。')
        args=[command,'--type','text/plain;charset=utf-8'] if wayland else [command,'-selection','clipboard','-in']
        subprocess.run(args,input=text.encode('utf-8'),check=True,timeout=5)
    pressed=[]
    try:
        for key in ('CTRL','V'):backend.send_key(key,False);pressed.append(key)
    finally:
        # Cleanup all keys, even when an intermediate release fails.
        error=None
        for key in reversed(pressed):
            try:backend.send_key(key,True)
            except Exception as failure:error=error or failure
        if error:raise error
