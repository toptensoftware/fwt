function globToRx(glob)
{
    let rx = "^";
    for (let i=0; i<glob.length; i++)
    {
        let ch = glob[i];

        switch (ch)
        {
            case '?':
                // Any Character
                rx += ".";
                break;

            case '*':
                // Any Characters
                rx += ".*";
                break;

            case '[':
                // Character class
                rx += '[';
                i++;
                if (i < glob.length)
                {
                    if (glob[i] == '!')
                    {
                        rx += '^';
                        i++;
                    }
                }
                while (i < glob.length && glob[i] != ']')
                {
                    if (glob[i] == '\\')
                    {
                        rx += '\\';
                        i++;
                        if (i < glob.length)
                            rx += glob[i++];
                    }
                    else
                    {
                        rx += glob[i++];
                    }
                }
                rx += ']';
                break;
            
            case '\\':
            case ']':
            case '{':
            case '}':
            case '(':
            case ')':
            case '<':
            case '>':
            case '+':
            case '-':
            case '=':
            case '!':
            case '?':
            case '^':
            case '$':
            case '|':
            case '.':
                // Escaped characters
                rx += '\\' + ch;
                break;

            default:
                // Literal character
                rx += ch;
                break;
        }
    }

    rx += '$';
    return rx;
}

module.exports = globToRx;