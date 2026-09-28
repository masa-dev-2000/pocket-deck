"""Prepare and verify real npm/deb install only inside the disposable VM."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

assert Path('/var/tmp/deck-lab-ready').exists() and os.getuid()==1000
root=Path('/home/deck/pocket-deck-npm-check')
config=Path('/home/deck/pocket-deck-desktop-check/config/Pocket Deck/data/config.json')
mode=sys.argv[1]
if mode=='prepare-update':
    assert (root/'node/bin/node').is_file(),'original private runtime required'
    with tarfile.open(Path(__file__).resolve().parent/'final-npm-inputs.tar.gz') as archive:
        archive.extractall(root,filter='data')
    query=subprocess.check_output(['dpkg-query','-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],text=True)
    assert query.startswith('installed\n')
    (root/'previous-version').write_text(query.split('\n')[1])
    (root/'configuration.sha256').write_text(hashlib.sha256(config.read_bytes()).hexdigest())
    print('Actual staged npm/deb ready; installed version and configuration fingerprint saved.')
elif mode=='prepare':
    root.mkdir(exist_ok=True)
    assert not (root/'package.tgz').exists(), 'fixture already prepared'
    with tarfile.open('/home/deck/vm-inputs.tar.gz') as archive:
        archive.extractall(root,filter='data')
    (root/'npmrc').write_text('audit=false\nfund=false\n')
    (root/'configuration.sha256').write_text(hashlib.sha256(config.read_bytes()).hexdigest())
    print('Private Node/npm/cache prepared; existing configuration fingerprint saved.')
else:
    assert mode in ('cancel','cancel-update','installed')
    assert hashlib.sha256(config.read_bytes()).hexdigest()==(root/'configuration.sha256').read_text()
    query=subprocess.run(['dpkg-query','-W','-f=${db:Status-Status}\n${Version}','pocket-deck-desktop'],text=True,capture_output=True)
    if mode in ('cancel','cancel-update'):
        if mode=='cancel':
            assert query.returncode==1 or not query.stdout.startswith('installed\n'),query.stdout
            assert not Path('/opt/Pocket Deck/pocket-deck-desktop').exists()
        else:
            assert query.returncode==0 and query.stdout=='installed\n'+(root/'previous-version').read_text(),query.stdout
        log=Path('/tmp/npm.log').read_text()
        assert 'キャンセルされたか' in log and 'アプリを開きます' not in log
        print(json.dumps({'cancelledInstallDidNotLaunch':True,'configurationUnchanged':True,'mode':mode}))
    else:
        expected=(root/'expected-version').read_text() if (root/'expected-version').exists() else '1.0.4'
        assert query.returncode==0 and query.stdout=='installed\n'+expected,query.stdout
        log=Path('/tmp/npm.log').read_text()
        assert 'Pocket Deckの導入を確認しました。アプリを開きます。' in log
        subprocess.run(['/usr/bin/python3','/home/deck/pocket-deck-lab/verify-vm-desktop.py','deb'],check=True)
        print(json.dumps({'realGlobalNpmDebInstall':True,'configurationUnchanged':True,
                          'installedVersion':expected,
                          'source':'private npm tarball with SHA-256-verified offline deb cache'}))
