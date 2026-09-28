"""Real GTK4 scroll receiver for the disposable GNOME Wayland lab."""
import json
from pathlib import Path
import sys
import threading
import time

sys.path.insert(0, '/source/app')
import gi
gi.require_version('Gtk', '4.0')
from gi.repository import Gtk, GLib
from input_backend.portal import PortalInput

output = Path('/tmp/portal-scroll-probe.jsonl')
output.write_text('')
def record(value):
    with output.open('a') as stream:
        stream.write(json.dumps(value)+'\n')

Gtk.init()
window = Gtk.Window(title='Pocket Deck GTK4 Wayland scroll proof')
window.set_default_size(640, 420)
field = Gtk.TextView()
field.get_buffer().set_text('\n'.join('GTK4 scroll proof '+str(i) for i in range(200)))
field.get_buffer().place_cursor(field.get_buffer().get_start_iter())
scroller = Gtk.ScrolledWindow()
scroller.set_child(field)
window.set_child(scroller)
scroller.get_vadjustment().connect('value-changed', lambda adjustment: record({'scrollPosition': adjustment.get_value()}))
controller = Gtk.EventControllerScroll.new(Gtk.EventControllerScrollFlags.BOTH_AXES)
controller.connect('scroll', lambda controller, dx, dy: record({'scrollEvent': {'dx':dx,'dy':dy}}) or False)
field.add_controller(controller)
loop = GLib.MainLoop()
window.connect('close-request', lambda window: loop.quit() or False)
window.present()
backend = PortalInput()
def enable():
    time.sleep(2)
    record({'before': backend.status()})
    backend.enable()
threading.Thread(target=enable, daemon=True).start()
def send():
    try:
        backend.send_mouse('mouse_move',1,0)
        for _ in range(4):
            backend.send_mouse('mouse_scroll',0,-120)
            time.sleep(.1)
        record({'sent':True,'status':backend.status()})
    except Exception as error:
        record({'error':str(error)})
def poll():
    flag = Path('/tmp/scroll-probe-go')
    if flag.exists():
        flag.unlink()
        threading.Thread(target=send,daemon=True).start()
    return True
GLib.timeout_add(250,poll)
try:
    loop.run()
finally:
    backend.close()
