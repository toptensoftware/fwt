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
        synopsis: "Update file hash indicies",
        spec: [
            {
                name: "<dir>",
                default: [],
                help: "The directories to check",
            },
            {
                name: "--move",
                help: "Update indicies, assuming files have moved (saves rehashing known files)"
            },
            {
                name: "--purge",
                help: "Purge no longer existing files from indicies"
            },
            {
                name: "--reset",
                help: "Delete all previously built indicies"
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

    // Delete database file
    if (cl.reset)
    {
        let filename = hashfileDatabase.filename;
        if (fs.existsSync(filename))
            fs.unlinkSync(filename);
    }

    // Open data
    let db =  new hashfileDatabase();
    
    // Find files
    var excluder = makeExcluder(cl);
    let files = []
    for (let i=0; i<cl.dir.length; i++)
    {
        for (let f of fs.readdirSync(cl.dir[i], { recursive: true, withFileTypes: true }))
        {
            if (f.isDirectory())
                continue;
            if (!excluder(f))
                files.push(path.join(f.path, f.name));
        }
    }

    // Calculate hashes
    for (let i = 0; i<files.length; i++)
    {
        process.stdout.clearLine();
        process.stdout.cursorTo(0); 
        process.stdout.write(`Indexing ${i+1} of ${files.length} - ${files[i]}`)
        db.get_hash_of_file(files[i], cl.move);
    }

    process.stdout.clearLine();
    process.stdout.cursorTo(0); 

    // Purge
    if (cl.purge)
    {
        db.purge();
    }

    console.log(`${db.hashed} new, ${db.moved} moved, ${db.purged} removed.`)
}
