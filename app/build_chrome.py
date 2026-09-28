"""Build the no-console native host launcher using the installed .NET compiler."""
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parent

def build():
    compiler=Path(os.environ.get('WINDIR',r'C:\Windows'))/'Microsoft.NET'/'Framework64'/'v4.0.30319'/'csc.exe'
    if not compiler.exists():raise RuntimeError('.NET Framework compiler is unavailable')
    output=ROOT/'chrome_launcher.exe'
    subprocess.run([str(compiler),'/nologo','/target:winexe','/out:'+str(output),str(ROOT/'chrome_launcher.cs')],check=True,capture_output=True,creationflags=subprocess.CREATE_NO_WINDOW)
    return output

if __name__=='__main__':print(build())
