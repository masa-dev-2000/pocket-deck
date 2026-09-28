"""Real packaged text button -> native Wayland terminal -> PTY reader."""
import copy
import json
from pathlib import Path
import time
from urllib.request import Request,urlopen
assert Path('/var/tmp/deck-lab-ready').exists(),'disposable VM required'
def call(path,data=None):
    request=Request('http://127.0.0.1:8765'+path,data=None if data is None else json.dumps(data).encode(),
                    headers={'Content-Type':'application/json'})
    with urlopen(request,timeout=12) as response:return json.load(response)
assert call('/api/input-status')['state']=='ready','explicit packaged-app input permission required'
original=call('/api/config');changed=copy.deepcopy(original)
button=changed['layouts'][0]['buttons'][0]
button.update(type='text',text='端末🙂\n改行',pasteMode='terminal')
try:
    call('/api/config',changed)
    call('/api/action',{'action':'text','id':button['id'],'owner':'native-terminal-text'})
    time.sleep(1)
    call('/api/action',{'action':'key_tap','key':'ENTER','owner':'native-terminal-enter'})
    result=Path('/tmp/terminal-input.json')
    deadline=time.monotonic()+15
    while not result.exists() and time.monotonic()<deadline:time.sleep(.2)
    assert result.exists(),'terminal did not receive two lines'
    received=json.loads(result.read_text())
    assert received['terminalReceived']==button['text'],received
    print(json.dumps({'realPackagedTerminalPaste':True,**received}),flush=True)
finally:
    current=call('/api/config');original['revision']=current['revision'];call('/api/config',original)
