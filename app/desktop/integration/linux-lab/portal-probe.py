"""Manual real-compositor probe. Run only inside the disposable desktop lab."""
import json
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, '/source/app')
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GLib
from input_backend.portal import PortalInput

output = Path('/tmp/portal-probe.jsonl')
output.write_text('')
def record(value):
    with output.open('a') as stream:
        stream.write(json.dumps(value) + '\n')

window = Gtk.Window(title='Pocket Deck isolated Wayland input probe')
window.set_default_size(640, 420)
field = Gtk.TextView()
window.add(field)
field.get_buffer().connect('changed',lambda buffer:record({'text':buffer.get_text(buffer.get_start_iter(),buffer.get_end_iter(),True)}))
for signal in ('key-press-event', 'key-release-event', 'button-press-event', 'button-release-event', 'motion-notify-event', 'scroll-event'):
    field.add_events(Gdk.EventMask.ALL_EVENTS_MASK)
    field.connect(signal, lambda widget, event, name=signal: record({'event':name, 'key':getattr(event,'keyval',None), 'state':int(event.state), 'x':getattr(event,'x',None), 'y':getattr(event,'y',None)}) or False)
window.connect('destroy', Gtk.main_quit)
window.show_all()
field.grab_focus()
backend = PortalInput()
def enable():
    time.sleep(2)
    record({'before':backend.status()})
    backend.enable()
    record({'after':backend.status()})
threading.Thread(target=enable, daemon=True).start()
def run_input():
    flag=Path('/tmp/probe-go')
    if not flag.exists(): return True
    mode=flag.read_text().strip();flag.unlink()
    threading.Thread(target=send_input,args=(mode,),daemon=True).start()
    return True
def send_input(mode):
    try:
        if mode=='repeat':
            backend.send_key('A',False);time.sleep(1.2);backend.send_key('A',True)
            record({'repeat':'sent'});return
        if mode=='scroll':
            for _ in range(4):backend.send_mouse('mouse_scroll',0,-120);time.sleep(.05)
            record({'scroll':'sent'});return
        if mode=='close':
            backend.send_key('SHIFT',False);backend.send_mouse('mouse_down')
            time.sleep(.2);backend.close();record({'close':'completed'});return
        backend.send_key('A',False); backend.send_key('A',True)
        backend.send_mouse('mouse_down'); backend.send_mouse('mouse_move',30,15); backend.send_mouse('mouse_up')
        backend.send_mouse('mouse_scroll',0,120)
        backend.send_text('日本語の入力\n改行と絵文字🙂')
        record({'input':'sent', 'status':backend.status()})
    except Exception as error: record({'error':str(error)})
GLib.timeout_add(250, run_input)
Gtk.main()
backend.close()
