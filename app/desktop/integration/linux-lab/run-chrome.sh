#!/bin/sh
set -eu
. /tmp/deck-session.env
if [ "${DECK_CHROME_PLATFORM:-wayland}" = x11 ]; then
    export DISPLAY="${DECK_CHROME_DISPLAY:?}" XAUTHORITY="${DECK_CHROME_AUTH:?}"
fi
export XDG_CONFIG_HOME=/tmp/deck-test-config
extension_folder="$XDG_CONFIG_HOME/Pocket Deck/chrome-extension"
extension_id=$(/tmp/venv/bin/python -c 'import json; print(json.load(open("/tmp/deck-test-config/Pocket Deck/chrome-native-host.json"))["allowed_origins"][0].split("/")[2])')
exec /tmp/chrome-for-testing/chrome --no-sandbox --ozone-platform="${DECK_CHROME_PLATFORM:-wayland}" \
    --user-data-dir="$XDG_CONFIG_HOME/google-chrome-for-testing" --profile-directory="${1:-Default}" \
    --load-extension="$extension_folder" --no-first-run --no-default-browser-check \
    --new-window "chrome-extension://$extension_id/popup.html"
