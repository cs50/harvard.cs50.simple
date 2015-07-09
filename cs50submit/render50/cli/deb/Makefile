SHELL=/bin/bash

VERSION=1.8

all:
	tar -czf render50_$(VERSION).orig.tar.gz render50-$(VERSION)
	cd render50-$(VERSION) && debuild -us -uc

host:
	sudo apt-get install devscripts debhelper
