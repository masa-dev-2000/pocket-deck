"""Real Native Messaging/profile commands through the private product HTTP API."""
import copy
import json
import sys
from pathlib import Path
import time
import uuid
from urllib.request import Request,urlopen

assert Path('/tmp/deck-session.env').exists(),'disposable desktop lab required'
def call(path,data=None):
    request=Request('http://127.0.0.1:8765'+path,data=None if data is None else json.dumps(data).encode(),
                    headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=5) as response:return json.load(response)
profiles=call('/api/profiles')
online=[p for p in profiles if p['online']]
print(json.dumps({'onlineProfiles':[p['name'] for p in online]}),flush=True)
assert len(online)==2,'two real online Chrome profiles required'
original=call('/api/config');changed=copy.deepcopy(original)
button=changed['layouts'][0]['buttons'][0]
results=[]
targets=online+online[:1]
if len(sys.argv)==2:
    targets=[p for p in online if p['name']==sys.argv[1]]
    assert len(targets)==1,'one registered target required'
try:
    for profile in targets:
        button.update(type='macro',steps=[{'kind':'profile','profileId':profile['id']}])
        changed=call('/api/config',changed)
        button=changed['layouts'][0]['buttons'][0]
        call('/api/action',{'action':'execute','id':button['id'],'owner':'chrome-lab-'+uuid.uuid4().hex})
        deadline=time.monotonic()+8
        while time.monotonic()<deadline:
            state=call('/api/sequence')
            if state['state'] in ('done','error','cancelled'):break
            time.sleep(.05)
        assert state['state']=='done',state
        results.append({'profile':profile['name'],'state':state['state']})
finally:
    current=call('/api/config');original['revision']=current['revision']
    call('/api/config',original)
print(json.dumps({'realProfileSwitches':results,'configurationRestored':True}))
