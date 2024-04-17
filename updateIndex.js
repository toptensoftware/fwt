let path = require('path');
let os = require('os');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let hashfileDatabase = require('./utils/hashfileDatabase')

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
                name: "--import:<other>",
                default: [],
                help: "Import cache entries from another .fwt.db file"
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
                name: "--remap:<from:to>",
                default: [],
                help: "Remap directories"
            },
            {
                name: "--delete:<dir>",
                default: [],
                help: "Delete hash maps for specified directories",
            },
            {
                name: "--db:<dbfile>",
                default: null,
                help: "The index database file to use (default = ~/.fwt.db)",
            },
            {
                name: "--stat",
                help: "Show index"
            },
            {
                name: "--rootdirs",
                help: "Show root indexed directories"
            },
            {
                name: "--dirs",
                help: "Show all indexed directories"
            },
            {
                name: "--icase",
                help: "Case insensitive exclude patten matching (default is true for Windows, else false)",
                default: os.platform() === 'win32',
            },
        ]
    });

    // Work out database file to use
    if (cl.db)
    {
        try
        {
            let s = fs.statSync(cl.db);
            if (s.isDirectory())
                cl.db += ".fwt.db";
        }
        catch
        {
        }
    }

    // Delete database file
    if (cl.reset)
    {
        let filename = cl.db ?? hashfileDatabase.filename;
        if (fs.existsSync(filename))
            fs.unlinkSync(filename);
    }

    // Open data
    let db =  new hashfileDatabase(cl.db);

    // Delete
    for (let d of cl.delete)
    {
        db.deleteDir(d);
    }

    // Import
    for (let i of cl.import)
    {
        db.import(i);
    }

    // Remap
    for (let r of cl.remap)
    {
        let parts = r.split(":");
        if (parts.length != 2)
            throw new Error(`Invalid remap: ${r}`);
        db.remap(parts[0], parts[1]);
    }

    // Index files
    if (cl.dir.length > 0)
    {
        db.indexFiles(cl.dir, cl);
    }

    // Purge
    if (cl.purge)
    {
        db.purge();
    }

    // Stats?
    if (cl.rootdirs)
    {
        db.showDirectories(true);
    }
    
    // Stats?
    if (cl.dirs)
    {
        db.showDirectories(false);
    }
    
    // Stats?
    if (cl.stat)
    {
        db.showStats();
    }

    console.log(`${db.hashed} new, ${db.moved} moved, ${db.purged} removed.`)
}
