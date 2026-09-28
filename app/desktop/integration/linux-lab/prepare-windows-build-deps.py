"""Use a real, locked private dependency tree; never package a junction."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

assert sys.platform=='win32'
source=Path(__file__).resolve().parents[4]
desktop=source.parent/'pocket-deck-release-work/app/desktop'
dependencies=desktop/'node_modules';expected=source/'app/desktop/node_modules'
if dependencies.exists() and dependencies.resolve()!=dependencies.absolute():
    assert dependencies.resolve()==expected.resolve(),'unexpected private dependency link'
    # rmdir on a Windows directory junction removes only that link, not its target.
    assert desktop.resolve().is_relative_to((source.parent/'pocket-deck-release-work').resolve())
    os.rmdir(dependencies)
    assert expected.is_dir(),'source dependencies must remain intact'
node=shutil.which('node');npm=shutil.which('npm.cmd');assert node and npm
cli=Path(npm).parent/'node_modules/npm/bin/npm-cli.js';assert cli.is_file()
with (desktop/'dependency-install.log').open('w',encoding='utf-8') as log:
    result=subprocess.run([node,str(cli),'ci','--ignore-scripts','--no-audit','--no-fund'],cwd=desktop,
                          stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
assert dependencies.resolve()==dependencies.absolute(),'private dependency tree must not be a junction'
print('Private locked Windows dependencies '+('PASS' if result.returncode==0 else 'FAIL'))
raise SystemExit(result.returncode)
