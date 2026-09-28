"""Standalone executable Native Messaging test; mock HTTP, isolated data."""
import subprocess,tempfile,threading,json,struct
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
root=Path(__file__).resolve().parent
exe=root/'backend-build/PocketDeckServer/PocketDeckServer.exe'
seen=[]
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        seen.append((self.path,self.headers.get('X-Deck-Token'),json.loads(self.rfile.read(int(self.headers['Content-Length'])))))
        raw=b'{"commands":[]}'
        self.send_response(200);self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
http=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=http.serve_forever,daemon=True).start()
try:
    with tempfile.TemporaryDirectory() as directory:
        (Path(directory)/'chrome-bridge.token').write_text('mock-token','ascii')
        p=subprocess.Popen([str(exe),'--chrome-host','--data-dir',directory,'--port',str(http.server_port)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            message=json.dumps({'action':'register','id':'mock-profile','name':'テスト'}).encode()
            p.stdin.write(struct.pack('<I',len(message))+message);p.stdin.flush()
            messages=[]
            def read():
                header=p.stdout.read(4)
                if len(header)==4:messages.append(json.loads(p.stdout.read(struct.unpack('<I',header)[0])))
            reader=threading.Thread(target=read,daemon=True);reader.start();reader.join(10)
            assert messages and messages[0]['status']=='Pocket Deckに接続中',messages
            assert seen[0][0:2]==('/api/bridge','mock-token') and seen[0][2]['name']=='テスト'
            p.stdin.close();p.wait(timeout=5);assert p.returncode==0
            assert not p.stderr.read(), 'Host stderr was not empty'
        finally:
            if p.poll() is None:p.kill();p.wait()
    assert (exe.parent/'PocketDeckChromeHost.exe').exists()
    assert (exe.parent/'chrome-extension'/'manifest.json').exists()
    print('Packaged Chrome host: authenticated framed transport, Japanese name, data-dir, no Python dependency and EOF shutdown PASS')
finally:http.shutdown();http.server_close()
