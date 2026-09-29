"""Run checks without spawning console windows; write one consolidated log."""
from pathlib import Path
import subprocess
import sys
import shutil

ROOT=Path(__file__).resolve().parent
flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
commands=[[sys.executable,'-m','unittest','-v','test_server.py','test_features.py','test_input_backend.py','test_desktop_bridge.py','test_macos.py']]
if sys.platform == 'win32': commands.append([sys.executable,'build_chrome.py'])
node=shutil.which('node')
for file in ['test_editor.js','test_reorder.js','test_layout.js','test_group.js','test_lines.js','test_preview.js','test_input_modes.js','test_pad.js','test_wheel.js','test_wheel_hold.js','test_wheel_browser_timer.js','test_extras.js','test_chrome.js']:
    commands.append([node,file])
with (ROOT/'checks.log').open('w',encoding='utf-8') as log:
    failed=False
    for command in commands:
        log.write('RUN '+str(command[1:])+'\n');log.flush()
        result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,creationflags=flags)
        failed|=bool(result.returncode)
    log.write('RESULT: '+('FAIL' if failed else 'PASS')+'\n')
sys.exit(1 if failed else 0)
