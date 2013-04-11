/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen:true, stupid:true*/

'use strict';

var libpath = require('path'),
    libfs = require('fs'),
    JSV = require('JSV').JSV,
    log = require('./log'),
    MOJSCHEMA = 'schemas',
    jsonlint = require('jsonlint').parser;

require('js-yaml');

function Validator() {
    this.env = JSV.createEnvironment('json-schema-draft-03');
}

Validator.prototype = {
    schemas: {},

    registerSchema: function (name, schemaPath) {
        var schema = JSON.parse(libfs.readFileSync(schemaPath));

        this.schemas[name] = schema;
    },

    validate: function (filePath, ext) {
        var type = libpath.basename(filePath, ext),
            schema = this.schemas[type];

        if (schema) {
            if (ext === '.json') {
                this._validateJson(filePath, schema);
            } else if (ext === '.yaml') {
                this._validateYaml(filePath, schema);
            }
        }
    },

    // validate .json configuration file
    _validateJson: function (filePath, schema) {
        var that = this;

        libfs.readFile(filePath, function (err, data) {
            var instance, report;

            if (err) {
                throw err;
            }

            try {
                // Parse as JSON
                instance = JSON.parse(data);
            } catch (e) {
                log.error("JSON parse error in file: " + filePath);
                try {
                    // get detailed json error info
                    jsonlint.parse(libfs.readFileSync(filePath, "utf8"));
                } catch (jsonSyntaxError) {
                    log.warn(jsonSyntaxError.message);
                }
                return;
            }

            // validate
            report = that.env.validate(instance, schema);

            // echo to command line
            that.printErrors(report.errors, filePath);
        });
    },

    // validate .yaml configuration file
    _validateYaml: function (filePath, schema) {
        var instance, report;

        try {
            instance = require(filePath);
        } catch (e) {
            log.error("YAML parse error in file: " + filePath);
            log.warn(e.message);
            return;
        }

        // validate
        report = this.env.validate(instance, schema);

        // echo to command line
        this.printErrors(report.errors, filePath);
    },

    // refine and output the error information
    printErrors: function (errors, filePath) {
        var message,
            info = {},
            uri,
            i,
            j,
            enumError = 'Instance is not one of the possible values';

        if (errors.length) {
            message = 'Possible errors in config file: ' + filePath;
            log.error(message);

            for (i = 0; i < errors.length; i = i + 1) {
                uri = (errors[i].uri).split('/');
                info.config = 'context';
                for (j = 1; j < uri.length; j = j + 1) {
                    if (uri[j].match(/^[0-9]*$/)) {
                        info.config += '[' + uri[j] + ']';
                    } else {
                        info.config += ' -> ' + uri[j];
                    }
                }
                info.message = errors[i].message;
                if (info.message === enumError) {
                    info.message += ': ' + errors[i].details;
                }
                log.warn(info);
            }
        } else {
            message = 'mojito config validation passed ' + '(' + filePath + ') .';
            log.info(message);
        }
    }
};

var walk = function (dir, excludes, cb) {
    libfs.readdir(dir, function (err, list) {
        if (err) {
            cb(err);
            return;
        }

        list.forEach(function (file) {
            file = libpath.join(dir, file);
            libfs.stat(file, function (err, stat) {
                if (err) {
                    cb(err);
                    return;
                }

                if (!stat) {
                    cb(null);
                    return;
                }

                if (stat.isDirectory()) {
                    if (!(excludes && excludes.indexOf(file) >= 0)) {
                        walk(file, excludes, cb);
                    }
                } else {
                    cb(null, file);
                }
            });
        });
    });
};

function schemas(file) {
    return {
        'name': file.split('.')[0],
        'path': file
    };
}

function mojschemas(mojitoPath) {
    var path = libpath.resolve(mojitoPath, MOJSCHEMA),
        list;

    try {
        list = libfs.readdirSync(path).map(schemas);
        list.path = path;
    } catch (e) {
        // in case there is no schemas folder in the local mojito
        log.debug('no schemas found at %s', path);
    }

    return list;
}

function main(args, opts, meta, cb) {
    var root,
        i,
        validator,
        excludes = [],
        schemas,
        schemaPath;

    if (args.length) {
        cb('Unknown extra parameters.');
        return;
    }

    if (!meta.mojito || !meta.mojito.path) {
        cb('Cannot find mojito.');
        return;
    }

    schemas = mojschemas(meta.mojito.path);
    if (!schemas || !schemas.length) {
        cb('Cannot find mojito configuration schemas.');
        return;
    }

    validator = new Validator();

    for (i = 0; i < schemas.length; i = i + 1) {
        schemaPath = libpath.join(schemas.path, schemas[i].path);
        validator.registerSchema(schemas[i].name, schemaPath);
    }

    root = process.cwd();

    // skip artifacts folder and mojito itself
    excludes.push(libpath.join(root, './artifacts'));
    excludes.push(libpath.join(root, './node_modules/mojito'));
    excludes.push(libpath.join(root, './node_modules/mojito-shaker'));

    // validate all .json files
    walk(root, excludes, function (err, file) {
        if (err) {
            throw err;
        }

        var ext = libpath.extname(file);
        if ((ext  === '.json') || (ext === '.yaml')) {
            validator.validate(file, ext);
        }
    });
}


module.exports = main;
module.exports.usage = 'mojito validate   // validate mojito configuration files' +
    '\n' +
    '[1] http://developer.yahoo.com/cocktails/mojito/docs/intro/mojito_configuring.html';