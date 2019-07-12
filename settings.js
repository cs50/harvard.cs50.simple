define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "Plugin", "settings"
    ];

    main.provides = ["harvard.cs50.settings"];
    return main;

    function main(options, imports, register) {
        const Plugin = imports.Plugin;
        const settings = imports.settings;

        const plugin = new Plugin("CS50", main.consumes);
        const revision = 2;

        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;

            // Default settings
            settings.on("read", () => {
                const currentRevision = settings.getNumber("project/cs50/simple/settings/@revision");
                if (!currentRevision || currentRevision < revision) {
                    setTimeout(async () => {
                        const editorTypes = {};
                        ["class", "exe", "gz", "o", "pyc", "raw", "tar", "zip"].forEach(type => {
                            editorTypes[`user/tabs/editorTypes/@${type}`] = "none"
                        })

                        const defaults = {
                            // Set default ace print margin
                            "user/ace/@printMarginColumn": "132",

                            // Show status bar
                            "user/ace/statusbar/@show": true,

                            // Turn off auto-save
                            "user/general/@autosave": false,

                            // Download project as ZIP files
                            "user/general/@downloadFilesAs": "zip",

                            // Disable autocomplete (temporarily?)
                            "user/language/@continuousCompletion": false,
                            "user/language/@enterCompletion": false,

                            // Hide asterisks for unsaved documents
                            "user/tabs/@asterisk": false,

                            // Terminal scrollback buffer
                            "user/terminal/@scrollback": 2000,

                            // Strip trailing whitespaces on save
                            "project/general/@stripws": true,

                            // Strip trailing whitespaces on save
                            "project/general/@stripws": true,

                            // Excluded formats
                            ...editorTypes
                        }

                        let retries = 5
                        while (retries > 0) {
                           if (Object.keys(defaults).every((key) => settings.set(key, defaults[key])))
                               break

                           console.warn('failed to update settings, retrying')
                           await new Promise((resolve) => setTimeout(resolve, 500))
                           retries--
                        }

                        if (retries < 1) {
                            console.error('failed to update settings')
                            return
                        }

                        // Update revision
                        settings.set("project/cs50/simple/settings/@revision", revision)
                    }, 0)
                }
            })

        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.settings" : plugin });
    }
});
