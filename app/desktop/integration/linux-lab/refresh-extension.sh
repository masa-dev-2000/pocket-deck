#!/bin/sh
set -eu
for deck_file in manifest.json background.js popup.html popup.js; do
    cp "/source/app/chrome-extension/$deck_file" "/tmp/deck-test-config/Pocket Deck/chrome-extension/$deck_file"
done
if [ "${DECK_FOCUS_DIAGNOSTICS:-0}" = 1 ]; then
    python3 - <<'PY'
from pathlib import Path
path = Path('/tmp/deck-test-config/Pocket Deck/chrome-extension/background.js')
text = path.read_text()
text = text.replace("throw Error('Chromeを前面に出せませんでした')",
                    "throw Error('Lab focus check: '+JSON.stringify(actual))")
path.write_text(text)
PY
fi
