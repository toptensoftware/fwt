let path = require('path');
let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser');
let hashfileDatabase = require('./utils/hashfileDatabase')

let hashmap = new Map();
let filemap = new Map();

function processDir(source, options)
{
    process.stdout.write(`indexing: ${source}\n`);
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
            let hash = options.db.get_hash_of_file(sourceItem);

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
    console.log("Duplicate Directories:")
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
                if (!filesWithHash || filesWithHash.length < 2)
                    return; 
            }
        }
        console.log(dir);
    });
}
