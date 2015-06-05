define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "layout", "Dialog",
        "settings", "proc"
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
        var settings = imports.settings;

        /***** Initialization *****/

        var plugin = new Dialog("CS50", main.consumes, {
            name: "CS50 Stats",
            allowClose: true,
            title: "CS50 IDE Stats",
            heading: "",
            modal: true
        });

        var versionBtn, hostnameBtn, cs50Btn;

        var stats = {}, timer = null, delay, verbose;

        var showing;
        function load() {
            showing = false;

            settings.on("read", function(){
                settings.setDefaults("user/cs50/stats", [
                    ["refreshRate", delay],
                    ["verboseButtons", true]
                ]);
            });

            // watch for settings change and update accordingly
            settings.on("write", function() {
                // fetch new rate, stopping timer to allow restart with new val
                var rate = settings.getNumber("user/cs50/stats/@refreshRate");
                var ver = settings.getBool("user/cs50/stats/@verboseButtons");

                if (delay != rate) {
                    // validate new rate, overwriting bad value if necessary
                    if (rate < 1) {
                        delay = 30;
                        settings.set("user/cs50/stats/@refreshRate", delay);
                    } else {
                        delay = rate;
                    }

                    // update stats and timer interval
                    updateStats();
                    stopTimer();
                    if (ver) startTimer();
                }

                if (verbose != ver) {
                    verbose = ver;
                    updateVerbosity();
                }
            });

            delay = settings.getNumber("user/cs50/stats/@refreshRate");
            verbose = settings.getBool("user/cs50/stats/@verboseButtons");

            commands.addCommand({
                name: "cs50statsDialog",
                hint: "CS50 IDE Workspace Stats",
                group: "General",
                exec: toggle
            }, plugin);

            menus.addItemByPath("Window/~", new ui.divider(), 33, plugin);
            menus.addItemByPath("Window/CS50 Workspace Stats...", new ui.item({
                command: "cs50statsDialog"
            }), 34, plugin);

            // CS50 button
            cs50Btn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "CS50",
                "tooltip" : "CS50 IDE Workspace Stats",
                "command" : "cs50statsDialog",
                "visible" : false
            });

            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), cs50Btn, 860, plugin);

            // create version button
            versionBtn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Workspace Version",
                "command" : "cs50statsDialog",
                "visible" : false
            });

            // place version button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), versionBtn, 860, plugin);

            // create hostname button and place it
            hostnameBtn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Workspace Hostname",
                "command" : "cs50statsDialog",
                "visible" : false
            });

            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), hostnameBtn, 860, plugin);

            updateStats();
            updateVerbosity();
        }

        function updateVerbosity() {
            if (verbose) {
                cs50Btn.setAttribute("visible", false);
                versionBtn.setAttribute("visible", true);
                hostnameBtn.setAttribute("visible", true);
                startTimer();
            }
            else {
                stopTimer();
                versionBtn.setAttribute("visible", false);
                hostnameBtn.setAttribute("visible", false);
                cs50Btn.setAttribute("visible", true);
            }
        }

        function updateStats(callback) {
            proc.execFile("stats50", {
                cwd: "/home/ubuntu/workspace"
            }, function(err, stdout, stderr) {
                parseStats(err, stdout, stderr);
                callback && callback();
            });
        }

        function stopTimer() {
            if (timer == null) return;

            window.clearInterval(timer);
            timer = null;
        }

        function startTimer() {
            if (timer != null) return;
            if (!settings.getBool("user/cs50/stats/@verboseButtons")) return;

            timer = window.setInterval(updateStats, delay * 1000);
        }

        function parseStats(err, stdout, stderr) {
            if (err) {
                stats = {
                    "host": "!",
                    "apache": "Unknown",
                    "listening": false,
                    "version": "!"
                };
                hostnameBtn.setCaption("Run update50!");
                versionBtn.setCaption("");
                cs50Btn.setCaption("Run update50!");
                plugin.body = "<p>Error: Please run update50!</p>";
                return;
            }

            // stats50 returns json object of data
            stats = JSON.parse(stdout);

            hostnameBtn.setCaption(stats.host);
            versionBtn.setCaption(stats.version);

            var str = '<table><col width="100">' +
              "<tr><td>IDE Version</td><td>" + stats.version+"</td></tr>" +
              "<tr><td>Apache</td><td>" + stats.apache + "</td></tr>"+
              "<tr><td>Hostname</td><td>";

            // display a link if we're listening
            if (stats.listening) {
              str += '<a href="https://'+stats.host+'" target="_blank">' +
                     stats.host + '</a>';
            }
            else {
                // no link!
                str += stats.host;
            }
            str += "</td></tr></table>";
            plugin.body = str;
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
            updateStats(function() {
                plugin.show();
            });
        });

        plugin.on("hide", function () {
            updateVerbosity();
            showing = false;
            plugin.hide();
        });

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            stopTimer();

            delay = 30;
            verbose = true;
            stats = {};
            timer = null;
            showing = false;
            cs50Btn = null;
            versionBtn = null;
            hostnameBtn = null;
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
