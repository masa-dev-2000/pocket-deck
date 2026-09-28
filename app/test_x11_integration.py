"""Real XTest verification. Run only with xvfb-run, never a user's desktop."""
import ctypes as C
from ctypes.util import find_library
import os
import time
import unittest
from input_backend.x11 import X11Input

class NativeEvent(C.Structure):
    _fields_=[('type',C.c_int),('serial',C.c_ulong),('send_event',C.c_int),
        ('display',C.c_void_p),('window',C.c_ulong),('root',C.c_ulong),
        ('subwindow',C.c_ulong),('time',C.c_ulong),('x',C.c_int),('y',C.c_int),
        ('x_root',C.c_int),('y_root',C.c_int),('state',C.c_uint),
        ('detail',C.c_uint),('same_screen',C.c_int)]
class Event(C.Union):
    _fields_=[('event',NativeEvent),('padding',C.c_long*24)]

@unittest.skipUnless(os.environ.get('DECK_XVFB_TEST') == '1', 'explicit isolated Xvfb required')
class X11Integration(unittest.TestCase):
    def test_real_keys_pointer_drag_scroll_and_shutdown_release(self):
        x=C.CDLL(find_library('X11'))
        prototypes={
            'XOpenDisplay':([C.c_char_p],C.c_void_p),
            'XDefaultRootWindow':([C.c_void_p],C.c_ulong),
            'XCreateSimpleWindow':([C.c_void_p,C.c_ulong,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_uint,C.c_ulong,C.c_ulong],C.c_ulong),
            'XSelectInput':([C.c_void_p,C.c_ulong,C.c_long],C.c_int),
            'XMapWindow':([C.c_void_p,C.c_ulong],C.c_int),
            'XSetInputFocus':([C.c_void_p,C.c_ulong,C.c_int,C.c_ulong],C.c_int),
            'XWarpPointer':([C.c_void_p,C.c_ulong,C.c_ulong,C.c_int,C.c_int,C.c_uint,C.c_uint,C.c_int,C.c_int],C.c_int),
            'XSync':([C.c_void_p,C.c_int],C.c_int),
            'XPending':([C.c_void_p],C.c_int),
            'XNextEvent':([C.c_void_p,C.POINTER(Event)],C.c_int),
            'XCloseDisplay':([C.c_void_p],C.c_int)}
        for name,(args,result) in prototypes.items():
            getattr(x,name).argtypes=args;getattr(x,name).restype=result
        display=x.XOpenDisplay(os.environ['DISPLAY'].encode());self.assertTrue(display)
        backend=None
        try:
            window=x.XCreateSimpleWindow(display,x.XDefaultRootWindow(display),0,0,600,400,0,0,0)
            x.XSelectInput(display,window,1|2|4|8|64)
            x.XMapWindow(display,window);x.XSync(display,False)
            x.XSetInputFocus(display,window,1,0)
            x.XWarpPointer(display,0,window,0,0,0,0,100,100);x.XSync(display,False)
            def drain():
                time.sleep(.05);events=[]
                while x.XPending(display):
                    event=Event();x.XNextEvent(display,C.byref(event))
                    e=event.event;events.append((e.type,e.detail,e.state,e.x,e.y))
                return events
            drain();backend=X11Input()
            backend.send_key('CTRL',False);backend.send_key('A',False)
            backend.send_key('A',True);backend.send_key('CTRL',True)
            events=drain();self.assertEqual([e[0] for e in events],[2,2,3,3])
            self.assertTrue(events[1][2]&4,'A must be received with Ctrl held')
            backend.send_mouse('mouse_down');backend.send_mouse('mouse_move',30,20)
            backend.send_mouse('mouse_up');events=drain()
            self.assertEqual([e[0] for e in events],[4,6,5])
            self.assertTrue(events[1][2]&256,'drag movement must retain left button')
            self.assertEqual(events[1][3:],(130,120))
            backend.send_mouse('mouse_scroll',0,60);self.assertEqual(drain(),[])
            backend.send_mouse('mouse_scroll',0,60)
            self.assertEqual([(e[0],e[1]) for e in drain()],[(4,4),(5,4)])
            backend.send_key('SHIFT',False);backend.send_mouse('mouse_down');drain()
            backend.close();self.assertEqual([e[0] for e in drain()],[3,5])
        finally:
            if backend:backend.close()
            x.XCloseDisplay(display)

if __name__ == '__main__': unittest.main()
