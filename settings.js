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
        const revision = 1;

        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;

            // Default settings
            const currentRevision = settings.getNumber("project/cs50/simple/settings/@revision");
            if (!currentRevision || currentRevision < revision) {

                // Set default ace print margin
                settings.set("user/ace/@printMarginColumn", "132");

                // Show status bar
                settings.set("user/ace/statusbar/@show", true);

                // Turn off auto-save
                settings.set("user/general/@autosave", false);

                // Download project as ZIP files
                settings.set("user/general/@downloadFilesAs", "zip");

                // Disable autocomplete (temporarily?)
                settings.set("user/language/@continuousCompletion", false);
                settings.set("user/language/@enterCompletion", false);

                // Hide asterisks for unsaved documents
                settings.set("user/tabs/@asterisk", false);

                // Excluded formats
                ["class", "exe", "gz", "o", "pyc", "raw", "tar", "zip"].forEach(type => {
                    settings.set(`user/tabs/editorTypes/@${type}`, "none");
                });

                // Terminal scrollback buffer
                settings.set("user/terminal/@scrollback", 2000);

                // Strip trailing whitespaces on save
                settings.set("project/general/@stripws", true);

                // Update revision
                settings.set("project/cs50/simple/settings/@revision", revision)
            }
        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.settings" : plugin });
    }
});
