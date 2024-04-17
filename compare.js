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

function buildHashMap(files)
{
    let map = new Map();
    for (let f of files)
    {
        let list = map.get(f.hash);
        if (!list)
        {
            list = [];
            map.set(f.hash, list);
        }
        list.push(f.filename);
    }
    return map;
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
                name: "--content",
                help: "Compare files by content only (ignore file names and attributes)"
            },
            {
                name: "--attrs",
                default: false,
                help: "Compare by file attributes only (ignore content)",
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

    if (cl.attrs && cl.attrs)
    {
        throw new Error("Please specify just one of --attrs or --content");
    }

    if (cl.content)
    {
        let db = new hashfileDatabase();

        // Index left and right sides
        let leftFiles = db.indexFiles([cl.left], cl);
        let rightFiles = db.indexFiles([cl.right], cl);

        if (!cl.noLeft)
        {
            console.log("Files in left with no equivalent in right:")
            let rightMap = buildHashMap(rightFiles);
            let missing = 0;
            for (let lf of leftFiles)
            {
                if (!rightMap.has(lf.hash))
                {
                    console.log(`  ${lf.filename}`);
                    missing++;
                }
            }
            console.log(`Total: ${missing}`);
        }
        if (!cl.noRight)
        {
            console.log("Files in right with no equivalent in left:")
            let leftMap = buildHashMap(leftFiles);
            let missing = 0;
            for (let rf of rightFiles)
            {
                if (!leftMap.has(rf.hash))
                {
                    console.log(`  ${rf.filename}`);
                    missing++;
                }
            }
            console.log(`Total: ${missing}`);
        }
    }
    else
    {
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
}



