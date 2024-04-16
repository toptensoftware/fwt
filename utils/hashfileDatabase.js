let os = require('os');
let fs = require('fs');
let path = require('path');
let hashfile = require('./hashfile');
let {  Database, SQL } = require('@toptensoftware/sqlite');

class hashfileDatabase extends Database
{
    constructor()
    {
        super(path.join(os.homedir(), ".fwt.db"));

        // Migrate
        this.migrate([
            () => this.migrate_1(),
        ]);
    }

    get_hash_of_file(file, lazy)
    {
        // Resolve to absolute path
        file = path.resolve(file);

        // Stat it and quit if not a file
        var stat = fs.statSync(file);
        if (!stat.isFile())
            throw new Error(`${file} is not a file`);
        
        // Look up database
        var found;
        if (lazy)
        {
            var found = this.findOne("Files", {
                name: path.basename(file),
                size: stat.size,
                timestamp: stat.mtimeMs,
            });
        }
        else
        {
            var found = this.findOne("Files", {
                dir: path.dirname(file),
                name: path.basename(file),
                size: stat.size,
                timestamp: stat.mtimeMs,
            });
        }

        if (found)
            return found.hash;

        // Hash the file
        let hash = hashfile(file);

        // Store in database
        this.insertOrReplace("Files", {
            dir: path.dirname(file),
            name: path.basename(file),
            size: stat.size,
            timestamp: stat.mtimeMs,
            hash: hash
        });

        return hash;
    }


    migrate_1()
    {
        this.createTable({
            tableName: "Files",
            columns: [
                { dir: "STRING NOT NULL" },                 // Directory name
                { name: "STRING NOT NULL" },                // File name
                { size: "INTEGER NOT NULL" },               // Bytes
                { timestamp: "INTEGER NOT NULL" },          // Modified time in milliseconds
                { hash: "STRING NOT NULL" },                // File Hash
            ],
            indicies: [
                { 
                    unique: true,
                    columns: [ "dir", "name" ],
                },
                { 
                    unique: false,
                    columns: [ "name" ],
                },
                {
                    unique: false,
                    columns: [ "hash" ],
                }
            ]
        });
    }
}


module.exports = hashfileDatabase;