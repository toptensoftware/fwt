let path = require('path');
let fs = require('fs');
let areFilesEqual = require('./utils/areFilesEqual');
let commandLineParser = require('./utils/commandLineParser');

let copyCount = 0;
let skipCount = 0;
let conflictCount = 0;

function processDir(source, target)
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
            if (statSource.isDirectory())
            {
                processDir(sourceItem, targetItem);
                continue;
            }

            // Get target item path
            if (!fs.existsSync(targetItem))
            {
                // Doesn't exist, copy it
                fs.copyFileSync(sourceItem, targetItem);
                copyCount++;
                process.stdout.write(`${sourceItem} => ${targetItem}\n`);
                continue;
            }

            // Check if files are the same
            if (areFilesEqual(sourceItem, targetItem))
            {
                process.stdout.write(`${sourceItem} == ${targetItem}\n`);
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
                        process.stdout.write(`${sourceItem} == ${targetItem}\n`);
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
                    process.stdout.write(`${sourceItem} => ${targetItem}\n`);
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



function isDigit(c) {
    return c >= '0' && c <= '9';
}

function incrementString(str)
{
    // Find end of trailing number
    var endDigitPos = str.length;
    while (endDigitPos > 0 && !isDigit(str[endDigitPos-1]))
        endDigitPos--;

    // No digits, append one
    if (endDigitPos == 0)
        return str + "(2)";

    // Find start of trailing number
    var startDigitPos = endDigitPos;
    while (startDigitPos > 0 && isDigit(str[startDigitPos - 1]))
        startDigitPos--;

    // Get the number
    var number = parseInt(str.substring(startDigitPos, endDigitPos));

    return str.substring(0, startDigitPos) 
        + (number + 1).toString().padStart(endDigitPos - startDigitPos, '0') 
        + str.substring(endDigitPos);
}

function incrementFilename(str)
{
    var p = path.parse(str);
    return path.join(p.dir, incrementString(p.name) + p.ext);
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
        ]
    });

    // Process directories
    processDir(cl.source, cl.target);

    // Show summary
    process.stdout.write(`copied: ${copyCount} skipped: ${skipCount} conflicts: ${conflictCount}\n`);
}


