"""Observe only; the packaged private PC app supplies all synthetic input."""
import json
from pathlib import Path
import gi
gi.require_version('Gtk','3.0')
from gi.repository import Gtk,Gdk

assert Path('/var/tmp/deck-lab-ready').exists(),'disposable VM required'
output=Path('/tmp/lost-session-events.jsonl');output.write_text('')
def record(value):
    with output.open('a') as stream:stream.write(json.dumps(value)+'\n')
window=Gtk.Window(title='Pocket Deck passive session-loss probe')
window.set_default_size(640,420)
field=Gtk.TextView();field.add_events(Gdk.EventMask.ALL_EVENTS_MASK)
window.add(field)
for signal in ('key-press-event','key-release-event','button-press-event','button-release-event','motion-notify-event'):
    field.connect(signal,lambda widget,event,name=signal:record({'event':name,'key':getattr(event,'keyval',None),'state':int(event.state)}) or False)
window.connect('destroy',Gtk.main_quit)
window.show_all();field.grab_focus();Gtk.main()
