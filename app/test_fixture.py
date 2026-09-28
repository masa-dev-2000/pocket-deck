"""Manual browser fixture: isolated data, mock keyboard/mouse, loopback only."""
import tempfile
import threading
import time
import argparse
from pathlib import Path
from http.server import ThreadingHTTPServer
import server

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8766);args=parser.parse_args()
    with tempfile.TemporaryDirectory() as directory:
        events=[]
        app=server.App(Path(directory)/'config.json',server.Keyboard(lambda *a:events.append(['key',*a])),lambda t:events.append(['text',t]),lambda *a:events.append(['mouse',*a]))
        layout=app.config['layouts'][0];layout.update(columns=4,rows=4,buttons=layout['buttons'][:3])
        class Handler(server.handler(app)):
            def do_GET(self):
                if self.path=='/test-events':self.reply(200,events)
                else:super().do_GET()
        def watchdog():
            while True:
                time.sleep(.02)
                with app.lock:app.features.tick();app.keyboard.expire();app.mouse.expire()
        threading.Thread(target=watchdog,daemon=True).start()
        ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
