define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "layout", "Dialog",
        "settings", "proc", "preferences"
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
        var prefs = imports.preferences;

        /***** Initialization *****/

        var plugin = new Dialog("CS50", main.consumes, {
            name: "CS50 Stats",
            allowClose: true,
            title: "CS50 IDE Workspace Stats",
            modal: true
        });

        var versionBtn, hostnameBtn, cs50Btn;   // UI button elements

        var DEFAULT_REFRESH = 30;   // default refresh rate
        var delay;                  // current refresh rate
        var fetching;               // are we fetching data
        var html = null;            // object with references to html els
        var showing;                // is the dialog showing
        var stats = null;           // last recorded stats
        var timer = null;           // javascript interval ID

        function load() {
            showing = false;
            fetching = false;

            // set default values
            settings.on("read", function(){
                settings.setDefaults("user/cs50/stats", [
                    ["refreshRate", DEFAULT_REFRESH]
                ]);
            });

            // watch for settings change and update accordingly
            settings.on("write", function() {
                // fetch new rate, stopping timer to allow restart with new val
                var rate = settings.getNumber("user/cs50/stats/@refreshRate");

                if (delay != rate) {
                    // validate new rate, overwriting bad value if necessary
                    if (rate < 1) {
                        delay = DEFAULT_REFRESH;
                        settings.set("user/cs50/stats/@refreshRate", delay);
                    } else {
                        delay = rate;
                    }

                    // update stats and timer interval
                    updateStats();
                    stopTimer();
                    startTimer();
                }
            });

            // fetch setting information
            delay = settings.getNumber("user/cs50/stats/@refreshRate");

            // notify UI of the function to run to open the dialog
            commands.addCommand({
                name: "cs50statsDialog",
                hint: "CS50 IDE Workspace Stats",
                group: "General",
                exec: toggle
            }, plugin);

            // notify UI of the function to open the host in a new tab
            commands.addCommand({
                name: "openDomain",
                hint: "CS50 IDE Workspace Host",
                group: "General",
                exec: loadHost
            }, plugin);

            // add a menu item to show the dialog
            menus.addItemByPath("Window/~", new ui.divider(), 33, plugin);
            menus.addItemByPath("Window/CS50 Workspace Stats...", new ui.item({
                command: "cs50statsDialog"
            }), 34, plugin);

            // create CS50 button
            cs50Btn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Workspace Stats",
                "command" : "cs50statsDialog",
                "visible" : true
            });

            // place CS50 button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), cs50Btn, 860, plugin);

            // create version button
            versionBtn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Workspace Version",
                "command" : "cs50statsDialog",
                "visible" : true
            });

            // place version button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), versionBtn, 860, plugin);

            // create hostname button
            hostnameBtn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Workspace Hostname",
                "command" : "openDomain",
                "visible" : true
            });

            // place button
            ui.insertByIndex(layout.findParent({
                name: "preferences"
            }), hostnameBtn, 860, plugin);

            // Add preference pane
            prefs.add({
               "CS50" : {
                    position: 5,
                    "Workspace Stats" : {
                        position: 10,
                        "Information refresh rate (in seconds)" : {
                            type: "spinner",
                            path: "user/cs50/stats/@refreshRate",
                            min: 1,
                            max: 200,
                            position: 200
                        }
                    }
                }
            }, plugin);

            // fetch data
            updateStats();

            // always verbose, start timer
            startTimer();
        }

        /*
         * Stop automatic refresh of information by disabling JS timer
         */
        function stopTimer() {
            if (timer == null) return;
            window.clearInterval(timer);
            timer = null;
        }

        /*
         * If not already started, begin a timer to automatically refresh data
         */
        function startTimer() {
            if (timer != null) return;
            timer = window.setInterval(updateStats, delay * 1000);
        }

        /*
         * Initiate an info refresh by calling `stats50`
         */
        function updateStats(callback) {
            // respect the lock
            if (fetching) return;

            fetching = true;

            proc.execFile("stats50", {
                cwd: "/home/ubuntu/workspace"
            }, parseStats);
        }

        /*
         * Process output from stats50 and update UI with new info
         */
        function parseStats(err, stdout, stderr) {
            // release lock
            fetching = false;

            if (err) {
                var long;
                if (err.code == "EDISCONNECT") {
                    // disconnected client: don't provide error
                    return;
                }
                else if (err.code == "ENOENT") {
                    // command not found
                    long = "Please run <tt>update50</tt>!";
                }
                else {
                    long = "Unknown error from workspace: <em>" + err.message +
                           " (" + err.code + ")</em><br /><br />"+
                           "Please run <tt>update50</tt>!";
                }

                // notify user through button text
                hostnameBtn.setCaption("Run update50!");
                versionBtn.setCaption("");
                cs50Btn.setCaption("Run update50!");

                // update dialog with error
                stats = {"error":long};
                updateDialog();
                return;
            }

            // parse the JSON returned by stats50 output
            stats = JSON.parse(stdout);

            //grey out hostnameBtn if no server running
            if(!stats.listening) {
                hostnameBtn.setAttribute("disabled", true);
            }
            else {
                hostnameBtn.setAttribute("disabled", false);
            }

            // update UI
            hostnameBtn.setCaption(stats.host);
            versionBtn.setCaption(stats.version);
            cs50Btn.$ext.innerHTML = "&#9432;";

            updateDialog();
        }

        /*
         * Update the Dialog text based on latest stats info
         */
        function updateDialog() {
            // confirm dialog elements have been created
            if (html == null) return;

            // removes button bar on darker themes
            if (settings.get("user/general/@skin") != "flat-light") {
               html.stats.parentElement.style.setProperty("background-color", "#DEDEDE");
            }
            else {
                html.stats.parentElement.style.setProperty("background-color", "#FEFEFE");
            }

            if (stats == null) {
                // no information fetched yet
                html.info.innerHTML = "Please wait, fetching information...";
                html.info.style.display = "block";
                html.stats.style.display = "none";
            }
            else if (stats.hasOwnProperty("error")) {
                // error while fetching information
                html.info.innerHTML = stats.error;
                html.info.style.display = "block";
                html.stats.style.display = "none";
            }
            else {
                // have stats: update table of info in dialog window
                html.info.style.display = "none";
                html.stats.style.display = "block";

                html.version.innerHTML = stats.version;

                if (stats.listening) {
                    // display running server & provide a link to host
                    html.server.innerHTML = "Yes (" + stats.server + ")";
                    html.hostname.innerHTML = '<a href="//'+ stats.host +
                        '" target="_blank">' + stats.host + '</a>';
                }
                else {
                    // still show host, but no link, since no running server
                    html.server.innerHTML = "No";
                    html.hostname.innerHTML = stats.host;
                }
            }
        }

        /*
         * Toggle the display of the stats dialog
         */
        function toggle() {
            if (showing) {
                plugin.hide();
            }
            else {
                plugin.show();
            }
        }

        /*
         * Open domain page in new tab
         */
        function loadHost() {
            window.open("//" + stats.host);
        }

        /*
         * Place initial HTML on the first drawing of the dialog
         */
        plugin.on("draw", function(e) {
            e.html.innerHTML =
                '<p id="info">...</p>' +
                '<table id="stats"><col width="100">' +
                '<tr><td>IDE Version</td><td id="version">...</td></tr>' +
                '<tr><td>Server Running</td><td id="server">...</td></tr>' +
                '<tr><td>Hostname</td><td id="hostname">...</td></tr>' +
                '</table>';

            // Sets background on initial draw to prevent unecessary flicker
            if (settings.get("user/general/@skin") != "flat-light") {
               e.html.style.setProperty("background-color", "#DEDEDE");
            }
            else {
                e.html.style.setProperty("background-color", "#FEFEFE");
            }

            // find & connect to all of the following in the dialog's DOM
            var els = ["version", "server", "hostname", "info", "stats"];
            html = {};
            for (var i = 0, j = els.length; i < j; i++)
                html[els[i]] = e.html.querySelector("#" + els[i]);

            updateDialog();
        });

        /*
         * When the dialog is shown, request latest info and display dialog
         */
        plugin.on("show", function () {
            showing = true;

            // make sure dialog has latest info
            updateStats();

            // keep dialog up-to-date
            startTimer();
        });

        /*
         * When dialog is hidden, reset state, stopping the timer if necessary
         */
        plugin.on("hide", function () {
            startTimer();
            showing = false;
        });

        /***** Lifecycle *****/

        plugin.on("load", function() {
            load();
        });

        plugin.on("unload", function() {
            stopTimer();

            delay = 30;
            timer = null;
            showing = false;
            cs50Btn = null;
            versionBtn = null;
            hostnameBtn = null;
            fetching = false;
            html = null;
            stats = null;
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
