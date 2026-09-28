"""Start private deb in the real desktop login session for OS update auth."""
import os
from pathlib import Path
import subprocess
assert Path('/var/tmp/deck-lab-ready').exists() and os.getuid()==1000
env={**os.environ,'XDG_CONFIG_HOME':'/home/deck/pocket-deck-desktop-check/config',
     'XDG_DATA_HOME':'/home/deck/pocket-deck-desktop-check/data',
     'XDG_CACHE_HOME':'/home/deck/pocket-deck-desktop-check/cache'}
with Path('/tmp/deb-session.log').open('w') as log:
    result=subprocess.run(['/opt/Pocket Deck/pocket-deck-desktop'],env=env,stdout=log,stderr=subprocess.STDOUT)
raise SystemExit(result.returncode)
