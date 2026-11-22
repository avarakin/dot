#!/usr/bin/env bash
# Enable Chrome remote debugging (CDP) via a managed policy.
# Chrome 136+ blocks --remote-debugging-port unless RemoteDebuggingAllowed is
# true. This machine has no policy dir, so the switch is accepted and silently
# ignored. The script creates the dir and drops a policy file.
# Requires sudo (password prompt).
set -euo pipefail
DIR=/etc/opt/chrome/policies/managed

sudo mkdir -p "$DIR"

sudo tee "$DIR/remote_debugging.json" >/dev/null <<'EOF'
{
  "RemoteDebuggingAllowed": true,
  "DeveloperToolsAvailability": 1
}
EOF

echo "Wrote $DIR/remote_debugging.json"
echo "Verify with chrome://policy after restarting Chrome."
echo "Then run: ~/.agents/skills/astrobin-upload/scripts/start-chrome.sh"
