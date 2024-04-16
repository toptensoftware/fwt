let path = require('path');
let os = require('os');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let hashfileDatabase = require('./utils/hashfileDatabase')
let makeExcluder = require('./utils/makeExcluder');

module.exports = function main(args)
{

    // Process args
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt index",
        packageDir: __dirname,
        synopsis: "Updates the paths of previously indexed files",
        spec: [
            {
                name: "<from>",
                help: "The old path",
            },
            {
                name: "<to>",
                help: "The new path",
            }
        ]
    });

    // Open data base
    let db =  new hashfileDatabase();
    
    // Remap
    db.remap(cl.from, cl.to);
}
