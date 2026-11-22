#!/usr/bin/env bash
# Start a visible, logged-in Chrome with the DevTools protocol enabled.
#
# Chrome refuses --remote-debugging-port when --user-data-dir points at the
# default profile, so we run against a copy of the real profile. That keeps the
# user's AstroBin (and every other) login without touching the live profile.
#
# Usage: start-chrome.sh [--kill] [--fresh]
#   --kill   stop any running Chrome first (closes the user's windows)
#   --fresh  re-copy the profile from scratch (use after cookies expire)
#
# Env: PORT (default 9222), PROFILE (default /tmp/opencode/chrome-profile),
#      SRC (default ~/.config/google-chrome), CHROME (binary path override)

set -euo pipefail

PORT="${PORT:-9222}"
PROFILE="${PROFILE:-/tmp/opencode/chrome-profile}"
SRC="${SRC:-$HOME/.config/google-chrome}"
LOG="${LOG:-/tmp/opencode/chrome-automation.log}"
KILL=0
FRESH=0

for arg in "$@"; do
  case "$arg" in
    --kill) KILL=1 ;;
    --fresh) FRESH=1 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

cdp_up() {
  curl -sf "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1
}

if cdp_up; then
  echo "CDP already listening on 127.0.0.1:${PORT}; reusing the running Chrome."
  exit 0
fi

if pgrep -x chrome >/dev/null; then
  if [ "$KILL" -eq 1 ]; then
    echo "Stopping running Chrome..."
    pkill -x chrome || true
    for _ in $(seq 1 20); do pgrep -x chrome >/dev/null || break; sleep 0.5; done
  else
    cat >&2 <<EOF
Chrome is running, but without a DevTools port on 127.0.0.1:${PORT}.
Re-run with --kill to close it first (Chrome restores its tabs on next start),
or close Chrome yourself and run this script again.
EOF
    exit 1
  fi
fi

if [ ! -x "$(command -v "${CHROME:-}" 2>/dev/null || true)" ]; then
  for cand in google-chrome-stable google-chrome chromium chromium-browser; do
    if command -v "$cand" >/dev/null 2>&1; then CHROME="$(command -v "$cand")"; break; fi
  done
fi
[ -n "${CHROME:-}" ] || { echo "No Chrome binary found; set CHROME=/path/to/chrome" >&2; exit 1; }

mkdir -p "$(dirname "$PROFILE")" "$(dirname "$LOG")"

if [ "$FRESH" -eq 1 ] || [ ! -f "$PROFILE/Local State" ]; then
  echo "Copying profile $SRC -> $PROFILE (this takes a minute)..."
  rm -rf "$PROFILE"
  mkdir -p "$PROFILE"
  rsync -a \
    --exclude 'Cache/' --exclude 'Code Cache/' --exclude 'GPUCache/' \
    --exclude 'DawnCache/' --exclude 'GrShaderCache/' --exclude 'ShaderCache/' \
    --exclude 'GraphiteDawnCache/' --exclude 'Service Worker/CacheStorage/' \
    --exclude 'Crash Reports/' --exclude 'BrowserMetrics/' \
    --exclude 'component_crx_cache/' --exclude 'extensions_crx_cache/' \
    "$SRC/" "$PROFILE/"
else
  echo "Reusing existing profile copy at $PROFILE (use --fresh to re-copy)."
fi

echo "Launching Chrome on port ${PORT}..."
"$CHROME" \
  --remote-debugging-port="$PORT" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$PROFILE" \
  --no-first-run --no-default-browser-check \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling \
  --disable-features=CalculateNativeWinOcclusion \
  --disable-background-networking \
  --disable-sync \
  --disable-component-update \
  --disable-features=OptimizationHints \
  --ash-no-nudges \
  >"$LOG" 2>&1 &
disown || true

for _ in $(seq 1 60); do
  if cdp_up; then
    echo "CDP ready: http://127.0.0.1:${PORT}"
    exit 0
  fi
  sleep 0.5
done

echo "Chrome did not expose CDP. Last log lines:" >&2
tail -20 "$LOG" >&2
exit 1
