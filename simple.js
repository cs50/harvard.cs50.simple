define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "commands", "fs.cache", "harvard.cs50.presentation", "gotoanything", "language",
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
            const interval = setInterval(
                () => {
                    const leftBarAml = panels.areas && panels.areas.left && panels.areas.left.aml;
                    if (!leftBarAml)
                        return

                    clearInterval(interval)
                    const removals = leftBarAml.childNodes.filter(node => {
                    return ["panelsbar open", "gotoanything-input"]
                        .indexOf(node.getAttribute("class")) > -1;
                    });

                    removals.forEach(node => node.remove());

                    const treeActive = tree.active;
                    panels.disablePanel("tree");
                    panels.disablePanel("gotoanything");

                    if (treeActive)
                        tree.show();
                    else
                        tree.hide();
                },
                0
            )
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

            settings.on("read", () => {
                settings.setDefaults("user/cs50/simple", [
                    ["terminalSound", true],
                    ["previewEnabled", false]
                ]);

                _toggleTerminalSound(settings.getBool("user/cs50/simple/@terminalSound"));
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

            prefs.add({
               "CS50" : {
                    position: 10,
                    "IDE Behavior" : {
                        position: 10,
                        "Enable Preview" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@previewEnabled",
                            position: 190
                        }
                    }
                }
            }, plugin);

            settings.on(
                "user/cs50/simple/@terminalSound",
                _toggleTerminalSound,
                plugin
            );
        }


        function removeTrailingQuestionMark() {
            if (history.replaceState && /\?*&*$/.test(window.location.href))
                history.replaceState({}, window.title, window.location.href.replace(/\?*&*$/, ""));
        }


        function disableRunKeyboardShortcuts() {
            commands.bindKey(null, commands.commands["run"], true);
            commands.bindKey(null, commands.commands["runlast"], true);
        }


        function disableCompleters() {
            language.unregisterLanguageHandler(require("language!@c9/ide/plugins/c9.ide.language.generic/local_completer"));
            language.unregisterLanguageHandler(require("language!@c9/ide/plugins/c9.ide.language.html/html_completer"));
            language.unregisterLanguageHandler(require("language!@c9/ide/plugins/c9.ide.language.generic/snippet_completer"));
        }


        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;
            ui.insertCss(require("text!./style.css"), plugin);

            addSlashToFolders();
            addTerminalSound();
            disableCompleters();
            removeLeftBar();
            removeTrailingQuestionMark();
        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.simple" : plugin });
    }
});
