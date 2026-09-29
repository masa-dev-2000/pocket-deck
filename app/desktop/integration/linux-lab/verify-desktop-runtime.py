"""Load packaged dependency graph as Node, without starting desktop main/UI."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile

source=Path(__file__).resolve().parents[4]
target=Path('/tmp/pocket-deck-package') if sys.platform=='linux' else source.parent/'pocket-deck-release-work'
directory=target/'app/desktop-dist'/('linux-unpacked' if sys.platform=='linux' else 'win-unpacked')
if len(sys.argv)==2:directory=Path(sys.argv[1]).resolve()
version=json.loads((source/'app/desktop/package.json').read_text())['version']
if sys.platform=='darwin':
    binary=directory/'Contents/MacOS/Pocket Deck'
    archive=directory/'Contents/Resources/app.asar'
else:
    binary=directory/('pocket-deck-desktop' if sys.platform=='linux' else 'Pocket Deck.exe')
    archive=directory/'resources/app.asar'
assert binary.is_file() and archive.is_file()
with tempfile.TemporaryDirectory(prefix='deck-packaged-runtime-') as temporary:
    script=Path(temporary)/'verify.cjs'
    script.write_text("const root=process.argv[2];const pkg=require(root+'/package.json');"
                     "if(pkg.version!==process.argv[3])throw Error('Unexpected release version');"
                     "const updates=require(root+'/node_modules/electron-updater');"
                     "for(const name of ['NsisUpdater','DebUpdater','AppImageUpdater','MacUpdater'])"
                     "if(typeof updates[name]!=='function')throw Error('Missing updater '+name);"
                     "require(root+'/updates.cjs');require(root+'/backend.cjs');"
                     "require(root+'/chrome-setup.cjs');require(root+'/sandbox-policy.cjs');"
                     "require(root+'/linux-deb-update.cjs');"
                     "console.log('Packaged '+pkg.version+' dependency graph PASS; desktop main not started');")
    env={**os.environ,'ELECTRON_RUN_AS_NODE':'1'}
    result=subprocess.run([str(binary),str(script),str(archive),version],env=env,text=True,capture_output=True,
                          creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0),timeout=45)
    print(result.stdout);print(result.stderr)
    raise SystemExit(result.returncode)
