import subprocess,tempfile,time,json,urllib.request,socket
from pathlib import Path
exe=Path(__file__).parent/'backend-build/PocketDeckServer/PocketDeckServer.exe'
with tempfile.TemporaryDirectory() as directory:
    with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
    def start():
        return subprocess.Popen([str(exe),'--host','127.0.0.1','--port',str(port),'--data-dir',directory,'--managed-stdio'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NO_WINDOW)
    def get(route):
        with urllib.request.urlopen(f'http://127.0.0.1:{port}'+route,timeout=2) as r:return r.read()
    p=start()
    try:
        for _ in range(80):
            if p.poll() is not None:raise RuntimeError(p.communicate()[1].decode(errors='replace'))
            try:config=json.loads(get('/api/config'));break
            except OSError:time.sleep(.1)
        else:raise RuntimeError('Server did not start')
        assert config['version']==5
        assert b'lineTools' in get('/editor')
        assert b'value="wheel"' in get('/editor')
        assert b'class WheelController' in get('/pad.js')
        assert b'<svg' in get('/connect.svg')
        config['layouts'][0]['buttons'][0]['type']='wheel'
        req=urllib.request.Request(f'http://127.0.0.1:{port}/api/config',json.dumps(config).encode(),{'Content-Type':'application/json'})
        with urllib.request.urlopen(req) as response:config=json.load(response)
        p.stdin.write(b'shutdown\n');p.stdin.flush();p.wait(timeout=5);assert p.returncode==0
        saved=(Path(directory)/'config.json').read_bytes()
        p=start()
        for _ in range(80):
            try:again=json.loads(get('/api/config'));break
            except OSError:time.sleep(.1)
        assert again==config
        p.stdin.close();p.wait(timeout=5);assert p.returncode==0
        assert (Path(directory)/'config.json').read_bytes()==saved
        print('Bundled backend: standalone startup, static UI, QR, graceful shutdown, parent EOF and persistent config PASS')
    finally:
        if p.poll() is None:p.kill();p.wait()
