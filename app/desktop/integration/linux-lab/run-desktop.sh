#!/bin/sh
set -eu
export XDG_RUNTIME_DIR=/tmp/deck-runtime
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
export DISPLAY=:99 XDG_SESSION_TYPE=wayland XDG_CURRENT_DESKTOP=GNOME
export GALLIUM_DRIVER=llvmpipe LIBGL_ALWAYS_SOFTWARE=1
Xvfb :99 -screen 0 1440x1000x24 -ac -nolisten tcp >/tmp/xvfb.log 2>&1 &
sleep 1
gnome-shell --nested --wayland >/tmp/gnome-shell.log 2>&1 &
for attempt in $(seq 1 60); do
    if test -S "$XDG_RUNTIME_DIR/wayland-0"; then break; fi
    sleep 1
done
export WAYLAND_DISPLAY=wayland-0
for attempt in $(seq 1 30); do
    compositor_display=$(sed -n 's/.*Using public X11 display \(:[0-9]*\).*/\1/p' /tmp/gnome-shell.log | tail -1)
    if [ -n "$compositor_display" ]; then break; fi
    sleep 1
done
if [ -n "$compositor_display" ]; then export DISPLAY="$compositor_display"; fi
export XAUTHORITY=$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -name '.mutter-Xwaylandauth.*' -print -quit)
dbus-update-activation-environment DISPLAY WAYLAND_DISPLAY XDG_RUNTIME_DIR XDG_CURRENT_DESKTOP XDG_SESSION_TYPE XAUTHORITY
pipewire >/tmp/pipewire.log 2>&1 &
wireplumber >/tmp/wireplumber.log 2>&1 &
printf "export DISPLAY='%s'\nexport WAYLAND_DISPLAY='%s'\nexport XDG_RUNTIME_DIR='%s'\nexport XDG_CURRENT_DESKTOP='%s'\nexport XDG_SESSION_TYPE='%s'\nexport DBUS_SESSION_BUS_ADDRESS='%s'\nexport XAUTHORITY='%s'\n" \
    "$DISPLAY" "$WAYLAND_DISPLAY" "$XDG_RUNTIME_DIR" "$XDG_CURRENT_DESKTOP" "$XDG_SESSION_TYPE" "$DBUS_SESSION_BUS_ADDRESS" "$XAUTHORITY" >/tmp/deck-session.env
env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 x11vnc -display :99 -forever -shared -nopw -listen 127.0.0.1 -rfbport 5900 >/tmp/x11vnc.log 2>&1 &
exec websockify --web=/usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900
