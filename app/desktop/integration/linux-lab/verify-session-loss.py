"""Interrupt the actual portal while the private packaged app holds input."""
import json
from pathlib import Path
import subprocess
import sys
import threading
import time
from urllib.request import Request,urlopen

assert Path('/var/tmp/deck-lab-ready').exists(),'disposable VM required'
events=Path('/tmp/lost-session-events.jsonl')
assert events.exists(),'passive receiver must be focused first'
def call(path,data=None):
    request=Request('http://127.0.0.1:8765'+path,data=None if data is None else json.dumps(data).encode(),
                    headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=10) as response:return json.load(response)
if sys.argv[1:]==['--enable']:
    print(json.dumps(call('/api/input-enable',{})))
    raise SystemExit()
if sys.argv[1:]==['--release']:
    print(json.dumps(call('/api/action',{'action':'release_all'})))
    raise SystemExit()
assert call('/api/input-status')['state']=='ready','private app needs explicit permission'
start=len(events.read_text().splitlines())
stop=threading.Event()
owners=['session-loss-key','session-loss-mouse']
def heartbeat():
    while not stop.wait(.2):
        for owner in owners:
            try:call('/api/action',{'action':'heartbeat','owner':owner})
            except Exception:pass
worker=threading.Thread(target=heartbeat,daemon=True);worker.start()
try:
    call('/api/action',{'action':'key_down','key':'SHIFT','owner':owners[0]})
    call('/api/action',{'action':'mouse_down','owner':owners[1]})
    subprocess.run(['systemctl','--user','restart','xdg-desktop-portal.service'],check=True,timeout=45)
    deadline=time.monotonic()+10
    while time.monotonic()<deadline:
        records=[json.loads(line) for line in events.read_text().splitlines()[start:]]
        if (any(r.get('event')=='key-release-event' and r.get('key')==65505 for r in records)
            and any(r.get('event')=='button-release-event' for r in records)):break
        time.sleep(.2)
    status=call('/api/input-status')
    result={'realPortalRestart':True,'inputStatus':status,'receivedEvents':records,
            'keyReleaseReceived':any(r.get('event')=='key-release-event' and r.get('key')==65505 for r in records),
            'mouseReleaseReceived':any(r.get('event')=='button-release-event' for r in records)}
    print(json.dumps(result),flush=True)
    assert status['state']=='permission' and not status['keyboard'] and not status['pointer']
    assert result['keyReleaseReceived'] and result['mouseReleaseReceived'],'compositor release was not observed'
finally:
    stop.set();worker.join(timeout=15)
