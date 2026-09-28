"""Real npm update must leave the running private desktop and data unchanged."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

root=Path('/tmp/deck-npm-test')
state=root/'data-home/pocket-deck/installation.json'
image=root/'data-home/pocket-deck/Pocket-Deck.AppImage'
config=root/'config-home/Pocket Deck/data/config.json'
before=(state.read_bytes(),hashlib.sha256(image.read_bytes()).hexdigest(),config.read_bytes())
env={**os.environ,'XDG_DATA_HOME':str(root/'data-home'),'XDG_CONFIG_HOME':str(root/'config-home'),
     'LOCALAPPDATA':str(root/'download-cache')}
result=subprocess.run(['npm','install','--global','--prefix',str(root/'prefix'),'--cache',str(root/'npm-cache'),
                       '--userconfig',str(root/'npmrc'),'--offline','--foreground-scripts',str(root/'masadev-pocket-deck-1.0.5.tgz')],
                      env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
assert result.returncode!=0 and '完全に終了' in result.stdout,result.stdout
assert before==(state.read_bytes(),hashlib.sha256(image.read_bytes()).hexdigest(),config.read_bytes())
print('Real npm update refused a running AppImage; artifact, installation state and configuration unchanged.')
