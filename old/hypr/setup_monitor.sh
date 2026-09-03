# Monitor configuration based on hostname
# Current machine: q530 (Scaling = 1)
# All other machines (Scaling = 1.25)

if [ "$(hostname)" = "q530" ]; then
    echo "monitor=,preferred,auto,1" > ~/.config/hypr/monitor.conf
else
    echo "monitor=,preferred,auto,1.25" > ~/.config/hypr/monitor.conf
fi
