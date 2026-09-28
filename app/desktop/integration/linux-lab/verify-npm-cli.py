"""Install the CLI matching an already updated app and exercise Linux dispatch."""
import json
import os
from pathlib import Path
import subprocess

root=Path('/tmp/deck-npm-test')
env={**os.environ,'DISPLAY':':178','XDG_SESSION_TYPE':'x11','XDG_RUNTIME_DIR':str(root/'runtime'),
     'XDG_CONFIG_HOME':str(root/'config-home'),'XDG_DATA_HOME':str(root/'data-home'),
     'LOCALAPPDATA':str(root/'download-cache'),'APPIMAGE_EXTRACT_AND_RUN':'1'}
env.pop('WAYLAND_DISPLAY',None)
state=root/'data-home/pocket-deck/installation.json'
config=root/'config-home/Pocket Deck/data/config.json'
before=(state.read_bytes(),config.read_bytes())
result=subprocess.run(['npm','install','--global','--prefix',str(root/'prefix'),'--cache',str(root/'npm-cache'),
                       '--userconfig',str(root/'npmrc'),'--offline','--foreground-scripts',str(root/'masadev-pocket-deck-1.0.5.tgz')],
                      env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=60)
assert result.returncode==0,result.stdout
command=root/'prefix/bin/pocket-deck'
assert subprocess.check_output([str(command),'--version'],env=env,text=True).strip()=='1.0.5'
assert 'Ubuntu' in subprocess.check_output([str(command),'--help'],env=env,text=True)
result=subprocess.run([str(command),'install'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=30)
assert result.returncode==0,result.stdout
assert (state.read_bytes(),config.read_bytes())==before
print('Real global CLI version/help/Linux install succeeded; existing updated app and configuration preserved.')
