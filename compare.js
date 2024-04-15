let path = require('path');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let glob = require('glob');
let os = require('os');

function processDir(source, target, options)
{
    try
    {
        // Process all items in the source directory
        let sourceItems = new Set(fs.readdirSync(source));
        let targetItems = new Set(fs.readdirSync(target));

        sourceItems.forEach(i => {

            // Get paths to both
            var si = path.join(source, i);
            var ti = path.join(target, i);

            // Append directory indicator
            var ss = fs.statSync(si);
            if (ss.isDirectory())
            {
                si += "/";
                ti += "/";
            }

            if (options.shouldExclude(si))
                return;

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
            var si = path.join(source, i);
            if (shouldExclude(si))
                return;
            if (!options.noLeft)
                console.log(`  missing: ${si}`);
        });
    }
    catch (err)
    {
        console.error(` ${err.message}`);
    }
}


function makeExcluder(options)
{
    // No exclude patterns
    if (!options.exclude || options.exclude.length == 0)
        return (x) => false;

    // On windows convert all backslashes to forward slashes
    let convertBackslashes = os.platform() === "win32";

    // Convert pattens to regexp and negative flag
    var patterns = options.exclude.map(x => {
        let negative = x.startsWith('!');
        if (negative)
            x = x.substring(1);
        if (convertBackslashes)
            x = x.replace(/\\/g, '/');
        return {
            negative,
            rx: new RegExp(glob(x), options.icase ? "i" : "")
        };
    });


    // Returns true if file should be ignored
    return function(filepath)
    {
        // Convert backslashes to forward slashes
        if (convertBackslashes)
            filepath = filepath.replace(/\\/g, "/");

        // Make sure there's a leading slash
        if (!filepath[0] == '/')
            filepath = "/" + x;

        // Find last matching pattern
        for (let i= patterns.length-1; i>=0; i--)
        {
            let p = patterns[i];
            if (filepath.match(x) != null)
                return !p.negative;
        }

        // Didn't match any patterns, so file is included
        return false;
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
                name: "--icase",
                help: "Case insensitive exclude patten matching (default is true for Windows, else false)",
                default: os.platform() === 'win32',
            },
            {
                name: "--exclude:<spec>",
                default: [],
                help: "Glob pattern for files to exclude",
            }

        ]
    });

    options.shouldExclude = makeExcluder(cl);

    processDir(cl.left, cl.right, cl);
}



