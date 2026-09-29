"""Build a redistributable backend without bundling the user's configuration."""
from pathlib import Path
import subprocess
import sys
import os
import shutil
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
IS_WINDOWS=sys.platform=='win32'
CREATE_FLAGS=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0
image=Image.new('RGBA',(256,256),'#14212e');draw=ImageDraw.Draw(image)
for x,y,color in [(40,40,'#8be4d4'),(144,40,'#438e72'),(40,144,'#438e72'),(144,144,'#8be4d4')]:
    draw.rounded_rectangle((x,y,x+72,y+72),radius=16,fill=color)
image.save(HERE/'icon.png');image.save(HERE/'icon.ico',sizes=[(16,16),(32,32),(48,48),(256,256)])
if sys.platform=='darwin':image.resize((1024,1024),Image.Resampling.LANCZOS).save(HERE/'icon.png')
command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onedir','--name','PocketDeckServer',
         '--distpath',str(HERE/'backend-build'),'--workpath',str(HERE/'backend-work'),'--specpath',str(HERE),
         '--paths',str(ROOT/'vendor'),'--hidden-import','qrcode.image.svg','--hidden-import','chrome_host','--collect-all','PIL']
if sys.platform=='linux':
    command+=['--hidden-import','input_backend.portal','--hidden-import','dbus_next']
elif sys.platform=='darwin':command+=['--hidden-import','input_backend.macos']
for file in ROOT.iterdir():
    if file.suffix in ('.js','.html','.css') and not file.name.startswith('test_'):
        command+=['--add-data',str(file)+os.pathsep+'.']
command+=[str(ROOT/'server.py')]
with (HERE/'backend-build.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,creationflags=CREATE_FLAGS)
if result.returncode:sys.exit(result.returncode)
destination=HERE/'backend-build'/'PocketDeckServer'
if IS_WINDOWS:
    compiler=Path(os.environ.get('WINDIR',r'C:\Windows'))/'Microsoft.NET'/'Framework64'/'v4.0.30319'/'csc.exe'
    subprocess.run([str(compiler),'/nologo','/target:winexe','/out:'+str(destination/'PocketDeckChromeHost.exe'),str(HERE/'chrome_launcher.cs')],check=True,capture_output=True,creationflags=CREATE_FLAGS)
else:
    # ChromeSetup creates a stable user-owned launcher with the actual data directory.
    launcher=destination/'PocketDeckChromeHost'
    launcher.write_text('#!/bin/sh\nexec "$(dirname "$0")/PocketDeckServer" --chrome-host\n',encoding='utf-8')
    launcher.chmod(0o755)
shutil.copytree(ROOT/'chrome-extension',destination/'chrome-extension',dirs_exist_ok=True)
