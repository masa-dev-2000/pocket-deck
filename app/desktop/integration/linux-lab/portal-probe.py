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
scroller = Gtk.ScrolledWindow()
scroller.add(field)
window.add(scroller)
scroller.get_vadjustment().connect('value-changed',lambda adjustment:record({'scrollPosition':adjustment.get_value()}))
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
        if mode in ('macro','cancel'):
            import server
            directory=Path('/tmp/probe-macro');directory.mkdir(exist_ok=True)
            app=server.App(directory/'config.json',server.Keyboard(backend.send_key),
                           text_emit=backend.send_text,mouse_emit=backend.send_mouse)
            if mode=='macro':
                steps=[{'kind':'shortcut','keys':'Ctrl+A'},
                       {'kind':'text','text':'連続操作🙂'}, {'kind':'wait','ms':150},
                       {'kind':'shortcut','keys':'Enter'}, {'kind':'text','text':'完了'}]
            else:
                steps=[{'kind':'press','key':'SHIFT'}, {'kind':'wait','ms':5000},
                       {'kind':'text','text':'SHOULD_NOT_EXECUTE'}]
            app.features.start({'id':'probe','type':'macro','label':'Real Wayland macro','steps':steps},'lab-owner')
            if mode=='cancel':
                time.sleep(.2);app.features.cancel_owner('lab-owner')
            until=time.monotonic()+4
            while app.features.running and time.monotonic()<until:time.sleep(.02)
            record({'mode':mode,'sequence':app.features.status(),'heldKeys':app.keyboard.held})
            return
        if mode=='repeat':
            backend.send_key('A',False);time.sleep(1.2);backend.send_key('A',True)
            record({'repeat':'sent'});return
        if mode in ('scroll','scroll-move'):
            prepared=threading.Event()
            def prepare_scroll():
                field.get_buffer().set_text('\n'.join('Scroll proof line '+str(i) for i in range(200)))
                field.get_buffer().place_cursor(field.get_buffer().get_start_iter())
                prepared.set()
                return False
            GLib.idle_add(prepare_scroll)
            if not prepared.wait(2):raise RuntimeError('scroll target did not prepare')
            time.sleep(.2)
            if mode=='scroll-move':backend.send_mouse('mouse_move',1,0);time.sleep(.1)
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
