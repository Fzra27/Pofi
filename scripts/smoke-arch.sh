#!/usr/bin/env bash
# Runs only in a disposable Arch CI container, never on a user's installed system.
set -euo pipefail
pacman -Syu --noconfirm
pacman -S --needed --noconfirm xorg-server-xvfb xorg-xwininfo dbus python
pacman -U --noconfirm /packages/pofi-*-x86_64.pkg.tar.zst
useradd --create-home --user-group pofi-smoke
install -d -o pofi-smoke -g pofi-smoke /tmp/pofi-smoke-user
runuser -u pofi-smoke -- dbus-run-session -- bash -c '
  set -euo pipefail
  Xvfb :99 -screen 0 1440x1100x24 > /tmp/pofi-xvfb.log 2>&1 &
  xvfb=$!
  export DISPLAY=:99
  for i in {1..50}; do if [ -S /tmp/.X11-unix/X99 ]; then break; fi; sleep .1; done
  # Container smoke test only. Distributed launchers retain the normal Chromium sandbox.
  /opt/Pofi/pofi --no-sandbox --user-data-dir=/tmp/pofi-smoke-user > /tmp/pofi-app.log 2>&1 &
  pofi=$!
  trap "kill $pofi $xvfb 2>/dev/null || true" EXIT
  if ! python /scripts/smoke-linux.py; then tail -80 /tmp/pofi-app.log; exit 1; fi
'
