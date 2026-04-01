if status is-interactive
    # Commands to run in interactive sessions can go here
end
export PATH="$HOME/.local/bin:$PATH"
abbr obs "GLIBC_TUNABLES=glibc.rtld.execstack=2 obs"
abbr webcam "sudo modprobe v4l2loopback exclusive_caps=1 max_buffers=2 ; gphoto2 --stdout --set-config liveviewsize=0 --capture-movie | ffmpeg  -i - -vcodec rawvideo -pix_fmt yuv420p -threads 0 -f v4l2  -r 30 /dev/video0"

