if status is-interactive
    # Commands to run in interactive sessions can go here
end
export PATH="$HOME/.local/bin:$HOME/dot/scripts:$PATH"
#abbr obs "GLIBC_TUNABLES=glibc.rtld.execstack=2 obs"
alias webcam "sudo modprobe v4l2loopback exclusive_caps=1 max_buffers=2 ; gphoto2 --stdout --set-config liveviewsize=0 --capture-movie | ffmpeg  -i - -vcodec rawvideo -pix_fmt yuv420p -threads 0 -f v4l2  -r 30 /dev/video0"
alias resolve "__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia /opt/resolve/bin/resolve"
export SHELL=/usr/bin/fish
alias gsu 'pkexec env WAYLAND_DISPLAY="$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" XDG_RUNTIME_DIR=/run/user/0'
export ANTHROPIC_AUTH_TOKEN="token"
export ANTHROPIC_BASE_URL="http://localhost:8084"

