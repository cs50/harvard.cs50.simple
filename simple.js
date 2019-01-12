define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "commands", "dialog.file", "fs.cache", "harvard.cs50.presentation", "language", "menus",
        "panels", "Plugin", "preferences", "settings", "tabManager", "tree", "tree.favorites",
        "ui"
    ];

    main.provides = ["harvard.cs50.simple"];
    return main;

    function main(options, imports, register) {
        const commands = imports.commands;
        const favorites = imports["tree.favorites"];
        const fileDialog = imports["dialog.file"];
        const fsCache = imports["fs.cache"];
        const language = imports.language;
        const menus = imports.menus;
        const panels = imports.panels;
        const Plugin = imports.Plugin;
        const prefs = imports.preferences;
        const presentation = imports["harvard.cs50.presentation"];
        const settings = imports.settings;
        const tabs = imports.tabManager;
        const tree = imports.tree;
        const ui = imports.ui;

        const libterm = require("@c9/ide/plugins/c9.ide.terminal/aceterm/libterm").prototype;

        const plugin = new Plugin("CS50", main.consumes);

        function removeLeftBar() {
            const removals = panels.areas["left"].aml.childNodes.filter(node => {
                return ["panelsbar open", "gotoanything-input"]
                    .indexOf(node.getAttribute("class")) > -1;
            });

            removals.forEach(node => node.remove());
        }


        function addSlashToFolders() {
            function _addSlashToFolders() {
                const getCaptionHTML = fsCache.model.getCaptionHTML;
                fsCache.model.getCaptionHTML = node => {
                    let caption = getCaptionHTML(node);
                    if (node.isFolder && !node.isFavorite &&
                        !node.path.startsWith("!") && !caption.endsWith("/")) {
                        caption += "/";
                    }

                    return caption;
                };

                tree.tree && tree.tree.redraw();
            }

            favorites.on("favoriteRemove", _addSlashToFolders);
            favorites.on("favoriteAdd", _addSlashToFolders);
            _addSlashToFolders();
        }


        function addTerminalSound() {
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        "Audible Terminal Bell" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@terminalSound",
                            min: 1,
                            max: 200,
                            position: 190
                        }
                    }
                }
            }, plugin);

            const terminalSound = new Audio(require(
                "asset-url!@cs50/ide/plugins/harvard.cs50.simple/sounds/bell.mp3"
            ));


            function _toggleTerminalSound(enable) {
                if (!libterm)
                    return;

                if (enable) {
                    libterm.bell = () => {
                        !presentation.presenting && terminalSound.play();
                    };
                }
                else {
                    libterm.bell = () => {};
                }
            }

            settings.on(
                "user/cs50/simple/@terminalSound",
                _toggleTerminalSound,
                plugin
            );

            _toggleTerminalSound(settings.getBool("user/cs50/simple/@terminalSound"));
        }


        function addFileDialog() {
            const openItem = menus.get("File/Open...").item;
            if (!openItem)
                return;

            const gotoanything = commands.commands.gotoanything;
            commands.addCommand({
                name: "openFileDialog",
                hint: "Opens dialog for opening files",
                bindKey: gotoanything.bindKey,
                exec() {
                    fileDialog.show(
                        "Open file",
                        null,
                        path => {
                            fileDialog.tree.getSelection().getSelectedNodes()
                                .filter(node => !node.isFolder).forEach(node => {
                                    tabs.openFile(node.path);
                                });

                            fileDialog.hide();
                        },
                        null,
                        {
                            createFolderButton: false,
                            showFilesCheckbox: false,
                            chooseCaption: "Open"
                        }
                    );
                }
            }, plugin);

            delete gotoanything.bindKey;

            fileDialog.on("show", () => {
                const txtDirectory = fileDialog.getElement("txtDirectory");
                txtDirectory.previousSibling.hide();
                txtDirectory.hide();

                fileDialog.tree.once("afterChoose", () => {
                    fileDialog.getElement("btnChoose").dispatchEvent("click");
                });

            }, plugin);

            openItem.setAttribute("command", "openFileDialog");
        }


        function removeTrailingQuestionMark() {
            if (history.replaceState && /\?*&*$/.test(window.location.href))
                history.replaceState({}, window.title, window.location.href.replace(/\?*&*$/, ""));
        }


        function disableRunKeyboardShortcuts() {
            commands.bindKey(null, commands.commands["run"], true);
            commands.bindKey(null, commands.commands["runlast"], true);
        }


        function disableHTMLCompleter() {
            language.unregisterLanguageHandler("plugins/c9.ide.language.html/html_completer");
        }


        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;
            ui.insertCss(require("text!./style.css"), plugin);

            addFileDialog();
            addSlashToFolders();
            addTerminalSound();
            disableHTMLCompleter();
            removeLeftBar();
            removeTrailingQuestionMark();
        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.simple" : plugin });
    }
});
