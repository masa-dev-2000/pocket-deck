"""Read real terminal PTY input, without executing the received text."""
import json
from pathlib import Path
import time
assert Path('/var/tmp/deck-lab-ready').exists(),'disposable VM required'
print('Paste the two-line terminal test text here:',flush=True)
lines=[input(),input()]
result={'terminalReceived':'\n'.join(lines)}
Path('/tmp/terminal-input.json').write_text(json.dumps(result))
print(json.dumps(result,ensure_ascii=False),flush=True)
while True:time.sleep(1)
