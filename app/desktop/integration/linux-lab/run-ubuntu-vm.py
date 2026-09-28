"""Isolated Ubuntu 24.04 VM: real boot/login, no host data or input devices."""
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import urlopen

root = Path('/tmp/pocket-deck-vm-24')
root.mkdir(exist_ok=True)
base = root/'base.img'
url = 'https://cloud-images.ubuntu.com/noble/current/'
name = 'noble-server-cloudimg-amd64.img'
with urlopen(url+'SHA256SUMS', timeout=30) as response:
    checksum = next(line.split()[0] for line in response.read().decode().splitlines() if line.split()[-1].lstrip('*') == name)
def digest(file):
    result=hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):result.update(chunk)
    return result.hexdigest()
if not base.exists() or digest(base)!=checksum:
    print('Downloading official Ubuntu cloud image.', flush=True)
    with urlopen(url+name, timeout=60) as response, base.with_suffix('.partial').open('wb') as stream:
        received=0
        for chunk in iter(lambda:response.read(1024*1024),b''):
            stream.write(chunk);received+=len(chunk)
            if received%(64*1024*1024)==0:print(f'Downloaded {received//(1024*1024)} MiB.',flush=True)
    assert digest(base.with_suffix('.partial')) == checksum, 'official image checksum mismatch'
    base.with_suffix('.partial').replace(base)
print('Ubuntu image SHA-256 verified: '+checksum,flush=True)
key=root/'ssh-key'
if not key.exists():
    subprocess.run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(key)],check=True)
public_key=key.with_suffix('.pub').read_text().strip()
config={
    'hostname':'pocket-deck-vm-24',
    'users':[{'name':'deck','groups':['sudo'],'shell':'/bin/bash','lock_passwd':True,
              'sudo':'ALL=(ALL) NOPASSWD:ALL','ssh_authorized_keys':[public_key]}],
    'ssh_pwauth':False,
    'package_update':True,
    'packages':['gnome-session','gdm3','gnome-shell','xdg-desktop-portal','xdg-desktop-portal-gnome',
                'xwayland','pipewire','wireplumber','python3-gi','python3-dbus-next',
                'gir1.2-gtk-3.0','gir1.2-gtk-4.0','fonts-noto-cjk','libgl1-mesa-dri',
                'libasound2t64','libnss3','libgbm1','libgtk-3-0t64','libxtst6','xclip','xdg-utils'],
    'write_files':[{'path':'/etc/gdm3/custom.conf','content':'[daemon]\nAutomaticLoginEnable=True\nAutomaticLogin=deck\nWaylandEnable=true\nDefaultSession=gnome\n'}],
    'runcmd':[['systemctl','set-default','graphical.target'],['systemctl','enable','gdm3'],
              ['systemctl','restart','gdm3'],['touch','/var/tmp/deck-lab-ready']]
}
userdata=root/'user-data';userdata.write_text('#cloud-config\n'+json.dumps(config))
metadata=root/'meta-data';metadata.write_text('instance-id: pocket-deck-vm-24\nlocal-hostname: pocket-deck-vm-24\n')
seed=root/'seed.iso'
subprocess.run(['cloud-localds',str(seed),str(userdata),str(metadata)],check=True)
disk=root/'disk.qcow2'
if not disk.exists():
    subprocess.run(['qemu-img','create','-f','qcow2','-F','qcow2','-b',str(base),str(disk),'16G'],check=True)
print('Starting isolated VM; VNC 127.0.0.1:5907, SSH 127.0.0.1:22024.',flush=True)
subprocess.run(['qemu-system-x86_64','-accel','tcg,thread=multi','-cpu','max','-smp','2','-m','3072',
                '-drive',f'file={disk},format=qcow2,if=virtio','-drive',f'file={seed},format=raw,if=virtio',
                '-vga','virtio','-device','qemu-xhci','-device','usb-tablet',
                '-netdev','user,id=net0,hostfwd=tcp:127.0.0.1:22024-:22',
                '-device','virtio-net-pci,netdev=net0','-vnc','127.0.0.1:7','-display','none',
                '-serial',f'file:{root/"serial.log"}'],check=True)
