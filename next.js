let fs = require('fs');
let commandLineParser = require('./utils/commandLineParser.js');
let { incrementFilename } = require('./utils/incrementString.js');

module.exports = function main(args)
{
    // Process args
    let cl = commandLineParser.parse(args, {
        usagePrefix: "fwt next",
        packageDir: __dirname,
        synopsis: "Finds the next numbered file that doesn't exist",
        spec: [
            {
                name: "<filename>",
                help: "The file name to increment",
            },
        ]
    });

    while (fs.existsSync(cl.filename))
    {
        cl.filename = incrementFilename(cl.filename);
    }

    console.log(cl.filename);
}
