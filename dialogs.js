define(function(require, exports, module) {
    "use strict";

    main.consumes = [
        "commands", "dialog.file", "dialog.share", "menus", "Plugin", "tabManager"
    ];

    main.provides = ["harvard.cs50.dialogs"];
    return main;

    function main(options, imports, register) {
        const commands = imports.commands;
        const fileDialog = imports["dialog.file"];
        const shareDialog = imports["dialog.share"];
        const menus = imports.menus;
        const Plugin = imports.Plugin;
        const tabs = imports.tabManager;

        const plugin = new Plugin("CS50", main.consumes);


        function addFileDialog() {
            const openItem = menus.get("File/Open...").item;
            if (!openItem)
                return;

            const gotoanything = commands.commands.gotoanything;
            commands.addCommand({
                name: "openFileDialog",
                hint: "Opens dialog for opening files",
                bindKey: gotoanything.bindKey,
                exec() {
                    fileDialog.show(
                        "Open file",
                        null,
                        path => {
                            fileDialog.tree.getSelection().getSelectedNodes()
                                .filter(node => !node.isFolder).forEach(node => {
                                    tabs.openFile(node.path);
                                });

                            fileDialog.hide();
                        },
                        null,
                        {
                            createFolderButton: false,
                            showFilesCheckbox: false,
                            chooseCaption: "Open"
                        }
                    );
                }
            }, plugin);

            delete gotoanything.bindKey;

            fileDialog.on("show", () => {
                const txtDirectory = fileDialog.getElement("txtDirectory");
                txtDirectory.previousSibling.hide();
                txtDirectory.hide();

                fileDialog.tree.once("afterChoose", () => {
                    fileDialog.getElement("btnChoose").dispatchEvent("click");
                });

            }, plugin);

            openItem.setAttribute("command", "openFileDialog");
        }


        function simplifyShareDialog() {

            // AWS Cloud9 documentation
            shareDialog.getElement("publishDiv", e => e.remove());

            shareDialog.getElement("access", e => {

                // RW button
                e.hide();

                // Placeholder in text field
                e.previousSibling.setAttribute("initial-message", "Username");
                e.previousSibling.setAttribute("width", 432);
                e.previousSibling.$ext.style.marginRight = "6px";

                // Invite Members label
                e.parentNode.parentNode.previousSibling.setAttribute("tooltip", "");
            });

            // Create new IAM label
            shareDialog.getElement("inviteDetailsRow", e => e.remove());
        }


        let loaded = false;
        plugin.on("load", () => {
            if (loaded)
               return false;

            loaded = true;

            addFileDialog();
            simplifyShareDialog();
        });

        plugin.on("unload", () => {});

        plugin.freezePublicAPI({});

        register(null, { "harvard.cs50.dialogs" : plugin });
    }
});
