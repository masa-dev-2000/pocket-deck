"""Validate update SHA-512, stage exact artifacts, then write npm SHA-256."""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

source=Path(__file__).resolve().parents[4]
version=json.loads((source/'app/desktop/package.json').read_text())['version']
stage=source.parent/'pocket-deck-release-staging'/version;stage.mkdir(parents=True,exist_ok=True)
node=shutil.which('node');assert node
def hashes(file):
    sha256=hashlib.sha256();sha512=hashlib.sha512()
    with file.open('rb') as stream:
        while block:=stream.read(1024*1024):sha256.update(block);sha512.update(block)
    return {'sha256':sha256.hexdigest(),'sha512':base64.b64encode(sha512.digest()).decode(),'bytes':file.stat().st_size}
if sys.argv[1:]==['finalize']:
    windows=json.loads((stage/'windows-manifest.json').read_text())
    linux=json.loads((stage/'linux-manifest.json').read_text())
    release={}
    for label,name in [('windows','Pocket-Deck-Setup-'+version+'.exe'),('linux','Pocket-Deck-'+version+'-amd64.deb')]:
        manifest=windows if label=='windows' else linux
        assert manifest['version']==version
        checksum=hashes(stage/name)
        assert checksum==manifest['artifacts'][name]
        metadata={'version':version,'url':'https://github.com/masa-dev-2000/pocket-deck/releases/download/v'+version+'/'+name,
                  'sha256':checksum['sha256'],'bytes':checksum['bytes'],'filename':name}
        if label=='windows':release.update(metadata)
        else:release['linux']=metadata
    (source/'npm/release.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
    for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):shutil.copy2(source/name,stage/name)
    files=[stage/name for name in [*windows['artifacts'],*linux['artifacts'],'LICENSE','THIRD_PARTY_NOTICES.md']]
    (stage/'SHA256SUMS.txt').write_text(''.join(hashes(file)['sha256']+'  '+file.name+'\n' for file in files))
    print(json.dumps({'releaseStaging':str(stage),'version':version,'npmMetadataMatchesArtifacts':True}))
else:
    label='linux' if sys.platform=='linux' else 'windows'
    target=Path('/tmp/pocket-deck-package') if label=='linux' else source.parent/'pocket-deck-release-work'
    output=target/'app/desktop-dist';feed=output/('latest-linux.yml' if label=='linux' else 'latest.yml')
    metadata=json.loads(subprocess.check_output([node,str(Path(__file__).with_name('read-update-metadata.cjs')),str(feed)],text=True))
    assert metadata['version']==version
    expected={'Pocket-Deck-'+version+'-x86_64.AppImage','Pocket-Deck-'+version+'-amd64.deb'} if label=='linux' else {'Pocket-Deck-Setup-'+version+'.exe'}
    assert {entry['url'] for entry in metadata['files']}==expected
    manifest={'version':version,'artifacts':{}}
    for entry in metadata['files']:
        assert Path(entry['url']).name==entry['url']
        file=output/entry['url'];checksum=hashes(file)
        assert checksum['sha512']==entry['sha512'] and checksum['bytes']==entry['size'],file.name
        shutil.copy2(file,stage/file.name);manifest['artifacts'][file.name]=checksum
    extra=[feed]
    if label=='windows':extra.append(output/('Pocket-Deck-Setup-'+version+'.exe.blockmap'))
    for file in extra:shutil.copy2(file,stage/file.name);manifest['artifacts'][file.name]=hashes(file)
    (stage/(label+'-manifest.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'platform':label,'version':version,'validatedAndStaged':list(manifest['artifacts'])}))
