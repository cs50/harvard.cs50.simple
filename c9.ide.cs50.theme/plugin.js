define(function(require, exports, module) {

    // APIs consumed
    main.consumes = [
        "commands", "layout", "menus", "Plugin", "settings", "ui"
    ];

    // APIs provided
    main.provides = ["harvard.cs50.theme"];

    // plugin
    return main;

    /**
     * Implements plugin.
     */
    function main(options, imports, register) {

        // instantiate plugin
        var plugin = new imports.Plugin("CS50", main.consumes);

        // button for menu
        var button = null;

        // when plugin is loaded
        plugin.on("load", function() {

            // create button
            button = new imports.ui.button({
                "command": "toggleTheme",
                "skin": "c9-menu-btn",
                "tooltip": "Toggle Theme",
                "visible": true
            });

            // register command for button
            imports.commands.addCommand({
                exec: toggleTheme,
                group: "CS50",
                name: "toggleTheme"
            }, plugin);

            // load CSS for button
            imports.ui.insertCss(require("text!./styles.css"), options.staticPrefix, plugin);

            // style button
            styleButton();
            
            // re-style button whenever theme changes
            imports.settings.on("user/general/@skin", function(value) {
                styleButton();
            }, plugin);

            // insert button into menu
            imports.ui.insertByIndex(imports.layout.findParent({
                name: "preferences"
            }), button, 0, plugin);
        });

        // when plugin is unloaded
        plugin.on("unload", function() {
            button = null;
        });

        // register plugin
        register(null, {
            "harvard.cs50.theme": plugin
        });

        /**
         * Styles button based on current theme.
         */
        function styleButton() {
            var theme = imports.settings.get("user/general/@skin");
            var btnClass = (theme === "flat-dark") ? "harvard-cs50-theme-dark" : "harvard-cs50-theme-light";
            button.setAttribute("class", btnClass);
        }
        
        /**
         * Toggles theme from dark to light or from light to dark.
         */
        function toggleTheme() {
            var theme = imports.settings.get("user/general/@skin");
            var kind = (theme === "flat-dark" || theme === "dark") ? "light" : "dark";
            imports.layout.proposeLayoutChange(kind, true);
        }
    }
});
