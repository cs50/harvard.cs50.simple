define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "ace.status", "auth", "c9", "clipboard", "collab", "commands",
        "console", "dialog.file", "immediate", "info",  "keymaps", "navigate",
        "outline", "layout", "login", "Menu", "menus", "newresource", "panels",
        "Plugin", "preferences", "preview", "run.gui", "save", "settings",
        "tabManager", "terminal", "tooltip", "tree", "ui", "util"
    ];
    main.provides = ["harvard.cs50.simple"];
    return main;

    function main(options, imports, register) {
        var auth = imports.auth;
        var c9 = imports.c9;
        var collab = imports.collab;
        var commands = imports.commands;
        var fileDialog = imports["dialog.file"];
        var info = imports.info;
        var layout = imports.layout;
        var menus = imports.menus;
        var newresource = imports.newresource;

        // outline adds "Goto/Goto Symbol..."
        // listing it as dependency ensures item exists before simple is loaded
        var outline = imports.outline;

        var panels = imports.panels;
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        var save = imports.save;
        var settings = imports.settings;
        var tabManager = imports.tabManager;
        var tree = imports.tree;
        var ui = imports.ui;

        var plugin = new Plugin("CS50", main.consumes);

        var SETTINGS_VER = 9;

        // https://lodash.com/docs
        var _ = require("lodash");
        var basename = require("path").basename;

        var libterm = require("plugins/c9.ide.terminal/aceterm/libterm").prototype;

        var avatar = null;
        var dark = null;
        var divider = null;
        var lessComfortable = true;
        var openingFile = false;
        var presenting = false;
        var terminalSound = null;
        var trailingLine = null;
        var treeToggles = {};

        /**
         * Overrides the behavior of the "File/Open" menu item to open a file
         * dialog instead of the "Navigation" pane in less-comfy only.
         */
        function addFileDialog() {
            // get the "File/Open" menu item
            var openItem = menus.get("File/Open...").item;
            if (!openItem)
                return;

            // add command that opens file dialog in less-comfy only
            commands.addCommand({
                name: "openFileDialog",
                hint: "Opens file dialog for opening files",
                bindKey: commands.commands.navigate.bindKey,
                exec: function() {
                    // override in less-comfy only
                    if (!lessComfortable)
                        return commands.exec("navigate");

                    // wehther to customize file dialog
                    openingFile = true;

                    // show open file dialog
                    fileDialog.show("Open file", null, function(path) {
                        // open and activate file at path
                        tabManager.openFile(path, true);

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
         * Adds the buttons to toggle comfort level
         */
        function addToggle() {

            // creates the toggle menu item
            var toggle = new ui.item({
                type: "check",
                caption: "Less Comfortable",
                onclick: toggleSimpleMode
            });

            // places it in View tab
            menus.addItemByPath("View/Less Comfortable", toggle, 0, plugin);

            // divider before "Editors"
            divider = new ui.divider();
            menus.addItemByPath("View/~", divider, 10, plugin);

            // add preference pane button
            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        position: 10,
                        "Less Comfortable Mode" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@lessComfortable",
                            min: 1,
                            max: 200,
                            position: 190
                        },
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
                                position: 1000,
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

            // hide workspace from window menu
            setMenuVisibility("Window/Workspace", false);

            // remove workspace from left bar
            panels.disablePanel("tree");

            // reset tree visibility status (to prevent disablePanel from hiding tree)
            resetVisibility("tree");

            // create toggle button
            treeToggles.button = ui.button({
                id: "treeToggle",
                "class": "simple50-tree-toggle",
                command: "toggletree",
                skin: "c9-simple-btn",
                height: 16,
                width: 16
            });

            // create menu item
            treeToggles.menuItem = new ui.item({
                type: "check",
                caption: "File Browser",
                command: "toggletree"
            });

            // listen for pane creation
            tabManager.on("paneCreate", function(e) {
                var pane = e.pane;
                if (pane !== tabManager.getPanes()[0])
                    return;

                // make room for tree-toggle button
                pane.aml.$ext.classList.add("simple50-pane0");
                pane.aml.$buttons.style.paddingLeft = "54px";

                // insert tree-toggle button
                pane.aml.appendChild(treeToggles.button);
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

            // style tree-toggle initially
            syncTreeToggles(tree.active);
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

                // CS50 IDE > Restart Workspace to CS50 IDE > Restart
                setMenuCaption("Cloud9/Restart Workspace", "Restart");
            }
            else {
                // remove "Dashboard" offline
                menus.remove(dashboard);

                // remove CS50 IDE > Log out offline
                menus.remove("Cloud9/Quit Cloud9");
            }

            // add "About CS50"
            menus.addItemByPath("Cloud9/About CS50", new ui.item({
                caption: "About CS50",
                onclick: function() {
                    window.open("https://cs50.harvard.edu/", "_blank");
                }
            }), 0, plugin);

            // add "What's New?"
            menus.addItemByPath("Cloud9/What's New?", new ui.item({
                caption: "What's New?",
                onclick: function() {
                    window.open("http://docs.cs50.net/ide/new.html", "_blank");
                }
            }), 1, plugin);

            // add divider
            menus.addItemByPath("Cloud9/~", new ui.divider(), 50, plugin);

            // hide "Restart Cloud9"
            setMenuVisibility("Cloud9/Restart Cloud9", false);
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
            // hide "Collaborate" panel offline
            if (!c9.hosted) {
                // remove panel button
                collab.disable();

                // hide Window > Collaborate
                setMenuVisibility("Window/Collaborate", false);
            }

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
            // udpate document title once
            updateTitle(tabManager.focussedTab);

            // update document title when tabs change
            tabManager.on("focusSync", function(e) {
                updateTitle(e.tab);
            }, plugin);

            // update document title when
            tabManager.on("tabDestroy", function(e) {
                if (e.last)
                updateTitle();
            }, plugin);
        }

        /**
         * Set the Terminal tab title to the current working directory
         */
        function setTmuxTitle(tab){
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
         * Syncs tree toggle button and menu item with tree visibility state.
         *
         * @param {boolean} active whether to toggle the buttons on
         */
        function syncTreeToggles(active) {
            if (treeToggles && treeToggles.button && treeToggles.menuItem) {
                var style = "simple50-tree-toggle";
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
         * Toggles simplification of the menus at the top of Cloud 9
         */
        function toggleMenus(lessComfortable) {
            // toggle visibility of each menu item
            [
                // CS50 IDE menu
                "Cloud9/Open Your Project Settings",
                "Cloud9/Open Your User Settings",
                "Cloud9/Open Your Keymap",
                "Cloud9/Open Your Init Script",
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
                "Window/New Immediate Window",
                "Window/Installer...",
                "Window/Navigate",
                "Window/Commands",
                "Window/Presets",
                "Window/Changes",

                // Support menu
                "Support/Show Guided Tour",
                "Support/Get Help (Community)",
                "Support/Request a Feature",
                "Support/Go To YouTube Channel",

                // extraneous templates
                "File/New From Template/Text file",
                "File/New From Template/CoffeeScript file",
                "File/New From Template/XML file",
                "File/New From Template/XQuery file",
                "File/New From Template/SCSS file",
                "File/New From Template/LESS file",
                "File/New From Template/SVG file",
                "File/New From Template/Python file",
                "File/New From Template/Ruby file",
                "File/New From Template/OCaml file",
                "File/New From Template/Clojure file",
                "File/New From Template/Markdown",
                "File/New From Template/Express file",
                "File/New From Template/Node.js web server",
            ].forEach(function(path) {
                setMenuVisibility(path, !lessComfortable);
            });

            // show divider in more-comfy only (auto-hidden in less-comfy)
            if (!lessComfortable)
                divider.show();
        }

        /**
         * Toggles the button in top left that minimizes the menu bar
         */
        function toggleMiniButton(lessComfortable) {
            // menu bar
            var bar = layout.findParent(menus);
            if (bar && bar.childNodes[0]) {
                var minimizeBtn = bar.childNodes[0].childNodes[0];
                if (minimizeBtn) {
                    // hide minimize button in less-comfy only
                    minimizeBtn.setAttribute("visible", !lessComfortable);

                    // left-align "CS50 IDE" menu within menu bar
                    bar.$int.style.paddingLeft = lessComfortable ? "0" : "";
                }
            }
        }

        /**
         * Toggles menu simplification that you get when you click the plus icon
         */
        function togglePlus(lessComfortable) {
            var toggle = lessComfortable ? hide : show;

            // finds the menu bar and then executes callback
            tabManager.getElement("mnuEditors", function(menu) {
                var menuItems = menu.childNodes;

                // tries to toggle the menu items on the plus sign
                // until it works (sometimes this is called before they load)
                var test = setInterval(function() {
                    if (toggle(menuItems[2]) &&
                        toggle(menuItems[3]) &&
                        toggle(menuItems[4])) {
                        clearInterval(test);
                    }
                }, 0);
            });
        }

        /**
         * Toggles the left Navigate and Commands side tabs
         */
        function toggleSideTabs(lessComfortable) {
            var panelList = ["navigate", "commands.panel", "scm"];

            // remember tree visibility status
            var resetVisibility = tree.active ? tree.show : tree.hide;

            // temporarily overcomes a bug in C9 (tree is forcibly hidden by enabling panels)
            tree.hide();

            if (lessComfortable)
                // only shows tabs automatically when less comfortable is disabled
                panelList.forEach(function(p) {panels.disablePanel(p);});
            else
                panelList.forEach(function(p) {panels.enablePanel(p);});

            // reset tree visibility status
            resetVisibility();
        }

        /**
         * Toggles whether or not simple mode is enabled
         */
        function toggleSimpleMode(override) {

            // if we're unloading, remove menu customizations but don't save
            if (_.isBoolean(override))
                lessComfortable = override;
            else {
                // toggle comfort level
                lessComfortable = !lessComfortable;
                settings.set("user/cs50/simple/@lessComfortable", lessComfortable);
            }

            // toggle features
            toggleMenus(lessComfortable);
            toggleMiniButton(lessComfortable);
            toggleSideTabs(lessComfortable);
            togglePlus(lessComfortable);

            // make sure that the checkbox is correct
            menus.get("View/Less Comfortable").item.checked = lessComfortable;
        }

        /**
         * Enables or disables terminal sound.
         *
         * @param {boolean} enable whether to enable terminal sound
         */
        function toggleTerminalSound(enable) {
            libterm && (libterm.bell = (enable === true)
                ? function() { terminalSound.play(); }
                : function() {});
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
         * Updates items of "View > Font Size".
         */
        function updateFontSize() {
            /**
             * @return true if editor type of focused tab is ace or terminal.
             * false otherwise.
             */
            function isAvailable() {
                var editorType = tabManager.focussedTab.editor.type;
                return editorType === "ace" || editorType === "terminal";
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
                    commands.exec("largerfont");

                    // increase terminal's font size
                    var currSize = settings.getNumber(
                        "user/terminal/@fontsize"
                    );
                    settings.set(
                        "user/terminal/@fontsize",
                        ++currSize > 72 ? 72 : currSize
                    );
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
                    if (presenting)
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
                    commands.exec("smallerfont");

                    // decrease terminal's font size
                    var currSize = settings.getNumber(
                        "user/terminal/@fontsize"
                    );
                    settings.set(
                        "user/terminal/@fontsize",
                        --currSize < 1 ? 1 : currSize
                    );
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
                "Support/Read Documentation": "Cloud9 Documentation"
            };

            // update captions
            for (var path in captions)
                setMenuCaption(path, captions[path]);
        }

        /**
         * Sorts templates and removes the " file" suffix from their names
         */
        function updateTemplates() {
            var templates = menus.get("File/New From Template").menu;
            var index = 100;
            templates && templates.childNodes.map(function(item) {
                return item.getAttribute("caption");
            }).sort().forEach(function(caption) {
                // form path of template's menu item
                var path = "File/New From Template/" + caption;

                // get the item
                var item = menus.get(path).item;

                // ensure item exists
                if (item) {
                    // move the item to its sorted location
                    menus.addItemByPath(path, menus.get(path).item, index += 100, plugin);

                    // remove the " file" suffix
                    if (caption.slice(-5) === " file")
                        setMenuCaption(item, caption.substring(0, caption.length - 5));
                }
            });
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

        var loaded = false;
        function load() {
            if (loaded)
               return false;

            loaded = true;

            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);

            // add the permanent changes
            addFileDialog();
            addToggle(plugin);
            addTreeToggles();
            addTooltips();
            customizeC9Menu();
            hideElements();
            hideGearIcon();
            setTitleFromTabs();
            updateFontSize();
            updateMenuCaptions();

            // get setting's version number
            var ver = settings.getNumber("user/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // set Python default to Python 3
                settings.set("project/python/@version", "python3");

                // changes the vertical line to 132
                settings.set("user/ace/@printMarginColumn", "132");

                // set status bar to always show
                settings.set("user/ace/statusbar/@show", true);

                // update settings version
                settings.set("user/cs50/simple/@ver", SETTINGS_VER);

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
                var types = ["class", "exe", "gz", "o", "pdf", "pyc", "raw", "tar", "zip"];
                types.map(function(i) {
                    settings.set("user/tabs/editorTypes/@"+i, "none");
                });
            }

            settings.on("read", function() {
                settings.setDefaults("user/cs50/simple", [
                    ["gravatar", false],
                    ["lessComfortable", true],
                    ["terminalSound", true],
                    ["undeclaredVars", true]
                ]);
            });

            // when less comfortable option is changed
            settings.on("user/cs50/simple/@lessComfortable", function(saved) {
                if (saved !== lessComfortable) {
                    menus.click("View/Less Comfortable");
                }
            }, plugin);
            toggleSimpleMode(settings.get("user/cs50/simple/@lessComfortable"));

            // add trailing line to text files upon saving (if enabled)
            addTrailingLine();

            // stop marking undeclared variables for javascript files
            tabManager.on("tabAfterActivate", toggleUndeclaredVars);

            // set titles of terminal tabs to current directory name
            tabManager.on("tabCreate", function(e) {
                setTmuxTitle(e.tab);
            }, plugin);

            // add terminal sound
            terminalSound = new Audio(options.staticPrefix + "/sounds/bell.mp3");
            toggleTerminalSound(settings.getBool("user/cs50/simple/@terminalSound"));
            settings.on("user/cs50/simple/@terminalSound", toggleTerminalSound, plugin);

            // determine whether we're presenting initially
            presenting = settings.getBool("user/cs50/presentation/@presenting");

            // update presenting when necessary
            settings.on("user/cs50/presentation/@presenting", function(val) {
                presenting = val;
            }, plugin);

            // add Gravatar toggle online only
            info.getUser(addGravatarToggle);

            // add C template
            newresource.addFileTemplate(require("text!./templates/c.templates"), plugin);
            updateTemplates();
        }

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            toggleSimpleMode(false);
            avatar = null;
            dark = null;
            divider = null;
            lessComfortable = false;
            openingFile = false;
            presenting = false;
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
