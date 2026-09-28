"""Launch a probe in the disposable VM's actual GNOME session, via SSH."""
import os
from pathlib import Path
import subprocess
import sys
import signal
import time

assert Path('/var/tmp/deck-lab-ready').exists(), 'disposable VM is not ready'
assert os.getuid()!=0, 'run as the disposable desktop user'
if sys.argv[1:]==['--stop-app']:
    owned=set()
    for child in Path('/proc').iterdir():
        if not child.name.isdigit():continue
        try:
            if child.stat().st_uid!=os.getuid() or (child/'exe').readlink().name!='PocketDeckServer':continue
            if b'/home/deck/pocket-deck-desktop-check/config/Pocket Deck/data' not in (child/'cmdline').read_bytes():continue
            parent=Path('/proc')/(child/'stat').read_text().split(')')[-1].split()[1]
            if parent.stat().st_uid==os.getuid() and str((parent/'exe').readlink()).removesuffix(' (deleted)').endswith('/pocket-deck-desktop'):
                owned.add(parent)
        except OSError:pass
    assert len(owned)==1, 'expected one private desktop application'
    for parent in owned:os.kill(int(parent.name),signal.SIGTERM)
    until=time.monotonic()+15
    while any((parent/'exe').exists() for parent in owned) and time.monotonic()<until:time.sleep(.1)
    assert not any((parent/'exe').exists() for parent in owned), 'private app did not stop'
    print('Stopped only the private VM desktop application')
    raise SystemExit()
if len(sys.argv)==3 and sys.argv[1]=='--trigger':
    mode=sys.argv[2]
    assert mode in ('enable','scroll','scroll-move','repeat','macro','cancel','replay','close')
    Path('/tmp/probe-go').write_text(mode)
    print('Requested '+mode+' in the disposable input probe')
    raise SystemExit()
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
assert name in ('portal-probe.py','portal-scroll-probe.py','passive-probe.py','terminal','npm','deb-session','update-feed','AppImage','deb'), 'unknown probe'
script=Path(__file__).resolve().parent/name
if not script.is_file():script=Path('/source/app/desktop/integration/linux-lab')/name
command=['/usr/bin/python3',str(script)]
if name=='terminal':
    command=['gnome-terminal','--wait','--title=Pocket Deck native terminal probe','--',
             '/usr/bin/python3','/source/app/desktop/integration/linux-lab/terminal-reader.py']
if name=='npm':
    fixture=Path('/home/deck/pocket-deck-npm-check')
    assert (fixture/'package.tgz').is_file(), 'private npm fixture missing'
    env.update(PATH=str(fixture/'node/bin')+':'+env['PATH'],
               LOCALAPPDATA=str(fixture/'download-cache'),
               XDG_CACHE_HOME=str(fixture/'download-cache'),
               XDG_CONFIG_HOME='/home/deck/pocket-deck-desktop-check/config',
               XDG_DATA_HOME='/home/deck/pocket-deck-desktop-check/data')
    # Authentication must originate in the desktop's own terminal session,
    # rather than an SSH session merely carrying the desktop environment.
    command=['gnome-terminal','--wait','--title=Pocket Deck npm install probe','--',
             '/usr/bin/python3','/home/deck/pocket-deck-lab/vm-npm-command.py']
if name=='deb-session':
    command=['gnome-terminal','--wait','--title=Pocket Deck update probe','--',
             '/usr/bin/python3','/home/deck/pocket-deck-lab/vm-app-command.py']
if name=='update-feed':
    command=['/usr/bin/python3','/home/deck/pocket-deck-lab/setup-vm-update.py','serve']
if name in ('AppImage','deb'):
    image=Path('/tmp/Pocket-Deck.AppImage') if name=='AppImage' else Path('/opt/Pocket Deck/pocket-deck-desktop')
    if name=='AppImage':image.chmod(0o755);env['APPIMAGE_EXTRACT_AND_RUN']='1'
    env.update(XDG_CONFIG_HOME='/home/deck/pocket-deck-desktop-check/config',
               XDG_DATA_HOME='/home/deck/pocket-deck-desktop-check/data')
    command=[str(image)]
with Path('/tmp/'+name+'.log').open('ab') as output:
    child=subprocess.Popen(command,env=env,start_new_session=True,
                           stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT)
print('Started '+name+' PID '+str(child.pid)+' in '+env['WAYLAND_DISPLAY'])
