#!/bin/sh
set -eu
. /tmp/deck-session.env
export GDK_BACKEND=wayland PYTHONPATH=/usr/lib/python3/dist-packages
exec /tmp/venv/bin/python /source/app/desktop/integration/linux-lab/portal-scroll-probe.py
