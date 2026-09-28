#!/bin/sh
set -eu
unset WAYLAND_DISPLAY
XDG_SESSION_TYPE=x11 x11vnc -display :177 -forever -shared -nopw -listen 127.0.0.1 -rfbport 5906 >/tmp/pocket-deck-wsl-vnc.log 2>&1 &
deck_vnc_pid=$!
trap 'kill "$deck_vnc_pid" 2>/dev/null || true' EXIT INT TERM
websockify --web=/usr/share/novnc 127.0.0.1:6086 127.0.0.1:5906
