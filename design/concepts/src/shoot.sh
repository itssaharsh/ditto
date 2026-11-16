#!/bin/bash
# usage: shoot.sh name
D=$HOME/contri/kane/design/concepts
C=~/.local/lib/kane-chrome/chrome
for s in "1440,900,1440" "390,844,390"; do IFS=, read w h n <<<"$s"
 $C --headless=new --hide-scrollbars --disable-gpu --virtual-time-budget=4000 --force-device-scale-factor=1 --window-size=$w,$h --screenshot=$D/shots/$1-$n.png file://$D/$1.html >/dev/null 2>&1
done
