define(function(require, exports, module) {

    // libraries    
    var _ = require("lodash");
    var querystring = require('querystring');

    // APIs consumed
    main.consumes = [
        "commands", "layout", "menus", "Plugin", "settings", "ui"
    ];

    // APIs provided
    main.provides = ["harvard.cs50.open"];

    // plugin
    return main;

    /**
     * Implements plugin.
     */
    function main(options, imports, register) {

        // instantiate plugin
        var plugin = new imports.Plugin("CS50", main.consumes);

        // when plugin is loaded
        plugin.on("load", function() {

            // http://stackoverflow.com/a/2880929/5156190            
            (window.onhashchange = function() {
                
                // if hash starts with hash-bang
                if (window.location.hash.substr(0, 2) === "#!") {
                    var parameters = querystring.parse(window.location.hash.substr(2));
                    if (_.has(parameters, 'file')) {
                        // TODO
                    }
                }
            })();
            
        });

        // when plugin is unloaded
        plugin.on("unload", function() {
            // TODO
        });

        // register plugin
        register(null, {
            "harvard.cs50.open": plugin
        });
    }
});
