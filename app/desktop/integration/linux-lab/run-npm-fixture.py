"""Real npm global lifecycle and AppImage update in a private WSL X display."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
from urllib.request import Request,urlopen

root=Path('/tmp/deck-npm-test')
fixture=json.loads((root/'fixture.json').read_text())
runtime=root/'runtime';runtime.mkdir(exist_ok=True);runtime.chmod(0o700)
env={**os.environ,'DISPLAY':':178','XDG_SESSION_TYPE':'x11','XDG_RUNTIME_DIR':str(runtime),
     'XDG_CONFIG_HOME':str(root/'config-home'),'XDG_DATA_HOME':str(root/'data-home'),
     'LOCALAPPDATA':str(root/'download-cache'),'APPIMAGE_EXTRACT_AND_RUN':'1'}
env.pop('WAYLAND_DISPLAY',None)
children=[]
def launch(args,name):
    child=subprocess.Popen(args,env=env,stdout=(root/name).open('ab'),stderr=subprocess.STDOUT)
    children.append(child);return child
def stop(signum,frame):raise SystemExit()
signal.signal(signal.SIGTERM,stop)
try:
    assert not Path('/tmp/.X11-unix/X178').exists(),'private test display is already in use'
    # Never send configuration changes to an unrelated running backend.
    with socket.socket() as guard:
        guard.bind(('127.0.0.1',8765))
    launch(['Xvfb',':178','-screen','0','1440x1000x24','-ac','-nolisten','tcp'],'display.log')
    launch(['python3','-m','http.server','9998','--bind','127.0.0.1','--directory','/tmp/pocket-deck-update-fixture/feed'],'feed.log')
    time.sleep(1)
    launch(['x11vnc','-display',':178','-forever','-shared','-nopw','-listen','127.0.0.1','-rfbport','5908'],'vnc.log')
    subprocess.run(['npm','install','--global','--prefix',str(root/'prefix'),'--cache',str(root/'npm-cache'),
                    '--userconfig',str(root/'npmrc'),'--offline','--foreground-scripts',fixture['tarball']],env=env,check=True)
    for _ in range(600):
        try:
            with urlopen('http://127.0.0.1:8765/api/config',timeout=1) as response:config=json.load(response)
            break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('npm-installed AppImage backend did not start')
    installed=json.loads((root/'data-home/pocket-deck/installation.json').read_text())
    pid=installed['process']['pid']
    assert Path('/proc/'+str(pid)+'/exe').readlink().name=='pocket-deck-desktop'
    owned_backend=False
    for child in Path('/proc').iterdir():
        if not child.name.isdigit():continue
        try:
            if ((child/'exe').readlink().name=='PocketDeckServer'
                and str(root/'config-home/Pocket Deck/data').encode() in (child/'cmdline').read_bytes()
                and (child/'stat').read_text().split(')')[-1].split()[1]==str(pid)):
                owned_backend=True;break
        except OSError:pass
    assert owned_backend, 'private backend ownership was not verified'
    config['layouts'][0]['buttons'][0]['label']='npm update persistence proof'
    request=Request('http://127.0.0.1:8765/api/config',json.dumps(config).encode(),{'Content-Type':'application/json'})
    with urlopen(request,timeout=3) as response:expected=json.load(response)
    assert json.loads((root/'config-home/Pocket Deck/data/config.json').read_text())==expected
    (root/'expected-config.json').write_text(json.dumps(expected))
    state=json.loads((root/'data-home/pocket-deck/installation.json').read_text())
    assert state['file']=='Pocket-Deck.AppImage' and state['version']=='1.0.4' and state['process']['pid']>0
    (root/'initial-installation.json').write_text(json.dumps(state))
    print('Real npm global install and private desktop startup verified; confirm the private update prompt.',flush=True)
    while True:time.sleep(1)
finally:
    for child in reversed(children):
        if child.poll() is None:child.terminate()
    for child in children:
        try:child.wait(timeout=3)
        except subprocess.TimeoutExpired:child.kill();child.wait()
