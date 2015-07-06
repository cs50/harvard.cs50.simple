define(function(require, exports, module) {
     main.consumes = [
        "Plugin", "Dialog", "ace", "ace.status", "commands", "console", "Divider",
        "immediate", "keymaps", "layout", "Menu", "MenuItem", "menus", "mount",
        "panels", "preferences", "preview", "run.gui", "save", "settings",
        "tabManager", "terminal", "tooltip", "Tree", "ui", "util", "fs", "fs.cache",
        "dialog.alert", "dialog.file", "proc", "dialog.fileoverwrite", "List", "Form","cs50Dialog"
    ];
    main.provides = ["cs50Submit"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var Dialog = imports.Dialog
        var fs = imports.fs;
        var fsCache = imports["fs.cache"];
        var dialogAlert = imports["dialog.alert"];
        var dialogFile = imports["dialog.file"];
        var Tree = imports.Tree;
        var ui = imports.ui;
        var menus = imports.menus;
        var layout = imports.layout;
        var tabs = imports.tabManager;
        var settings = imports.settings;
        var status = imports["ace.status"];
        var basename = require("path").basename;
        var commands = imports.commands;
        var util = imports.util;
        var proc = imports.proc;
        var dialogFileOverwrite = imports["dialog.fileoverwrite"];
        var List = imports.List;
        var Form = imports.Form;
        var cs50submit = imports.cs50Dialog;
  
        /***** Initialization *****/
        
        var plugin = new Plugin("CS50", main.consumes);
        
        var cs50SubmitButton; // ui button in preview bar

        function load(){
            
            // Brings up CS50 submit dialog box 
            cs50SubmitButton = new ui.button({
                id       : "cs50SubmitButton",
                caption  : "CS50 Submit",
                tooltip  : "Render code to PDF.",
                skin     : "c9-toolbarbutton-glossy",
                onclick  : function() {showDialog()},
                visible  : true
            });
            var toolbar = layout.findParent({ name: "preview" });
            ui.insertByIndex(toolbar, cs50SubmitButton, 10, plugin);
            
            // Change skip caption to Cancel in overwrite dialog box
            dialogFileOverwrite.update([{id: "no", caption: "Cancel"}]);
        } 
        
        /***** Methods *****/
        
        /*
        * Runs render50 by spawning child process
        */
        function render(args, fileName){
            proc.spawn("render50", {args}, function(err, process) {
                if (err) throw err;
                
                process.stdout.on("data", function(chunk) {
                    console.log(chunk);
                    if(chunk.indexOf("overwrite", 0) != -1)
                        console.log("fix this");
                });
            });
        }

        
        /*
        * Shows render dialog
        */
        function showDialog(){
            cs50submit.show("Render to PDF", "",
                function(path, stat, done){
                    console.log("Chosen path is ", path, " and is currently a ", stat.mime);
                    var txtBox = cs50submit.getElement("fileOutput");
                    var args = ["workspace/" + txtBox.value, "workspace" + path];
                    render(args, txtBox.value);
                }, 
                function(){
                    console.log("Action cancelled");
                }, 
            {
                createFolderButton: false,
                showFilesCheckbox: true,
                chooseCaption: "Render"
            });
        }
        
        /*
        * Overwrites previous pdf if needed
        */
        function overwrite(){
            proc.execFile("y", function(err, process) {
                if (err) console.log("asdg");
            
                process.stdout.on("data", function(chunk) {
                    console.log(chunk);
                    console.log(process);
                });
            });
        }
        
        /*
        * Shows overwrite Dialog 
        */
        function overwriteDialog(fileName, process){
            dialogFileOverwrite.show("Rendering", 
            "File " + fileName + " already exists", 
            "Would you like to overwrite " + fileName + "?",
            function(all){
                console.log("Overwrite" + (all ? " for all" : ""));
                console.log(process);
                
            }, 
            function(all){
                console.log("Do not overwrite" + (all ? " for all" : ""));
            }, {
                all: false,
                cancel: false
            });
        }
        
        /***** Lifecycle *****/
        
        plugin.on("load", function() {
            load();
        });
        plugin.on("unload", function() {
            cs50SubmitButton = null;
        });
        
        /***** Register and define API *****/
        
        plugin.freezePublicAPI({
            _events: [
                /**
                 * Fires when the form is drawn.
                 * @event draw
                 */
                "draw",
                /**
                 * Fires when the form becomes visible. This happens when
                 * it's attached to an HTML element using the {@link #attachTo}
                 * method, or by calling the {@link #method-show} method.
                 * @event show
                 */
                "show",
                /**
                 * Fires when the form becomes hidden. This happens when
                 * it's detached from an HTML element using the {@link #detach}
                 * method, or by calling the {@link #method-hide} method.
                 * @event hide
                 */
                "hide"
            ],
            show: plugin.show,
            hide: plugin.hide
        });
        
        register(null, {
            "cs50Submit": plugin
        });
    }
});