# Usage

## Starting the Server

```
cd web/SOURCES/render50
./node_modules/forever/bin/forever index.js --port 80
```

## Using the API

Submit exactly one file (with a `name`) via POST to `/` with a Content-Type of `multipart/form-data`, as via the below:

```html
<form action="https://render.cs50.net/" enctype="multipart/form-data" method="post">
    <input name="file" type="file"/>
    <input type="submit"/>
</form>
```

Or POST the contents of the file itself to `/` with a Content-Type that matches the file's MIME type, as via the below:

```
POST / HTTP/1.1
Content-Length: [size of file]
Content-Type: application/pdf
Host: render.cs50.net

[contents of file]
```

Or even use cURL (where `example.c` and `example.pdf` are files in your working directory):

```
curl --data-binary "@example.c" --header "Content-Type: text/x-c" --request POST https://render.cs50.net/
curl --data-binary "@example.pdf" --header "Content-Type: application/pdf" --request POST https://render.cs50.net/
```

Supported inputs include:

| extension | Content-Type |
| --- | --- |
| `.c` | `text/x-c` |
| `.cc` | `text/x-c++` |
| `.cpp` | `text/x-c++` |
| `.html` | `text/html` |
| `.java` | `text/x-java` |
| `.js` | `text/x-javascript` |
| `.pdf` | `application/pdf` |
| `.php` | `text/x-php` |
| `.py` | `text/x-python` |
| `.rb` | `text/x-ruby` |
| `.txt` | `text/plain` |

# Installation Notes

These will eventually be automated via an RPM.

```
sudo su -

yum install \
autoconf \
automake \
bzip2 \
cairo-devel \
cmake \
fontconfig-devel \
freetype \
freetype-devel \
gcc \
gcc-c++ \
gettext \
gettext-devel \
giflib-devel \
git \
gnu-getopt \
libcurl-devel \
libjpeg-devel \
libpng-devel \
libspiro-devel \
libtiff-devel \
libtool \
libtool-ltdl-devel \
libxml2-devel \
make \
mercurial \
openjpeg-devel \
nodejs \
pango-devel \
python-devel \
python-pip \
qt-devel \
tar \
texinfo \
unzip \
wget

# https://pypi.python.org/pypi/pygments-style-github
python-pip install Pygments
python-pip install pygments-style-github

cd
git clone git://git.freedesktop.org/git/poppler/poppler
cd poppler
./autogen.sh --enable-libcurl --enable-xpdf-headers --enable-zlib
make
make install

cd
git clone git://git.freedesktop.org/git/poppler/poppler-data
cd poppler-data
make install

cd
hg clone https://bitbucket.org/sortsmill/libunicodenames
git clone http://git.savannah.gnu.org/r/gnulib.git/
cd libunicodenames
../gnulib/gnulib-tool --update
autoreconf -iv
./configure
make
make install

cd
git clone https://github.com/fontforge/fontforge.git
cd fontforge
./autogen.sh
./configure --enable-gb12345
make
make install

cd
wget http://download.savannah.gnu.org/releases/freetype/ttfautohint-0.96.tar.gz
tar xzf ttfautohint-0.96.tar.gz
cd ttfautohint-0.96
./configure
make
make install

cd
git clone --depth 1 https://github.com/coolwanglu/pdf2htmlEX.git
cd pdf2htmlEX
PKG_CONFIG_PATH=/usr/local/lib/pkgconfig cmake -DCMAKE_INSTALL_RPATH_USE_LINK_PATH=ON .
make
make install
```

# References

## poppler output of `./configure...`

```
Building poppler with support for:
  font configuration: fontconfig
  splash output:      yes
  cairo output:       yes
  qt4 wrapper:        no
  qt5 wrapper:        no
  glib wrapper:       yes
    introspection:    no
  cpp wrapper:        yes
  use gtk-doc:        no
  use libjpeg:        yes
  use libpng:         yes
  use libtiff:        yes
  use zlib:           yes
  use libcurl:        yes
  use libopenjpeg:    yes
  use cms:            auto
  command line utils: yes
  test data dir:      /root/poppler/./../test

  Warning: Using zlib is not totally safe
```

## fontforge output of `./configure...`

```
Summary of optional features:

  real (floating pt) double
  programs           yes
  native scripting   yes
  python scripting   yes
  python extension   yes
  freetype debugger  no
  capslock for alt   no
  raw points mode    no
  tile path          no
  gb12345 encoding   yes

Summary of optional dependencies:

  cairo              yes        http://www.cairographics.org/
  giflib             yes        http://giflib.sourceforge.net/
  libjpeg            yes        http://en.wikipedia.org/wiki/Libjpeg
  libpng             yes        http://www.libpng.org/
  libtiff            yes        http://en.wikipedia.org/wiki/Libtiff
  libxml             yes        http://www.xmlsoft.org/
  libspiro           yes        http://libspiro.sourceforge.net/
  libuninameslist    no         https://github.com/fontforge/libuninameslist
  libunicodenames    yes        https://github.com/sortsmill/libunicodenames
  zeromq             no         http://www.zeromq.org/
  libreadline        no         http://www.gnu.org/software/readline
  X Window System    yes
```

# Issues

No known issues at this time.
