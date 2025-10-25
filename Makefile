desktop: speedup base extra syncthing kstars nvidia 



astro_laptop: base astro

speedup:
	sudo sed -i 's/^#ParallelDownloads/ParallelDownloads/' /etc/pacman.conf
	sudo pacman -S --noconfirm reflector rsync grub
	sudo cp /etc/pacman.d/mirrorlist /etc/pacman.d/mirrorlist.backup
	sudo reflector -a 48 -c `curl -4 ifconfig.co/country-iso` -f 5 -l 20 --sort rate --save /etc/pacman.d/mirrorlist


/usr/bin/yay: git
	git clone "https://aur.archlinux.org/yay.git" && cd yay && makepkg -si --noconfirm && cd .. && rm -rf yay


zfs:
	sudo pacman -S --noconfirm --needed linux-headers linux-lts-headers
	yay -S --noconfirm --needed zfs-dkms
	sudo zpool import data1
	sudo zpool set cachefile=/etc/zfs/zpool.cache data1
	sudo systemctl enable --now zfs-scrub-weekly@zroot.timer
	sudo systemctl enable --now zfs.target
	sudo systemctl enable --now zfs-import.target
	sudo systemctl enable --now zfs-import-cache
	sudo systemctl enable --now zfs-mount
base:
	sudo pacman -Syu
	sudo pacman -S --noconfirm --needed terminator geeqie flameshot arduino tilda syncthing ttf-inconsolata remmina  libvncserver gparted emacs ttf-jetbrains-mono less  \
	terminus-font ttf-droid ttf-hack ttf-roboto python-pip p7zip rsync snapper unrar openssh unzip usbutils wget \
	zsh-autosuggestions net-tools inetutils mc reflector cups git rawtherapee system-config-printer gimp man baobab cronie \
	p7zip rsync snapper unrar openssh unzip usbutils wget zsh zsh-syntax-highlighting zsh-autosuggestions net-tools inetutils telegram-desktop ksnip ttf-jetbrains-mono-nerd picom alsa-utils
	sudo systemctl enable --now cups.service
	sudo systemctl enable --now cronie.service


#before proceeding, dowload distro file and place into yay cache directory for davincy package
resolve:
	yay -S --noconfirm --needed  davinci-resolve-studio
	sudo mkdir /opt/resolve/.license
	sudo chmod -R 7777 /opt/resolve/.license/



timeshift:
	sudo pacman -S --noconfirm --needed  timeshift grub-btrfs timeshift-autosnap
	#Modify line to be like this:  ExecStart=/usr/bin/grub-btrfsd --syslog --timeshift-auto
	sudo systemctl edit --full grub-btrfsd
	sudo systemctl enable grub-btrfsd
	sudo grub-mkconfig -o /boot/grub/grub.cfg

extra: /usr/bin/yay
	yay -S --noconfirm --needed google-chrome
#	yay -S --noconfirm --needed octopi
	yay -S --noconfirm --needed ttf-envy-code-r
	yay -S --noconfirm --needed joplin-appimage
	yay -S --noconfirm --needed visual-studio-code-bin
	yay -S --noconfirm --needed realvnc-vnc-viewer
	yay -S --noconfirm --needed freecad-appimage
	sudo pacman -S --noconfirm --needed prusa-slicer
	yay -S --noconfirm --needed kwin-scripts-krohnkite-git
	sudo pacman -S --noconfirm --needed libappindicator-gtk3
	yay -S --noconfirm --needed dropbox
	sudo pacman -S --noconfirm --needed qtile
	yay -S --noconfirm --needed qtile-extras
	yay -S --noconfirm --needed mergerfs
	yay -S --noconfirm --needed dnglab-bin

esp32:
	pip3 install pyserial
	sudo usermod -a -G uucp $(USER)

syncthing:
	sudo pacman -S --noconfirm --needed syncthing
	sudo systemctl enable --now syncthing@$(USER).service


astro: indi phd kstars astrometry ccdciel astap astap_star_db

kstars:
	sudo pacman -S --noconfirm --needed kstars breeze-icons

indi:
	sudo pacman -S --noconfirm --needed binutils patch libraw libindi gpsd gcc
	-yay -S --nobatchinstall --noconfirm --needed libindi_3rdparty libindi-asi 

phd:
	-yay -S --nobatchinstall --noconfirm --needed phd2 

astrometry:
	-yay -S --nobatchinstall --noconfirm --needed sextractor-bin
	-yay -S --nobatchinstall --noconfirm --needed astrometry.net
	#looks like astrometry is installed in the wrong place, so creating a symlink to the right place
	#-sudo ln -s /usr/lib/python/site-packages/astrometry /usr/lib/python3.10/site-packages
	wget broiler.astrometry.net/~dstn/4100/index-4107.fits
	wget broiler.astrometry.net/~dstn/4100/index-4108.fits
	wget broiler.astrometry.net/~dstn/4100/index-4109.fits
	sudo mv index-410[789].fits /usr/share/astrometry/data


.PHONY: ccdciel
ccdciel:
	yay -S --nobatchinstall --noconfirm --needed libpasastro
	cd ccdciel && makepkg  --noconfirm --needed  -sric && rm -f  *.xz *.zst

astap_star_db:
	cd h18_star_db && makepkg --noconfirm --needed  -sric && rm -f  *.deb download  *.zst

