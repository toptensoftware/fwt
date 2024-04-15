#!/usr/bin/env node
let commandLineParser = require('./utils/commandLineParser.js');

var parser = commandLineParser.parser({
    usagePrefix: "fwt",
    packageDir: __dirname,
    spec: [
        {
            name: "compare",
            help: "Compare directories"
        },
        {
            name: "merge",
            help: "Merge directories"
        },
        {
            name: "finddups",
            help: "Find duplicate files"
        },
        {
            name: "--help",
            help: "Show this help",
            terminal: true,
        },
        {
            name: "--version",
            help: "Show version info",
            terminal: true,
        },
    ]

});

// Parse command line
let cl = parser.parse(process.argv.slice(2));
if (!cl.$command)
{
    parser.handle_help(cl);
    return;
}
parser.check(cl);

// Dispatch it
require('./' + cl.$command)(cl.$tail)
