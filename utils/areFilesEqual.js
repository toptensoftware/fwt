let fs = require('fs');

// Create buffers
let bufa = null
let bufb = null;

function areFilesEqual(a, b)
{
    // First time, allocate buffers
    if (!bufa)
    {
        bufa = Buffer.allocUnsafe(1024*1024);
        bufb = Buffer.allocUnsafe(1024*1024);
    }

    // Compare size first
    let astat = fs.statSync(a);
    let bstat = fs.statSync(b);
    if (astat.size != bstat.size)
        return false;

    // Open both files
    let fda = fs.openSync(a, 'r');
    let fdb = fs.openSync(b, 'r');

    try
    {
        while (true)
        {
            // Read both files
            let reada = fs.readSync(fda, bufa, 0, bufa.length, null);
            let readb = fs.readSync(fdb, bufb, 0, bufb.length, null);

            // Check same read from both
            if (reada != readb)
                return false;

            // Compare
            if (Buffer.compare(bufa.subarray(0, reada), bufb.subarray(0, readb)) != 0)
                return false;

            // EOF reached?
            if (reada < bufa.length)
                break;
        }

        return true;
    }
    finally
    {
        fs.closeSync(fda);
        fs.closeSync(fdb);
    }
}


module.exports = areFilesEqual;