#!/bin/sh
set -eu
test "$(id -u)" != 0
. /tmp/deck-session.env
export XDG_CONFIG_HOME=/tmp/deck-test-config
exec /tmp/pocket-deck-backend/PocketDeckServer --host 127.0.0.1 --data-dir '/tmp/deck-test-config/Pocket Deck/data' > /tmp/deck-chrome-backend.log 2>&1
