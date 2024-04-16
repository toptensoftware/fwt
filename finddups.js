let path = require('path');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let hashfileDatabase = require('./utils/hashfileDatabase')

let hashmap = new Map();
let filemap = new Map();

function processDir(source, options)
{
    console.log(`indexing: ${source}\n`);
    try
    {
        // Process all items in the source directory
        let items = fs.readdirSync(source);
        for (let i=0; i<items.length; i++)
        {
            let item = items[i];

            // Get source item path
            let sourceItem = path.join(source, item);
            
            // Is the source item a directory
            let statSource = fs.statSync(sourceItem);
            if (statSource.isDirectory())
            {
                processDir(sourceItem, options);
                continue;
            }

            // Get the hash of the file
            let hash = options.db.get_hash_of_file(sourceItem, !options.strict);

            filemap.set(sourceItem, hash);

            let list = hashmap.get(hash);
            if (list == null)
            {
                list = [ sourceItem ];
                hashmap.set(hash, list);
            }
            else
            {
                list.push(sourceItem);
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
        usagePrefix: "fwt finddups",
        packageDir: __dirname,
        synopsis: "Compare all files in one or more directories and list duplicates and entirely duplicated directories",
        spec: [
            {
                name: "<dir>",
                default: [],
                help: "The directories to check",
            },
            {
                name: "--strict",
                default: true,
                help: "Use full directory, file name and attributes in cache file lookup.  Otherwise filename and attributes only. (default true)",   
            }
        ]
    });


    cl.db =  new hashfileDatabase();
    
    // Process directories
    for (let i=0; i<cl.dir.length; i++)
        processDir(cl.dir[i], cl);

    // Show duplicate files
    let dirsWithDups = new Set();
    hashmap.forEach((list) => {
        if (list.length > 1)
        {
            console.log("Duplicates:");
            for (let i of list)
            {
                dirsWithDups.add(path.dirname(i));
                console.log(`  ${i}`);
            }
        }
    });

    // Now look for directories where every file has a duplicate somewhere else
    let dupDirsPrelim = new Set();
    dirsWithDups.forEach(dir => {

        // Process all items in the source directory
        let items = fs.readdirSync(dir);
        for (let filename of items)
        {
            var filepath = path.join(dir, filename);
            var stat = fs.statSync(filepath);

            if (!stat.isDirectory())
            {
                let hash = filemap.get(filepath);
                if (!hash)
                    return;

                let filesWithHash = hashmap.get(hash);
                if (!filesWithHash)
                    return;
                if (filesWithHash.length < 2)
                    return;

                if (!filesWithHash.some(x => {
                    var rel = path.relative(path.dirname(filepath), path.dirname(x));
                    return rel.startsWith("..") || rel.startsWith("/") || rel.startsWith("\\");
                    }))
                    return;
            }
        }
        dupDirsPrelim.add(dir);
    });

    // Now find all the directories where not only all the files are duplicated
    // but also all the sub-directories are also fully recursively duplicated
    let dupDirsFinal = new Set();
    function checkAllSubDirsDup(x)
    {
        // Already checked
        if (dupDirsFinal.has(x))
            return true;

        // Are all files duplicate?
        if (!dupDirsPrelim.has(x))
            return false;

        // Check all sub-directories are fully duplicated
        for (let e of fs.readdirSync(x))
        {
            var item = path.join(x, e);
            var stat = fs.statSync(item);
            if (!stat.isDirectory())
                continue;
            if (!checkAllSubDirsDup(item))
                return false;
        }

        // It really it duplicated!
        dupDirsFinal.add(x);
        return true;
    }
    dupDirsPrelim.forEach(x => checkAllSubDirsDup(x));
    
    // Sort and remove sub-directories as they're implicitly duplicated by the parent being fully duplciated
    let dupDirsSorted = [...dupDirsFinal];
    dupDirsSorted.sort();
    for (let i=0; i<dupDirsSorted.length; i++)
    {
        while (i + 1 < dupDirsSorted.length && dupDirsSorted[i+1].startsWith(dupDirsSorted[i] + path.sep))
            dupDirsSorted.splice(i+1, 1);
    }

    // List the fully duplicated directories
    if (dupDirsFinal.size > 0)
    {
        console.log("Fully duplicated directories:")
        dupDirsSorted.forEach(x => console.log(x));
    }
}
