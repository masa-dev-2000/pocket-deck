"""Verify the private AppImage in the actual Ubuntu VM without altering data."""
import json
import os
import sys
from pathlib import Path
from urllib.request import urlopen

assert Path('/var/tmp/deck-lab-ready').exists(), 'disposable VM required'
kind=sys.argv[1] if len(sys.argv)>1 else 'AppImage'
assert kind in ('AppImage','deb')
root=Path('/home/deck/pocket-deck-desktop-check/config/Pocket Deck')
backend=[];renderers=[]
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        if process.stat().st_uid!=os.getuid():continue
        executable=(process/'exe').readlink()
        command=(process/'cmdline').read_bytes()
        if executable.name=='PocketDeckServer' and bytes(root/'data') in command:
            parent=(process/'stat').read_text().split(')')[-1].split()[1]
            parent_executable=(Path('/proc')/parent/'exe').readlink()
            assert parent_executable.name=='pocket-deck-desktop'
            if kind=='AppImage':assert str(parent_executable).startswith('/tmp/appimage_extracted_')
            else:assert str(parent_executable)=='/opt/Pocket Deck/pocket-deck-desktop'
            backend.append(int(process.name))
        if b'--type=renderer' in command and bytes(root) in command:
            assert b'--enable-sandbox' in command and b'--no-sandbox' not in command
            assert 'Seccomp:\t2' in (process/'status').read_text()
            renderers.append(int(process.name))
    except OSError:pass
assert len(backend)==1,backend
assert renderers,'no sandboxed renderer found'
with urlopen('http://127.0.0.1:8765/api/config',timeout=10) as response:
    config=json.load(response)
assert config['version']==5 and config['layouts'][0]['buttons']
print(json.dumps({'privateBundledBackend':backend,'sandboxedRenderers':renderers,
                  'configurationVersion':config['version'],'packageType':kind}))
