"""Exercise only the deb installation in the named disposable container."""
import json
from pathlib import Path
import signal
import sys
import time
from urllib.request import Request, urlopen

data = Path('/tmp/deck-deb-check/Pocket Deck/data/config.json')
expected_path = Path('/tmp/deck-deb-expected.json')
executable = Path('/opt/Pocket Deck/pocket-deck-desktop')
mode = sys.argv[1]
if mode == 'snapshot':
    with urlopen('http://127.0.0.1:8765/api/config', timeout=3) as response:
        config = json.load(response)
    config['layouts'][0]['buttons'][0]['label'] = 'deb data retention proof'
    request = Request('http://127.0.0.1:8765/api/config', json.dumps(config).encode(), {'Content-Type': 'application/json'})
    with urlopen(request, timeout=3) as response:
        expected = json.load(response)
    assert json.loads(data.read_text()) == expected
    expected_path.write_text(json.dumps(expected))
    print('Configuration saved through the installed desktop backend.')
elif mode == 'stop':
    owned = []
    for process in Path('/proc').iterdir():
        if not process.name.isdigit():
            continue
        try:
            if (process/'exe').readlink() == executable and b'--type=' not in (process/'cmdline').read_bytes():
                owned.append(process)
        except OSError:
            pass
    assert len(owned) == 1, f'expected one disposable deb app, found {owned}'
    process = owned[0]
    signal.pidfd_send_signal(__import__('os').pidfd_open(int(process.name)), signal.SIGTERM)
    until = time.monotonic()+10
    while (process/'exe').exists() and time.monotonic()<until:
        time.sleep(.1)
    assert not (process/'exe').exists(), 'disposable application did not stop'
    print('Disposable deb application stopped.')
elif mode == 'verify':
    assert not executable.exists(), 'package is still installed'
    assert json.loads(data.read_text()) == json.loads(expected_path.read_text())
    print('Uninstalled package; all saved configuration remains identical.')
else:
    raise ValueError('expected snapshot, stop, or verify')
