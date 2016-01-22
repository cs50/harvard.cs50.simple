define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "settings", "commands", "ui", "layout", "menus"
    ];
    
    main.provides = ["cs50.themes"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;

        /***** Initialization *****/
    
        var plugin = new Plugin("CS50", main.consumes);
        var toggleButton = null;

        function load() {
            // includes style.css (night/day toggle classes)
            ui.insertCss(require("text!./style.css"), options.staticPrefix, plugin);
            
            // change button when there is a change of theme
            settings.on("write", function(e) {
                styleButton();
            }, plugin);
        
            // add the command for the toggle button
            commands.addCommand({
                name: "cs50toggleThemes",
                hint: "CS50 Toggle Theme",
                group: "General",
                exec: toggleTheme
            }, plugin);
                
            // create the button
            toggleButton = new ui.button({
                "skin"      : "c9-menu-btn",
                "id"        : "toggleButton",
                "localName" : "toggleButton",
                "caption"   : "",
                "tooltip"   : "CS50 Toggle Theme",
                "command"   : "cs50toggleThemes",
                "visible"   : true
            });

            // style the button, of course!
            styleButton();
            
            // finally insert it in the preview bar
            ui.insertByIndex(layout.findParent({
                name: "preview"
            }), toggleButton, 800, plugin);
        }
        
        /***** Methods *****/
        
        /*
         * Switches skin/theme accordingly
         * By default, if dark skin, change to light skin with cloud9_day theme (vice-versa)
         */ 

        function toggleTheme() {
            var current = settings.get("user/general/@skin");
            var theme, skin;
            
            if (current == "flat-dark" || current == "dark") {
                theme = "ace/theme/cloud9_day";
                skin = "flat-light";
            } else {
                theme = "ace/theme/cloud9_night";
                skin = "flat-dark";
            }
            
            settings.set("user/ace/@theme", theme);
            settings.set("user/general/@skin", skin);
        }
        
        /*
         * Styles the toggle button according to skin type
         */
        function styleButton() {
            var btnClass, current;
            current = settings.get("user/general/@skin");
            
            if (current == "flat-dark" || current == "dark")
                btnClass = "day-toggle";
            else
                btnClass = "night-toggle";
            
            toggleButton.setAttribute("class", btnClass);
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.on("unload", function() {
            toggleButton = null;
        });
        
        /***** Register and define API *****/
        
        // api is just show and hide anyway
        plugin.freezePublicAPI({
             _events: [
                /**
                 * @event show The plugin is shown
                 */
                "show",

                /**
                 * @event hide The plugin is hidden
                 */
                "hide"
            ],

            /**
             * Show the plugin
             */
            show: plugin.show,

            /**
             * Hide the plugin
             */
            hide: plugin.hide
        });
        
        register(null, {
            "cs50.themes": plugin
        });
    }
});