let os = require('os');
let fs = require('fs');
let path = require('path');
let hashfile = require('./hashfile');
let {  Database, SQL } = require('@toptensoftware/sqlite');
let makeExcluder = require('./makeExcluder');
let glob = require('./glob');

class hashfileDatabase extends Database
{
    constructor(dbfile)
    {
        dbfile = dbfile ?? hashfileDatabase.filename;
        super(dbfile);
        this.filename = dbfile;

        // Migrate
        this.migrate([
            () => this.migrate_1(),
        ]);

        this.hashed = 0;
        this.moved = 0;
        this.purged = 0;
        this.function("regexp", (str, rx) => {
            let r = str.match(new RegExp(rx, "")) != null;
            return r ? 1 : 0;
        })
        this.function("regexpi", (str, rx) => {
            let r = str.match(new RegExp(rx, "i")) != null;
            return r ? 1 : 0;
        })
    }

    static get filename()
    {
        return path.join(os.homedir(), ".fwt.db");
    }

    showStats()
    {
        console.log(`${this.filename}:`);
        console.log(`        files: ${this.pluck("SELECT COUNT(*) FROM Files")}`);
        console.log(`  directories: ${this.pluck("SELECT COUNT(DISTINCT(dir)) FROM Files")}`);
    }

    showDirectories(roots)
    {
        var dirs = this.all("select dir, count(*) as fileCount from files group by dir");
        if (roots)
        {
            for (let i=0; i<dirs.length - 1; i++)
            {
                if (dirs[i+1].dir.startsWith(dirs[i].dir))
                {
                    dirs[i].fileCount += dirs[i+1].fileCount;
                    dirs.splice(i+1, 1);
                    i--;
                }
            }
        }

        dirs.forEach(x => console.log(`${x.fileCount.toString().padStart(10, ' ')} ${x.dir}`));
    }

    import(from)
    {
        this.run("ATTACH DATABASE ?  AS other", from);
        try
        {
            this.transactionSync(() => {
                console.log(`Importing ${from}...`)
                let r = this.run("INSERT INTO Files(dir,name,size,timestamp,hash) SELECT dir,name,size,timestamp,hash FROM other.Files");
                this.hashed += r.changes;
                this.fix_slashes();
            });
        }
        finally
        {
            this.run("DETACH DATABASE other");
        }
    }

    fix_slashes()
    {
        this.run("update files set dir = replace(dir, ?, ?)", path.sep == '/' ? '\\' : '/', path.sep);
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

        this.transactionSync(() => {
            for (let id of idsToDelete)
            {
                this.delete("Files", { id });
            }
        })
        this.purged += idsToDelete.length;
    }

    remap(from, to)
    {
        console.log(`Remapping ${from} to ${to}...`)
        let sql = SQL
            .update("Files")
            .append("SET dir=? || SUBSTR(dir, ?)", to, from.length + 1)
            .append("WHERE dir = ? OR SUBSTR(dir, 1, ?) = ?", from, from.length + 1, from + path.sep);
        sql.log();
        let r = this.run(sql);
        console.log(`Remapped ${r.changes} files`);
    }

    deleteDir(dir)
    {
        console.log(`Deleting ${dir}...`)
        let sql = SQL
            .delete("Files")
            .append("WHERE dir = ? OR SUBSTR(dir, 1, ?) = ?", dir, dir.length + 1, dir + path.sep);
        let r = this.run(sql);
        console.log(`Deleted ${r.changes} files`);
    }

    indexFiles(dirs, options)
    {
        // Find files
        var excluder = makeExcluder(options);
        let files = []
        for (let i=0; i<dirs.length; i++)
        {
            for (let f of fs.readdirSync(dirs[i], { recursive: true, withFileTypes: true }))
            {
                if (f.isDirectory())
                    continue;
                var fullpath = path.join(f.path, f.name)
                if (!excluder(fullpath))
                    files.push(fullpath);
            }
        }

        this.run("SAVEPOINT indexing");

        try
        {
            // Calculate hashes
            for (let i = 0; i<files.length; i++)
            {
                process.stdout.clearLine();
                process.stdout.cursorTo(0); 
                process.stdout.write(`Indexing ${i+1} of ${files.length} - ${files[i]}`)
                try
                {
                    files[i] = {
                        filename: files[i],
                        hash: this.get_hash_of_file(files[i], options.move),
                    }
                }
                catch (err)
                {
                    process.stdout.clearLine();
                    process.stdout.cursorTo(0);
                    process.stderr.write(`${err.message}\n`);
                    files.splice(i, 1);
                    i--;
                }

                if (i % 1000 == 0)
                {
                    this.run("RELEASE SAVEPOINT indexing");
                    this.run("SAVEPOINT indexing");
                }
            }

            process.stdout.clearLine();
            process.stdout.cursorTo(0); 
        }
        finally
        {
            this.run("RELEASE SAVEPOINT indexing");
        }

        return files;
    }

    query(spec, icase)
    {
        let rx = glob(spec);
        if (icase)
            return this.all("SELECT * FROM FILES WHERE regexpi(dir || ? || name, ?)", path.sep, rx);
        else
            return this.all("SELECT * FROM FILES WHERE regexp(dir || ? || name, ?)", path.sep, rx);
    }

    queryByName(name)
    {
        return this.all("SELECT * FROM FILES WHERE name = ?", name);
    }

    queryByHash(hash)
    {
        return this.all("SELECT * FROM FILES WHERE hash = ?", hash);
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