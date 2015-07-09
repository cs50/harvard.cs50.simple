SHELL=/bin/bash

prefix=/usr/local
DESTDIR=$(HOME)/render50/cli/deb/render50-1.8/debian/render50

all:

clean:

install: all
	cp -LR opt $(DESTDIR)
	find $(DESTDIR)/opt/render50 -type d -print0 | xargs -0 chmod 755
	find $(DESTDIR)/opt/render50 -type f -print0 | xargs -0 chmod 644
	chmod 755 $(DESTDIR)/opt/render50/bin/render50.sh
	ln -s /opt/render50/bin/render50.sh $(DESTDIR)$(prefix)/bin/render50
