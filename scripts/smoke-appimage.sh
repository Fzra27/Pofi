#!/usr/bin/env bash
# Display/DBus smoke test for the portable build in a disposable CI session.
set -euo pipefail
image=$(realpath "$1")
script=$(realpath "$(dirname "$0")/smoke-linux.py")
export POFI_SMOKE_DATA_DIR
POFI_SMOKE_DATA_DIR=$(mktemp -d /tmp/pofi-image-smoke-XXXXXX)
dbus-run-session -- xvfb-run -a bash -c '
  set -euo pipefail
  APPIMAGE_EXTRACT_AND_RUN=1 "$1" --no-sandbox --user-data-dir="$POFI_SMOKE_DATA_DIR" > /tmp/pofi-appimage.log 2>&1 &
  pofi=$!
  trap "kill $pofi 2>/dev/null || true" EXIT
  if ! python3 "$2"; then tail -80 /tmp/pofi-appimage.log; exit 1; fi
' _ "$image" "$script"
rm -rf "$POFI_SMOKE_DATA_DIR"
