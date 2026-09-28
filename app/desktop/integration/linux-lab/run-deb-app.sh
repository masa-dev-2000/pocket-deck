#!/bin/sh
# Disposable container UI check only. Never use these flags for a distribution.
set -eu
. /tmp/deck-session.env
export XDG_CONFIG_HOME=/tmp/deck-deb-check
exec '/opt/Pocket Deck/pocket-deck-desktop' --no-sandbox --ozone-platform=wayland
