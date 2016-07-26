define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "ace", "ace.status", "auth", "clipboard", "commands", "console",
        "Divider", "harvard.cs50.presentation", "immediate", "info",  "keymaps",
        "layout", "login", "Menu", "menus", "panels", "Plugin", "preferences",
        "preview", "run.gui", "save", "settings", "tabManager", "terminal",
        "tooltip", "tree", "ui", "util", "c9"
    ];
    main.provides = ["c9.ide.cs50.simple"];
    return main;

    function main(options, imports, register) {
        var auth = imports.auth;
        var c9 = imports.c9;
        var clipboard = imports.clipboard;
        var commands = imports.commands;
        var layout = imports.layout;
        var info = imports.info;
        var menus = imports.menus;
        var Plugin = imports.Plugin;
        var prefs = imports.preferences;
        var presentation = imports["harvard.cs50.presentation"];
        var settings = imports.settings;
        var status = imports["ace.status"];
        var tabs = imports.tabManager;
        var tabManager = imports.tabManager;
        var panels = imports.panels;
        var ui = imports.ui;
        var util = imports.util;

        var plugin = new Plugin("CS50", main.consumes);

        var SETTINGS_VER = 6;

        var cloud9Icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAABcSAAAXEgFnn9JSAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS40LjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgpMwidZAAACeElEQVQ4EY1TTUhUURT+7n1P58cpGE0EIZCsTCzoh6IoSIKoFi3a2CawVRAILdwEBbkoiGgTtOpH6YdRBiKIFrWwBDdBEtU0P45hCDE1Uo4247z3mvfe6dwbM4mKdODde+75+c6593zPwFpCJCCExNgYrRW20jcwIBEno+ZQQEvPNcdqygDJqvni85no0eFMa/WMePwfaM1YVTixK56sV8fznIh7qREMZQp4kF7E3eS7tkfpbh26ohPd3jLkofSH2+8tys07NLdYodFpi5pGpmlbLH1AgehCy4E6H6a2H4lP7sNg6vK50R/EYrme75ds11f6s2yZcCf1UndRXYikybrY+nhyiEyzt2TWAdLGrpDjsz04MbOAJ9l53DjWFmiPsMnAwf3D2fECUQmgW5NCvDA7YtnrZmNLr/vzu1uxPQH44mupoh+yqzUC29UTFHbFY0U0UCB0SEJCSON4RyxzWoLorFuYZUBIi8jYUSfktW8WVPVIwMThLVHdcCJfZnAi37E83yo5fsVWOVdVpQb43B5TRtVy+eswJfa+yvE0voAfAAtWBTenfmFTQIpFX/MjQL8d1dFG7gDjxjpdhSE1FIWV1RDUt7uZpBB0/22ePjkeRdnGBVQdW4YiqqOk6ZmyD8XCG2N94wa/XNQQDkfAkPg85yAxa6N/uow94XoUuRvJdhkMBz0VS7jAKMDmwalmM+BfYegTfM1m5j/fCMhYHk9FYGdQoqxvyUYBNYEJQXQpc6YzwRxnEvX0cCQLk6Pd/tiknkXJqRa94Wn+765WKxou5U62lrWlRib+ebpfk+LE/4lKZBKpYH2FJVmCHUuOq6g6Qw9MO/8AQ2ck6BoumNsAAAAASUVORK5CYII=";
        var lessComfortable = true;
        var profileMenu = null;
        var divider = null;
        var USER = null;

        // stop marking undeclared variables for javascript files
        tabManager.on('focus', function(e) {
            if (e.tab.path != undefined && e.tab.path.slice(-3) == ".js") {
                settings.set("project/language/@undeclaredVars",false);
            }
            else {
                var markUndecVars = settings.getBool("user/cs50/simple/@undeclaredVars");
                settings.set("project/language/@undeclaredVars", markUndecVars);
            }
        });

        /*
         * Sets visibility of menu item with specified path.
         */
        function setMenuVisibility(path, visible) {
            var menu = menus.get(path);
            if (menu && menu.item) {
                menu.item.setAttribute("visible", visible);
            }
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

        /*
         * Toggles the status bar in the bottom right corner of Ace
         */
        function toggleStatusBar(lessComfortable) {
            lessComfortable ? status.hide() : status.show();
        }

        /*
         * Toggles simplification of the menus at the top of Cloud 9
         */
        function toggleMenus(lessComfortable) {

            // remove gear icon as redundant from both modes
            var bar = layout.findParent({name: "preferences"});
            if (bar.childNodes) {
                bar.childNodes.forEach(function(node) {
                    if (node.class === "preferences") {
                        hide(node);
                    }
                });
            }

            // less comfortable
            if (lessComfortable) {
                menus.get("Goto").item.setAttribute("caption", "Go");
                menus.get("Goto/Goto Line...").item.setAttribute("caption", "Line...");
                menus.get("Support/Check Cloud9 Status").item.setAttribute("caption", "Cloud9 Status");
                menus.get("Support/Read Documentation").item.setAttribute("caption", "Cloud9 Documentation");
            }

            // more comfortable
            else {
                menus.get("Goto").item.setAttribute("caption", "Goto");
                menus.get("Goto/Goto Line...").item.setAttribute("caption", "Goto Line...");
                menus.get("Support/Check Cloud9 Status").item.setAttribute("caption", "Check Cloud9 Status");
                menus.get("Support/Read Documentation").item.setAttribute("caption", "Read Documentation");

                // re-show divider below View/Less Comfortable
                divider.show();
            }

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

                // Run Menu
                "Run",

                // Tools Menu
                "Tools",

                // Window Menu
                "Window/New Immediate Window",
                "Window/Installer...",
                "Window/Navigate",
                "Window/Commands",
                "Window/Presets",
                "Window/Changes",
                "Window/Workspace",

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

        /*
         * Toggles Preview Button
         */
        function togglePreview(lessComfortable) {
            // determines whether to show or hide
            var toggle = lessComfortable ? hide : show;

            // gets the menu bar that holds the preview and debug buttons
            var bar = layout.findParent({ name: "preview" });

            // toggles divider
            toggle(bar.childNodes[0]);

            // toggles preview button
            toggle(bar.childNodes[1]);

            // toggles run button
            toggle(bar.childNodes[2]);
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
                if (bar) {
                    bar.style.paddingLeft = "0";
                }
            }
            else {
                show(miniButton);
                if (bar) {
                    bar.style.paddingLeft = "";
                }
            }
        }

        /*
         * Toggles the left Navigate and Commands side tabs
         */
        function toggleSideTabs(lessComfortable) {
            var panelList = ["tree", "navigate", "commands.panel", "scm"];
            if (lessComfortable) {
                // Only shows tabs automatically when less comfortable is disabled
                panelList.forEach(function (p) { panels.disablePanel(p, true); });

                // forcibly show file tree
                panels.activate("tree");
            }
            else {
                panelList.forEach(function (p) { panels.enablePanel(p, true); });
            }
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
         * Adds tooltips to maximize and close the console
         */
        function addToolTip(div) {
            div.childNodes[0].setAttribute("tooltip", "Maximize");
            div.childNodes[2].setAttribute("tooltip", "Close Console");
        }

        /*
         * Find the console buttons and add tooltips
         */
        function addTooltips() {

            // adds tooltips as a callback after the consoleButtons are created
            imports.console.getElement("consoleButtons", addToolTip);
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
                        "Less Comfortable mode" : {
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
                        }
                    }
                }
            }, plugin);
        }

        /*
         * Show the CS50 IDE readme in a new tab when the "About CS50 IDE"
         * button is clicked
         */
        function displayReadme() {

            // Shows CS50 IDE readme
            tabManager.open({
            value      : "https://cs50.readme.io/",
            editorType : "urlview",
            active     : true,
            document   : {title : "About CS50 IDE"},
            }, function(err, tab) {
                if (err) return err;
            });
        }

        /*
         * Edit the "Cloud9" menu to be appropriately tailored to CS50 IDE
         */
        function loadMainMenuInfo(plugin) {

            // edits "Cloud9" main tab to display "CS50 IDE"
            menus.get("Cloud9").item.setAttribute("caption", "CS50 IDE");

            // creates the "About CS50 IDE" item
            var about = new ui.item({
                id     : "aboutCS50IDE",
                caption: "About CS50 IDE",
                onclick: displayReadme
            });

            // creates divider below toggle
            var div = new ui.divider();

            // places it in CS50 IDE tab
            menus.addItemByPath("Cloud9/About CS50 IDE", about, 0, plugin);
            menus.addItemByPath("Cloud9/Div", div, 10, plugin);

            // hide option as unneeded
            setMenuVisibility("Cloud9/Restart Cloud9", false);
        }

        /*
         * Locates user profile and assigns to global variable
         */
        function locateProfile() {

            // Locate current user's profile menu
            var bar = layout.findParent({ name: "preview" }).nextSibling;
            var profiles = bar.childNodes;
            for (var p in profiles) {
                if (profiles[p].$position == 600) {
                    profileMenu = profiles[p].submenu;
                    break;
                }
            }
        }

        /*
         * New logout function, redirects to appropriate page
         */
        function customLogout() {

            // Logs out, then redirects to CS50 login page
            auth.logout();
            window.location.replace("https://cs50.io/web/login");
        }

        /*
         * Change logout to take back to dashboard rather than sign in
         */
        function editProfileMenu(plugin) {
            if (profileMenu === null) return;

            // Hide old log out
            profileMenu.lastChild.setAttribute("visible", false);

            // Create new log out ui item
            var newLogout = ui.item({
                id     : "newLogout",
                caption: "Log Out",
                tooltip: "Log Out",
                onclick: customLogout
            });

            // Place in submenu
            menus.addItemToMenu(profileMenu, newLogout, 1000, plugin);
        }

        function updateProfileScripts() {
            commands.addCommand({
                name: "cs50updateProfileScripts",
                hint: "cs50 IDE Updating of Profile Scripts",
                group: "General",
                exec: function () {
                    // Stores an array of Tab objects into 'array'
                    var array = tabManager.getTabs();
                    var i = 0;
                    var arrayLength = array.length;
                    var str1 = "terminal";

                    // Go through the array of Tabs and find the terminal
                    for(i = 0; i < arrayLength; i++){
                        if(str1.localeCompare(array[i].editorType) === 0){
                            //Activate the terminal tab
                            var tab = array[i];
                            tabManager.activateTab(tab);

                            /***
                             * The below variable updateCommand can be changed to any
                             * unix command. It must be terminated with '\n' to ensure
                             * the command runs in the terminal.
                             */

                            // Get previously stored setting of warning window
                            var prevSetting = settings.getBool("user/clipboard/@dontshow");

                            // Set Clipboard Warning to "Don't Show"
                            settings.set("user/clipboard/@dontshow", true);

                            // Get previously set data
                            var prevData = clipboard.clipboardData.getData("text/plain");

                            // Set the variable updateCommand to be the command that updates the terminal
                            var updateCommand = " source /etc/profile && source /home/ubuntu/.bashrc\n";

                            // Copy to the clipboard the data stored in updateCommand
                            clipboard.clipboardData.setData("text/plain", updateCommand);

                            // Pastes in the active Tab (the terminal) the command stored in the clipboard
                            tab.editor.paste();

                            // Set clipboard back to previous stored data
                            clipboard.clipboardData.setData("text/plain", prevData);

                            //Set clipboard setting back to original setting
                            settings.set("user/clipboard/@dontshow", prevSetting);
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
            if (typeof override === "boolean")
                lessComfortable = override;
            else {
                // Toggles comfort level
                lessComfortable = !lessComfortable;
                settings.set("user/cs50/simple/@lessComfortable", lessComfortable);
            }

            // Toggles features
            toggleMenus(lessComfortable);
            togglePreview(lessComfortable);
            toggleStatusBar(lessComfortable);
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
            if (tab && tab.editorType == "terminal"){
                var session = tab.document.getSession();
                tab.document.on("setTitle", function(e) {
                    // the substring that must be removed
                    var substring = ' - ""';
                    // if the substring is found in either e.title or the tab title replace it everywhere with empty string
                    if(e.title.indexOf(substring) > -1 || tab.document.title.indexOf(substring) > -1){
                        e.title = tab.document.title = session.doc.title =
                        session.doc.tooltip = tab.document.title.replace(/ - ""/, "");
                    }
                }, plugin);
            }
        }

        /*
         * Set the HTML page title based on a tab's title
         */
        function updateTitle(tab) {
            document.title = tab && settings.getBool("user/tabs/@title") && tab.title
                ? tab.title + " - CS50 IDE"
                : c9.projectName + " - CS50 IDE";
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

        function addSoundToTerminal() {
            /*
            adds a beep sound to the terminal
            by inserting a script into the user's init.js file.
            */
            var presentContent = String(settings.get("user/config/init.js"));
            if (presentContent.search('prototype.bell') !== -1)
                return;

            var beepSound = require('text!./templates/beepsound.templates');
            settings.set("user/config/init.js",beepSound.concat(presentContent));
        }

        /*
         * Sets the initial icon in the avatar menu toolbar
         */
        function setIcon(err, user) {
            if (!USER || !USER.hasOwnProperty("id"))
                return;

            // Set global var USER
            USER = user;

            var currentMenu = menus.get("user_" + USER.id);
            // If offline IDE, return
            if (currentMenu.item === undefined || currentMenu.menu === undefined)
                return;

            prefs.add({
               "CS50" : {
                    position: 5,
                    "IDE Behavior" : {
                        position: 10,
                        "Gravatar" : {
                            type: "checkbox",
                            setting: "user/cs50/simple/@gravatarIcon",
                            min: 1,
                            max: 200,
                            position: 190
                        }
                    }
                }
            }, plugin);

            toggleIcon();
        }

        /*
         * Function that will change the Avatar Menu Icon, depending on toggle switch
         */

        function toggleIcon() {
            if (USER === null)
                return;

            var currentMenu = menus.get("user_" + USER.id);
            if (currentMenu.item === undefined || currentMenu.menu === undefined)
                return;

            // Get the avatar button
            var button = currentMenu.item;
            var icon = util.getGravatarUrl(USER.email, 32, "");

            if (settings.get("user/cs50/simple/@gravatarIcon")) {
                button.$ext.getElementsByClassName("icon")[0].style.backgroundImage = "url(" + icon + ")";
            }else {
                button.$ext.getElementsByClassName("icon")[0].style.backgroundImage = "url(" + cloud9Icon + ")";
            }
        }

        /*
         * Function that will rename "Quit Cloud9" menu button to "Log Out" in Online IDEs
         */

        function renameQuitCloud9() {
            var item = menus.get("Cloud9/Quit Cloud9").item;

            if (item === undefined)
                return;

            item.setAttribute("caption", "Log Out");
        }

        /* 
         * Function that will move the "Go To Your Dashboard" Menu Item below divider
         * If offline IDE it removes the "Go To Your Dashboard" item
         */

         function moveGoToYourDashboard() {
            if (!c9.hosted){
                menus.remove("Cloud9/Go To Your Dashboard");
            } else {
                menus.addItemByPath("Cloud9/Go To Your Dashboard", menus.get("Cloud9/Go To Your Dashboard").item, 2000060, plugin);
            }
         }

        /*
         * Function that will hide the Avatar Menu in Offline IDEs.
         * This function needs to be here if simple will consume login.
         */

        function hideAvatarMenuOffline() {
            var bar = layout.findParent({name: "preferences"});
            var button;
            for (var i = 0; i < bar.childNodes.length; i++) {
                if (bar.childNodes[i].icon.indexOf("gravatar") > -1) {
                    button = bar.childNodes[i];
                    break;
                }
            }
            hide(button);
        }

        /***** Initialization *****/

        var loaded = false;
        function load() {
            if (loaded)
               return false;
            loaded = true;

            // Adds the permanent changes
            addToggle(plugin);
            addTooltips();
            updateFontSize();
            locateProfile();
            loadMainMenuInfo(plugin);
            editProfileMenu(plugin);
            setTitlesFromTabs();
            addSoundToTerminal();
            updateProfileScripts();
            renameQuitCloud9();
            var ver = settings.getNumber("user/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // show asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", true);
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
            }

            settings.on("read", function(){
                settings.setDefaults("user/cs50/simple", [
                    ["lessComfortable", true],
                    ["undeclaredVars", true],
                    ["gravatarIcon", false]
                ]);
            });

            // When less comfortable option is changed
            settings.on("user/cs50/simple/@lessComfortable", function (saved) {
                if (saved != lessComfortable) {
                    menus.click("View/Less Comfortable");
                }
            }, plugin);
            toggleSimpleMode(settings.get("user/cs50/simple/@lessComfortable"));

            settings.on("user/cs50/simple/@gravatarIcon", toggleIcon, plugin);

            moveGoToYourDashboard();

            // If offline, hide avatar menu
            if (!c9.hosted) {
                hideAvatarMenuOffline();
            } else {
                // Set the initial icon based on previous settings (if none, set c9 logo)
                info.getUser(setIcon);
            }
        }

        /***** Lifecycle *****/

        plugin.on("load", function(){
            load();
        });

        plugin.on("unload", function() {
            toggleSimpleMode(false);
            loaded = false;
            lessComfortable = false;
            profileMenu = null;
            divider = null;
        });

        /***** Register and define API *****/

        /**
         * Left this empty since nobody else should be using our plugin
         **/
        plugin.freezePublicAPI({ });

        register(null, { "c9.ide.cs50.simple" : plugin });
    }
});
