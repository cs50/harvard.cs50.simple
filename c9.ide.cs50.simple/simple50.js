/**
 * CS50 IDE
 * Simplifies Cloud9 IDE for those less comfortable.
 *
 */
define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "ace", "ace.status", "auth", "commands", "console", "Divider",
        "immediate", "keymaps", "layout", "Menu", "MenuItem", "menus", "mount",
        "panels", "preferences", "preview", "run.gui", "save", "settings",
        "tabManager", "terminal", "tooltip", "tree", "ui", "c9"
    ];
    main.provides = ["cs50.simple"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var status = imports["ace.status"];
        var basename = require("path").basename;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var panels = imports.panels;
        var auth = imports.auth;
        var prefs = imports.preferences;

        var plugin = new Plugin("CS50", main.consumes);

        var SETTINGS_VER = 2;

        // the title to set Terminal tabs
        var TERMINAL_TITLE = "Terminal";

        var lessComfortable = true;
        var profileMenu = null;
        var complexMenus = findComplexMenus();

        // code from gui.js
        function findTabToRun(){
            var path = tabs.focussedTab && tabs.focussedTab.path;
            if (path) return path.replace(/^\//, "");

            var foundActive;
            if (tabs.getPanes().every(function(pane) {
                var tab = pane.activeTab;
                if (tab && tab.path) {
                    if (foundActive) return false;
                    foundActive = tab;
                }
                return true;
            }) && foundActive) {
                return foundActive.path.replace(/^\//, "");
            }

            return false;
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
         * Finds the complex menus that this plugin removes
         */
        function findComplexMenus() {
            var complexMenus = [];

            // Cloud9 Menu
            complexMenus.push(menus.get("Cloud9/Open Your Project Settings"));
            complexMenus.push(menus.get("Cloud9/Open Your User Settings"));
            complexMenus.push(menus.get("Cloud9/Open Your Keymap"));
            complexMenus.push(menus.get("Cloud9/Open Your Init Script"));
            complexMenus.push(menus.get("Cloud9/Open Your Stylesheet"));


            // File Menu
            complexMenus.push(menus.get("File/Revert to Saved"));
            complexMenus.push(menus.get("File/Revert All to Saved"));
            complexMenus.push(menus.get("File/Mount FTP or SFTP server"));
            complexMenus.push(menus.get("File/Line Endings"));
            complexMenus.push(menus.get("File/New Plugin"));

            // Edit Menu
            complexMenus.push(menus.get("Edit/Line/Move Line Up"));
            complexMenus.push(menus.get("Edit/Line/Move Line Down"));
            complexMenus.push(menus.get("Edit/Line/Copy Lines Up"));
            complexMenus.push(menus.get("Edit/Line/Copy Lines Down"));
            complexMenus.push(menus.get("Edit/Line/Remove Line"));
            complexMenus.push(menus.get("Edit/Line/Remove to Line End"));
            complexMenus.push(menus.get("Edit/Line/Remove to Line Start"));
            complexMenus.push(menus.get("Edit/Line/Split Line"));
            complexMenus.push(menus.get("Edit/Keyboard Mode"));
            complexMenus.push(menus.get("Edit/Selection"));
            complexMenus.push(menus.get("Edit/Text"));
            complexMenus.push(menus.get("Edit/Code Folding"));
            complexMenus.push(menus.get("Edit/Code Formatting"));

            // View Menu
            complexMenus.push(menus.get("View/Syntax"));
            complexMenus.push(menus.get("View/Wrap Lines"));
            complexMenus.push(menus.get("View/Wrap to Print Margin"));

            // Goto Menu
            complexMenus.push(menus.get("Goto/Goto Anything..."));
            complexMenus.push(menus.get("Goto/Goto Symbol..."));
            complexMenus.push(menus.get("Goto/Word Right"));
            complexMenus.push(menus.get("Goto/Word Left"));
            complexMenus.push(menus.get("Goto/Scroll to Selection"));

            // Run Menu
            complexMenus.push(menus.get("Run"));

            // Tools Menu
            complexMenus.push(menus.get("Tools"));

            // Window Menu
            complexMenus.push(menus.get("Window/New Immediate Window"));
            complexMenus.push(menus.get("Window/Installer..."));
            complexMenus.push(menus.get("Window/Navigate"));
            complexMenus.push(menus.get("Window/Commands"));

            return complexMenus;
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
        function toggleMenus(complexMenus, lessComfortable) {

            // toggles visibility of each menu item
            complexMenus.forEach(function(element, index, array) {
                if (element.item) {
                    element.item.setAttribute("visible", !lessComfortable);
                }
            });


            // Tidy up dividers
            menus.get("File").menu.childNodes[14].setAttribute("visible", !lessComfortable);
            menus.get("Edit").menu.childNodes[6].setAttribute("visible", !lessComfortable);
            menus.get("Goto").menu.childNodes[7].setAttribute("visible", !lessComfortable);
            menus.get("Goto").menu.childNodes[16].setAttribute("visible", !lessComfortable);
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
        }

        /*
         * Switches the Run button to say Debug
         */
        function runToDebug() {
            var runButton = layout.findParent({ name: "preview" }).childNodes[2];
            runButton.$ext.childNodes[3].innerHTML = "Debug";

            function updateTip() {
                var path = basename(findTabToRun());
                runButton.setAttribute("tooltip", "Run and debug " + path);
            }

            // Updates the tooltip to Run and debug
            updateTip();
            tabs.on("focus", updateTip);
        }

        /*
         * Toggles the button in top left that minimizes the menu bar
         */
        function toggleMiniButton(lessComfortable) {
            var miniButton = layout.findParent(menus).childNodes[0].childNodes[0];
            lessComfortable ? hide(miniButton) : show(miniButton);
        }

        /*
         * Toggles the left Navigate and Commands side tabs
         */
        function toggleSideTabs(lessComfortable) {

            // Only shows tabs automatically when less comfortable is disabled
            lessComfortable ? panels.disablePanel("navigate") : panels.enablePanel("navigate");
            lessComfortable ? panels.disablePanel("commands.panel") : panels.enablePanel("commands.panel");
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
                        toggle(menuItems[4]) &&
                        toggle(menuItems[5]) &&
                        toggle(menuItems[6])) {
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
            var div = new ui.divider();

            // places it in View tab
            menus.addItemByPath("View/Less Comfortable", toggle, 0, plugin);
            menus.addItemByPath("View/Div", div, 10, plugin);

            // Add preference pane button
            prefs.add({
               "CS50" : {
                    position: 5,
                    "Less Comfortable" : {
                        position: 10,
                        "Toggle less comfortable mode" : {
                            type: "checkbox",
                            setting: "user/cs50/@lessComfortable",
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
            document   : {title : "CS50 Readme"},
            }, function(err, tab) {
                 if(err) return err;
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

            // hide quit and restart cloud9 ui elements in CS50 IDE section
            menus.get("Cloud9/Restart Cloud9").item.setAttribute("visible", false);
            menus.get("Cloud9/Quit Cloud9").item.setAttribute("visible", false);
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
                caption: "Log out",
                tooltip: "Log out",
                onclick: customLogout
            });

            // Place in submenu
            menus.addItemToMenu(profileMenu, newLogout, 1000, plugin);
        }

        /*
         * Creates a button to change Terminal font size
         */
        function terminalFontSizeButton() {

            // Add keyboard hotkeys
            commands.addCommand({
                name: "largerterminalfont",
                hint: "increase terminal font size",
                bindKey: { mac: "Command-Ctrl-=|Command-Ctrl-+",
                           win: "Meta-Ctrl-=|Meta-Ctrl-+" },
                group: "Terminal",
                exec: function() {
                    var fsize = settings.getNumber("user/terminal/@fontsize");

                    // default size
                    if (fsize == 0)
                        fsize = 12;

                    // increase size, unless it will take us over 72
                    fsize = ++fsize > 72 ? 72 : fsize;

                    // Update both the int and string forms of fontsize
                    settings.set("user/terminal/@fontsize", fsize);
                }
            }, plugin);

            commands.addCommand({
                name: "smallerterminalfont",
                hint: "decrease terminal font size",
                bindKey: { mac: "Command-Ctrl--", win: "Meta-Ctrl--" },
                group: "Terminal",
                exec: function() {
                    var fsize = settings.getNumber("user/terminal/@fontsize");

                    // default size
                    if (fsize == 0)
                        fsize = 12;

                    // decrease size, unless it will take us below 1
                    fsize = --fsize < 1 ? 1 : fsize;

                    // Update both the int and string forms of fontsize
                    settings.set("user/terminal/@fontsize", fsize);
                }
            }, plugin);

            menus.addItemByPath("View/Terminal Font Size/", null, 290000, plugin);
            menus.addItemByPath("View/Terminal Font Size/Increase Terminal Font Size",
                new ui.item({
                    caption: "Increase Terminal Font Size",
                    command: "largerterminalfont"
                }), 100, plugin);
            menus.addItemByPath("View/Terminal Font Size/Decrease Terminal Font Size",
                new ui.item({
                    caption: "Decrease Terminal Font Size",
                    command: "smallerterminalfont",
                }), 200, plugin);
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
            toggleMenus(complexMenus, lessComfortable);
            togglePreview(lessComfortable);
            toggleStatusBar(lessComfortable);
            toggleMiniButton(lessComfortable);
            toggleSideTabs(lessComfortable);
            togglePlus(lessComfortable);

            // Makes sure that the checkbox is correct
            menus.get("View/Less Comfortable").item.checked = lessComfortable;

        }

        /*
         * Disable Tmux title update and force Terminal tabs to one title
         */
        function disableTmuxTitle(tab) {
            if (tab && tab.editorType == "terminal") {
                var terminal = tab.document.getSession().terminal;
                if (terminal)
                    terminal.removeAllListeners("title"); // disable updating title
                tab.document.title = TERMINAL_TITLE;
                tab.document.on("setTitle", function(e) {
                    if (e.title != TERMINAL_TITLE)
                        tab.document.title = TERMINAL_TITLE;
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
                disableTmuxTitle(tab);
            });

            // future tabs
            tabManager.on("open", function wait(e) {
                disableTmuxTitle(e.tab);
            }, plugin);

            // udpate document title once
            updateTitle(tabManager.focussedTab);

            // update document title when tabs change
            tabManager.on("focusSync", function(e){ updateTitle(e.tab); });
            tabManager.on("tabDestroy", function(e){ if (e.last) updateTitle(); });
            settings.on("user/tabs", function(){ updateTitle(tabManager.focussedTab); });
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
            runToDebug();
            terminalFontSizeButton();
            locateProfile();
            loadMainMenuInfo(plugin);
            editProfileMenu(plugin);
            setTitlesFromTabs();

            var ver = settings.getNumber("user/cs50/simple/@ver");
            if (isNaN(ver) || ver < SETTINGS_VER) {
                // show asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", true);
                // Turn off auto-save by default
                settings.set("user/general/@autosave", false);
                settings.set("user/cs50/simple/@ver", SETTINGS_VER);
            }

            settings.on("read", function(){
                settings.setDefaults("user/cs50/simple", [
                    ["lessComfortable", true]
                ]);
            });

            // When less comfortable option is changed
            settings.on("write", function(){
                if (settings.get("user/cs50/simple/@lessComfortable") != lessComfortable) {
                    menus.click("View/Less Comfortable");
                }
            });

            toggleSimpleMode(settings.get("user/cs50/simple/@lessComfortable"));

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
        });

        /***** Register and define API *****/

        /**
         * Left this empty since nobody else should be using our plugin
         **/
        plugin.freezePublicAPI({ });

        register(null, { "cs50.simple" : plugin });
    }
});

