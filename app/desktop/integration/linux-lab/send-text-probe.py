"""Send a registered text button in the isolated lab, never against the host."""
import json
from urllib.request import Request, urlopen

BASE='http://127.0.0.1:8765'
def call(route,data=None):
    request=Request(BASE+route, None if data is None else json.dumps(data).encode(),{'Content-Type':'application/json'})
    with urlopen(request,timeout=15) as response:return json.load(response)
config=call('/api/config')
button=config['layouts'][0]['buttons'][0]
button.update(type='text',text='日本語の入力\n改行と絵文字🙂',label='Unicode probe')
call('/api/config',config)
print(call('/api/action',{'action':'text','owner':'isolated-unicode-probe','id':button['id']}))
