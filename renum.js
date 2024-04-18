let fs = require('fs');
let os = require('os');
let path = require('path');
let glob = require('glob').sync;
let naturalCompare = require('string-natural-compare');
let commandLineParser = require('./utils/commandLineParser.js');

module.exports = function main(args)
{
    // Process args
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt renum",
        packageDir: __dirname,
        synopsis: "Renumber files",
        spec: [
            {
                name: "<files>",
                default: [],
                help: "The files to rename, followed by the new name spec",
            },
            {
                name: "--icase",
                help: "Case insensitive exclude patten matching (default is true for Windows, else false)",
                default: os.platform() === 'win32',
            },
            {
                name: "--dryrun",
                help: "Don't actually do anything, just show what would have happened",
                default: os.platform() === 'win32',
            },
        ]
    });

    // Options for globbing for files
    let globOptions = {
        nocase: cl.icase,
        nodir: true,
    }

    // Must have at least two file name entries
    if (cl.files.length < 2)
    {
        console.error(`error: not enough arguments`);
        process.exit(7);
    }

    // The target file name is the last argument
    let targetFileName = cl.files.pop();

    // Build list of source file names
    let sourceFileNames = [];
    for (var pattern of cl.files)
    {
        // Find files
        let files = glob(pattern, globOptions);

        // Sort naturally
        files.sort((a, b) => naturalCompare(path.basename(a), path.basename(b)));

        // Add to list
        sourceFileNames = sourceFileNames.concat(files);

    }

    // Check no duplicates
    if (new Set(sourceFileNames).size !== sourceFileNames.length)
    {
        console.error(`error: source file list contains duplicate files`);
        process.exit(7);
    }

    // Make sure the target filename doesn't have any glob characters
    if (targetFileName.indexOf('*') >= 0 || targetFileName.indexOf('?') >= 0)
    {
        console.error(`error: the target filename can't contain wildcard characters`);
        process.exit(7);
    }

    // Parse the target filename
    let formatter = parseTargetFileName(targetFileName);

    // Create mapping of old to new name
    let mapping = sourceFileNames.map(x => {
        var newName = formatter();
        return {
            oldName: x,
            newName: path.join(path.dirname(x), newName),
        }
    });

    // Remove any redundant renames
    mapping = mapping.filter(x=>x.oldName != x.newName);

    // Check if any of the target filenames already exist (and aren't about to be renamed)
    let clashes = mapping.filter(x => fs.existsSync(x.newName) && !mapping.some(y => y.oldName == x.newName));
    if (clashes.length > 0)
    {
        console.error(`error: one or more target file names already exists`);
        console.log(clashes);
        process.exit(7);
    }

    // Do the work
    if (!cl.dryrun)
    {
        // Rename all the files to something temporary
        for (let i=0; i<mapping.length; i++)
        {
            let e = mapping[i];
            fs.renameSync(e.oldName, e.newName + ".renum");
        }

        // Rename all the files to their final place
        for (let i=0; i<mapping.length; i++)
        {
            let e = mapping[i];
            fs.renameSync(e.newName + ".renum", e.newName);
        }
    }

    // Show what happened
    for (let i=0; i<mapping.length; i++)
    {
        let e = mapping[i];
        console.log(`${e.oldName} => ${e.newName}`);
    }

}

function parseTargetFileName(str)
{
    // Find the plus symbol
    let plusPos = str.indexOf('+');
    if (plusPos < 0)
    {
        console.error(`error: target filename must contain a number followed by a '+' suffix`);
        process.exit(7);
    }

    // Count how many preceding digits
    let numPos = plusPos;
    while (numPos > 0 && str[numPos-1] >= '0' && str[numPos-1] <= '9')
        numPos--;

    // Check found some digits
    if (numPos == plusPos)
    {
        console.error(`error: target filename must contain a number followed by a '+' suffix`);
        process.exit(7);
    }

    // Extract the number
    let startingNumber = parseInt(str.substr(numPos, plusPos - numPos));
    let padding = plusPos - numPos;

    return function() {
        let result = str.substr(0, numPos) + startingNumber.toString().padStart(padding, '0') + str.substr(plusPos+1);
        startingNumber++;
        return result;
    };
}
