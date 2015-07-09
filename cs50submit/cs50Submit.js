define(function(require, exports, module) {
     main.consumes = [
        "Plugin", "ui", "layout", "proc", "dialog.fileoverwrite",
        "dialog.alert_internal", "dialog.alert", "dialog.error", 
        "cs50Dialog", "fs.cache"
    ];
    main.provides = ["cs50Submit"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var ui = imports.ui;
        var layout = imports.layout;
        var proc = imports.proc;
        var dialogFileOverwrite = imports["dialog.fileoverwrite"];
        var cs50submit = imports.cs50Dialog;
        var alertInternal = imports["dialog.alert_internal"];
        var alert = imports["dialog.alert"];
        var showError = imports["dialog.error"].show;
        var fsCache = imports["fs.cache"];
  
        /***** Initialization *****/
        
        var plugin = new Plugin("CS50", main.consumes); // main plugin for CS50 submit
        var cs50SubmitButton; // ui button in preview bar

        function load() {
            // CS50 Submit ui button, which brings up CS50 Dialog
            cs50SubmitButton = new ui.button({
                id       : "cs50SubmitButton",
                caption  : "CS50 Submit",
                tooltip  : "Render code to PDF.",
                skin     : "c9-toolbarbutton-glossy",
                onclick  : function() {showDialog()},
                visible  : true
            });
            // Insert CS50 Submit button in proper location in ui
            var toolbar = layout.findParent({ name: "preview" });
            ui.insertByIndex(toolbar, cs50SubmitButton, 10, plugin);
            
            // Change Skip caption to Cancel in overwrite dialog box
            dialogFileOverwrite.update([{id: "no", caption: "Cancel"}]);
            // Disable close in rendering dialog
            alertInternal.allowClose = false;
        } 
        
        /***** Methods *****/
        
        /**
         * Brings up CS50 Submit dialog box
         */
        function showDialog() {
            cs50submit.show("CS50 Submit", "",
                function(path, stat, done){
                    var txtBox = cs50submit.getElement("fileOutput");
                    var main = fsCache.findNode("/");
                    path.splice(0, 0, txtBox.value);
                    overwriteDialog(main, path);
                }, 
                function() {
                }, 
                {
                    createFolderButton: false,
                    showFilesCheckbox: false,
                    chooseCaption: "Render"
            });
        }
        
        /**
         * Runs CS50 Render, and prompts for overwrite if necessary
         */
        function render(args) {
            proc.spawn("render50", {args : args, cwd: "/home/ubuntu/workspace"}, function(err, process) {
                if (err) 
                    return showError("Process halted. The render did not complete successfully!");
                
                var limiter = 0; // Prevents too many alert boxes from being created
                
                process.stdout.on("data", function(chunk) {
                    // Handles rendering dialog
                    if (limiter == 0) {
                        cs50submit.hide();
                        alert.show("Rendering..", 
                            "Please do not close your browser, the render is in progress.");
                        limiter++;
                    }
                });
                
                process.on("exit", function(code) {
                    // On successful render, commence zipping PDF and files
                    if (code == 0) {
                        args.splice(0, 0, "-r");
                        args.push("-xi");
                        args.push(args[1] + ".pdf");
                        zip(args);
                    }
                    // On unsuccessful render, display error dialog
                    if (code == null) {
                        alert.hide();
                        showError("The render did not complete successfully!");
                    }
                });
            });
        }
        
         /**
         * Brings up Overwrite dialog if a zip with the same name already exists  
         */
        function overwriteDialog(node, args) {
            var present;
            var fileName = args[0] + ".zip";
            
            //Prevents user from entering dot, which can accidentally overwrite incorrectly
            if (args[0].indexOf(".") > -1) {
                alert.show("Invalid Filename", 
                    "The symbol \".\" is invalid for the filename.");
            }
            
            // Searches for file in directory
            node.children.forEach(function(n){
                if (fileName === n.label)
                    present = true;
            });
            // Overwrite dialog
            if (present) {
                dialogFileOverwrite.show("Overwrite", 
                "The file \"" + fileName + "\" already exists", 
                "Would you like to overwrite \"" + fileName + "\"?",
                function(all){
                    render(args);
                    cs50submit.hide();
                }, 
                function(all){
                },{ 
                    all: false, 
                    cancel: false
                });
            }
            else
                render(args);
        }
        
        /**
         * Zips all the selected files, along with the PDF
         */
        function zip(args){
            proc.spawn("zip", {args: args, cwd: "/home/ubuntu/workspace"}, function(err, process) {
                if (err) 
                    return showError("Process halted. The render did not complete successfully!");
            
                process.on("exit", function(code) {
                    removePdf(args);
                });
            });
        }
        
        /**
         * Removes the extra PDF after the zip is created
         */
        function removePdf(args){
            proc.spawn("rm", {args: [args[1] + ".pdf"], cwd: "/home/ubuntu/workspace"}, function(err, process) {
                if (err) 
                    return showError("Process halted. The render did not complete successfully!");
                
                process.on("exit", function(code) {
                    alert.hide();
                });
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
                 * Fires when plugin is shown
                 */
                "show",
                /**
                 * Fires when plugin is drawn
                 */
                "hide"
            
            ],
            
            /**
             * Shows plugin
             */
            show: plugin.show,
            
            /**
             * Shows plugin
             */
            hide: plugin.hide
    });
        
        register(null, {
            "cs50Submit": plugin
        });
    }
});