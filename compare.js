let path = require('path');
let fs = require('fs');
let os = require('os');
let commandLineParser = require('./utils/commandLineParser');
let makeExcluder = require('./utils/makeExcluder');
let hashfileDatabase = require('./utils/hashfileDatabase');

let leftMissing = 0;
let rightMissing = 0;
let different = 0;

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

            if (options.shouldExcludeSource(si))
                return;

            // Check exists
            if (!targetItems.has(i))
            {
                if (!options.noRight)
                {
                    console.log(`  missing: ${ti}`);
                    rightMissing++;
                }
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
                different++;
                return;
            }

            // Directory or file?
            if (ss.isDirectory())
            {
                processDir(si, ti, options);
            }
            else
            {
                let sameTime = Math.abs(ss.mtimeMs - ts.mtimeMs) <= 2000;
                let same = ss.size == ts.size && sameTime;
                if (same && !options.attrs)
                {
                    same = options.db.are_files_equal(si, ti, false);
                }
                if (!same)
                {
                    let reason = "";
                    if (!sameTime && ss.mtimeMs > ts.mtimeMs)
                    {
                        reason = ` (left newer)`;
                    }
                    else if (!sameTime && ss.mtimeMs < ts.mtimeMs)
                    {
                        reason = ` (right newer)`;
                    }
                    else if (ss.size > ts.size)
                    {
                        reason = ` (left larger)`;
                    }
                    else if (ss.size < ts.size)
                    {
                        reason = ` (right larger)`;
                    }
                    else
                    {
                        reason = ` (content)`;
                    }
                    console.log(`different: ${si} <> ${ti}${reason}`)
                    different++;
                }
            }
        });

        targetItems.forEach(i => {
            var si = path.join(source, i);
            if (options.shouldExcludeTarget(si))
                return;
            if (!options.noLeft)
            {
                console.log(`  missing: ${si}`);
                leftMissing++;
            }
        });
    }
    catch (err)
    {
        console.error(` ${err.message}`);
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
                name: "--attrs",
                default: false,
                help: "Compare by file attributes only",
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

    // Make pattern excluders
    var excluder = makeExcluder(cl);
    cl.shouldExcludeSource = (x) => excluder(x.substring(cl.left.length));
    cl.shouldExcludeTarget = (x) => excluder(x.substring(cl.right.length));

    // Open data base if required
    if (!cl.attrs)
    {
        cl.db = new hashfileDatabase();
    }

    // Process
    processDir(cl.left, cl.right, cl);

    console.log(`Left missing: ${leftMissing}  Right Missing: ${rightMissing}  Different: ${different}`)
}



