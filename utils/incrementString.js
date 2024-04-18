let path = require('path');

function isDigit(c) {
    return c >= '0' && c <= '9';
}

function incrementString(str)
{
    // Find end of trailing number
    var endDigitPos = str.length;
    while (endDigitPos > 0 && !isDigit(str[endDigitPos-1]))
        endDigitPos--;

    // No digits, append one
    if (endDigitPos == 0)
        return str + "(2)";

    // Find start of trailing number
    var startDigitPos = endDigitPos;
    while (startDigitPos > 0 && isDigit(str[startDigitPos - 1]))
        startDigitPos--;

    // Get the number
    var number = parseInt(str.substring(startDigitPos, endDigitPos));

    return str.substring(0, startDigitPos) 
        + (number + 1).toString().padStart(endDigitPos - startDigitPos, '0') 
        + str.substring(endDigitPos);
}

function incrementFilename(str)
{
    var p = path.parse(str);
    return path.join(p.dir, incrementString(p.name) + p.ext);
}



module.exports = {
    incrementString,
    incrementFilename,
}