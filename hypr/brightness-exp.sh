#!/usr/bin/env bash
# Exponential brightness control for Hyprland
# Maps perceived brightness linearly (0–100%) to actual backlight
# using a power curve, so steps feel uniform to the human eye.
#
# Bottom range (0–10 raw): linear 1-unit steps
# Upper range: exponential (raw = (MAX+1)^(perc/100) - 1)
# This avoids the log(1)=0 flat spot that caused brightness to get stuck.

set -euo pipefail

MAX=$(brightnessctl max)
RAW=$(brightnessctl get)

DIR="${2:-up}"
STEP=${1:-5}

python3 -c "
import math, sys

MAX = ${MAX}
RAW = ${RAW}
STEP = ${STEP}
DIR = '${DIR}'
BOTTOM = 10  # Bottom raw units use linear stepping

# Convert current raw to perceived brightness
if RAW <= 0:
    perc = 0.0
elif RAW <= BOTTOM:
    perc = RAW * 10.0 / BOTTOM
else:
    perc = 10.0 + 90.0 * math.log((RAW + 1) / (BOTTOM + 1)) / math.log((MAX + 1) / (BOTTOM + 1))

# Adjust perceived brightness
if DIR == 'down':
    target_perc = perc - STEP
else:
    target_perc = perc + STEP

if target_perc < 0.0:
    target_perc = 0.0
if target_perc > 100.0:
    target_perc = 100.0

# Convert perceived brightness back to raw value
if target_perc <= 10.0:
    target_raw = int(round(target_perc / 10.0 * BOTTOM))
    if target_perc > 0 and target_raw == 0:
        target_raw = 1
    if target_perc > 0 and DIR == 'up' and target_raw <= RAW and RAW > 0:
        target_raw = min(RAW + 1, BOTTOM)
else:
    # Exponential range
    target_raw = int(round((BOTTOM + 1) * ((MAX + 1) / (BOTTOM + 1)) ** ((target_perc - 10.0) / 90.0) - 1))

target_raw = max(0, min(target_raw, MAX))

print(target_raw)
" | xargs -I{} brightnessctl s {}
