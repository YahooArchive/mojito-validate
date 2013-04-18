/*
 * Copyright (c) 2011-2013, Yahoo! Inc.  All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen:true*/

var test = require('tap').test,
    log = require('../log'),
    main = require('../');

// buffer log msgs instead of outputing them
log.pause();

function reset(t) {
    if (t) {
        t.same(log.record, log._buffer, 'records & buffer are same');
        t.ok(log.record.length, 'have records buffered');
    }
    log.record = log._buffer = [];
}

test('mojito validate (app cwd)', function (t) {
    t.plan(2);
    reset();

    var cwd = __dirname + '/fixtures/someapp',
        ymlFile = cwd + "/mojits/testMojit/definition.yaml",
        errors = [],
        warns = [],
        expectedWarnings = ["{ config: 'context[0] -> actionTimeout',\n  message: 'Instance is not a required type' }",
            "JS-YAML: missed comma between flow collection entries in \"" +
                ymlFile + "\" at line 3, column 20:\n            \"settings\" : [ \"master\" ],\n                       ^",
            "{ config: 'context[0] -> debugger',\n  message: 'Additional properties are not allowed' }",
            "{ config: 'context[0] -> search-advanced-page -> verbs[2]',\n  message: 'Instance is not one of the possible values: get,post,put,delete,GET,POST,PUT,DELETE' }",
            "Parse error on line 3:\n...\"master\" ]        \"config\": {        \n---------------------^\nExpecting 'EOF', '}', ',', ']', got 'STRING'"
            ],
        meta = {"mojito" : {
            "path": cwd + "/node_modules/mojito"
        }};

    log.on('log.error', function (m) {
        errors.push(m.message);
    });

    log.on('log.warn', function (m) {
        warns.push(m.message);
    });

    function cb(msg) {
        console.log(msg);
    }

    main([], null, meta, cb);
    setTimeout(function () {
        t.equals(errors.length, 4);
        t.same(warns, expectedWarnings);
    }, 3000);
});