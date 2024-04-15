let crypto = require('crypto');
let fs = require('fs');

let bufa;

function hashfile(a)
{
    // First time, allocate buffer
    if (!bufa)
        bufa = Buffer.allocUnsafe(1024*1024);

    // Open files
    let fda = fs.openSync(a, 'r');

    let hash = crypto.createHash('sha256');

    try
    {
        while (true)
        {
            // Read both files
            let reada = fs.readSync(fda, bufa, 0, bufa.length, null);
            
            // Update hash
            hash.update(bufa.subarray(0, reada));

            // EOF reached?
            if (reada < bufa.length)
                break;
        }

        return hash.digest('hex');;
    }
    finally
    {
        fs.closeSync(fda);
    }
}


module.exports = hashfile;