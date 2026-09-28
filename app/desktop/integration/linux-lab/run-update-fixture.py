"""Keep an isolated X display alive while AppImage updater restarts the app."""
import json
import os
from pathlib import Path
import signal
import subprocess
import time
from urllib.request import Request,urlopen

def stop_previous_lab_app():
    for process in Path('/proc').iterdir():
        if not process.name.isdigit():continue
        try:
            args=(process/'cmdline').read_bytes().split(b'\0')
            environment=(process/'environ').read_bytes().split(b'\0')
            if Path(os.fsdecode(args[0])).name=='pocket-deck-desktop' and not any(arg.startswith(b'--type=') for arg in args) and b'XDG_CONFIG_HOME=/tmp/pocket-deck-install-check' in environment:
                os.kill(int(process.name),signal.SIGTERM)
        except (OSError,IndexError):pass
    for _ in range(50):
        if not Path('/tmp/.X11-unix/X177').exists() and not Path('/tmp/.X177-lock').exists():return
        time.sleep(.1)
    raise RuntimeError('previous disposable display did not stop')

stop_previous_lab_app()
runtime=Path('/tmp/pocket-deck-x11-runtime');runtime.mkdir(exist_ok=True);runtime.chmod(0o700)
env={**os.environ,'DISPLAY':':177','XDG_SESSION_TYPE':'x11','XDG_RUNTIME_DIR':str(runtime),'XDG_CONFIG_HOME':'/tmp/pocket-deck-update-check','APPIMAGE_EXTRACT_AND_RUN':'1'}
env.pop('WAYLAND_DISPLAY',None)
children=[]
def launch(args,log,environment=env):
    child=subprocess.Popen(args,env=environment,stdout=open(log,'ab'),stderr=subprocess.STDOUT);children.append(child);return child
def stop(signum,frame):raise SystemExit()
signal.signal(signal.SIGTERM,stop)
try:
    launch(['Xvfb',':177','-screen','0','1440x1000x24','-ac','-nolisten','tcp'],'/tmp/deck-update-display.log')
    launch(['python3','-m','http.server','9998','--bind','127.0.0.1','--directory','/tmp/pocket-deck-update-fixture/feed'],'/tmp/deck-update-feed.log')
    time.sleep(1)
    launch(['x11vnc','-display',':177','-forever','-shared','-nopw','-listen','127.0.0.1','-rfbport','5906'],'/tmp/deck-update-vnc.log')
    launch(['/tmp/pocket-deck-update-fixture/old/Pocket-Deck-1.0.4-x86_64.AppImage','--ozone-platform=x11','--disable-gpu'],'/tmp/deck-update-app.log')
    for _ in range(600):
        try:
            with urlopen('http://127.0.0.1:8765/api/config',timeout=1) as response:config=json.load(response)
            break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('test AppImage backend did not start')
    config['layouts'][0]['buttons'][0]['label']='Update persistence proof'
    request=Request('http://127.0.0.1:8765/api/config',json.dumps(config).encode(),{'Content-Type':'application/json'})
    with urlopen(request,timeout=2) as response:expected=json.load(response)
    Path('/tmp/deck-update-expected.json').write_text(json.dumps(expected))
    print('Isolated updater fixture is ready; confirm its native update prompt.',flush=True)
    while True:time.sleep(1)
finally:
    for child in reversed(children):
        if child.poll() is None:child.terminate()
    for child in children:
        try:child.wait(timeout=3)
        except subprocess.TimeoutExpired:child.kill();child.wait()
