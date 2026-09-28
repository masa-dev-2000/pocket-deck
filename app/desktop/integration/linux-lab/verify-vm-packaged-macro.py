"""Real packaged HTTP sequence -> focused passive Wayland GTK receiver."""
import copy
import json
from pathlib import Path
import time
from urllib.request import Request,urlopen

assert Path('/var/tmp/deck-lab-ready').exists()
def call(path,data=None):
    request=Request('http://127.0.0.1:8765'+path,data=None if data is None else json.dumps(data).encode(),
                    headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=15) as response:return json.load(response)
assert call('/api/input-status')['state']=='ready'
original=call('/api/config');changed=copy.deepcopy(original)
button=changed['layouts'][0]['buttons'][0]
button.update(type='macro',steps=[{'kind':'shortcut','keys':'Ctrl+A'},
    {'kind':'text','text':'連続操作🙂'},{'kind':'wait','ms':1500},
    {'kind':'shortcut','keys':'Enter'},{'kind':'text','text':'完了'},
    {'kind':'wait','ms':1500}])
owner='packaged-vm-sequence-'+str(time.monotonic_ns())
try:
    call('/api/config',changed)
    call('/api/action',{'action':'execute','id':button['id'],'owner':owner})
    deadline=time.monotonic()+25
    while time.monotonic()<deadline:
        call('/api/action',{'action':'heartbeat','owner':owner})
        status=call('/api/sequence')
        if status['state']!='running':break
        time.sleep(.3)
    assert status['state']=='done',status
    for _ in range(3):
        call('/api/action',{'action':'execute','id':button['id'],'owner':owner})
        assert call('/api/sequence')==status,'duplicate sequence restarted'
    records=[json.loads(line) for line in Path('/tmp/lost-session-events.jsonl').read_text().splitlines()]
    received=next(item['receivedText'] for item in reversed(records) if 'receivedText' in item)
    assert received=='連続操作🙂\n完了',received
    result={'realPackagedMacro':True,'configuredWaitMs':1500,'receivedText':received,'threeReplaysSuppressed':True}
    Path('/tmp/packaged-macro-result.json').write_text(json.dumps(result,ensure_ascii=False))
    print(json.dumps(result,ensure_ascii=False))
finally:
    call('/api/action',{'action':'macro_cancel','owner':owner+'-cleanup','targetOwner':owner})
    current=call('/api/config');original['revision']=current['revision'];call('/api/config',original)
