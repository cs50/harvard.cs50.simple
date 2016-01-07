define(function(require, exports, module) {
    main.consumes = ["Plugin", "settings", "commands", "ui", "layout", "ace"];
    main.provides = ["cs50.themes"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var settings = imports.settings;
        var commands = imports.commands;
        var ui = imports.ui;
        var layout = imports.layout;
        var ace = imports.ace;

        /***** Initialization *****/
    
        var plugin = new Plugin("CS50", main.consumes);

        function load() {
            settings.on("write", function(e) {
                style_button();
            }, plugin);
            
            commands.addCommand({
                name: "cs50toggleThemes",
                hint: "CS50 Toggle Theme",
                group: "General",
                exec: toggle_theme
            }, plugin);
                
            var toggle_button = new ui.button({
                "skin"      : "c9-menu-btn",
                "id"        : "toggle_button",
                "localName" : "toggle_button",
                "caption"   : "",
                "tooltip"   : "CS50 Toggle Theme",
                "command"   : "cs50toggleThemes",
                "visible"   : true
            });
            
            style_button();
            
            ui.insertByIndex(layout.findParent({
                name: "preview"
            }), toggle_button, 800, plugin);
        }
        
        /***** Methods *****/
        
        function toggle_theme() {
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
        
        function style_button() {
            var img, current;
            current = settings.get("user/general/@skin");
            
            if (current == "flat-dark" || current == "dark")
                img = "background-image: url(https://www.dropbox.com/s/yj62nb8ui25u340/day.png?raw=1)";
            else
                img = "background-image: url(https://www.dropbox.com/s/71g1adoxa9q6deg/night.png?raw=1);";
                
            var toggle_button = plugin.getElement("toggle_button", function(btn) {
               btn.setAttribute("style", "background-size: contain; width: 40px;" + img); 
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        
        plugin.on("unload", function() {
        
        });
        
        /***** Register and define API *****/
        
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