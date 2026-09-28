"""Launch a probe in the disposable VM's actual GNOME session, via SSH."""
import os
from pathlib import Path
import subprocess
import sys

assert Path('/var/tmp/deck-lab-ready').exists(), 'disposable VM is not ready'
assert os.getuid()!=0, 'run as the disposable desktop user'
session=None
for process in Path('/proc').iterdir():
    if not process.name.isdigit():continue
    try:
        if process.stat().st_uid==os.getuid() and (process/'comm').read_text().strip()=='gnome-shell':
            session=dict(item.split('=',1) for item in (process/'environ').read_text().split('\0') if '=' in item)
            break
    except OSError:pass
assert session, 'no actual GNOME session found'
env={**os.environ,**{name:value for name,value in session.items()
                   if name in ('DISPLAY','WAYLAND_DISPLAY','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS','XDG_SESSION_TYPE','XAUTHORITY')}}
# Mutter exports the display after startup; /proc/environ retains initial values.
activation=subprocess.check_output(['systemctl','--user','show-environment'],env=env,text=True)
for item in activation.splitlines():
    name,separator,value=item.partition('=')
    if separator and name in ('DISPLAY','WAYLAND_DISPLAY','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS','XDG_SESSION_TYPE','XAUTHORITY'):
        env[name]=value
env.update(GDK_BACKEND='wayland')
assert env.get('WAYLAND_DISPLAY'), 'native Wayland session required'
name=sys.argv[1] if len(sys.argv)>1 else 'portal-probe.py'
assert name in ('portal-probe.py','portal-scroll-probe.py'), 'unknown probe'
script=Path('/source/app/desktop/integration/linux-lab')/name
with Path('/tmp/'+name+'.log').open('ab') as output:
    child=subprocess.Popen(['/usr/bin/python3',str(script)],env=env,start_new_session=True,
                           stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT)
print('Started '+name+' PID '+str(child.pid)+' in '+env['WAYLAND_DISPLAY'])
