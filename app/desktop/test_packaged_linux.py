"""Opt-in Linux packaged runtime and rapid restart checks, with no desktop input."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen

@unittest.skipUnless(sys.platform=='linux' and os.environ.get('DECK_PACKAGED_TEST')=='1','opt-in Linux package test')
class PackagedLinux(unittest.TestCase):
    def test_embedded_python_exclusive_listener_and_saved_config_survive_restart(self):
        executable=Path(os.environ.get('DECK_PACKAGED_EXEC',Path(__file__).parent/'backend-build/PocketDeckServer/PocketDeckServer'))
        environment={**os.environ,'PATH':'/nonexistent'}
        for key in ('DISPLAY','WAYLAND_DISPLAY'):environment.pop(key,None)
        self.assertEqual(subprocess.run([executable,'--help'],env=environment,capture_output=True,timeout=10).returncode,0)
        with socket.socket() as probe:probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
        def request(data=None):
            req=Request(f'http://127.0.0.1:{port}/api/config',None if data is None else json.dumps(data).encode(),{'Content-Type':'application/json'})
            with urlopen(req,timeout=2) as response:return json.load(response)
        with tempfile.TemporaryDirectory(prefix='deck-packaged-') as directory:
            command=[str(executable),'--host','127.0.0.1','--port',str(port),'--data-dir',directory,'--managed-stdio']
            for generation in range(2):
                child=subprocess.Popen(command,env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
                try:
                    for _ in range(50):
                        try:config=request();break
                        except Exception:time.sleep(.1)
                    else:
                        if child.poll() is None:child.kill()
                        _,failure=child.communicate(timeout=5)
                        self.fail('packaged backend did not start: '+failure.decode())
                    if generation==0:
                        config['layouts'][0]['buttons'][0]['label']='Linux package persistence proof'
                        saved=request(config)
                        second=subprocess.run(command,env=environment,input=b'shutdown\n',capture_output=True,timeout=10)
                        self.assertNotEqual(second.returncode,0,'a live listener must remain exclusive')
                        self.assertIn(b'Address already in use',second.stderr)
                    else:
                        self.assertEqual(config,saved)
                    stdout,stderr=child.communicate(b'shutdown\n',timeout=10)
                    self.assertEqual(child.returncode,0,stderr.decode())
                finally:
                    if child.poll() is None:child.kill();child.communicate()

if __name__=='__main__':unittest.main()
