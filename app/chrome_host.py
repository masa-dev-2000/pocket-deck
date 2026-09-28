"""Native Messaging host; stdout is reserved for framed JSON messages."""
import json
import os
from pathlib import Path
import struct
import sys
import threading
import time
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parent

def read_message(stream):
    header=stream.read(4)
    if not header:return None
    if len(header)!=4:raise ValueError('Truncated native message')
    size=struct.unpack('<I',header)[0]
    if not 0<size<=65536:raise ValueError('Native message too large')
    raw=stream.read(size)
    if len(raw)!=size:raise ValueError('Truncated native message')
    data=json.loads(raw)
    if not isinstance(data,dict):raise ValueError('Invalid native message')
    return data

def write_message(stream,data):
    raw=json.dumps(data,ensure_ascii=False).encode('utf-8')
    stream.write(struct.pack('<I',len(raw))+raw);stream.flush()

def main(data_dir=None,port=8765):
    directory=Path(data_dir) if data_dir is not None else ROOT
    if os.name=='nt':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(),os.O_BINARY);msvcrt.setmode(sys.stdout.fileno(),os.O_BINARY)
    state={'profile':None,'results':[]};lock=threading.Lock();ended=threading.Event()
    def reader():
        try:
            while True:
                message=read_message(sys.stdin.buffer)
                if message is None:break
                with lock:
                    if message.get('action')=='register':state['profile']={'id':message.get('id'),'name':message.get('name')}
                    elif message.get('action')=='result':state['results'].append(message)
        finally:ended.set()
    threading.Thread(target=reader,daemon=True).start()
    last_status=None
    while not ended.wait(.35):
        with lock:
            profile=state['profile'];results=state['results'];state['results']=[]
        if not profile:continue
        try:
            token=(directory/'chrome-bridge.token').read_text('ascii').strip()
            request=Request(f'http://127.0.0.1:{port}/api/bridge',json.dumps({**profile,'results':results}).encode(),{'Content-Type':'application/json','X-Deck-Token':token})
            with urlopen(request,timeout=2) as response:data=json.load(response)
            for command in data.get('commands',[]):write_message(sys.stdout.buffer,command)
            status='Pocket Deckに接続中'
        except Exception:
            status='Pocket Deck未接続：PC側の起動・ホスト登録を確認してください'
        if status!=last_status:write_message(sys.stdout.buffer,{'status':status});last_status=status

if __name__=='__main__':main()
