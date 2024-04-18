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
            name: "index",
            help: "Build and update file hash indicies"
        },
        {
            name: "renum",
            help: "Renumber files",
        },
        {
            name: "next",
            help: "Finds the next numbered file that doesn't exist"
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
    parser.show_help();
    return;
}

if (cl.$command == "index")
    cl.$command = "indexTools";

// Dispatch it
require('./' + cl.$command)(cl.$tail)
