//
// This is CS50 Render.
//
// David J. Malan
// malan@harvard.edu
//
// Implements an HTTP API that accepts a PDF or source code as input
// and returns the corresponding HTML as ouput.
//
// https://github.com/cs50/render50
//

// supported MIME types
var TYPES = {
    'c': ['text/x-c'],
    'cc': ['text/x-c++'],
    'cpp': ['text/x-c++'],
    'html': ['text/html'],
    'java': ['text/x-java'],
    'js': ['text/x-javascript'],
    'pdf' : ['application/pdf'],
    'php': ['text/x-php'],
    'rb': ['text/x-ruby'],
    'py': ['text/x-python'],
    'txt': ['text/plain']
};

// for parsing command-line arguments
// https://github.com/substack/node-optimist
var argv = require('optimist').demand(['port']).argv;

// simplifies asynchronous code
// https://github.com/caolan/async
var async = require('async');

// for spawning childen
var child_process = require('child_process');

// simplies web server
var express = require('express');
var app = express();
var server = require('http').createServer(app);

// for rawBody
var BufferJoiner = require('bufferjoiner');

// for file system
var fs = require('fs');
var os = require('os');
var path = require('path');

// simplifies JavaScript
var _ = require('underscore');

// for UUIDs
var uuid = require('node-uuid');

// get server's IP (for diagnostic purposes)
var ip = (function() {
    try {
        return os.networkInterfaces().eth0[0].address;
    }
    catch (e) {
        return undefined;
    }
})();

// configure server
app.configure(function() {

    // handle static files
    app.use(express.static(__dirname + '/public'));

    // preserve requests' raw bodies except for form submissions
    // http://steelballsafety.wordpress.com/2012/01/25/express-rawbody/
    app.use(function(req, res, next) {
        var type = req.headers['content-type'];
        if (_.isString(type) && !type.match(/^multipart\/form-data/i) && type !== 'application/x-www-form-urlencoded') {
            var buffers = new BufferJoiner();
            req.on('data', function(buffer) {
                buffers.add(buffer);
            });
            req.on('end', function() {
                req.rawBody = buffers.join(false);
                next();
            });
        }
        else {
            next();
        }
    });

    // parse requests' bodies for files
    app.use(express.bodyParser({ keepExtensions: true }));

    // limit size of uploads
    app.use(express.limit(argv.limit || 10485760));

    // remove Express's X-Powered-By header
    app.use(function(req, res, next) {
        res.removeHeader('x-powered-by');
        next();
    });

    // enable CORS
    app.use(function(req, res, next) {

        // whitelist client
        if (!_.isUndefined(req.headers.origin)) {
            res.header('Access-Control-Allow-Origin', req.headers.origin);
        }

        // allow JSON responses to be embedded in DOMs
        res.header('Access-Control-Allow-Methods', 'POST');

        next();
    });

    // route requests
    app.use(app.router);

    // handle errors
    // http://expressjs.com/guide.html#error-handling
    app.use(function(err, req, res, next) {
        switch (err.status) {
            default:
                console.log(err);
        }
    });

});

// development settings
app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// production settings
app.configure('production', function() {
    app.use(express.errorHandler());
});

// disable layouts
app.set('view options', {
    layout: false
});

// listen for connections on port
server.listen(argv.port);

// GET /status
app.get('/status', function(req, res) {
    res.send(200); // always return 200 when server is running
});

// POST /
app.post('/', function(req, res) {

    // series of steps
    async.waterfall([

        // determine filename for input
        function(callback) {

            // rely on Content-Type
            if (!_.isString(req.headers['content-type'])) {
                callback(new Error('cannot determine Content-Type'));
            }

            // form submissions will include file names
            else if (req.headers['content-type'].match(/^multipart\/form-data/i)) {
                if (!_.isObject(req.files) || _.keys(req.files).length === 0) {
                    callback(new Error('missing file'));
                }
                else if (_.keys(req.files).length > 1) {
                    callback(new Error('too many files'));
                }
                else {
                    callback(null, _.values(req.files)[0].path);
                }
            }

            // API calls won't include file names, so we infer file extension from Content-Type
            else {

                // map Content-Type to file extension
                var extension = _.find(_.keys(TYPES), function(type) {
                    return _.contains(TYPES[type], req.headers['content-type']);
                });

                // save raw body to file
                if (!_.isUndefined(extension)) {
                    var input = path.join(os.tmpDir(), uuid.v4()) + '.' + extension;
                    fs.writeFile(input, req.rawBody, undefined, function(err) {
                        callback(err, input);
                    });
                }
                else {
                    callback(new Error('unsupported Content-Type'));
                }
            }
        },

        // render input
        function(input, callback) {

            // outfile's file name
            var output = input + '.html';

            // render based on input's file extension (using switch in case we add support for other types)
            switch (input.split('.').pop()) {

                // pdf2htmlEX --dest-dir / --zoom 2 [input] [output]
                case 'pdf':
                    child_process.execFile('pdf2htmlEX', ['--dest-dir', '/', '--zoom', '2', input, output], null, function(err) {
                        callback(err, input, output);
                    });
                    break;

                // pygmentize -f html -O full,linenos=1,style=github -o [output] [input]
                case 'c':
                case 'cc':
                case 'cpp':
                case 'html':
                case 'java':
                case 'js':
                case 'php':
                case 'py':
                case 'rb':
                case 'txt':
                    child_process.execFile('pygmentize', ['-f', 'html', '-O', 'full,linenos=1,style=github', '-o', output, input], null, function(err) {
                        callback(err, input, output);
                    });
                    break;

                default:
                    callback(new Error('unsupported input'));
                    break;
            }
        },

        // get output's file size
        function(input, output, callback) {
            fs.stat(output, function(err, stats) {
                callback(err, input, output, stats);
            });
        }

    ],

    // write response
    function(err, input, output, stats) {

        // success
        if (_.isNull(err)) {
            res.writeHead(200, {
                'Content-Length': stats.size,
                'Content-Type': 'text/html',
                'X-CS50-IP': ip
            });
            fs.createReadStream(output).pipe(res); // http://stackoverflow.com/a/13486341
        }

        // fail
        else {
            res.writeHead(400, {
                'X-CS50-IP': ip
            });
            res.end();
        }

        // delete input and output
        async.series([
            function(callback) {
                if (_.isString(input)) {
                    fs.unlink(input, callback);
                }
                else {
                    callback(null);
                }
            },
            function(callback) {
                if (_.isString(output)) {
                    fs.unlink(output, callback);
                }
                else {
                    callback(null);
                }
            }
        ]);
    });
});
