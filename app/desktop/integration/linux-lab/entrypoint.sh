#!/bin/sh
set -eu
mkdir -p /run/dbus
dbus-daemon --system --fork
/usr/lib/systemd/systemd-logind >/tmp/logind.log 2>&1 &
exec runuser -u deck -- dbus-run-session -- /opt/run-desktop.sh
