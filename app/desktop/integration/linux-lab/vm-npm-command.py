"""Execute real npm from a GNOME-terminal child in the disposable desktop."""
import os
from pathlib import Path
import subprocess

assert Path('/var/tmp/deck-lab-ready').exists() and os.getuid()==1000
root=Path('/home/deck/pocket-deck-npm-check')
package=root/('package-final.tgz' if (root/'package-final.tgz').exists() else 'package.tgz')
env={**os.environ,'PATH':str(root/'node/bin')+':'+os.environ['PATH'],
     'LOCALAPPDATA':str(root/'download-cache'),
     'XDG_CACHE_HOME':str(root/'download-cache'),
     'XDG_CONFIG_HOME':'/home/deck/pocket-deck-desktop-check/config',
     'XDG_DATA_HOME':'/home/deck/pocket-deck-desktop-check/data'}
command=[str(root/'node/bin/node'),str(root/'npm-runtime/bin/npm-cli.js'),
         'install','-g','--prefix',str(root/'prefix'),'--cache',str(root/'npm-cache'),
         '--userconfig',str(root/'npmrc'),'--offline','--foreground-scripts',str(package)]
print('Installing the private npm fixture; normal Ubuntu authentication is required.',flush=True)
with Path('/tmp/npm.log').open('w') as log:
    result=subprocess.run(command,env=env,stdout=log,stderr=subprocess.STDOUT)
Path('/tmp/npm-exit-code').write_text(str(result.returncode))
print('npm exit code: '+str(result.returncode),flush=True)
