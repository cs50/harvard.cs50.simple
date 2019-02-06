define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "commands", "fs.cache", "harvard.cs50.presentation", "language",
        "panels", "Plugin", "preferences", "settings", "tree", "tree.favorites",
        "ui"
    ];

    main.provides = ["harvard.cs50.simple"];
    return main;

    function main(options, imports, register) {
        const commands = imports.commands;
        const favorites = imports["tree.favorites"];
        const fsCache = imports["fs.cache"];
        const language = imports.language;
        const panels = imports.panels;
        const Plugin = imports.Plugin;
        const prefs = imports.preferences;
        const presentation = imports["harvard.cs50.presentation"];
        const settings = imports.settings;
        const tree = imports.tree;
        const ui = imports.ui;

        const libterm = require("@c9/ide/plugins/c9.ide.terminal/aceterm/libterm").prototype;

        const plugin = new Plugin("CS50", main.consumes);

        function removeLeftBar() {
            panels.on("draw", () => {
                const leftBarAml = panels.areas.left.aml;
                if (leftBarAml) {
                    const removals = leftBarAml.childNodes.filter(node => {
                    return ["panelsbar open", "gotoanything-input"]
                        .indexOf(node.getAttribute("class")) > -1;
                    });

                    removals.forEach(node => node.remove());
                }

                const treeActive = tree.active;
                panels.disablePanel("tree");
                panels.disablePanel("gotoanything");

                if (treeActive)
                    tree.show();
                else
                    tree.hide();
            });
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
            settings.on("read", () => {
                settings.setDefaults("user/cs50/simple", [
                    ["terminalSound", true]
                ]);
            });

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
