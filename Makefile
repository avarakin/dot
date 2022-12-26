astro_laptop: base astro

speedup:
	sudo sed -i 's/^#ParallelDownloads/ParallelDownloads/' /etc/pacman.conf
	sudo pacman -S --noconfirm reflector rsync grub
	sudo cp /etc/pacman.d/mirrorlist /etc/pacman.d/mirrorlist.backup
	sudo reflector -a 48 -c `curl -4 ifconfig.co/country-iso` -f 5 -l 20 --sort rate --save /etc/pacman.d/mirrorlist
	sudo pacman -S --noconfirm --needed p7zip rsync snapper unrar openssh unzip usbutils wget zsh zsh-syntax-highlighting zsh-autosuggestions net-tools inetutils


/usr/bin/yay:
	git clone "https://aur.archlinux.org/yay.git" && cd yay && makepkg -si --noconfirm && cd .. && rm -rf yay


base: /usr/bin/yay syncthing
	sudo pacman -Syu
	sudo pacman -S --noconfirm --needed terminator geeqie flameshot arduino tilda syncthing ttf-inconsolata remmina  libvncserver gparted emacs ttf-jetbrains-mono \
	terminus-font ttf-droid ttf-hack ttf-roboto python-pip p7zip rsync snapper unrar openssh unzip usbutils wget zsh zsh-syntax-highlighting \
	zsh-autosuggestions net-tools inetutils mc
	yay -S --noconfirm --needed gooogle-chrome
	yay -S --noconfirm --needed nomachine
	yay -S --noconfirm --needed octopi
	yay -S --noconfirm --needed ttf-envy-code-r
	yay -S --noconfirm --needed joplin-appimage
	yay -S --noconfirm --needed visual-studio-code-bin
	yay -S --noconfirm --needed snapper-gui-git


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
	mkdir -p ~/.local/share/nemo/scripts
	cp resize_for_CN ~/.local/share/nemo/scripts
	mkdir -p ~/.local/share/kservices5/ServiceMenus
	cp  resize_for_cn.desktop ~/.local/share/kservices5/ServiceMenus/ 

git:
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
	-yay -S --noconfirm --needed  teams
	-yay -S --noconfirm --needed  zoom
	-yay -S --noconfirm --needed  vmware
	sudo pacman -S --noconfirm --needed rawtherapee cura system-config-printer gimp
	systemctl enable cups.service

#support suspend for CUDA
nvidia:
	echo "options nvidia NVreg_PreserveVideoMemoryAllocations=1 NVreg_TemporaryFilePath=/tmp" | sudo tee /etc/modprobe.d/nvidia-power-management.conf 
	sudo systemctl enable nvidia-suspend.service
	sudo systemctl enable nvidia-hibernate.service
	sudo systemctl status nvidia-suspend.service
	sudo systemctl start nvidia-suspend.service


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

