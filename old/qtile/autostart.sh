#!/bin/sh 
picom --vsync --backend=glx &
dropbox &
QT_SCALE_FACTOR=1 flameshot &
telegram-desktop &
nm-applet &
#arandr &
~/.screenlayout/external.sh &


