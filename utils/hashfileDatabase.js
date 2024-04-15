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

    get_hash_of_file(file)
    {
        // Resolve to absolute path
        file = path.resolve(file);

        // Stat it and quit if not a file
        var stat = fs.statSync(file);
        if (!stat.isFile())
            throw new Error(`${file} is not a file`);

        // Look up database
        var found = this.findOne("Files", {
            path: file,
            size: stat.size,
            timestamp: stat.mtimeMs,
        });
        if (found)
            return found.hash;

        // Hash the file
        let hash = hashfile(file);

        // Store in database
        this.insertOrReplace("Files", {
            path: file,
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
                { path: "STRING NOT NULL" },                    // Plain file name
                { size: "INTEGER NOT NULL" },                   // Bytes
                { timestamp: "INTEGER NOT NULL" },                            // Date taken in UTC unix epoch milliseconds
                { hash: "STRING NOT NULL" },                          // The date taken but in local time unix epoch milliseconds
            ],
            indicies: [
                { 
                    unique: true,
                    columns: [ "path" ],
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