define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "layout", "Dialog", "proc"
    ];
    main.provides = ["cs50.stats"];
    return main;

    function main(options, imports, register) {
        var ui = imports.ui;
        var menus = imports.menus;
        var commands = imports.commands;
        var layout = imports.layout;
        var Dialog = imports.Dialog;
        var proc = imports.proc;

        /***** Initialization *****/

        var plugin = new Dialog("CS50", main.consumes, {
            name: "CS50 Stats",
            allowClose: true,
            title: "CS50 IDE Stats",
            heading: "",
            modal: true
        });

        var showing;
        function load() {
            showing = false;
            commands.addCommand({
                name: "cs50dialog",
                hint: "CS50 features",
                group: "General",
                exec: toggle
            }, plugin);

            var btn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "CS50",
                "tooltip" : "CS50 features",
                // "width"   : 80,
                "command" : "cs50dialog"
            });

            menus.addItemByPath("Window/~", new ui.divider(), 33, plugin);
            menus.addItemByPath("Window/CS50...", new ui.item({
                command: "cs50dialog"
            }), 34, plugin);

            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), btn, 860, plugin);

        }

        function toggle() {
            if (showing) {
                plugin.hide();
            }
            else {
                plugin.show();
            }
        }

        plugin.on("show", function () {
            showing = true;
            var version, hostname, apache;
            proc.execFile("version50", {
                cwd: "/home/ubuntu/workspace"
            }, function(err, stdout, stderr) {
                if (err) return console.error(err);
                version = stdout.trim();
                proc.execFile("hostname50", {
                    cwd: "/home/ubuntu/workspace"
                }, function(err, stdout, stderr) {
                    if (err) return console.error(err);
                    hostname = "https://" + stdout.trim();
                    proc.execFile("service", {
                        args: ["apache2", "status"],
                        cwd: "/home/ubuntu/workspace"
                    }, function(err, stdout, stderr) {
                        if (err && err.code !== 0) {
                            apache = "Not Running";
                        }
                        else {
                            apache = "Running!";
                        }
                        var str = '<table><col width="100">'+
                          "<tr><td>IDE Version</td><td>"+version+"</td></tr>"+
                          "<tr><td>Apache</td><td>"+apache+"</td></tr>"+
                          '<tr><td>Hostname</td><td><a href="'+hostname+
                          '" target="_blank">'+hostname+"</td></tr></table>";
                        plugin.body = str;
                        plugin.show();
                        return;
                    });
                    return;
                });
                return;
            });
        });

        plugin.on("hide", function () {
            showing = false;
            plugin.hide();
        });

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            showing = false;
        });

        /***** Register and define API *****/

        /**
         * This is an example of an implementation of a plugin.
         * @singleton
         */
        plugin.freezePublicAPI({
            /**
             * @property showing whether this plugin is being shown
             */
            get showing(){ return showing; },

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
            hide: plugin.hide,
        });

        register(null, {
            "cs50.stats": plugin
        });
    }
});
