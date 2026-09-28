ARG UBUNTU_VERSION=24.04
FROM ubuntu:${UBUNTU_VERSION}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    gnome-shell mutter xdg-desktop-portal xdg-desktop-portal-gnome \
    dbus-x11 pipewire wireplumber xvfb xwayland x11vnc novnc websockify at-spi2-core \
    python3 python3-venv python3-gi gir1.2-gtk-3.0 libxtst6 x11-utils xclip \
    libgtk-3-0 libnss3 libgbm1 libgl1-mesa-dri \
    ca-certificates curl git fonts-noto-core fonts-noto-cjk \
    && (. /etc/os-release; if [ "$VERSION_ID" = "22.04" ]; then apt-get install -y libasound2; else apt-get install -y libasound2t64; fi) \
    && useradd -m -u 1001 deck && rm -rf /var/lib/apt/lists/*
COPY run-desktop.sh /opt/run-desktop.sh
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod 755 /opt/run-desktop.sh /opt/entrypoint.sh
EXPOSE 6080
ENTRYPOINT ["/opt/entrypoint.sh"]
