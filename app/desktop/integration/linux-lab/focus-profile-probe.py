"""Exercise registered Chrome profile focus in the disposable desktop lab."""
import json
import sys
import time
import uuid
from urllib.request import Request,urlopen
BASE='http://127.0.0.1:8765'
def call(route,data=None):
    req=Request(BASE+route,None if data is None else json.dumps(data).encode(),{'Content-Type':'application/json'})
    with urlopen(req,timeout=5) as response:return json.load(response)
profiles=call('/api/profiles')
target=next(profile for profile in profiles if profile['name']==sys.argv[1] and profile['online'])
config=call('/api/config');button=config['layouts'][0]['buttons'][1]
button.update(type='profile',profileId=target['id'],label='Isolated focus probe')
call('/api/config',config)
print(call('/api/action',{'action':'execute','owner':'focus-probe-'+uuid.uuid4().hex,'id':button['id']}))
for _ in range(40):
    state=call('/api/sequence')
    if state['state']!='running':print(json.dumps(state));break
    time.sleep(.1)
