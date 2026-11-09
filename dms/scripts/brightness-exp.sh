#!/bin/sh
# Re-apply DMS brightness exponential mode (runtime-only setting, no DMS config
# persistence). Waits for the dms ipc server to be up.
echo "run at $(date)" >> /tmp/bexp-marker
sleep 3
dms ipc call brightness enableExponential
