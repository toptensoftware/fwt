let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser.js');
const phash = require('phash-im');

module.exports = async function main(args)
{
    // Process args
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt next",
        packageDir: __dirname,
        synopsis: "Calculates the phash for a file",
        spec: [
            {
                name: "<filename>",
                help: "The file to phash",
            },
            {
                name: "<filename2>",
                help: "Optional second file to compare",
                default: null,
            },
        ]
    });

    
    let hash = await phash.compute(cl.filename);
    console.log(hash);
    if (cl.filename2)
    {
        let hash2 = await phash.compute(cl.filename2);
        console.log(hash2);
        console.log("similarity: ", phash.compare(hash, hash2));
    }
}
