define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "ace.status", "auth", "c9", "clipboard", "collab",
        "collab.workspace", "commands", "console", "dialog.confirm",
        "dialog.file", "dialog.notification", "editors", "fs", "fs.cache",
        "harvard.cs50.info", "harvard.cs50.presentation", "immediate", "info",
        "keymaps", "navigate", "outline", "language", "language.python",
        "layout", "login", "Menu", "MenuItem", "menus", "newresource", "panels",
        "Plugin", "preferences", "preview", "proc", "run.gui", "save",
        "settings", "tabbehavior", "tabManager", "terminal", "tooltip", "tree",
        "tree.favorites", "ui", "util"
    ];

    main.provides = ["harvard.cs50.simple"];
    return main;

    function main(options, imports, register) {
        var ace = imports.ace;
        var auth = imports.auth;
        var c9 = imports.c9;
        var collab = imports.collab;
        var commands = imports.commands;
        var confirm = imports["dialog.confirm"].show;
        var editors = imports.editors;
        var favorites = imports["tree.favorites"];
        var fileDialog = imports["dialog.file"];
        var fs = imports.fs;
        var fsCache = imports["fs.cache"];
        var info = imports.info;
        var info50 = imports["harvard.cs50.info"];
        var language = imports.language;
        var layout = imports.layout;
        var Menu = imports.Menu;
        var MenuItem = imports.MenuItem;
        var menus = imports.menus;
        var model = fsCache.model;
        var newresource = imports.newresource;
        var notify = imports["dialog.notification"].show;

        // outline adds "Goto/Goto Symbol..."
        // listing it as dependency ensures item exists before simple is loaded
        var outline = imports.outline;

        var panels = imports.panels;
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        const presentation = imports["harvard.cs50.presentation"];
        var proc = imports.proc;
        var save = imports.save;
        var settings = imports.settings;
        var statusbar = imports["ace.status"];
        var tabs = imports.tabManager;
        var tabMenu = imports.tabbehavior.contextMenu;
        var tree = imports.tree;
        var ui = imports.ui;
        var workspace = imports["collab.workspace"];

        var plugin = new Plugin("CS50", main.consumes);

        var SETTINGS_VER = 14;

        // https://lodash.com/docs
        var _ = require("lodash");
        var basename = require("path").basename;

        var libterm = require("plugins/c9.ide.terminal/aceterm/libterm").prototype;

        var authorInfoToggled = null;
        var avatar = null;
        var dark = null;
        var languages = {
            en: "en_US.UTF-8",
            es: "es_ES.UTF-8"
        };

        var notification = {};
        var openingFile = false;
        var terminalSound = null;
        var trailingLine = null;
        var treeToggles = {};

        /**
         * Overrides the behavior of the "File/Open" menu item to open a file
         * dialog instead of the "Navigation" pane.
         */
        function addFileDialog() {
            // get the "File/Open" menu item
            var openItem = menus.get("File/Open...").item;
            if (!openItem)
                return;

            // add command that opens file dialog
            commands.addCommand({
                name: "openFileDialog",
                hint: "Opens file dialog for opening files",
                bindKey: commands.commands.navigate.bindKey,
                exec: function() {

                    // wehther to customize file dialog
                    openingFile = true;

                    // show open file dialog
                    fileDialog.show("Open file", null, function(path) {
                        // open and activate file at path
                        tabs.openFile(path, true);

                        // hide file dialog
                        fileDialog.hide();
                    }, null, {
                        createFolderButton: false,
                        showFilesCheckbox: false,
                        chooseCaption: "Open"
                    });
                }
            }, plugin);

            // delete navigate's keyboard shortcut
            delete commands.commands.navigate.bindKey;

            /**
             * Prevents selection of multiple files in "open file" dialog's tree
             */
            function disableMultiSelect() {
                var selection = fileDialog.tree.selection;
                var selectedNodes = selection.getSelectedNodes();

                if (selectedNodes.length > 1)
                    // select last selected node only
                    selection.selectNode(selectedNodes[selectedNodes.length - 1], false);
            }

            // customize file dialog
            fileDialog.on("show", function() {
                // avoid customizing other file dialogs (e.g., save)
                if (openingFile !== true)
                    return;

                // hide "Folder:" label and text field
                var txtDirectory = fileDialog.getElement("txtDirectory");
                hide(txtDirectory.previousSibling);
                hide(txtDirectory);

                // allow opening file by double-clicking it
                fileDialog.tree.once("afterChoose", function() {
                    fileDialog.getElement("btnChoose").dispatchEvent("click");
                });

                // disable multiple selection
                fileDialog.tree.on("changeSelection", disableMultiSelect);
            }, plugin);

            // clean up to avoid affecting other file dialogs
            fileDialog.on("hide", function() {
                // reset openingFile
                openingFile = false;

                // remove changeSelection listener
                fileDialog.tree.off("changeSelection", disableMultiSelect);
            }, plugin);

            // override "File/Open"'s behavior
            openItem.setAttribute("command", "openFileDialog");
        }

        /**
         * Hides avatar in offline IDE. Adds preference to toggle between
         * Gravatar and C9 logo in online IDE only.
         *
         * @param err ideally passed by info.getUser in case of an error
         * @param user a user object with property id
         */
        function addGravatarToggle(err, user) {
            if (!err && user && user.id) {

                // get avatar button
                avatar = menus.get("user_" + user.id).item;
                if (!avatar)
                    return;
                else if (!c9.hosted)
                    // hide avatar in offline IDE
                    return hide(avatar);

                // add toggle in preferences
                prefs.add({
                   "CS50" : {
                        position: 5,
                        "IDE Behavior" : {
                            position: 10,
                            "Gravatar" : {
                                type: "checkbox",
                                setting: "user/cs50/simple/@gravatar",
                                min: 1,
                                max: 200,
                                position: 190
                            }
                        }
                    }
                }, plugin);

                // retrieve initial gravatar setting
                toggleGravatar(settings.getBool("user/cs50/simple/@gravatar"));

                // handle toggling gravatar setting
                settings.on("user/cs50/simple/@gravatar", toggleGravatar);
            }
        }

        /**
         * Adds View > Languages
         */
        function addLanguages() {

            // create Language submenu
            var languagesItem = new MenuItem({
                caption: "Language",
                submenu: new Menu({}, plugin)
            });

            // add Language to View menu
            menus.addItemByPath("View/~", new ui.divider(), 3, plugin);
            menus.addItemByPath("View/Language", languagesItem, 4, plugin);

            // fetch current language from settings or fallback to English
            var currLanguage = settings.get("project/cs50/simple/@language") || "en";

            // create language menu items
            Object.keys(languages).forEach(function(language) {
                var item = new MenuItem({
                    caption: language,
                    onclick: function() {
                        setLanguage(language);
                    },
                    type: "radio"
                });

                item.aml.setAttribute("selected", language === currLanguage);
                menus.addItemByPath("View/Language/" + language, item, plugin);
            });

        }

        /**
         * Adds Serve menu item to context menu of file browser.
         */
        function addServe() {
            tree.getElement("mnuCtxTree", function(mnuCtxTree) {

                // add "Serve" to tree context menu
                menus.addItemToMenu(mnuCtxTree, new ui.item({
                    caption: "Serve",
                    match: "folder",

                    // disable "Serve"
                    isAvailable: function() {

                        // disable item when more than one folder is selected
                        return tree.selectedNodes.filter(function(node) {
                            return node.isFolder;
                        }).length === 1;
                    },
                    onclick: function() {
                        var node = tree.selectedNodes.find(function(node) {
                            return node.isFolder;
                        });

                        if (!node)
                            return;

                        // path for selected directory
                        var path = node.path.replace(/^\//, c9.workspaceDir + "/");

                        // open new browser tab
                        var tab = window.open("", "_blank");
                        if (!tab)
                            return;

                        tab.document.write(
                            'Starting http-server...<br>' +
                            'Please wait! This page will reload automatically.'
                        );

                        // spawn http-server
                        // alias isn't seen by subshell
                        var PORT = "8081";
                        proc.spawn("/home/ubuntu/.cs50/bin/http-server", {
                            args: [ "-p", PORT ],
                            cwd: path
                        },
                        function(err, process) {
                            if (err) {
                                // showError("Could not start http-server");
                                tab.document.write("Could not start http-server.");
                                return console.error(err);
                            }

                            process.stderr.on("data", function(chunk) {
                                console.log(chunk);
                            });

                            setTimeout(function() {
                                tab.location.href = info50.host.replace(/:[0-9]+$/, ":" + PORT);
                            },
                            1000);
                        });
                    }
                }), 102, plugin);
            });
        }

        /**
         * Adds slashes to directory names in file browser
         */
        function addSlashToDirs() {

            // ensure slashes don't disappear when hiding favorites
            favorites.on("favoriteRemove", helper);

            // always reset getCaptionHTML to helper after adding favorite
            favorites.on("favoriteAdd", helper);

            // overrides getCaptionHTML to add slash to dir names and redraws file browser
            function helper() {
                var getCaptionHTML = model.getCaptionHTML;
                model.getCaptionHTML = function(node) {
                        var caption = getCaptionHTML(node);
                        if (node.isFolder && !node.isFavorite && !node.path.startsWith("!") && !caption.endsWith("/"))
                            caption += "/";

                        return caption;
                };

                tree.tree && tree.tree.redraw();
            }

            helper();
        }

        /**
         * Adds tooltips to console buttons
         */
        function addTooltips() {

            // adds tooltips as a callback after the consoleButtons are created
            imports.console.getElement("consoleButtons", function(aml) {
                aml.childNodes[0].setAttribute("tooltip", "Maximize Console");
                aml.childNodes[2].setAttribute("tooltip", "Close Console");
            });
        }

        /**
         * Adds trailing newline to text files upon saving (if enabled)
         *
         * @param {object} e an object as passed by save.beforeSave event's
         * callback
         */
        function addTrailingLine(e) {
            if (trailingLine === null) {

                // add preference toggle
                prefs.add({
                    "Project": {
                        position: 10,
                        "Code Editor (Ace)": {
                            "On Save, Add Trailing Newline": {
                                type: "checkbox",
                                position: 300,
                                path: "project/cs50/ace/@trailingLine"
                            }
                        }
                    }
                }, plugin);

                // update trailingLine when pref changes
                settings.on("project/cs50/ace/@trailingLine", function(enabled) {
                    trailingLine = enabled;
                });

                // whether to add trailing line to text files upon saving
                trailingLine = settings.getBool("project/cs50/ace/@trailingLine");

                // add trailing line to text files upon saving (if enabled)
                save.on("beforeSave", addTrailingLine);
            }
            else if (trailingLine === true && _.isObject(e) && _.isObject(e.tab)
                && e.tab.editorType === "ace" && _.isString(e.tab.path)
                && _.isObject(e.document)
                && /^makefile$|\.(?:c|css|h|html|php|py|rb|sh)$/i.test(basename(e.tab.path))) {

                // Ace Document (https://ace.c9.io/#nav=api&api=document)
                var doc = e.document.getSession().session.getDocument();

                // number of lines in the document
                var length = doc.getLength();

                // insert trailing line only if last line isn't newline
                if (trailingLine && doc.getLine(length - 1) !== "")
                    doc.insertFullLines(length, [""]);
            }
        }

        /**
         * Hides workspace button and adds small toggle to the left of code tabs
         * and a menu toggle item under view.
         */
        function addTreeToggles() {
            // get current skin initially
            dark = settings.get("user/general/@skin").indexOf("dark") > -1;

            // remember if tree is shown or hidden initially
            var resetVisibility = tree.active ? tree.show : tree.hide;

            // get middle column
            var tabsParent = layout.findParent(tabs);

            // hide workspace from window menu
            setMenuVisibility("Window/Workspace", false);

            // remove workspace from left bar
            panels.disablePanel("tree");

            // reset tree visibility status (to prevent disablePanel from hiding tree)
            resetVisibility("tree");

            // toggle ID
            treeToggles.ID = "treeToggle";

            // create menu item
            treeToggles.menuItem = new ui.item({
                type: "check",
                caption: "File Browser",
                command: "toggletree"
            });

            // listen for pane creation
            tabs.on("paneCreate", function(e) {
                var codePanes = tabs.getPanes(tabsParent);

                // ensure pane is a code pane (i.e., not console)
                var pane = codePanes.find(function(p) {
                    return p === e.pane;
                });

                if (!pane)
                    return;

                // create hidden toggle button
                var button = ui.button({
                    id: treeToggles.ID,
                    "class": "cs50-simple-tree-toggle",
                    command: "toggletree",
                    skin: "c9-simple-btn",
                    height: 16,
                    width: 16,
                    visible: false
                });

                // insert button into pane
                pane.aml.appendChild(button);

                // register button for destruction on pane destruction
                pane.addElement(button);

                // show button in first pane initially
                if (codePanes.length === 1)
                    showTreeToggle(codePanes[0]);

                // handle when the pane that holds the button is destroyed
                tabs.on("paneDestroy", function(e) {
                    // ensure pane is button-holder
                    if (_.isObject(treeToggles.button) && e.pane !== treeToggles.button.pane)
                        return;

                    // get current code panes
                    var codePanes = tabs.getPanes(tabsParent);

                    // ensure at least one pane left
                    if (codePanes.length < 1)
                        return;

                    // find top-left pane
                    var topLeftPane = codePanes[0];

                    // remember boundaries of top-left pane
                    var topLeftRect = topLeftPane.container.getBoundingClientRect();

                    // iterate over the rest of the panes
                    for (var i = 1; i < codePanes.length; i++) {
                        // get boundary of current pane
                        var rect = codePanes[i].container.getBoundingClientRect();

                        // handle when pane is more top-left
                        if (rect.left <= topLeftRect.left && rect.top <= topLeftRect.top) {
                            topLeftPane = codePanes[i];
                            topLeftRect = rect;
                        }
                    }

                    // show tree toggle in top-left pane
                    showTreeToggle(topLeftPane);
                });
            });

            // add menu item to toggle tree (useful when toggle is hidden)
            menus.addItemByPath("View/File Browser", treeToggles.menuItem, 200, plugin);

            // sync tree toggles as tree is toggled or skin is changed
            tree.once("draw", syncTreeToggles.bind(this, true));
            tree.on("show", syncTreeToggles.bind(this, true));
            tree.on("hide", syncTreeToggles);
            settings.on("user/general/@skin", function(skin) {
                dark = skin.indexOf("dark") > -1;
                syncTreeToggles(tree.active);
            });

            // toggle visibility of tree toggle as tabs are shown or hidden
            settings.on("user/tabs/@show", function(showing) {
                showing ? show(treeToggles.button) : hide(treeToggles.button);
            });
        }

        /**
         * Shows confirmation dialog before restarting IDE.
         */
        function confirmRestart() {

            // no Restart Workspace item offline
            if (!c9.hosted)
                return;

            // get Restart Workspace menu item
            var item = menus.get("Cloud9/Restart Workspace").item;
            if (!item)
                return;

            // add command that wraps restartc9vm
            commands.addCommand({
                name: "confirmrestartc9vm",
                isAvailable: commands.commands.restartc9vm.isAvailable,
                exec: function() {
                    confirm("Restart Workspace?",
                        "Are you sure you want to restart CS50 IDE?",
                        "Any files you have open will stay open.",

                        // OK
                        function() {
                            commands.exec("restartc9vm");
                        },

                        // Cancel
                        function() {}
                    );
                }
            }, plugin);

            // update command associated with menu item
            item.setAttribute("command", "confirmrestartc9vm");
        }

        /**
         * Customizes "Cloud9" menu for CS50 IDE
         */
        function customizeC9Menu() {
            var dashboard = "Cloud9/Go To Your Dashboard";
            if (c9.hosted) {
                var dashboardItem = menus.get(dashboard).item;
                if (dashboardItem) {
                    // rename "Go To Your Dashboard" to "Dashboard"
                    setMenuCaption(dashboardItem, "Dashboard");

                    // move "Dashboard" above "Preferences"
                    menus.addItemByPath(dashboard, dashboardItem, 299, plugin);
                }

                // simplify user's menu
                info.getUser(function(err, user) {
                    if (user && user.id) {
                        var path = "user_" + user.id + "/";

                        // move "Account" to CS50 IDE menu
                        menus.addItemByPath("Cloud9/Account", menus.get(path + "Account").item, 298, plugin);

                        // remove items from user's menu
                        ["Dashboard", "Home", "Log out"].forEach(function(item) {
                            menus.remove(path + item);
                        });
                    }
                });

                // add divider after restart workspace
                menus.addItemByPath("Cloud9/~", new ui.divider(), 2000081, plugin);
            }
            else {
                // remove "Dashboard" offline
                menus.remove(dashboard);

                // remove CS50 IDE > Log out offline
                menus.remove("Cloud9/Quit Cloud9");
            }

            // project and user settings
            setMenuCaption("Cloud9/Open Your Project Settings", "Project Settings");
            setMenuCaption("Cloud9/Open Your User Settings", "User Settings");
            setMenuCaption("Cloud9/Open Your Init Script", "Init Script");

            // add divider after "Preferences"
            var div = new ui.divider();
            menus.addItemByPath("Cloud9/~", div, 301, plugin);

            // add "Reset"
            menus.addItemByPath("Cloud9/Reset Settings", new ui.item({
                caption: "Reset Settings",
                onclick: function() {
                    confirm("Reset Settings",
                        "",
                        "Are you sure you want to reset CS50 IDE to factory " +
                        "defaults? It will then look just as it did when you " +
                        "created it. Your files and folders will not be deleted.",
                        // OK
                        function() {

                            // reset user, state, and project settings
                            window.location.search += "&reset=user|state|project";
                        },

                        // Cancel
                        function() {}
                    );
                }
            }), 2000079, plugin);

            // hide "Restart Cloud9"
            setMenuVisibility("Cloud9/Restart Cloud9", false);
        }

        /**
         * Finds bars for left and right areas and disables their context menus
         */
        function disableAreaBarsMenu() {

            // find bars for left and right panel areas
            [panels.areas["left"], panels.areas["right"]].forEach(function(area) {
                if (area && area.aml && area.aml.childNodes.length > 0) {
                    area.aml.childNodes.some(function(bar) {
                        if (bar.$baseCSSname === "panelsbar") {

                            // disable context menu
                            bar.oncontextmenu = function() {};
                        }
                    });
                }
            });
        }

        /**
         * Hides the given div by changing CSS
         *
         * @param {AMLElement} the AMLElement to hide
         * @return true if successfuly hides, false otherwise
         */
        function hide(aml) {
            if (aml) {
                aml.setAttribute("visible", false);
                return true;
            }

            return false;
        }

        /**
         * Hides unneeded elements.
         */
        function hideElements() {

            /**
             * Event handler for hiding "Run This File" item from menu.
             */
            function hideRunThisFile(e) {
                e.currentTarget.childNodes.some(function(item) {
                    if (item.caption === "Run This File")
                        return hide(item);
                });
            }

            // hide Collaborate panel offline but always enable online
            if (!c9.hosted)
                collab.disable();
            else
                collab.enable();

            // always enable Outline online
            outline.enable();

            // get parent of "Preview" and "Run" buttons
            var p = layout.findParent({ name: "preview" });

            // hide the divider
            hide(p.childNodes[0]);

            // hide the "Preview" button
            hide(p.childNodes[1]);

            // hide the "Run" button
            hide(p.childNodes[2]);

            // hide Run menu
            setMenuVisibility("Run", false);

            // hide "Run" and "Preview" items from file browser's menu
            tree.on("menuUpdate", function(e) {
                if (!e.menu)
                    return;

                e.menu.childNodes.forEach(function(item) {
                    if (item.caption === "Run" || item.caption === "Preview")
                        hide(item);
                });
            });

            // hide "Run This File" item from tab context menu
            tabMenu.once("prop.visible", hideRunThisFile);

            // remove "Run This File" item from ace's context menu
            ace.getElement("menu", function(menu) {
                menu.once("prop.visible", hideRunThisFile);
            });

            // disable "Run" through keyboard
            commands.bindKey(null, commands.commands["run"], true);
            commands.bindKey(null, commands.commands["runlast"], true);
        }

        /**
         * Hides gear icon
         */
        function hideGearIcon() {
            var bar = layout.findParent({name: "preferences"});
            if (bar.childNodes) {
                bar.childNodes.forEach(function(node) {
                    if (node.class === "preferences")
                        hide(node);
                });
            }
        }

        /**
         * Moves some menu items from their original menus to different menus.
         */
        function moveMenuItems() {

            // move New Terminal to File menu
            var newTerminal = menus.get("Window/New Terminal").item;
            if (newTerminal)
                menus.addItemByPath("File/New Terminal", newTerminal, 150, plugin);
        }

        /**
         * Sets and exports LANGUAGE env var in ~/.cs50/language
         */
        function setLanguage(language) {

            // ensure we know locale for language or fallback to English
            if (!languages[language])
                language = "en";

            // write a shell script that sets LANGUAGE env var to be sourced by ~/.bashrc
            var path = "~/.cs50/language";
            fs.writeFile(path, "export LANGUAGE=" + languages[language], function(err) {
                if (err) {
                    console.log(err);
                    return showError("Failed to set language.");
                }

                // chmod 644
                fs.chmod(path, 644, function(err) {
                    if (err) {
                        console.log(err);
                        return showError("Failed to chmod language file.");
                    }

                    // warn before restarting terminal
                    var count = 0;
                    tabs.getTabs().some(function(tab) {
                        return (tab.editorType === "terminal") && (++count === 2);
                    });

                    // remember chosen language
                    settings.set("project/cs50/simple/@language", language);

                    confirm("Language Updated",
                        "Restart terminal window" + (count == 2 ? "s" : "") + "?",
                        (count === 2)
                            ? "Doing so will kill any programs that are running in open terminal windows."
                            : "",

                        // OK
                        function() {

                            // restart all terminal sessions
                            proc.spawn("killall", { args: ["tmux"] }, function(err) {
                                if (err)
                                    showError("Failed to restart terminals!");
                            });
                        },

                        // Cancel
                        function() {}
                    );
                });
            });
        }

        /**
         * Sets or updates the caption of a menu or a menu item
         *
         * @param {(object|string)} item the menu item (or the path thereof)
         * whose caption is to be set
         * @param {string} caption the caption to be set
         */
        function setMenuCaption(item, caption) {
            // get item by path
            if (_.isString(item))
                item = menus.get(item).item;

            // ensure item is object
            if (_.isObject(item))
                item.setAttribute("caption", caption);
        }

        /**
         * Sets visibility of menu item with specified path.
         */
        function setMenuVisibility(path, visible) {
            var menu = menus.get(path).item;
            visible ? show(menu) : hide(menu);
        }

        /**
         * Initially sets the title of the web page to title of focused IDE tab
         * (if any) and registers event handlers to update title when necessary.
         */
        function setTitleFromTabs() {
            // udpate document title initially
            updateTitle(tabs.focussedTab);

            // update document title when tab is focused
            tabs.on("focusSync", function(e) {
                updateTitle(e.tab);
            }, plugin);

            // update document title when tab is destroyed
            tabs.on("tabDestroy", function(e) {
                if (e.last)
                updateTitle();
            }, plugin);

            // update document title when preference is toggled
            settings.on("user/tabs/@title", function() {
                updateTitle(tabs.focussedTab);
            });
        }

        /**
         * Set the Terminal tab title to the current working directory
         */
        function setTmuxTitle(tab) {
            // check if the tab exists and it is a terminal tab
            if (tab && tab.editorType === "terminal") {
                var session = tab.document.getSession();
                tab.document.on("setTitle", function(e) {
                    // fetch title from the object, fall back on tab
                    var title = e.title || tab.document.title;

                    // remove terminating ' - ""', if it exists
                    var re = /\s-\s""\s*$/;
                    if (title && re.test(title)) {
                        title = title.replace(re, "");

                        // list of items whose title should change
                        var docList = [e, tab.document];

                        if (session && session.hasOwnProperty("doc"))
                            docList.push(session.doc, session.doc.tooltip);

                        // fix all titles
                        docList.forEach(function(doc) {
                            if (doc.hasOwnProperty("title"))
                                doc.title = title;

                            if (doc.hasOwnProperty("tooltip"))
                                doc.tooltip = title;
                        });
                    }
                }, plugin);
            }
        }

        /**
         * Shows the given AMLElement
         *
         * @param {AMLElement} the AMLElement to show
         * @return true if successfully shows, false otherwise
         */
        function show(aml) {
            if (aml) {
                aml.setAttribute("visible", true);
                return true;
            }
            return false;
        }

        /**
         * Shows the tree toggle of the passed pane only if tab buttons are
         * visible
         *
         * @param {Pane} the pane to show its tree toggle
         */
        function showTreeToggle(pane) {
            if (!_.isObject(pane))
                return;

            // show button in first pane
            pane.getElement(treeToggles.ID, function(button) {
                // make room for button
                pane.aml.$ext.classList.add("cs50-simple-pane0");
                pane.aml.$buttons.style.paddingLeft = "54px";

                // show button only if tab buttons are visible
                button.setAttribute("visible", settings.getBool("user/tabs/@show"));

                // keep track of button
                treeToggles.button = button;

                // keep track of parent pane
                treeToggles.button.pane = pane;

                // sync button style with tree visibility
                syncTreeToggles(tree.active);
            });
        }

        /**
         * Simplifies UI for Cloud9's imgeditor
         */
        function simplifyImgeditor() {

            // handle creation of new imgeditors
            editors.on("create", function(e) {
                var editor = e.editor;
                if (editor.type !== "imgeditor")
                    return;

                // get the zoom dropdown
                editor.getElement("zoom", function(zoom) {

                    // remember parent node
                    var parent = zoom.parentNode;

                    // hide all controls
                    parent.childNodes.forEach(function(n) {
                        n.hide();
                        n.show = function() {};
                    });

                    // increase bar height for buttons
                    parent.setAttribute("class", (parent.getAttribute("class") || "") + " cs50-simple-imgeditor-bar");

                    // label for current zoom level
                    var label = new ui.label({ width: 50 });
                    label.setCaption = function(val) {
                        label.setAttribute("caption", ((_.isNumber(val) && val) || "100") + "%");
                    };

                    // update caption when activating other tabs
                    editor.on("documentActivate", function() {
                        label.setCaption(zoom.value);
                    });

                    // add minus button
                    var minus = new ui.button({
                        caption: "-",
                        class: "cs50-simple-zoom-button",
                        skin: "btn-default-css3",
                        onclick: function() {

                            // ensure zoom.value is integer
                            !_.isNumber(zoom.value) && (zoom.setValue(100));

                            // decrease by 100 so long as zoom level remains >= 100
                            // otherwise decrease by 10, keeping min zoom level at 10
                            zoom.setValue(Math.max(10, zoom.value - (zoom.value >= 200 ? 100 : 10)));
                            label.setCaption(zoom.value);
                            zoom.dispatchEvent("afterchange");
                        },
                        margin: "2 0 0 5"
                    });

                    parent.appendChild(minus);
                    editor.addElement(minus);

                    parent.appendChild(label);
                    editor.addElement(label);

                    // add plus button
                    var plus = new ui.button({
                        caption: "+",
                        class: "cs50-simple-zoom-button",
                        skin: "btn-default-css3",
                        onclick: function() {

                            // ensure zoom.value is integer
                            !_.isNumber(zoom.value) && (zoom.setValue(100));

                            // increase by 10 so long as zoom level is < 100
                            // otherwise increase by 100
                            zoom.setValue(zoom.value + (zoom.value >= 100 ? 100 : 10));
                            label.setCaption(zoom.value);
                            zoom.dispatchEvent("afterchange");
                        },
                        margin: "2 0 0 5"
                    });

                    parent.appendChild(plus);
                    editor.addElement(plus);

                    // add keyboard shortcuts to zoom in and out
                    commands.addCommand({
                        name: "zoom_in",
                        hint: "Zooms in on image in image viewer",
                        group: "imgeditor",
                        bindKey: { mac: "Command-+", win: "Ctrl-+" },
                        isAvailable: function(editor) {
                            return editor && editor.type === "imgeditor";
                        },
                        exec: function() {
                            plus.dispatchEvent("click");
                        }
                    }, plugin);

                    commands.addCommand({
                        name: "zoom_out",
                        hint: "Zooms in on image in image viewer",
                        group: "imgeditor",
                        bindKey: { mac: "Command--", win: "Ctrl--" },
                        isAvailable: function(editor) {
                            return editor && editor.type === "imgeditor";
                        },
                        exec: function() {
                            minus.dispatchEvent("click");
                        }
                    }, plugin);

                    // handle light and dark themes
                    function setTheme(e) {
                        [plus, minus].forEach(function(button) {
                            var _class = button.getAttribute("class") || "";
                            if (e.theme.indexOf("dark") >  -1) {
                                if (_class.search(/\bdark\b/) === -1)
                                    _class += " dark";
                            }
                            else {
                                _class = _class.replace(/\bdark\b/, "");
                            }

                            button.setAttribute("class", _class);
                        });
                    }

                    layout.on("themeChange", setTheme);
                    setTheme({ theme: settings.get("user/general/@skin") });
                });
            });
        }

        /**
         * Syncs tree toggle button and menu item with tree visibility state.
         *
         * @param {boolean} active whether to toggle the buttons on
         */
        function syncTreeToggles(active) {
            if (treeToggles && treeToggles.button && treeToggles.menuItem) {
                var style = "cs50-simple-tree-toggle";
                if (dark)
                    style += " dark";

                if (active === true) {
                    style += " active";

                    // check menu item
                    treeToggles.menuItem.setAttribute("checked", true);
                }
                else {
                    // uncheck menu item
                    treeToggles.menuItem.setAttribute("checked", false);
                }

                // update style of tree-toggle button
                treeToggles.button.setAttribute("class", style);
            }
        }

        /**
         * Disable code folding
         *
         */
        function disableCodeFolding() {
            function getFalse() {
                return false;
            }

            [
                "fold", "foldall", "foldOther", "toggleFoldWidget",
                "toggleParentFoldWidget"
            ].forEach(function(name) {
                commands.commands[name].isAvailable = getFalse;
            });

            // unfold all folded code
            tabs.getTabs().forEach(function(tab) {
                commands.exec("unfoldall", tab.editor);
            });

            settings.set("user/ace/@showFoldWidgets", false);
        }

        /**
         * Toggles avatar between Gravatar and C9 logo
         *
         * @param show whether to show Gravatar
         */
        function toggleGravatar(show) {
            if (!_.isBoolean(show))
                return;

            if (avatar && avatar.$ext) {
                // switch between Gravatar and C9 logo
                if (show)
                    avatar.$ext.classList.remove("c9-logo");
                else
                    avatar.$ext.classList.add("c9-logo");
            }
        }

        /**
         * Simplifies menus at the top of Cloud9
         */
        function hideMenus() {
            // hide each menu item
            [
                // CS50 IDE menu
                "Cloud9/Open Your Keymap",
                "Cloud9/Open Your Stylesheet",

                // File menu
                "File/Revert to Saved",
                "File/Revert All to Saved",
                "File/Mount FTP or SFTP server...",
                "File/Line Endings",
                "File/New Plugin",

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
                "Goto/Goto Anything...",
                "Goto/Goto Symbol...",
                "Goto/Goto Command...",
                "Goto/Next Error",
                "Goto/Previous Error",
                "Goto/Word Right",
                "Goto/Word Left",
                "Goto/Scroll to Selection",

                // Tools menu
                "Tools",

                // Window menu
                "Window",

                // Support menu
                "Support",

                // extraneous templates
                "File/New From Template"
            ].forEach(function(path) {
                setMenuVisibility(path, false);
            });
        }

        /**
         * Hides the button in top left that minimizes the menu bar
         */
        function hideMiniButton() {
            // menu bar
            var bar = layout.findParent(menus);
            if (bar && bar.childNodes[0]) {
                var minimizeBtn = bar.childNodes[0].childNodes[0];
                if (minimizeBtn) {
                    // hide minimize button
                    minimizeBtn.setAttribute("visible", false);

                    // left-align "CS50 IDE" menu within menu bar
                    bar.$int.style.paddingLeft = "0";
                }
            }
        }

        /**
         * Simplifies menu that you get when you click the plus icon
         */
        function simplifyPlus() {

            // finds the menu bar and then executes callback
            tabs.getElement("mnuEditors", function(menu) {
                var menuItems = menu.childNodes;

                // tries to hide the menu items on the plus sign
                // until it works (sometimes this is called before they load)
                var test = setInterval(function() {
                    if (hide(menuItems[2]) &&
                        hide(menuItems[3]) &&
                        hide(menuItems[4])) {
                        clearInterval(test);
                    }
                }, 0);
            });
        }

        /**
         * Hides the left Navigate and Commands side tabs
         */
        function hideSideTabs() {
            var panelList = ["navigate", "commands.panel", "scm"];

            // remember tree visibility status
            var resetVisibility = tree.active ? tree.show : tree.hide;

            // temporarily overcomes a bug in C9 (tree is forcibly hidden by enabling panels)
            tree.hide();

            panelList.forEach(function(p) {panels.disablePanel(p);});

            // reset tree visibility status
            resetVisibility();
        }

        /**
         * Enables simple mode
         */
        function enableSimpleMode() {
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        position: 10,
                        "Mark Undeclared Variables" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@undeclaredVars",
                            min: 1,
                            max: 200,
                            position: 190
                        },
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

            hideMenus();
            hideMiniButton();
            hideSideTabs();
            simplifyPlus();
            disableCodeFolding();
        }

        /**
         *  Simplifies ace's statusbar
         */
        function simplifyStatusbar() {

            // handle ace instance creation
            ace.on("create", function(e) {

                // get statusbar for this instance
                var bar = statusbar.getStatusbar(e.editor);
                if (!bar)
                    return;
                [
                    "btnSbPrefs", "itmTabSize", "lblEditorStatus",
                    "lblSelectionLength", "lblSyntax", "lblTabs"
                ].forEach(function(element) {
                    // hide element from statusbar
                    bar.getElement(element, function(e) {
                        e.hide();

                        // prevent statusbar from showing them again
                        e.show = function() {};
                    });
                });
            });
        }

        /**
         * Enables or disables terminal sound.
         *
         * @param {boolean} enable whether to enable terminal sound
         */
        function toggleTerminalSound(enable) {
            if (!libterm)
                return;

            if (enable === true)
                libterm.bell = () => !presentation.presenting && terminalSound.play();
            else
                libterm.bell = () => {};
        }

        /**
         * Disables warnings about undeclared variables for JavaScript files
         *
         * @param {object} e a JSON as passed by tabManager.tabAfterActivate's callback
         */
        function toggleUndeclaredVars(e) {
            // ensure tab is ace
            if (e && e.tab && e.tab.editorType === "ace") {
                // disable warnings about undeclared vars for js files
                if (/\.js$/i.test(e.tab.path)) {
                    return settings.set("project/language/@undeclaredVars", false);
                }
                // handle renaming tabs
                else if (e.tab.document) {
                    // handle setting/updating document title
                    e.tab.document.once("setTitle", function(e) {
                        if (/\.js$/i.test(e.title))
                            settings.set("project/language/@undeclaredVars", false);
                    });
                }

                // enable warnings about undeclared vars for other files
                settings.set("project/language/@undeclaredVars", true);
            }
        }

        /**
         * Enables author info when workspace is shared only.
         */
        function updateAuthorInfo(force) {
            // whether to force enable or disable the setting (without saving)
            if (_.isBoolean(force))
                authorInfoToggled = force;

            // handle when author info should be automatically toggled
            if (authorInfoToggled === true) {
                settings.set("user/collab/@show-author-info", workspace.members.length > 1);
            }
            // reset default setting when automatic toggling is disabled
            else if (authorInfoToggled === false) {
                settings.set(
                    "user/collab/@show-author-info",
                    settings.getBool("user/cs50/simple/collab/@originAuthorInfo")
                );
            }
        }

        /**
         * Updates items of "View > Font Size".
         */
        function updateFontSize() {
            /**
             * @return true if editor type of focused tab is ace or terminal.
             * false otherwise.
             */
            function isAvailable() {
                var type = _.isObject(tabs.focussedTab)
                    && tabs.focussedTab.editorType;
                if (_.isString(type))
                    return _.indexOf(["ace", "hex", "terminal"], type) > -1;
            };

            // cache and delete keyboard shortcuts for largerfont & smallerfont
            var largerfontKeys = commands.commands.largerfont.bindKey;
            delete commands.commands.largerfont.bindKey;
            var smallerfontKeys = commands.commands.smallerfont.bindKey;
            delete commands.commands.smallerfont.bindKey;

            // command for increasing font sizes of ace and terminal
            commands.addCommand({
                name: "largerfonts",
                exec: function() {
                    // increase ace's font size
                    var size = settings.getNumber("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", ++size > 72 ? 72 : size);

                    // increase terminal's font size
                    size = settings.getNumber("user/terminal/@fontsize");
                    settings.set("user/terminal/@fontsize", ++size > 72 ? 72 : size);
                },
                bindKey: largerfontKeys,
                isAvailable: isAvailable
            }, plugin);


            // command for resetting font sizes of ace and terminal to defaults
            commands.addCommand({
                name: "resetfonts",
                exec: function() {
                    var ace = 12;
                    var terminal = 12;

                    // determine default font sizes depending on current mode
                    if (presentation.presenting)
                        ace = terminal = 20;

                    // reset font sizes of ace and terminal to defaults
                    settings.set("user/ace/@fontSize", ace);
                    settings.set("user/terminal/@fontsize", terminal);
                },
                bindKey: {
                    mac: "Command-Ctrl-0",
                    win: "Alt-Ctrl-0"
                },
                isAvailable: isAvailable,
            }, plugin);

            // command for decreasing font sizes of ace and terminal
            commands.addCommand({
                name: "smallerfonts",
                exec: function() {
                    // decrease ace's font size
                    var size = settings.getNumber("user/ace/@fontSize");
                    settings.set("user/ace/@fontSize", --size < 1 ? 1 : size);

                    // decrease terminal's font size
                    size = settings.getNumber("user/terminal/@fontsize");
                    settings.set("user/terminal/@fontsize", --size < 1 ? 1 : size);
                },
                bindKey: smallerfontKeys,
                isAvailable: isAvailable
            }, plugin);

            // override behaviors of "Increase Font Size" & "Decrease Font Size"
            menus.get("View/Font Size/Increase Font Size").item.setAttribute(
                "command", "largerfonts"
            );
            menus.get("View/Font Size/Decrease Font Size").item.setAttribute(
                "command", "smallerfonts"
            );

            // add "Reset Font Size"
            menus.addItemByPath("View/Font Size/Reset Font Size", new ui.item({
                command: "resetfonts",
            }), 150, plugin);
        }

        /**
         * Updates captions of some menus and menu items
         */
        function updateMenuCaptions() {
            // map paths to captions
            var captions = {
                "Cloud9": "CS50 IDE",
                "Cloud9/Quit Cloud9": "Log Out",
                "Goto": "Go",
                "Goto/Goto Anything...": "Anything...",
                "Goto/Goto Line...": "Line...",
                "Goto/Goto Symbol...": "Symbol...",
                "Goto/Goto Command...": "Command...",
                "Support/Check Cloud9 Status": "Cloud9 Status",
                "Support/Read Documentation": "Cloud9 Documentation",
                "View/Gutter": "Line Numbers"
            };

            // update captions
            for (var path in captions)
                setMenuCaption(path, captions[path]);
        }

        /**
         * Sets and updates the title of the browser tab.
         */
        function updateTitle(tab) {
            var title = "CS50 IDE";

            // append "Offline" to offline IDE title
            if (!c9.hosted)
                title += " Offline";

            // prepend tab title when should
            document.title = tab && settings.getBool("user/tabs/@title")
                && tab.title
                ? tab.title + " - " + title
                : title
        }

        /**
         * Warns about unsaved file when focusing terminal
         */
        function warnUnsaved() {

            // warning toggle
            notification.enabled = settings.getBool("user/cs50/simple/@unsavedWarning");
            settings.on("user/cs50/simple/@unsavedWarning", function(enabled) {
                notification.enabled = enabled;
                if (!enabled && _.isFunction(notification.hide))
                    notification.hide();
            });

            // add toggle to preferences
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        position: 10,
                        "Warn about Unsaved Files" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@unsavedWarning",
                            min: 1,
                            max: 200,
                            position: 190
                        }
                    }
                }
            }, plugin);

            /**
             * Shows the warning
             *
             * @param {string} title the title of the unsaved file
             */
            function show(title) {

                // clear current timer (if any)
                if (notification.timer)
                    clearTimeout(notification.timer);

                // extend timeout if notifying about same title
                if (title === notification.currTitle && _.isFunction(notification.hasClosed) && !notification.hasClosed()) {
                    notification.timer = setTimeout(notification.hide, 5000);
                    return;
                }

                // hide old notification (if any)
                if (_.isFunction(notification.hide)) {
                    notification.hide();

                    // wait for old notification to be closed before showing
                    if (_.isFunction(notification.hasClosed) && !notification.hasClosed()) {
                        notification.hasClosed.interval = setInterval(function() {
                            clearInterval(notification.hasClosed.interval);
                            show(title);
                        }, 300);

                        return;
                    }
                }

                // new notification
                var div = '<div class="cs50-unsaved-notification">You haven\'t saved your changes to <code>' + title + '</code> yet.</div>';

                // show new notification
                notification.hide = notify(div, true);

                // shortcut for hasClosed
                notification.hasClosed = notification.hide.hasClosed;

                // cache current title
                notification.currTitle = title;

                // timeout before hiding notification automatically
                notification.timer = setTimeout(notification.hide, 5000);

            }

            // handle when a tab goes blur
            tabs.on("blur", function(e) {
                var blurTab = e.tab;
                var doc = blurTab.document;

                // ensure blur tab is ace
                if (!blurTab || blurTab.editorType !== "ace" || !doc)
                    return;

                // wait for a tab to be focussed
                tabs.once("focus", function(e) {
                    if (e.tab.editorType === "terminal" && doc.changed) {

                        // hide notification when tab is closed
                        blurTab.on("close", function() {
                            if (notification.currTitle === blurTab.title && _.isFunction(notification.hide))
                                notification.hide();
                        });

                        // ensure tab is still open before showing warning
                        if (notification.enabled && tabs.findTab(blurTab.path))
                            show(blurTab.title);
                    }
                });
            });

            // hide notification on save
            save.on("afterSave", function(e) {
                if (notification.currTitle === e.tab.title && _.isFunction(notification.hide))
                    notification.hide();
            });
        }


        /**
         * Updates tab tooltip to start with ~/workspace instead of /
         */
        function updateTooltip(e) {
            if (e.tab.path && e.tab.tooltip === e.tab.path && e.tab.tooltip.startsWith("/")) {
                e.tab.document.tooltip = e.tab.tooltip =
                    `${c9.workspaceDir.replace(c9.home, "~")}${e.tab.tooltip}`;
            }
        }


        var loaded = false;
        function load() {

            // remove trailing ? or & (e.g., when left after resetting setting)
            if (history.replaceState && /\?*&*$/.test(window.location.href))
                history.replaceState({}, window.title, window.location.href.replace(/\?*&*$/, ""));

            if (loaded)
               return false;

            loaded = true;

            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);

            // add the permanent changes
            addFileDialog();
            addLanguages();
            addServe();
            addSlashToDirs();
            addTreeToggles();
            addTooltips();
            confirmRestart();
            customizeC9Menu();
            disableAreaBarsMenu();
            hideElements();
            hideGearIcon();
            moveMenuItems();
            setTitleFromTabs();
            simplifyImgeditor();
            updateFontSize();
            updateMenuCaptions();
            warnUnsaved();

            // get setting's version number
            var ver = settings.getNumber("project/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // changes the vertical line to 132
                settings.set("user/ace/@printMarginColumn", "132");

                // set status bar to always show
                settings.set("user/ace/statusbar/@show", true);

                // turn off auto-save by default
                settings.set("user/general/@autosave", false);

                // download project as ZIP files by default
                settings.set("user/general/@downloadFilesAs", "zip");

                // disable autocomplete (temporarily?)
                settings.set("user/language/@continuousCompletion", false);
                settings.set("user/language/@enterCompletion", false);

                // hide asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", false);

                // default excluded formats
                ["class", "exe", "gz", "o", "pyc", "raw", "tar", "zip"].forEach(function(type) {
                    settings.set("user/tabs/editorTypes/@" + type, "none");
                });

                // increase default value for terminal scrollback buffer
                settings.set("user/terminal/@scrollback", 2000);

                // set Python's version
                settings.set("project/python/@version", "python3");

                // set PYTHONPATH
                settings.set(
                    "project/python/@path",
                    "/home/ubuntu/.cs50/py_modules" +
                    ":/opt/pyenv/versions/3.6.0/lib/python3.6/site-packages"
                );

                // set pylint's flags
                settings.set(
                    "project/python/@pylintFlags",
                    "-d all -e E -e F --generated-members=app.jinja_env.*,db.session.*,Registrant.* --ignored-classes=SQL,SQLAlchemy --load-plugins pylint50"
                );

                // strip trailing whitespaces on save by default
                settings.set("project/general/@stripws", true);

                // update settings version
                settings.set("project/cs50/simple/@ver", SETTINGS_VER);
            }

            settings.on("read", function() {
                settings.setDefaults("user/cs50/simple", [
                    ["gravatar", false],
                    ["terminalSound", true],
                    ["undeclaredVars", true],
                    ["unsavedWarning", true]
                ]);
            });

            enableSimpleMode();

            // add trailing line to text files upon saving (if enabled)
            addTrailingLine();

            // simplify ace's statusbar
            simplifyStatusbar();

            // stop marking undeclared variables for javascript files
            tabs.on("tabAfterActivate", (e) => {
                toggleUndeclaredVars(e);

                // prevent other plugins from resetting it
                updateTooltip(e);
            });

            // set titles of terminal tabs to current directory name
            tabs.on("tabCreate", function(e) {
                setTmuxTitle(e.tab);
                updateTooltip(e);
            }, plugin);


            // add terminal sound
            terminalSound = new Audio(options.staticPrefix + "/sounds/bell.mp3");
            toggleTerminalSound(settings.getBool("user/cs50/simple/@terminalSound"));
            settings.on("user/cs50/simple/@terminalSound", toggleTerminalSound, plugin);

            // add Gravatar toggle online only
            info.getUser(addGravatarToggle);

            // forcibly enable changes panel once
            if (!settings.getBool("project/cs50/simple/@scm-enabled")) {
                settings.set("state/experiments/@git", true);
                settings.set("project/cs50/simple/@scm-enabled", true);
            }

            // enable author info when workspace is shared only
            if (c9.hosted) {
                settings.setDefaults("user/cs50/simple/collab", [
                    // cache original author info setting
                    ["originAuthorInfo", settings.getBool("user/collab/@show-author-info")],

                    // automatically toggle author info by default
                    ["authorInfoToggled", true]
                ]);

                // update author info as setting is toggled
                settings.on("user/cs50/simple/collab/@authorInfoToggled", updateAuthorInfo);

                // update author info initially
                updateAuthorInfo(settings.getBool("user/cs50/simple/collab/@authorInfoToggled"));

                // cache original author info setting as it changes
                settings.on("user/collab/@show-author-info", function(val) {
                    // ensure only original setting is cached
                    if (authorInfoToggled === false)
                        settings.set("user/cs50/simple/collab/@originAuthorInfo", val);
                });

                // add preference toggle
                prefs.add({
                    "CS50" : {
                        position: 5,
                        "IDE Behavior" : {
                            position: 10,
                            "Automatically Toggle Author Info" : {
                                type: "checkbox",
                                setting: "user/cs50/simple/collab/@authorInfoToggled",
                                position: 900
                            }
                        }
                    }
                }, plugin);

                // load members in the workspace
                workspace.loadMembers(updateAuthorInfo);

                // update author info as members are added or removed
                workspace.on("sync", updateAuthorInfo);
            }

            // disable html auto completer
            language.unregisterLanguageHandler("plugins/c9.ide.language.html/html_completer");
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            // TODO unload correctly
            // toggleSimpleMode(false);
            authorInfoToggled = null;
            avatar = null;
            dark = null;
            notification = {};
            openingFile = false;
            terminalSound = null;
            trailingLine = null;
            treeToggles = {};
            loaded = false;
        });

        /***** Register and define API *****/

        /**
         * Left this empty since nobody else should be using our plugin
         **/
        plugin.freezePublicAPI({ });

        register(null, { "harvard.cs50.simple" : plugin });
    }
});
