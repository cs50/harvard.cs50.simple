define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "dialog.confirm", "menus", "panels", "Plugin", "tabbehavior",
        "tabManager", "tree", "ui", "configure", "editors", "findreplace",
        "format", "keymaps", "layout", "login", "newresource", "preferences",
        "preferences.keybindings", "proc", "save", "ace.status", "terminal"
    ];

    main.provides = ["harvard.cs50.menus"];
    return main;

    function main(options, imports, register) {
        const ace = imports.ace;
        const confirm_ = imports["dialog.confirm"].show;
        const menus = imports.menus;
        const panels = imports.panels;
        const Plugin = imports.Plugin;
        const proc = imports.proc;
        const tabbehavior = imports.tabbehavior;
        const tabs = imports.tabManager;
        const tree = imports.tree;
        const ui = imports.ui;

        const plugin = new Plugin("CS50", main.consumes);

        function applyToMenuItem(path, fn) {
            const item = menus.get(path).item;
            if (item)
                fn(item)

            return item;
        }


        function moveMenuItemSameMenu(path, index) {
            applyToMenuItem(path, i => menus.addItemByPath(path, i, index, plugin));
        }


        function removeMenuItem(path) {
            return applyToMenuItem(path, i => i.remove());
        }


        function renameMenuItem(path, caption) {
            return applyToMenuItem(path, i => i.setAttribute("caption", caption));
        }


        function moveMenuItem(curPath, newPath, index) {
             applyToMenuItem(curPath, i => menus.addItemByPath(newPath, i, index, plugin));
        }


        function removeUserMenu() {
            removeMenuItem("user_info");
        }


        function updateAWSCloud9Menu() {
            ["Go To Your Dashboard", "Restart AWS Cloud9"]
                .forEach(i => removeMenuItem(`AWS Cloud9/${i}`));

            ["Project Settings", "User Settings", "Keymap", "Init Script", "Stylesheet"]
                .forEach(i => renameMenuItem(`AWS Cloud9/Open Your ${i}`, i));

            renameMenuItem("AWS Cloud9", "CS50 IDE");

            menus.addItemByPath("AWS Cloud9/~", new ui.divider(), 2000078, plugin);
            menus.addItemByPath("AWS Cloud9/Reset Settings", new ui.item({
                caption: "Reset Settings",
                onclick() {
                    confirm_("Reset Settings",
                        "",
                        "Are you sure you want to reset CS50 IDE to factory " +
                        "defaults? It will then look just as it did the first time you " +
                        "logged in. Your files and folders will not be deleted.",
                        // OK
                        (() => {

                            // Reset project, state, and user, state settings
                            window.location.search += "&reset=project|state|user";
                        }),

                        // Cancel
                        (() => {})
                    );
                }
            }), 2000079, plugin);

            menus.addItemByPath("AWS Cloud9/Restart", new ui.item({
                caption: "Restart",
                onclick() {
                    confirm_("Restart IDE",
                        "",
                        "Are you sure you want to restart the IDE?",
                        // OK
                        (() => {
                            proc.spawn("sudo", { args: ["service", "ssh", "stop"] }, () => {});
                            setTimeout(() => {
                                parent.postMessage("reload", "https://ide.cs50.io")
                            }, 1000);
                        }),

                        // Cancel
                        (() => {})
                    );
                }
            }), 2000080, plugin);

            // Sort
            [
                "Init Script",
                "Keymap",
                "Project Settings",
                "Stylesheet",
                "User Settings"
            ].forEach((p, i) => moveMenuItemSameMenu(`AWS Cloud9/Open Your ${p}`, 400 + i * 10));
        }


        function simplifyMenuBar() {
            [
                // File menu
                "File/Revert to Saved",
                "File/Revert All to Saved",
                "File/Line Endings",
                "File/New From Template",

                // Edit menu
                "Edit/Line/Move Line Up",
                "Edit/Line/Move Line Down",
                "Edit/Line/Copy Lines Up",
                "Edit/Line/Copy Lines Down",
                "Edit/Line/Remove Line",
                "Edit/Line/Remove to Line End",
                "Edit/Line/Remove to Line Start",
                "Edit/Line/Split Line",
                "Edit/Keyboard Mode",
                "Edit/Selection",
                "Edit/Text",
                "Edit/Code Folding",
                "Edit/Code Formatting",

                // Find menu
                "Find/Replace Next",
                "Find/Replace Previous",
                "Find/Replace All",

                // View menu
                "View/Editors",
                "View/Syntax",
                "View/Wrap Lines",
                "View/Wrap To Print Margin",
                "View/Status Bar",
                "View/Menu Bar",
                "View/Tab Buttons",
                "View/Themes",

                // Goto menu
                "Go/Find References",
                "Go/Go to Anything...",
                "Go/Go to File...",
                "Go/Go to Symbol...",
                "Go/Go to Command...",
                "Go/Next Error",
                "Go/Previous Error",
                "Go/Word Right",
                "Go/Word Left",
                "Go/Scroll to Selection",

                // Tools menu
                "Tools",

                // Window menu
                "Window",

                // Run menu
                "Run",

                // Support
                "Support"
            ].forEach(removeMenuItem);

            moveMenuItem("Window/New Terminal", "File/New Terminal", 150);
            renameMenuItem("View/Gutter", "Line Numbers");
            renameMenuItem("Go/Go to Line...", "Line...");
        }


        function simplifyPlusMenu() {
            // Plus menu
            tabs.getElement("mnuEditors", menu => {
                const captions = [
                    "New Run Configuration",
                    "Open Preferences",
                    "New Immediate Window",
                    "Recently Closed Tabs"
                ];

                const interval = setInterval(() => {
                    menu.childNodes.forEach(node => {
                        const i = captions.indexOf(node.getAttribute("caption"));
                        if (i > -1) {
                            node.remove();
                            captions.splice(i, 1);
                        }

                        if (!captions.length) {

                            // Remove divider
                            menu.childNodes[2] && menu.childNodes[2].remove();
                            clearInterval(interval);
                        }
                    }, 0);
                });
            });
        }


        function _hideRunThisFile(e) {
            e.currentTarget.childNodes.some(node => {
                if (node.getAttribute("caption") == "Run This File") {
                    node.remove();
                    return true;
                }
            });
        }


        function simplifyAceContextMenu() {
            // Remove "Run This File" item from ace's context menu
            ace.getElement("menu", menu => {
                menu.once("prop.visible", _hideRunThisFile);
            });
        }


        function simplifyTabContextMenu() {
            // Remove "Run This File" from tab context menu
            tabbehavior.contextMenu.once("prop.visible", _hideRunThisFile);
        }


        function simplifyTreeContextMenu() {
            // Remove "Run" and "Preview" from file browser's context menu
            tree.on("menuUpdate", e => {
                if (!e.menu)
                    return;

                e.menu.childNodes.forEach(node => {
                    const caption = node.getAttribute("caption");
                    if (caption === "Run" || caption === "Preview")
                        node.remove();
                });
            });
        }


        function disableRightBarContextMenu() {
            const aml = panels.areas["right"].aml;
            if (aml) {
                aml.childNodes.some(node => {
                    if (node.$ext && node.$ext.classList.contains("panelsbar"))
                        node.oncontextmenu = (() => {});
                });
            }
        }


        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;


            disableRightBarContextMenu();
            removeUserMenu();
            simplifyAceContextMenu();
            simplifyMenuBar();
            simplifyPlusMenu();
            simplifyTabContextMenu();
            simplifyTreeContextMenu();
            updateAWSCloud9Menu();
        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.menus" : plugin });
    }
});
