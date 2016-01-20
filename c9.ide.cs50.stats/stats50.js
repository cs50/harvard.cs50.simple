define(function(require, exports, module) {
    main.consumes = [
        "Plugin", "ui", "commands", "menus", "settings", "layout", "Dialog",
        "settings", "proc", "preferences", "collab.workspace", "info"
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
        var workspace = imports["collab.workspace"];
        var info = imports["info"];

        /***** Initialization *****/

        var plugin = new Dialog("CS50", main.consumes, {
            name: "CS50 Stats",
            allowClose: true,
            textselect: true,
            title: "CS50 IDE Info",
            modal: true
        });

        var versionBtn, hostnameBtn, cs50Btn;   // UI button elements

        var RUN_MESSAGE = "Please run <tt>update50</tt>!"; // update50 message
        var DEFAULT_REFRESH = 30;   // default refresh rate
        var delay;                  // current refresh rate
        var fetching;               // are we fetching data
        var html = null;            // object with references to html els
        var showing;                // is the dialog showing
        var stats = null;           // last recorded stats
        var timer = null;           // javascript interval ID
        var domain = null;          // current domain

        function load() {
            showing = false;
            fetching = false;

            // notify the instance of the domain the IDE is loaded on
            domain = window.location.hostname;

            // we only want the domain; e.g., "cs50.io" from "ide.cs50.io"
            if (domain.substring(0, 3) == "ide")
                domain = domain.substring(4);

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
                hint: "CS50 IDE Info Window",
                group: "General",
                exec: toggle
            }, plugin);

            // notify UI of the function to open the host in a new tab
            commands.addCommand({
                name: "openDomain",
                hint: "CS50 IDE Host",
                group: "General",
                exec: loadHost
            }, plugin);

            // add a menu item to show the dialog
            menus.addItemByPath("Window/~", new ui.divider(), 33, plugin);
            menus.addItemByPath("Window/CS50 IDE Info...", new ui.item({
                command: "cs50statsDialog"
            }), 34, plugin);

            // create CS50 button
            cs50Btn = new ui.button({
                "skin"    : "c9-menu-btn",
                "caption" : "",
                "tooltip" : "CS50 IDE Info",
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
                "tooltip" : "CS50 IDE Version",
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
                "tooltip" : "CS50 IDE Host",
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
                    "IDE Information" : {
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
         * Initiate an info refresh by calling `info50`
         */
        function updateStats(callback) {
            // respect the lock
            if (fetching) return;

            fetching = true;

            // hash that uniquely determines this client
            var myID = info.getUser().id;
            var myClientID = workspace.myClientId;
            var hash = myID + '-' + myClientID;

            // extra buffer time for info50
            // refer to info50 for more documentation on this
            var buffer = delay + 2;

            proc.execFile("info50", {
                args: [domain, hash, buffer],
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
                    long = RUN_MESSAGE;
                }
                else {
                    long = "Unknown error from workspace: <em>" + err.message +
                           " (" + err.code + ")</em><br /><br />"+ RUN_MESSAGE;
                }

                // notify user through button text
                hostnameBtn.setCaption("Run update50!");
                hostnameBtn.setAttribute("disabled", true);
                versionBtn.setCaption("");
                cs50Btn.setCaption("Run update50!");

                // update dialog with error
                stats = {"error":long};
                updateDialog();
                return;
            }

            // parse the JSON returned by stats50 output
            stats = JSON.parse(stdout);

            // update UI
            hostnameBtn.setAttribute("tooltip", "Click to load the website served by this workspace");
            hostnameBtn.setCaption(stats.host);
            versionBtn.setCaption(stats.version);
            cs50Btn.$ext.innerHTML = "&#9432;";

            // the button should be disabled if the domain do not match the docker instance's domain
            hostnameBtn.setAttribute("disabled", !stats.host.endsWith(domain));

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

                // Add MySQL username and password field
                if (stats.hasOwnProperty("user")) {
                    html.user.innerHTML = stats.user;
                }
                else {
                    html.user.innerHTML = RUN_MESSAGE;
                }
                if (stats.hasOwnProperty("passwd")) {
                    html.passwd.innerHTML = stats.passwd;
                }
                else {
                    html.passwd.innerHTML = RUN_MESSAGE;
                }

                html.hostname.innerHTML = '<a href="//'+ stats.host +
                    '/" target="_blank">' + location.protocol + "//" +
                    stats.host + '/</a>';

                var pma = stats.host + '/phpmyadmin';
                html.phpmyadmin.innerHTML = '<a href="//' + pma +
                    '/" target="_blank">' + location.protocol + "//" + pma +
                    '/</a>';
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
                '<table id="stats"><col width="110">' +
                '<tr><td><strong>Version</strong></td><td id="version">...</td></tr>' +
                '<tr><td><strong>Web Server</strong></td><td id="hostname">...</td></tr>' +
                '<tr><td><strong>phpMyAdmin</strong></td><td id="phpmyadmin">...</td></tr>' +
                '<tr><td><strong>MySQL Username</strong></td><td id="user">...</td></tr>' +
                '<tr><td><strong>MySQL Password</strong></td><td id="passwd">...</td></tr>' +
                '</table>';

            // Prevents column wrapping in any instance
            e.html.style.whiteSpace = "nowrap";

            // Sets background on initial draw to prevent unecessary flicker
            if (settings.get("user/general/@skin") != "flat-light") {
               e.html.style.setProperty("background-color", "#DEDEDE");
            }
            else {
                e.html.style.setProperty("background-color", "#FEFEFE");
            }

            // find & connect to all of the following in the dialog's DOM
            var els = ["version", "hostname", "phpmyadmin", "info",
                       "stats", "user", "passwd"];
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
            domain = null;
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

            /**
             * @property showing whether this client can preview 
             */
            get canPreview(){ return stats && stats.host.endsWith(domain); },

            /**
             * @property showing hostname50
             */
            get host(){ return stats && stats.host; },

            /**
             * @property showing whether info50 has run at least once
             */
            get hasLoaded(){ return (stats != null); },

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
