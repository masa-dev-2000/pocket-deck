"""Private localhost feed and verification for real packaged deb updates."""
import hashlib
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

assert Path('/var/tmp/deck-lab-ready').exists()
root=Path('/home/deck/pocket-deck-update-check');mode=sys.argv[1]
config=Path('/home/deck/pocket-deck-desktop-check/config/Pocket Deck/data/config.json')
if mode=='prepare':
    assert os.getuid()==0,'private VM root required to redirect only test app feed'
    assert subprocess.check_output(['dpkg-query','-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],text=True)=='installed\n1.1.0'
    root.mkdir(exist_ok=True);os.chown(root,1000,1000)
    with tarfile.open('/home/deck/pocket-deck-lab/deb-update-feed.tar.gz') as archive:
        archive.extractall(root,filter='data')
    for file in root.iterdir():os.chown(file,1000,1000)
    settings=Path('/opt/Pocket Deck/resources/app-update.yml')
    backup=root/'original-app-update.yml';assert not backup.exists(),'feed already prepared'
    backup.write_bytes(settings.read_bytes());os.chown(backup,1000,1000)
    (root/'configuration.sha256').write_text(hashlib.sha256(config.read_bytes()).hexdigest())
    settings.write_text('provider: generic\nurl: http://127.0.0.1:9998\nupdaterCacheDirName: pocket-deck-private-update\n')
    print('Only disposable installed app uses the private localhost update feed.')
elif mode=='serve':
    assert os.getuid()==1000
    handler=lambda *args,**kwargs:SimpleHTTPRequestHandler(*args,directory=str(root),**kwargs)
    ThreadingHTTPServer(('127.0.0.1',9998),handler).serve_forever()
else:
    assert os.getuid()==1000 and mode in ('cancel','installed')
    expected='1.1.0' if mode=='cancel' else '1.1.1'
    assert subprocess.check_output(['dpkg-query','-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],text=True)=='installed\n'+expected
    assert hashlib.sha256(config.read_bytes()).hexdigest()==(root/'configuration.sha256').read_text()
    subprocess.run(['/usr/bin/python3','/home/deck/pocket-deck-lab/verify-vm-desktop.py','deb'],check=True)
    if mode=='cancel':
        log=Path('/home/deck/pocket-deck-desktop-check/config/Pocket Deck/updates.log').read_text()
        assert 'OSの更新確認がキャンセルされたか' in log
    result={'realPackagedDebUpdate':mode,'installedVersion':expected,'configurationUnchanged':True,
            'source':'private localhost feed; 1.1.1 is not a public release'}
    (root/('result-'+mode+'.json')).write_text(json.dumps(result))
    print(json.dumps(result))
