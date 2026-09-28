#!/bin/sh
# Isolated WSL X11 display for testing the AppImage with Chromium sandbox enabled.
set -eu
test ! -S /tmp/.X11-unix/X177
mkdir -p /tmp/pocket-deck-x11-runtime
chmod 700 /tmp/pocket-deck-x11-runtime
Xvfb :177 -screen 0 1440x1000x24 -ac -nolisten tcp >/tmp/pocket-deck-x11-lab.log 2>&1 &
deck_xvfb_pid=$!
trap 'kill "$deck_xvfb_pid" 2>/dev/null || true' EXIT INT TERM
sleep 1
unset WAYLAND_DISPLAY
export DISPLAY=:177 XDG_SESSION_TYPE=x11 XDG_RUNTIME_DIR=/tmp/pocket-deck-x11-runtime
export XDG_CONFIG_HOME=/tmp/pocket-deck-install-check APPIMAGE_EXTRACT_AND_RUN=1
/tmp/pocket-deck-package/app/desktop-dist/Pocket-Deck-1.0.4-x86_64.AppImage --ozone-platform=x11 --disable-gpu >/tmp/pocket-deck-sandbox-check.log 2>&1
