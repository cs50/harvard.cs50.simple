## Getting Started

* Create a new Cloud9 workspace. Note that most plugins assume a workspace based on the CS50 template.
* Clone this repo into ~/.c9/plugins/ (for example, the directory structure for the Simple plugin should be `~/.c9/plugins/cs50simple`)
* Run your workspace with: http://ide.c9.io/user/workspace?sdk=1&debug=2

More information here: http://cloud9-sdk.readme.io/v0.1/docs/running-the-sdk

## 

## Publishing

There are two disparate steps to take for updating the plugins for Online
IDE users and Offline.

### Online

1. Zip up the plugins you want updated into a file called `ide50-plugins`:
    zip -r ide50-plugins cs50stats
    zip -r ide50-plugins cs50simple

1. Email that bundle to Nikolai Onken, nikolai@c9.io

### Offline

1. Make sure the changes for each plugin are committed to this repo's master
   branch.

1. [Build and release a new ide50 deb](https://github.com/cs50/ide50), the 
   process incorporates the latest revisions of each plugin in the deb.
