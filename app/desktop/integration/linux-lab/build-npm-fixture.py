"""Pack a private npm lifecycle fixture using a verified local AppImage cache."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

source=Path(__file__).resolve().parents[4]/'npm'
root=Path('/tmp/deck-npm-test');package=root/'package';package.mkdir(parents=True,exist_ok=True)
for name in ('bin','package.json','release.json','README.md','LICENSE'):
    if (source/name).is_dir():shutil.copytree(source/name,package/name,dirs_exist_ok=True)
    else:shutil.copy2(source/name,package/name)
metadata=json.loads((package/'package.json').read_text())
version=sys.argv[1] if len(sys.argv)>1 else '1.0.4'
assert version in ('1.0.4','1.0.5'),'only private fixture versions are supported'
metadata['os']=['linux']
metadata['version']=version
(package/'package.json').write_text(json.dumps(metadata,indent=2))
image=Path('/tmp/pocket-deck-update-fixture')/('old' if version=='1.0.4' else 'feed')/f'Pocket-Deck-{version}-x86_64.AppImage'
digest=hashlib.sha256()
with image.open('rb') as stream:
    for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
checksum=digest.hexdigest()
release=json.loads((package/'release.json').read_text())
release['linux']={'version':version,'filename':image.name,'bytes':image.stat().st_size,'sha256':checksum,
                  'url':f'https://github.com/masa-dev-2000/pocket-deck/releases/download/v{version}/'+image.name}
(package/'release.json').write_text(json.dumps(release,indent=2))
cache=root/'download-cache/Pocket Deck/downloads';cache.mkdir(parents=True,exist_ok=True)
shutil.copy2(image,cache/(f'Pocket-Deck-{version}-'+checksum[:12]+'.AppImage'))
result=subprocess.check_output(['npm','pack','--json','--ignore-scripts','--pack-destination',str(root)],cwd=package,text=True)
filename=json.loads(result)[0]['filename']
(root/'fixture.json').write_text(json.dumps({'tarball':str(root/filename),'sha256':checksum,'bytes':image.stat().st_size}))
(root/'npmrc').write_text('audit=false\nfund=false\n')
print('Private cache-only npm fixture: '+str(root/filename))
print('No Linux release was published or downloaded from GitHub.')
