"""Private offline npm fixture; public metadata is never modified."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
source=Path(__file__).resolve().parents[4]
root=Path('/tmp/deck-npm-deb-fixture');root.mkdir(exist_ok=True)
package=root/'package';package.mkdir(exist_ok=True)
for name in ('bin','package.json','release.json','README.md','LICENSE'):
    entry=source/'npm'/name
    if entry.is_dir():shutil.copytree(entry,package/name,dirs_exist_ok=True)
    else:shutil.copy2(entry,package/name)
metadata=json.loads((package/'package.json').read_text());metadata['os']=['linux']
(package/'package.json').write_text(json.dumps(metadata))
artifact=Path('/tmp/pocket-deck-terminal-fixture/Pocket-Deck-1.0.4-amd64.deb')
checksum=hashlib.sha256(artifact.read_bytes()).hexdigest()
release=json.loads((package/'release.json').read_text())
release['linux']={'version':'1.0.4','filename':artifact.name,'bytes':artifact.stat().st_size,'sha256':checksum,
 'url':'https://github.com/masa-dev-2000/pocket-deck/releases/download/v1.0.4/'+artifact.name}
(package/'release.json').write_text(json.dumps(release))
result=json.loads(subprocess.check_output(['npm','pack','--json','--ignore-scripts','--pack-destination',str(root)],cwd=package,text=True))
tarball=root/result[0]['filename']
with tarfile.open(root/'vm-inputs.tar.gz','w:gz') as archive:
    archive.add('/usr/bin/node',arcname='node/bin/node')
    archive.add('/usr/lib/node_modules/npm',arcname='npm-runtime')
    archive.add(tarball,arcname='package.tgz')
    archive.add(artifact,arcname='download-cache/Pocket Deck/downloads/Pocket-Deck-1.0.4-'+checksum[:12]+'.deb')
print(json.dumps({'privateNpmFixture':str(tarball),'debSha256':checksum,'vmInputs':str(root/'vm-inputs.tar.gz')}))
