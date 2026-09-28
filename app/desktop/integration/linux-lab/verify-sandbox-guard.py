"""Actual packaged guard test. Confirm its error dialog in the private X display."""
import json
import os
from pathlib import Path
import subprocess
from urllib.request import urlopen

root=Path('/tmp/deck-sandbox-policy-check');root.mkdir(exist_ok=True)
subprocess.run(['xdpyinfo','-display',':178'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
env={**os.environ,'DISPLAY':':178','XDG_SESSION_TYPE':'x11',
     'XDG_RUNTIME_DIR':'/tmp/deck-npm-test/runtime','XDG_CONFIG_HOME':str(root/'config'),
     'XDG_DATA_HOME':str(root/'data'),'APPIMAGE_EXTRACT_AND_RUN':'1'}
env.pop('WAYLAND_DISPLAY',None)
env.pop('POCKET_DECK_NPM_INSTALL_DIR',None)
with urlopen('http://127.0.0.1:8765/api/config',timeout=3) as response:before=json.load(response)
with (root/'guard.log').open('ab') as output:
    child=subprocess.Popen(['/tmp/pocket-deck-sandbox-fixture/Pocket-Deck-1.0.4-x86_64.AppImage','--no-sandbox'],
                           env=env,stdout=output,stderr=subprocess.STDOUT)
    print('Confirm the private sandbox error dialog; test PID '+str(child.pid),flush=True)
    assert child.wait(timeout=120)==0
assert not (root/'config/Pocket Deck/data').exists(), 'blocked app created backend data'
with urlopen('http://127.0.0.1:8765/api/config',timeout=3) as response:after=json.load(response)
assert before==after, 'blocked app altered the other private application'
print('Packaged Linux sandbox guard exited without starting input or changing configuration.')