powerlink:
	touch "$(HOME)/.cache/zshhistory"
	git clone --depth=1 https://github.com/romkatv/powerlevel10k.git ~/powerlevel10k
	echo 'source ~/powerlevel10k/powerlevel10k.zsh-theme' >> ~/.zshrc

scripts:
	ln -s ~/dot/scripts  ~/.local/share/nemo/
	ln -s ~/dot/scripts  ~/.local/share/nautilus/
	mkdir -p ~/.local/share/kservices5/ServiceMenus
	ln -s  resize_for_cn.desktop ~/.local/share/kservices5/ServiceMenus/ 

git:
	sudo pacman -S git
	git config --global user.email "avarakin@gmail.com"
	git config --global user.name "Alex Varakin"
	git config credential.helper 'cache --timeout=30000'


#configure tigervnc 
vnc :
	sudo pacman -S --noconfirm --needed tigervnc
	vncpasswd
	echo geometry=1920x1080 > ~/.vnc/config
	echo alwaysshared >> ~/.vnc/config
	sudo sh -c "echo :1=$(USER) >>  /etc/tigervnc/vncserver.users"
	sudo systemctl enable vncserver@:1.service
	sudo systemctl start vncserver@:1.service

 
wap :
	yay -S --noconfirm --needed create_ap-git
	sudo sed -i.bak 's/SSID=MyAccessPoint/SSID=zbox/'  /etc/create_ap.conf
	sudo sed -i.bak 's/PASSPHRASE=12345678/PASSPHRASE=password/'  /etc/create_ap.conf
	sudo sed -i.bak 's/INTERNET_IFACE=eth0/INTERNET_IFACE=enp2s0/'  /etc/create_ap.conf
	sudo sed -i.bak 's/NO_VIRT=0/NO_VIRT=1/'  /etc/create_ap.conf
	sudo sed -i.bak 's/WIFI_IFACE=wlan0/WIFI_IFACE=wlp3s0/'  /etc/create_ap.conf
	sudo systemctl enable create_ap
	sudo systemctl start create_ap
	sleep 5
	sudo systemctl status create_ap


astrodmx:
	wget https://www.astrodmx-capture.org.uk/sites/downloads/astrodmx/current/x86-64/astrodmx-capture_1.4.2.1_x86-64-manual.tar.gz
	tar zxvf astrodmx-capture_1.4.2.1_x86-64-manual.tar.gz

astap:
	yay --noconfirm --needed  --mflags --skipchecksums -S astap-bin


#These are applications for Desktop computer
desktop:
	-yay -S --noconfirm --needed  dropbox
	-yay -S --noconfirm --needed  zoom
#	-yay -S --noconfirm --needed  teams

#support suspend for CUDA
nvidia:
	sudo pacman -S --noconfirm --needed nvidia-settings nvidia-utils tensorflow-cuda
#	exit 1
	echo "options nvidia NVreg_PreserveVideoMemoryAllocations=1 NVreg_TemporaryFilePath=/tmp" | sudo tee /etc/modprobe.d/nvidia-power-management.conf 
	sudo systemctl enable nvidia-suspend.service
	sudo systemctl enable nvidia-hibernate.service
	sudo systemctl status nvidia-suspend.service
	sudo systemctl start nvidia-suspend.service

PI:
	sudo pacman -S --noconfirm --needed cuda cudnn tensorflow-cuda
	sudo rm /opt/PixInsight/bin/lib/libtensor* 
	sudo rm /opt/PixInsight/bin/lib/libssh2.*
	sudo rm /opt/PixInsight/bin/lib/libssl*
	sudo rm /opt/PixInsight/bin/lib/libcrypto*


WAKEUP=/lib/systemd/system/wakeup.service
wakeup:
	sudo sh -c "echo '[Unit]' > $(WAKEUP)"
	sudo sh -c "echo 'Description=Disable wakeup on USB' >> $(WAKEUP)"
	sudo sh -c "echo 'After=multi-user.target' >> $(WAKEUP)"
	sudo sh -c "echo '[Service]'>> $(WAKEUP)"
	sudo sh -c "echo 'Type=oneshot'>> $(WAKEUP)"
	sudo sh -c "echo 'RemainAfterExit=yes'>> $(WAKEUP)"
#	sudo sh -c "echo 'ExecStart=/bin/echo PTXH > /proc/acpi/wakeup'>> $(WAKEUP)"
	sudo sh -c "echo 'ExecStart=/bin/sh -c \"/bin/echo XHC0 > /proc/acpi/wakeup\"'>> $(WAKEUP)"
	sudo sh -c "echo '[Install]'>> $(WAKEUP)"
	sudo sh -c "echo 'WantedBy=multi-user.target'>> $(WAKEUP)"
	sudo systemctl enable wakeup.service
	sudo systemctl start wakeup.service

#fix zfs auto mounting issue. Run this as root
zfs-fix:
	cat <<EOF > /etc/systemd/system/zfs-import-race-condition-fix.service
	[Unit]
	DefaultDependencies=no
	Before=zfs-import-scan.service
	Before=zfs-import-cache.service
	After=systemd-modules-load.service
	
	[Service]
	Type=oneshot
	RemainAfterExit=yes
	ExecStart=/usr/bin/sleep 10
	
	[Install]
	WantedBy=zfs-import.target
	EOF
	systemctl enable zfs-import-race-condition-fix
	echo "zfs" > /etc/modules-load.d/zfs.conf


