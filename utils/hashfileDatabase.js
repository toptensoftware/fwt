let os = require('os');
let fs = require('fs');
let path = require('path');
let hashfile = require('./hashfile');
let {  Database, SQL } = require('@toptensoftware/sqlite');

class hashfileDatabase extends Database
{
    constructor()
    {
        super(hashfileDatabase.filename);

        // Migrate
        this.migrate([
            () => this.migrate_1(),
        ]);

        this.hashed = 0;
        this.moved = 0;
        this.purged = 0;
    }

    static get filename()
    {
        return path.join(os.homedir(), ".fwt.db");
    }

    are_files_equal(a, b, lazy)
    {
        var astat = fs.statSync(a);
        var bstat = fs.statSync(b);

        if (!astat.isFile() || !bstat.isFile())
            return false;
        if (astat.mtimeMs != bstat.mtimeMs)
            return false;
        if (astat.size != bstat.size)
            return false;

        var ahash = this.get_hash_of_file(a, lazy);
        var bhash = this.get_hash_of_file(b, lazy);

        return ahash === bhash;
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
        var found = this.findOne("Files", {
            dir: path.dirname(file),
            name: path.basename(file),
            size: stat.size,
            timestamp: stat.mtimeMs,
        });

        if (lazy && !found)
        {
            found = this.findOne("Files", {
                name: path.basename(file),
                size: stat.size,
                timestamp: stat.mtimeMs,
            });

            if (found)
            {
                this.insertOrReplace("Files", {
                    dir: path.dirname(file),
                    name: path.basename(file),
                    size: stat.size,
                    timestamp: stat.mtimeMs,
                    hash: found.hash
                });
                this.moved++;
            }
        }

        if (found)
        {
            return found.hash;
        }

        // Hash the file
        let hash = hashfile(file);
        this.hashed++;

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

    purge()
    {
        let idsToDelete = [];
        for (let f of this.iterate("SELECT * FROM Files"))
        {
            if (!fs.existsSync(path.join(f.dir, f.name)))
            {
                idsToDelete.push(f.id);
            }
        }

        for (let id of idsToDelete)
        {
            this.delete("Files", { id });
        }
        this.purged += idsToDelete.length;
    }


    migrate_1()
    {
        this.createTable({
            tableName: "Files",
            columns: [
                { id: "INTEGER PRIMARY KEY AUTOINCREMENT" },
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