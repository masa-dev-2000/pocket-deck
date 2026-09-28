"""Build a redistributable backend without bundling the user's configuration."""
from pathlib import Path
import subprocess
import sys
import os
import shutil
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
image=Image.new('RGBA',(256,256),'#14212e');draw=ImageDraw.Draw(image)
for x,y,color in [(40,40,'#8be4d4'),(144,40,'#438e72'),(40,144,'#438e72'),(144,144,'#8be4d4')]:
    draw.rounded_rectangle((x,y,x+72,y+72),radius=16,fill=color)
image.save(HERE/'icon.png');image.save(HERE/'icon.ico',sizes=[(16,16),(32,32),(48,48),(256,256)])
command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onedir','--name','PocketDeckServer',
         '--distpath',str(HERE/'backend-build'),'--workpath',str(HERE/'backend-work'),'--specpath',str(HERE),
         '--paths',str(ROOT/'vendor'),'--hidden-import','qrcode.image.svg','--hidden-import','chrome_host','--collect-all','PIL']
for file in ROOT.iterdir():
    if file.suffix in ('.js','.html','.css') and not file.name.startswith('test_'):
        command+=['--add-data',str(file)+';.']
command+=[str(ROOT/'server.py')]
with (HERE/'backend-build.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:sys.exit(result.returncode)
destination=HERE/'backend-build'/'PocketDeckServer'
compiler=Path(os.environ.get('WINDIR',r'C:\Windows'))/'Microsoft.NET'/'Framework64'/'v4.0.30319'/'csc.exe'
subprocess.run([str(compiler),'/nologo','/target:winexe','/out:'+str(destination/'PocketDeckChromeHost.exe'),str(HERE/'chrome_launcher.cs')],check=True,capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
shutil.copytree(ROOT/'chrome-extension',destination/'chrome-extension',dirs_exist_ok=True)
