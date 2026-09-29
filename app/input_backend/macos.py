"""macOS Quartz input. No shell or subprocess is started for input events."""
import ctypes as C
import threading

# Carbon virtual keycodes describe physical ANSI keys. F21–F24 and media keys
# have no equivalent keyboard event here; reject them rather than send a guess.
KEYCODES = {'A':0,'S':1,'D':2,'F':3,'H':4,'G':5,'Z':6,'X':7,'C':8,'V':9,
    'B':11,'Q':12,'W':13,'E':14,'R':15,'Y':16,'T':17,'1':18,'2':19,'3':20,
    '4':21,'6':22,'5':23,'9':25,'0':29,'O':31,'U':32,'I':34,'L':37,'J':38,
    'K':40,'N':45,'M':46}
KEYCODES.update({'7':26,'8':28,'P':35,'ENTER':36,'TAB':48,'SPACE':49,
    'BACKSPACE':51,'ESC':53,'SUPER':55,'SHIFT':56,'ALT':58,'CTRL':59,
    'HOME':115,'PAGEUP':116,'DELETE':117,'END':119,'PAGEDOWN':121,
    'LEFT':123,'RIGHT':124,'DOWN':125,'UP':126})
KEYCODES.update(dict(zip((f'F{i}' for i in range(1,21)),
    [122,120,99,118,96,97,98,100,101,109,103,111,105,107,113,106,64,79,80,90])))
MODIFIER_FLAGS = {'SHIFT':1<<17,'CTRL':1<<18,'ALT':1<<19,'SUPER':1<<20}


class Point(C.Structure):
    _fields_ = [('x',C.c_double),('y',C.c_double)]


class QuartzAPI:
    def __init__(self):
        self.cg=C.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        self.cf=C.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
        signatures={
            'CGPreflightPostEventAccess':([],C.c_bool),
            'CGRequestPostEventAccess':([],C.c_bool),
            'CGEventSourceCreate':([C.c_int32],C.c_void_p),
            'CGEventCreate':([C.c_void_p],C.c_void_p),
            'CGEventGetLocation':([C.c_void_p],Point),
            'CGEventCreateKeyboardEvent':([C.c_void_p,C.c_uint16,C.c_bool],C.c_void_p),
            'CGEventCreateMouseEvent':([C.c_void_p,C.c_uint32,Point,C.c_uint32],C.c_void_p),
            'CGEventSetFlags':([C.c_void_p,C.c_uint64],None),
            'CGEventSetIntegerValueField':([C.c_void_p,C.c_uint32,C.c_int64],None),
            'CGEventPost':([C.c_uint32,C.c_void_p],None),
            # Variadic signed int32 wheel values follow these fixed arguments.
            'CGEventCreateScrollWheelEvent':([C.c_void_p,C.c_uint32,C.c_uint32],C.c_void_p),
        }
        for name,(args,result) in signatures.items():
            function=getattr(self.cg,name);function.argtypes=args;function.restype=result
        self.cf.CFRelease.argtypes=[C.c_void_p];self.cf.CFRelease.restype=None
        self.source=None

    def trusted(self):return bool(self.cg.CGPreflightPostEventAccess())
    def request_access(self):return bool(self.cg.CGRequestPostEventAccess())

    def _source(self):
        if not self.source:
            self.source=self.cg.CGEventSourceCreate(-1)  # private event state
            if not self.source:raise RuntimeError('macOSの入力サービスを初期化できません。')
        return self.source

    def _post(self,event,flags=0,fields=()):
        if not event:raise RuntimeError('macOSの入力イベントを作成できません。')
        try:
            self.cg.CGEventSetFlags(event,flags)
            for field,value in fields:self.cg.CGEventSetIntegerValueField(event,field,value)
            self.cg.CGEventPost(0,event)  # kCGHIDEventTap
        finally:self.cf.CFRelease(event)

    def key(self,code,up,flags,repeat):
        event=self.cg.CGEventCreateKeyboardEvent(self._source(),code,not up)
        self._post(event,flags,((8,int(repeat)),))  # keyboard autorepeat

    def mouse(self,kind,dx,dy,dragging,flags):
        probe=self.cg.CGEventCreate(None)
        if not probe:raise RuntimeError('マウス位置を取得できません。')
        try:point=self.cg.CGEventGetLocation(probe)
        finally:self.cf.CFRelease(probe)
        event_type={'mouse_down':1,'mouse_up':2,'mouse_move':6 if dragging else 5}[kind]
        if kind=='mouse_move':point=Point(point.x+dx,point.y+dy)
        fields=((4,dx),(5,dy)) if kind=='mouse_move' else ((1,1),)
        self._post(self.cg.CGEventCreateMouseEvent(self._source(),event_type,point,0),flags,fields)

    def scroll(self,dx,dy,flags):
        # Quartz positive horizontal is left; the wire protocol is right-positive.
        event=self.cg.CGEventCreateScrollWheelEvent(self._source(),0,2,C.c_int32(dy),C.c_int32(-dx))
        self._post(event,flags,((88,1),))  # pixel/continuous scroll

    def close(self):
        if self.source:self.cf.CFRelease(self.source);self.source=None


