"""Provision/restore only the disposable VM's synthetic test credential."""
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys
assert os.getuid()==0 and Path('/var/tmp/deck-lab-ready').exists(),'disposable VM root required'
assert pwd.getpwnam('deck').pw_uid==1000
backup=Path('/var/tmp/deck-lab-original-auth.json')
if sys.argv[1:]==['restore']:
    saved=json.loads(backup.read_text())
    subprocess.run(['usermod','--password',saved['shadow'],'deck'],check=True)
    print('Original disposable test-account authentication restored.')
else:
    assert sys.argv[1:]==['prepare']
    if not backup.exists():
        original=next(line.split(':')[1] for line in Path('/etc/shadow').read_text().splitlines() if line.startswith('deck:'))
        assert original.startswith(('!','*')),'expected a locked synthetic account'
        backup.write_text(json.dumps({'shadow':original}));backup.chmod(0o600)
    # This deliberately non-secret fixture credential belongs only to this VM.
    subprocess.run(['chpasswd'],input=b'deck:PocketDeck-disposable-VM-only\n',check=True)
    print('Disposable test account prepared for normal OS authentication.')
