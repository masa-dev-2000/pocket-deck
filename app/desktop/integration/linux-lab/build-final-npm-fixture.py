"""Bundle the actual staged npm tarball and its verified deb for VM testing."""
import hashlib
import json
from pathlib import Path
import tarfile

source=Path(__file__).resolve().parents[4]
release=json.loads((source/'npm/release.json').read_text())['linux']
stage=source.parent/'pocket-deck-release-staging'/release['version']
deb=stage/release['filename']
assert deb.stat().st_size==release['bytes'] and hashlib.sha256(deb.read_bytes()).hexdigest()==release['sha256']
root=Path('/tmp/deck-npm-deb-fixture');root.mkdir(exist_ok=True)
expected=root/'expected-version';expected.write_text(release['version'])
with tarfile.open(root/'final-npm-inputs.tar.gz','w:gz') as archive:
    archive.add(stage/('masadev-pocket-deck-'+release['version']+'.tgz'),arcname='package-final.tgz')
    archive.add(deb,arcname='download-cache/Pocket Deck/downloads/Pocket-Deck-'+release['version']+'-'+release['sha256'][:12]+'.deb')
    archive.add(expected,arcname='expected-version')
print('Actual final npm/deb fixture: '+str(root/'final-npm-inputs.tar.gz'))
