let path = require('path');
let fs = require('fs');
let areFilesEqual = require('./utils/areFilesEqual');
let commandLineParser = require('./utils/commandLineParser');
let os = require('os');
let makeExcluder = require('./utils/makeExcluder');
let { incrementFilename } = require('./utils.incrementString');

let copyCount = 0;
let skipCount = 0;
let conflictCount = 0;

function processDir(source, target, options)
{
    try
    {
        // Make sure target directory exists
        if (!fs.existsSync(target))
        {
            fs.mkdirSync(target);
        }

        // Process all items in the source directory
        let items = fs.readdirSync(source);
        for (let item of items)
        {
            // Get source item path
            let sourceItem = path.join(source, item);
            let targetItem = path.join(target, item);
            
            // Is the source item a directory
            let statSource = fs.statSync(sourceItem);

            // Check if should exclude
            if (statSource.isDirectory())
                sourceItem += "/";
            if (options.shouldExclude(sourceItem))
                continue;

            // Recurse?
            if (statSource.isDirectory())
            {
                processDir(sourceItem, targetItem, options);
                continue;
            }

            // Get target item path
            if (!fs.existsSync(targetItem))
            {
                // Doesn't exist, copy it
                fs.copyFileSync(sourceItem, targetItem);
                copyCount++;
                console.log(`${sourceItem} => ${targetItem}`);
                continue;
            }

            // Check if files are the same
            if (areFilesEqual(sourceItem, targetItem))
            {
                console.log(`${sourceItem} == ${targetItem}`);
                skipCount++;
                continue;
            }

            var p = path.parse(targetItem);
            targetItem = path.join(p.dir, p.name + " (Conflict 1)" + p.ext);
            while (true)
            {
                if (fs.existsSync(targetItem))
                {
                    if (areFilesEqual(sourceItem, targetItem))
                    {
                        console.log(`${sourceItem} == ${targetItem}`);
                        skipCount++;
                        break;
                    }
                }
                else
                {
                    // Copy it
                    fs.copyFileSync(sourceItem, targetItem);
                    copyCount++;
                    conflictCount++;
                    console.log(`${sourceItem} => ${targetItem}`);
                    break;
                }

                targetItem = incrementFilename(targetItem);
            }
        }
    }
    catch (err)
    {
        console.error(` ${err.message}`);
    }
}


module.exports = function main(args)
{
    // Process args
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt merge",
        packageDir: __dirname,
        synopsis: "Safely merge two directories, ensure nothing is overwritten (conflicted files will be named accordingly).",
        spec: [
            {
                name: "<source>",
                help: "The 'source' directory to merge from",
            },
            {
                name: "<target>",
                help: "The 'target' directory to merge to",
            },
            {
                name: "--exclude:<spec>",
                default: [],
                help: "Glob pattern for files to exclude",
            },
            {
                name: "--icase",
                help: "Case insensitive exclude patten matching (default is true for Windows, else false)",
                default: os.platform() === 'win32',
            },
        ]
    });

    var excluder = makeExcluder(cl);
    cl.shouldExclude = (x) => excluder(x.substring(cl.source.length));

    cl.db =  new hashfileDatabase();
    
    // Process directories
    processDir(cl.source, cl.target, cl);

    // Show summary
    console.log(`copied: ${copyCount} skipped: ${skipCount} conflicts: ${conflictCount}\n`);
}


