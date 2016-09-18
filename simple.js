define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "ace.status", "auth", "c9", "clipboard", "collab", "commands",
        "console", "Divider", "dialog.file", "immediate", "info",  "keymaps",
        "navigate", "outline", "layout", "login", "Menu", "menus", "panels",
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

        // ensures "Goto/Goto Symbol..." exists before simple is loaded
        var outline = imports.outline;

        var panels = imports.panels;
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        var settings = imports.settings;
        var tabs = imports.tabManager;
        var tabManager = imports.tabManager;
        var tree = imports.tree;
        var ui = imports.ui;

        var plugin = new Plugin("CS50", main.consumes);

        var SETTINGS_VER = 9;

        // https://lodash.com/docs
        var _ = require("lodash");

        var libterm = require("plugins/c9.ide.terminal/aceterm/libterm").prototype;

        var lessComfortable = true;
        var divider = null;
        var terminalBellObj = null;
        var treeToggle = null;
        var treeToggleItem = null;
        var dark = null;
        var avatar = null;
        var openingFile = false;
        var presenting = false;
        var terminalSound = false;

        /*
         * Sets visibility of menu item with specified path.
         */
        function setMenuVisibility(path, visible) {
            var menu = menus.get(path).item;
            menu && menu.setAttribute("visible", visible);
        }

        /*
         * Hides the given div by changing CSS
         * @return true if successfuly hides, false otherwise
         */
        function hide(div) {
            if (div && div.$ext && div.$ext.style) {
                div.$ext.style.display = "none";
                return true;
            }
            else {
                return false;
            }
        }

        /*
         * Shows the given div by changing CSS
         * @return true if successfully shows, false otherwise
         */
        function show(div) {
            if (div && div.$ext && div.$ext.style) {
                div.$ext.style.display = "";
                return true;
            }
            else {
                return false;
            }
        }

        /**
         * Hides gear icon
         */
        function hideGearIcon() {
            var bar = layout.findParent({name: "preferences"});
            if (bar.childNodes) {
                bar.childNodes.forEach(function(node) {
                    if (node.class === "preferences") {
                        hide(node);
                    }
                });
            }
        }

        /*
         * Toggles simplification of the menus at the top of Cloud 9
         */
        function toggleMenus(lessComfortable) {
            // toggle visibility of each menu item
            [
                // Cloud9 Menu
                "Cloud9/Open Your Project Settings",
                "Cloud9/Open Your User Settings",
                "Cloud9/Open Your Keymap",
                "Cloud9/Open Your Init Script",
                "Cloud9/Open Your Stylesheet",

                // File Menu
                "File/Revert to Saved",
                "File/Revert All to Saved",
                "File/Mount FTP or SFTP server...",
                "File/Line Endings",
                "File/New Plugin",

                // Edit Menu
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

                // Find Menu
                "Find/Replace Next",
                "Find/Replace Previous",
                "Find/Replace All",

                // View Menu
                "View/Editors",
                "View/Syntax",
                "View/Wrap Lines",
                "View/Wrap To Print Margin",

                // Goto Menu
                "Goto/Goto Anything...",
                "Goto/Goto Symbol...",
                "Goto/Goto Command...",
                "Goto/Next Error",
                "Goto/Previous Error",
                "Goto/Word Right",
                "Goto/Word Left",
                "Goto/Scroll to Selection",

                // Tools Menu
                "Tools",

                // Window Menu
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
                        item.setAttribute("visible", false);
                });
            });
        }

        /*
         * Toggles the button in top left that minimizes the menu bar
         */
        function toggleMiniButton(lessComfortable) {

            // toggle button
            var miniButton = layout.findParent(menus).childNodes[0].childNodes[0];

            // left-align "CS50 IDE" within menu bar
            var bar = document.querySelector(".c9-menu-bar .c9-mbar-cont");
            if (lessComfortable) {
                hide(miniButton);
                bar && (bar.style.paddingLeft = "0");
            }
            else {
                show(miniButton);
                bar && (bar.style.paddingLeft = "");
            }
        }

        /*
         * Toggles the left Navigate and Commands side tabs
         */
        function toggleSideTabs(lessComfortable) {
            var panelList = ["navigate", "commands.panel", "scm"];

            // remember tree visibility status
            var resetVisibility = tree.active ? tree.show : tree.hide;

            // temporarily overcomes a bug in C9 (tree is forcibly hidden by enabling panels)
            tree.hide();

            if (lessComfortable)
                // Only shows tabs automatically when less comfortable is disabled
                panelList.forEach(function (p) {panels.disablePanel(p);});
            else
                panelList.forEach(function (p) {panels.enablePanel(p);});

            // reset tree visibility status
            resetVisibility();
        }

        /*
         * Toggles menu simplification that you get when you click the plus icon
         */
        function togglePlus(lessComfortable) {
            var toggle = lessComfortable ? hide : show;

            // finds the menu bar and then executes callback
            tabs.getElement("mnuEditors", function(menu) {
                var menuItems = menu.childNodes;

                // tries to toggle the menu items on the plus sign
                // until it works (sometimes this is called before they load)
                var test = setInterval(function (){
                    if (toggle(menuItems[2]) &&
                        toggle(menuItems[3]) &&
                        toggle(menuItems[4])) {
                        clearInterval(test);
                    }
                }, 0);
            });
        }

        /*
         * Adds tooltips to console buttons
         */
        function addTooltips() {

            // adds tooltips as a callback after the consoleButtons are created
            imports.console.getElement("consoleButtons", function(aml) {
                aml.childNodes[0].setAttribute("tooltip", "Maximize");
                aml.childNodes[1].setAttribute("tooltip", "Close Console");
            });
        }

        /*
         * Adds the buttons to toggle comfort level
         */
        function addToggle(plugin) {

            // creates the toggle menu item
            var toggle = new ui.item({
                type: "check",
                caption: "Less Comfortable",
                onclick: toggleSimpleMode
            });

            // creates divider below toggle
            divider = new ui.divider();

            // places it in View tab
            menus.addItemByPath("View/Less Comfortable", toggle, 0, plugin);
            menus.addItemByPath("View/Div", divider, 10, plugin);

            // Add preference pane button
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

        /*
         * Toggles whether or not simple mode is enabled
         */
        function toggleSimpleMode(override) {

            // if we're unloading, remove menu customizations but don't save
            if (_.isBoolean(override))
                lessComfortable = override;
            else {
                // Toggles comfort level
                lessComfortable = !lessComfortable;
                settings.set("user/cs50/simple/@lessComfortable", lessComfortable);
            }

            // Toggles features
            toggleMenus(lessComfortable);
            toggleMiniButton(lessComfortable);
            toggleSideTabs(lessComfortable);
            togglePlus(lessComfortable);

            // Makes sure that the checkbox is correct
            menus.get("View/Less Comfortable").item.checked = lessComfortable;
        }

        /*
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
                        docList.forEach(function (doc) {
                            if (doc.hasOwnProperty("title"))
                                doc.title = title;
                        });
                    }
                }, plugin);
            }
        }

        /*
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

        /*
         * Set all Terminal tab titles and HTML document title based on tab
         */
        function setTitlesFromTabs() {
            // set terminal titles and document title based on existing tabs
            tabManager.getTabs().forEach(function(tab) {
                setTmuxTitle(tab);
            });

            // future tabs
            tabManager.on("open", function wait(e) {
                setTmuxTitle(e.tab);
            }, plugin);

            // udpate document title once
            updateTitle(tabManager.focussedTab);

            // update document title when tabs change
            tabManager.on("focusSync", function(e){ updateTitle(e.tab); });
            tabManager.on("tabDestroy", function(e){ if (e.last) updateTitle(); });
            settings.on("user/tabs", function(){ updateTitle(tabManager.focussedTab); });
        }

        /**
         * Enables or disables terminal sound.
         *
         * @param {boolean} enable whether to enable terminal sound
         */
        function toggleTerminalSound(enable) {
            libterm && (libterm.bell = (enable === true)
                ? function() { terminalBellObj.play(); }
                : function() {});
        }

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
                txtDirectory.previousSibling.setAttribute("visible", false);
                txtDirectory.setAttribute("visible", false);

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
         * Syncs tree toggle button and menu item with tree visibility state.
         *
         * @param {boolean} active whether to toggle the buttons on
         */
        function syncTreeToggles(active) {
            if (!treeToggle || !treeToggleItem)
                return;

            var style = "simple50-tree-toggle";
            if (dark)
                style += " dark";

            if (active === true) {
                style += " active";

                // check menu item
                treeToggleItem.setAttribute("checked", true);
            }
            else {
                // uncheck menu item
                treeToggleItem.setAttribute("checked", false);
            }

            // update style of tree-toggle button
            treeToggle.setAttribute("class", style);
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
            treeToggle = ui.button({
                id: "treeToggle",
                "class": "simple50-tree-toggle",
                command: "toggletree",
                skin: "c9-simple-btn",
                height: 16,
                width: 16
            });

            // create menu item
            treeToggleItem = new ui.item({
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
                pane.aml.appendChild(treeToggle);
            });

            // add menu item to toggle tree (useful when toggle is hidden)
            menus.addItemByPath("View/File Browser", treeToggleItem, 200, plugin);

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
                treeToggle.setAttribute("visible", showing);
            });

            // style tree-toggle initially
            syncTreeToggles(tree.active);
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

        /*
         * Hides avatar in offline IDE. Adds preference to toggle between
         * Gravatar and C9 logo in online IDE only.
         *
         * @param err ideally passed by info.getUser in case of an error
         * @param user a user object with property id
         */
        function addGravatarToggle(err, user) {
            if (err)
                return;

            if (user && user.id) {
                // get avatar button
                avatar = menus.get("user_" + user.id).item;
                if (!avatar)
                    return;

                // hide avatar in offline IDE
                if (!c9.hosted) {
                    avatar.setAttribute("visible", false);
                    return;
                }

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
                        ["Dashboard", "Home", "Log out"].forEach(function (item) {
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
         * Disables warnings about undeclared variables for JavaScript files
         *
         * @param {object} e a JSON as passed by tabManager.tabAfterActivate's callback
         */
        function toggleUndeclaredVars(e) {
            // ensure tab is ace
            if (e && e.tab && e.tab.editorType === "ace") {
                // disable warnings about undeclared vars for js files
                if (e.tab.path && e.tab.path.slice(-3) === ".js")
                    return settings.set("project/language/@undeclaredVars", false);
                // handle renaming tabs
                else if (e.tab.document)
                    // handle setting/updating document title
                    e.tab.document.once("setTitle", function(e) {
                        if (e.title.slice(-3) === ".js")
                            settings.set("project/language/@undeclaredVars", false);
                    });

                // enable warnings about undeclared vars for other files
                settings.set("project/language/@undeclaredVars", true);
            }
        }

        var loaded = false;
        function load() {
            if (loaded)
               return false;

            loaded = true;

            // Adds the permanent changes
            addToggle(plugin);
            addTooltips();
            hideGearIcon();
            updateFontSize();
            updateMenuCaptions();
            setTitlesFromTabs();
            customizeC9Menu();
            addFileDialog();
            addTreeToggles();
            hideElements();
            updateTemplates();

            // add terminal sound
            terminalBellObj = new Audio(options.staticPrefix + "/sounds/bell.mp3");
            terminalSound = settings.getBool("user/cs50/simple/@terminalSound");
            toggleTerminalSound(terminalSound);
            settings.on("user/cs50/simple/@terminalSound", toggleTerminalSound);

            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);

            // stop marking undeclared variables for javascript files
            tabManager.on("tabAfterActivate", toggleUndeclaredVars);

            var ver = settings.getNumber("user/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // hide asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", false);

                // Turn off auto-save by default
                settings.set("user/general/@autosave", false);

                // disable autocomplete (temporarily?)
                settings.set("user/language/@continuousCompletion", false);
                settings.set("user/language/@enterCompletion", false);

                // download project as ZIP files by default
                settings.set("user/general/@downloadFilesAs", "zip");

                settings.set("user/cs50/simple/@ver", SETTINGS_VER);
                // changes the vertical line to 132
                settings.set("user/ace/@printMarginColumn", "132");

                // default excluded formats
                var types = ["class", "exe", "gz", "o", "pdf", "pyc", "raw", "tar", "zip"];
                types.map(function (i) {
                    settings.set("user/tabs/editorTypes/@"+i, "none");
                });

                // Set Python default to Python 3
                settings.set("project/python/@version", "python3");

                // Set status bar to always show
                settings.set("user/ace/statusbar/@show", true);
            }

            settings.on("read", function(){
                settings.setDefaults("user/cs50/simple", [
                    ["lessComfortable", true],
                    ["undeclaredVars", true],
                    ["gravatar", false],
                    ["terminalSound", true]
                ]);
            });

            // When less comfortable option is changed
            settings.on("user/cs50/simple/@lessComfortable", function (saved) {
                if (saved != lessComfortable) {
                    menus.click("View/Less Comfortable");
                }
            }, plugin);

            toggleSimpleMode(settings.get("user/cs50/simple/@lessComfortable"));

            // determine whether we're presenting initially
            presenting = settings.getBool("user/cs50/presentation/@presenting");

            // update presenting when necessary
            settings.on("user/cs50/presentation/@presenting", function(val) {
                presenting = val;
            });

            // Add Gravatar toggle online only
            info.getUser(addGravatarToggle);
        }

        /***** Lifecycle *****/

        plugin.on("load", function(){
            load();
        });

        plugin.on("unload", function() {
            toggleSimpleMode(false);
            loaded = false;
            lessComfortable = false;
            divider = null;
            terminalBellObj = null;
            treeToggle = null;
            treeToggleItem = null;
            dark = null;
            avatar = null;
            openingFile = false;
            presenting = false;
        });

        /***** Register and define API *****/

        /**
         * Left this empty since nobody else should be using our plugin
         **/
        plugin.freezePublicAPI({ });

        register(null, { "harvard.cs50.simple" : plugin });
    }
});
