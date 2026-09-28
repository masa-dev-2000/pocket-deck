"""Package both platforms in the source-only private build directories."""
from pathlib import Path
import shutil
import subprocess
import sys

source=Path(__file__).resolve().parents[4]
target=Path('/tmp/pocket-deck-package') if sys.platform=='linux' else source.parent/'pocket-deck-release-work'
desktop=target/'app/desktop'
assert desktop.exists() and (desktop/'backend-build/PocketDeckServer').is_dir()
node=shutil.which('node');assert node
cli=desktop/'node_modules/electron-builder/out/cli/cli.js';assert cli.is_file()
arguments=['--linux','AppImage','deb'] if sys.platform=='linux' else ['--win','nsis']
if sys.argv[1:]==['--update-fixture']:
    assert sys.platform=='linux','private deb update fixture is Linux-only'
    arguments=['--linux','deb','--config.extraMetadata.version=1.1.1',
               '--config.directories.output=/tmp/pocket-deck-deb-update-feed']
elif sys.argv[1:]:raise ValueError('unknown build arguments')
with (desktop/'release-build.log').open('w',encoding='utf-8') as log:
    result=subprocess.run([node,str(cli),*arguments,'--x64','--publish','never'],cwd=desktop,
                          stdout=log,stderr=subprocess.STDOUT,
                          creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
print('Private '+sys.platform+' desktop build '+('PASS' if result.returncode==0 else 'FAIL')+
      '; log: '+str(desktop/'release-build.log'))
raise SystemExit(result.returncode)
