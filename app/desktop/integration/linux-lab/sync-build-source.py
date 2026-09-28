"""Copy source-only inputs to the disposable Linux build, never user settings."""
import json
from pathlib import Path
import shutil
import subprocess
import sys

assert sys.platform in ('linux','win32')
source=Path(__file__).resolve().parents[4]
target=Path('/tmp/pocket-deck-package') if sys.platform=='linux' else source.parent/'pocket-deck-release-work'
desktop=target/'app/desktop';desktop.mkdir(parents=True,exist_ok=True)
if sys.platform=='win32':
    dependencies=desktop/'node_modules'
    expected=source/'app/desktop/node_modules'
    assert (expected/'electron-builder').is_dir(),'Windows build dependencies required'
    if not dependencies.exists():
        subprocess.run(['cmd.exe','/d','/c','mklink','/J',str(dependencies),str(expected)],check=True,
                       creationflags=subprocess.CREATE_NO_WINDOW,capture_output=True)
    assert dependencies.resolve()==expected.resolve(),'private build dependency link must match source'
assert (target/'app/desktop/node_modules/electron-builder').is_dir(),'private build dependencies required'
for file in (source/'app').iterdir():
    if file.suffix in ('.py','.js','.html','.css'):
        shutil.copy2(file,target/'app'/file.name)
for directory in ('input_backend','chrome-extension','vendor'):
    shutil.copytree(source/'app'/directory,target/'app'/directory,dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
config=json.loads((source/'app/desktop/package.json').read_text())
for name in [*config['build']['files'],'build_backend.py','requirements-build.txt','test_packaged.py','test_packaged_chrome.py']:
    shutil.copy2(source/'app/desktop'/name,target/'app/desktop'/name)
if sys.platform=='win32':shutil.copy2(source/'app/desktop/chrome_launcher.cs',desktop/'chrome_launcher.cs')
for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):
    shutil.copy2(source/name,target/name)
shutil.copytree(source/'license-notices',target/'license-notices',dirs_exist_ok=True)
print('Source, UI and packaged license inputs synchronized; no user configuration copied.')
