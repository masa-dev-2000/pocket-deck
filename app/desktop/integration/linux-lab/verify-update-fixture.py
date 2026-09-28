"""Verify the disposable AppImage update, independently of updater callbacks."""
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.request import urlopen

root = Path('/tmp/pocket-deck-update-fixture')
image = root / 'old/Pocket-Deck-1.0.5-x86_64.AppImage'
feed = root / 'feed/Pocket-Deck-1.0.5-x86_64.AppImage'
expected = json.loads(Path('/tmp/deck-update-expected.json').read_text())
with urlopen('http://127.0.0.1:8765/api/config', timeout=3) as response:
    actual = json.load(response)
assert actual == expected, 'configuration changed during update'
assert hashlib.sha256(image.read_bytes()).digest() == hashlib.sha256(feed.read_bytes()).digest()
assert not (root / 'old/Pocket-Deck-1.0.4-x86_64.AppImage').exists()
running = []
for process in Path('/proc').iterdir():
    if not process.name.isdigit():
        continue
    try:
        arguments = (process / 'cmdline').read_bytes().split(b'\0')
        executable = (process / 'exe').readlink()
        if executable.name != 'pocket-deck-desktop' or b'--type=' in b' '.join(arguments):
            continue
        if not executable.parent.name.startswith('appimage_extracted_'):
            continue
        # Chromium clears its initial environment; inspect the running bundle's
        # package metadata instead of relying on /proc/<pid>/environ.
        archive = executable.parent / 'resources/app.asar'
        library = '/tmp/pocket-deck-package/app/desktop/node_modules/app-builder-lib/node_modules/@electron/asar/lib/asar.js'
        metadata = json.loads(subprocess.check_output([
            'node', '--input-type=module', '-e',
            'const a=await import(process.argv[1]); process.stdout.write(a.extractFile(process.argv[2],"package.json"));',
            library, str(archive)], text=True))
        if metadata['name'] == 'pocket-deck-desktop' and metadata['version'] == '1.0.5':
            running.append(int(process.name))
    except (OSError, IndexError):
        pass
assert len(running) == 1, f'expected one restarted updated application, found {running}'
print(json.dumps({'updatedVersion': '1.0.5', 'artifactSha256': hashlib.sha256(image.read_bytes()).hexdigest(),
                  'configurationPreserved': True, 'restartedPid': running[0]}))
