#!/usr/bin/env bash

# CPU graph script for waybar - displays last 5 CPU readings as sparkline
CACHE_FILE="/tmp/cpu_history.dat"
HISTORY_SIZE=5

# Get current CPU usage percentage using top
usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{printf "%.0f", 100 - $1}')

# Clamp usage to 0-100
usage=${usage:=0}
if (( usage < 0 )); then usage=0; fi
if (( usage > 100 )); then usage=100; fi

# Initialize or append to history file
if [[ ! -f "$CACHE_FILE" ]]; then
    echo "$usage" > "$CACHE_FILE"
else
    echo "$usage" >> "$CACHE_FILE"
fi

# Keep only last HISTORY_SIZE entries
tail -n $HISTORY_SIZE "$CACHE_FILE" > "$CACHE_FILE.tmp"
mv "$CACHE_FILE.tmp" "$CACHE_FILE"

# Sparkline characters (low to high)
sparkline=("▁" "▂" "▃" "▄" "▅" "▆" "▇" "█")

# Convert history to sparkline
graph=""
while IFS= read -r val; do
    # Map value (0-100) to sparkline index (0-7)
    idx=$((val * 7 / 100))
    [[ $idx -lt 0 ]] && idx=0
    [[ $idx -gt 7 ]] && idx=7
    graph+="${sparkline[$idx]}"
done < "$CACHE_FILE"

# Output with current percentage
echo "${graph} ${usage}%"
