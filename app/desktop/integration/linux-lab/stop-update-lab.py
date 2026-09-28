"""Stop only the disposable WSL updater app and its owned display harness."""
import os
from pathlib import Path
import signal
import time

data=b'/tmp/pocket-deck-update-check/Pocket Deck/data'
owned=set()
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        if (process/'exe').readlink().name!='PocketDeckServer' or data not in (process/'cmdline').read_bytes():continue
        stat=(process/'stat').read_text();parent=Path('/proc')/stat[stat.rfind(')')+2:].split()[1]
        if (parent/'exe').readlink().name=='pocket-deck-desktop' and parent.stat().st_uid==os.getuid():owned.add(parent)
    except OSError:pass
assert len(owned)==1,f'expected exactly one disposable updater app: {owned}'
for process in owned:os.kill(int(process.name),signal.SIGTERM)
until=time.monotonic()+10
while any((p/'exe').exists() for p in owned) and time.monotonic()<until:time.sleep(.1)
assert not any((p/'exe').exists() for p in owned),'disposable app did not stop'
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        args=(process/'cmdline').read_bytes().split(b'\0')
        if process.stat().st_uid==os.getuid() and any(arg.endswith(b'/linux-lab/run-update-fixture.py') for arg in args):
            os.kill(int(process.name),signal.SIGTERM)
    except OSError:pass
print('Stopped only the private updater test application and harness.')
