"""Verify actual npm-installed AppImage update and its unchanged launch path."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

root=Path('/tmp/deck-npm-test')
state_path=root/'data-home/pocket-deck/installation.json'
expected=json.loads((root/'expected-config.json').read_text())
for _ in range(100):
    try:
        state=json.loads(state_path.read_text())
        with urlopen('http://127.0.0.1:8765/api/config',timeout=1) as response:actual=json.load(response)
        if state['version']=='1.0.5':break
    except (OSError,ValueError):pass
    time.sleep(.1)
else:raise RuntimeError('updated npm application did not restart and record its new version')
assert actual==expected
assert state['file']=='Pocket-Deck.AppImage'
image=root/'data-home/pocket-deck'/state['file']
feed=Path('/tmp/pocket-deck-update-fixture/feed/Pocket-Deck-1.0.5-x86_64.AppImage')
assert hashlib.sha256(image.read_bytes()).digest()==hashlib.sha256(feed.read_bytes()).digest()
assert state['process']['pid']!=json.loads((root/'initial-installation.json').read_text())['process']['pid']
assert Path('/proc/'+str(state['process']['pid'])+'/exe').readlink().name=='pocket-deck-desktop'
wrapper=root/'data-home/pocket-deck/pocket-deck'
assert str(image) in wrapper.read_text()
env={**os.environ,'DISPLAY':':178','XDG_SESSION_TYPE':'x11','XDG_RUNTIME_DIR':str(root/'runtime'),
     'XDG_CONFIG_HOME':str(root/'config-home'),'XDG_DATA_HOME':str(root/'data-home'),'APPIMAGE_EXTRACT_AND_RUN':'1'}
env.pop('WAYLAND_DISPLAY',None)
result=subprocess.run([str(wrapper)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=30)
assert result.returncode==0,result.stdout.decode(errors='replace')[-2000:]
assert json.loads(state_path.read_text())==state,'launching the wrapper created a second application'
renderers=[]
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        command=(process/'cmdline').read_bytes()
        if b'--type=renderer' in command and bytes(root/'config-home/Pocket Deck') in command:
            status=(process/'status').read_text()
            assert 'Seccomp:\t2' in status and b'--enable-sandbox' in command
            renderers.append(int(process.name))
    except OSError:pass
assert renderers,'no sandboxed renderer found'
print(json.dumps({'updatedVersion':state['version'],'stableLaunchPath':True,'configurationPreserved':True,
                  'installationRecordUpdated':True,'wrapperReopenedExistingApp':True,'sandboxedRendererCount':len(renderers)}))
