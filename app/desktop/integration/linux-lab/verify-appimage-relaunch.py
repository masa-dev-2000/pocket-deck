"""Real AppImage relaunch with new npm launchers in the private Xvfb lab."""
import json
import os
from pathlib import Path
import signal
import subprocess
import time
from urllib.request import urlopen

root=Path('/tmp/deck-npm-test')
expected=json.loads((root/'expected-config.json').read_text())
state=json.loads((root/'data-home/pocket-deck/installation.json').read_text())
main=Path('/proc')/str(state['process']['pid'])
owned=[]
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        if (str((process/'exe').readlink()).removesuffix(' (deleted)').endswith('/PocketDeckServer')
            and bytes(root/'config-home/Pocket Deck/data') in (process/'cmdline').read_bytes()
            and (process/'stat').read_text().split(')')[-1].split()[1]==main.name):owned.append(process)
    except OSError:pass
assert len(owned)==1,'one private backend required before stopping the test app'
assert str((main/'exe').readlink()).removesuffix(' (deleted)').endswith('/pocket-deck-desktop')
os.kill(int(main.name),signal.SIGTERM)
deadline=time.monotonic()+20
while (main/'exe').exists() and time.monotonic()<deadline:time.sleep(.1)
assert not (main/'exe').exists(),'private app did not stop'

data=root/'relaunch-data'
env={**os.environ,'DISPLAY':':178','XDG_SESSION_TYPE':'x11','XDG_RUNTIME_DIR':str(root/'runtime'),
     'XDG_CONFIG_HOME':str(root/'config-home'),'XDG_DATA_HOME':str(data)}
env.pop('WAYLAND_DISPLAY',None)
module=Path(__file__).resolve().parents[4]/'npm/bin/linux-install.cjs'
image=Path('/tmp/pocket-deck-sandbox-fixture/Pocket-Deck-1.0.4-x86_64.AppImage')
subprocess.run(['node','-e',"require(process.argv[1]).install({version:'1.0.4',downloadImpl:async()=>process.argv[2]}).catch(e=>{console.error(e);process.exit(1)});",str(module),str(image)],env=env,check=True)
record=data/'pocket-deck/installation.json'
deadline=time.monotonic()+90
while time.monotonic()<deadline:
    try:
        fresh=json.loads(record.read_text())
        with urlopen('http://127.0.0.1:8765/api/config',timeout=1) as response:config=json.load(response)
        if fresh.get('process') and config==expected:break
    except (OSError,ValueError):pass
    time.sleep(.2)
else:raise RuntimeError('new private launcher did not start')
main=Path('/proc')/str(fresh['process']['pid'])
executable=(main/'exe').readlink()
assert executable.exists(),'initial extraction is missing'
asar=executable.parent/'resources/app.asar'
assert asar.exists()
wrapper=data/'pocket-deck/pocket-deck'
assert 'NO_CLEANUP=1' in wrapper.read_text()
for _ in range(2):
    result=subprocess.run([str(wrapper)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=40)
    assert result.returncode==0,result.stdout.decode(errors='replace')[-1000:]
    assert executable.exists() and asar.exists(),'second-instance cleanup deleted live resources'
    assert json.loads(record.read_text())==fresh,'another main instance replaced the record'
    with urlopen('http://127.0.0.1:8765/api/config',timeout=3) as response:assert json.load(response)==expected
print(json.dumps({'realNewInstaller':True,'repeatLaunches':2,'liveResourcesPreserved':True,
                  'configurationPreserved':True,'privateMainPid':int(main.name)}))