class MacInput:
    paste_keys=('SUPER','V')  # Terminal.app also uses Command+V.
    def __init__(self,api=None):
        self.api=api or QuartzAPI()
        self.lock=threading.RLock();self.held_keys=set();self.button_held=False
        self.scroll_x=self.scroll_y=0.0;self.closed=False

    def _check(self):
        if self.closed:raise RuntimeError('macOS入力は終了しています。')
        if not self.api.trusted():
            raise RuntimeError('macOSのアクセシビリティ許可が必要です。PCアプリの「入力を許可」から設定してください。')

    def _flags(self,keys=None):
        return sum(MODIFIER_FLAGS.get(key,0) for key in (self.held_keys if keys is None else keys))

    def send_key(self,key,up):
        with self.lock:
            self._check()
            if key not in KEYCODES:raise RuntimeError(f'macOSでは{key}の入力に対応していません。')
            next_keys=self.held_keys-{key} if up else self.held_keys|{key}
            self.api.key(KEYCODES[key],up,self._flags(next_keys),not up and key in self.held_keys)
            self.held_keys=next_keys

    def send_mouse(self,kind,dx=0,dy=0):
        with self.lock:
            self._check()
            if kind=='mouse_click':
                if self.button_held:raise RuntimeError('ドラッグ中はクリックできません。先に保持を解除してください。')
                self.send_mouse('mouse_down');self.send_mouse('mouse_up')
            elif kind in ('mouse_down','mouse_up','mouse_move'):
                self.api.mouse(kind,dx,dy,self.button_held,self._flags())
                if kind!='mouse_move':self.button_held=kind=='mouse_down'
            elif kind=='mouse_scroll':
                # 120 wire units -> 30 pixels; preserve subpixel finger movements.
                x=self.scroll_x+dx/4;y=self.scroll_y+dy/4
                steps_x,steps_y=int(x),int(y)
                if steps_x or steps_y:self.api.scroll(steps_x,steps_y,self._flags())
                self.scroll_x=x-steps_x;self.scroll_y=y-steps_y
            else:raise ValueError('マウス操作が不正です。')

    def send_text(self,text,paste_mode='standard'):
        from .text import paste
        with self.lock:
            self._check()
            if self.held_keys:raise RuntimeError('文字入力の前に保持キーを解除してください。')
            paste(self,text,paste_mode=paste_mode)

    def repeat_settings(self):return .5,1/30

    def status(self):
        from .text import available
        ready=not self.closed and self.api.trusted()
        return {'platform':'darwin','backend':'quartz','state':'ready' if ready else 'permission',
                'keyboard':ready,'pointer':ready,'text':ready and available(),
                'canEnable':not self.closed and not ready,
                'reason':'' if ready else 'システム設定 → プライバシーとセキュリティ → アクセシビリティでPocket Deck（またはPocketDeckServer）を許可してください。',
                'unsupportedKeys':['F21','F22','F23','F24','VOLUMEUP','VOLUMEDOWN','MUTE','PLAYPAUSE']}

    def enable(self):
        if self.closed:raise RuntimeError('macOS入力は終了しています。')
        self.api.request_access()
        return self.status()  # request does not mean permission has been granted

    def close(self):
        with self.lock:
            if self.closed:return
            errors=[]
            for key in list(self.held_keys):
                try:self.send_key(key,True)
                except Exception as error:errors.append(error)
            if self.button_held:
                try:self.send_mouse('mouse_up')
                except Exception as error:errors.append(error)
            if errors:raise errors[0]  # do not claim releases succeeded after revocation
            self.api.close();self.closed=True
