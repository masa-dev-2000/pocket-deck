"""Build private AppImage updater fixtures; never publish them."""
import copy
import json
from pathlib import Path
import subprocess

desktop=Path('/tmp/pocket-deck-package/app/desktop')
manifest=desktop/'package.json'
original=manifest.read_text()
config=json.loads(original)
try:
    for version,destination in [('1.0.4','old'),('1.0.5','feed')]:
        test=copy.deepcopy(config);test['version']=version
        test['build']['publish']={'provider':'generic','url':'http://127.0.0.1:9998'}
        test['build']['directories']['output']='/tmp/pocket-deck-update-fixture/'+destination
        manifest.write_text(json.dumps(test,indent=2))
        with open('/tmp/pocket-deck-update-build.log','a') as log:
            subprocess.run(['npm','exec','electron-builder','--','--linux','AppImage','--x64','--publish','never'],cwd=desktop,stdout=log,stderr=subprocess.STDOUT,check=True)
finally:
    manifest.write_text(original)
