"""Observe held releases after the user-visible GNOME sharing stop control."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time
from urllib.request import Request,urlopen

assert Path('/var/tmp/deck-lab-ready').exists()
mode=sys.argv[1]
def call(path,data=None):
    request=Request('http://127.0.0.1:8765'+path,data=None if data is None else json.dumps(data).encode(),
                    headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=10) as response:return json.load(response)
if mode=='--abort':
    assert call('/api/input-status')['state']=='ready','abort only while releases can be sent'
    call('/api/action',{'action':'release_all'})
    for process in Path('/proc').iterdir():
        if not process.name.isdigit() or int(process.name)==os.getpid():continue
        try:
            args=(process/'cmdline').read_bytes().split(b'\0')
            if process.stat().st_uid==os.getuid() and len(args)>2 and args[1]==bytes(Path(__file__)) and args[2] in (b'normal',b'broker-loss'):
                os.kill(int(process.name),signal.SIGTERM)
        except OSError:pass
    print('Aborted only the private UI-stop probe and released its input.')
    raise SystemExit()
assert mode in ('normal','broker-loss')
assert call('/api/input-status')['state']=='ready'
events=Path('/tmp/lost-session-events.jsonl')
start=len(events.read_text().splitlines())
owners=['ui-stop-key-'+str(time.monotonic_ns()),'ui-stop-mouse-'+str(time.monotonic_ns())]
stop=threading.Event()
def heartbeat():
    while not stop.wait(.2):
        for owner in owners:
            try:call('/api/action',{'action':'heartbeat','owner':owner})
            except Exception:pass
worker=threading.Thread(target=heartbeat,daemon=True);worker.start()
try:
    call('/api/action',{'action':'key_down','key':'SHIFT','owner':owners[0]})
    call('/api/action',{'action':'mouse_down','owner':owners[1]})
    deadline=time.monotonic()+5
    while time.monotonic()<deadline:
        records=[json.loads(line) for line in events.read_text().splitlines()[start:]]
        if (any(r.get('event')=='key-press-event' and r.get('key')==65505 for r in records)
            and any(r.get('event')=='button-press-event' for r in records)):break
        time.sleep(.2)
    else:
        call('/api/action',{'action':'release_all'})
        raise AssertionError('Place the pointer and focus inside the passive receiver first')
    if mode=='broker-loss':
        subprocess.run(['systemctl','--user','restart','xdg-desktop-portal.service'],check=True,timeout=45)
        status=call('/api/input-status')
        assert status['state']=='permission' and '解除は確認できていません' in status['reason'],status
    print('Held Shift and mouse; now stop sharing using GNOME top-bar control.',flush=True)
    deadline=time.monotonic()+180
    while time.monotonic()<deadline:
        records=[json.loads(line) for line in events.read_text().splitlines()[start:]]
        key=any(r.get('event')=='key-release-event' and r.get('key')==65505 for r in records)
        mouse=any(r.get('event')=='button-release-event' for r in records)
        if key and mouse:break
        time.sleep(.3)
    status=call('/api/input-status')
    assert key and mouse,(key,mouse,records)
    assert status['state']=='permission' and not status['keyboard'] and not status['pointer'],status
    result={'mode':mode,'gnomeUiStopReleasedHeldKey':key,'gnomeUiStopReleasedHeldMouse':mouse,
            'inputStatus':status,'receivedEvents':records}
    Path('/tmp/ui-stop-'+mode+'.json').write_text(json.dumps(result,ensure_ascii=False))
    print(json.dumps(result,ensure_ascii=False),flush=True)
finally:
    stop.set();worker.join(timeout=15)
