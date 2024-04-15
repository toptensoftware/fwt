let path = require('path');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let glob = require('./utils/glob');

function processDir(source, target, options)
{
    try
    {
        // Process all items in the source directory
        let sourceItems = new Set(fs.readdirSync(source));
        let targetItems = new Set(fs.readdirSync(target));

        sourceItems.forEach(i => {

            if (shouldExclude(i))
                return;

            // Get paths to both
            var si = path.join(source, i);
            var ti = path.join(target, i);

            // Check exists
            if (!targetItems.has(i))
            {
                if (!options.noRight)
                    console.log(`  missing: ${ti}`);
                return;
            }

            // Remove from target list
            targetItems.delete(i);

            // Stat both
            var ss = fs.statSync(si);
            var ts = fs.statSync(ti);

            // Directory/file mismatch?
            if (ts.isDirectory() != ss.isDirectory())
            {
                console.log(`different: ${si} <> ${ti}`)
                return;
            }

            // Directory or file?
            if (ss.isDirectory())
            {
                processDir(si, ti, options);
            }
            else
            {
                // Same?
                if (ss.size != ts.size || Math.abs(ss.mtimeMs - ts.mtimeMs) > 2000)
                {
                    console.log(`different: ${si} <> ${ti}`)
                }
            }

        });

        targetItems.forEach(i => {
            if (shouldExclude(i))
                return;
            if (!options.noLeft)
                console.log(`  missing: ${path.join(source, i)}`);
        });
    }
    catch (err)
    {
        console.error(` ${err.message}`);
    }

    function shouldExclude(name)
    {
        return options.exclude.some(x => name.match(x) != null);
    }
}




module.exports = function main(args)
{
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt compare",
        packageDir: __dirname,
        synopsis: "Compare two directories listing missing and different files.",
        spec: [
            {
                name: "<left>",
                help: "The 'left' directory to compare",
            },
            {
                name: "<right>",
                help: "The 'right' directory to compare",
            },
            {
                name: "--no-left",
                help: "Don't show missing files in the left directory",
            },
            {
                name: "--no-right",
                help: "Don't show missing files in the right directory",
            },
            {
                name: "--exclude:<spec>",
                default: [],
                help: "Glob pattern for files to exclude",
            }

        ]
    });

    // Convert exclude patterns to regexps
    for (let i=0; i<cl.exclude.length; i++)
    {
        cl.exclude[i] = new RegExp(glob(cl.exclude[i]), 'i');
    }

    processDir(cl.left, cl.right, cl);
}



