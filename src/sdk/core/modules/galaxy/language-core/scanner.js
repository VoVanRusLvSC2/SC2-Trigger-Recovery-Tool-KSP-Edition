import { DiagnosticCategory, } from "./types.js";
// The compiler core is transport- and host-neutral. Scanner tracing is deliberately
// silent here; callers surface parser diagnostics through the public analysis API.
const log = Object.freeze({
    error: (_message, _context) => undefined,
});
const textToTokenTable = new Map([
    ['include', 50 /* SyntaxKind.IncludeKeyword */],
    ['struct', 51 /* SyntaxKind.StructKeyword */],
    ['static', 52 /* SyntaxKind.StaticKeyword */],
    ['const', 53 /* SyntaxKind.ConstKeyword */],
    ['native', 54 /* SyntaxKind.NativeKeyword */],
    ['break', 55 /* SyntaxKind.BreakKeyword */],
    ['continue', 56 /* SyntaxKind.ContinueKeyword */],
    ['breakpoint', 57 /* SyntaxKind.BreakpointKeyword */],
    ['return', 58 /* SyntaxKind.ReturnKeyword */],
    ['switch', 59 /* SyntaxKind.SwitchKeyword */],
    // ["case", SyntaxKind.CaseKeyword],
    ['default', 60 /* SyntaxKind.DefaultKeyword */],
    ['new', 61 /* SyntaxKind.NewKeyword */],
    ['do', 62 /* SyntaxKind.DoKeyword */],
    ['for', 63 /* SyntaxKind.ForKeyword */],
    ['while', 64 /* SyntaxKind.WhileKeyword */],
    ['if', 65 /* SyntaxKind.IfKeyword */],
    ['else', 66 /* SyntaxKind.ElseKeyword */],
    ['true', 67 /* SyntaxKind.TrueKeyword */],
    ['false', 68 /* SyntaxKind.FalseKeyword */],
    ['null', 69 /* SyntaxKind.NullKeyword */],
    ['typedef', 70 /* SyntaxKind.TypedefKeyword */],
    ['abilcmd', 77 /* SyntaxKind.AbilcmdKeyword */],
    ['actor', 78 /* SyntaxKind.ActorKeyword */],
    ['actorscope', 79 /* SyntaxKind.ActorscopeKeyword */],
    ['aifilter', 80 /* SyntaxKind.AifilterKeyword */],
    ['bank', 81 /* SyntaxKind.BankKeyword */],
    ['bool', 71 /* SyntaxKind.BoolKeyword */],
    ['bitmask', 82 /* SyntaxKind.BitmaskKeyword */],
    ['byte', 72 /* SyntaxKind.ByteKeyword */],
    ['camerainfo', 83 /* SyntaxKind.CamerainfoKeyword */],
    ['char', 73 /* SyntaxKind.CharKeyword */],
    ['color', 84 /* SyntaxKind.ColorKeyword */],
    ['doodad', 86 /* SyntaxKind.DoodadKeyword */],
    ['datetime', 85 /* SyntaxKind.DatetimeKeyword */],
    ['fixed', 75 /* SyntaxKind.FixedKeyword */],
    ['handle', 87 /* SyntaxKind.HandleKeyword */],
    ['generichandle', 88 /* SyntaxKind.GenerichandleKeyword */],
    ['effecthistory', 89 /* SyntaxKind.EffecthistoryKeyword */],
    ['int', 74 /* SyntaxKind.IntKeyword */],
    ['marker', 90 /* SyntaxKind.MarkerKeyword */],
    ['order', 91 /* SyntaxKind.OrderKeyword */],
    ['playergroup', 92 /* SyntaxKind.PlayergroupKeyword */],
    ['point', 93 /* SyntaxKind.PointKeyword */],
    ['region', 94 /* SyntaxKind.RegionKeyword */],
    ['revealer', 95 /* SyntaxKind.RevealerKeyword */],
    ['sound', 96 /* SyntaxKind.SoundKeyword */],
    ['soundlink', 97 /* SyntaxKind.SoundlinkKeyword */],
    ['string', 76 /* SyntaxKind.StringKeyword */],
    ['text', 98 /* SyntaxKind.TextKeyword */],
    ['timer', 99 /* SyntaxKind.TimerKeyword */],
    ['transmissionsource', 100 /* SyntaxKind.TransmissionsourceKeyword */],
    ['trigger', 101 /* SyntaxKind.TriggerKeyword */],
    ['unit', 102 /* SyntaxKind.UnitKeyword */],
    ['unitfilter', 103 /* SyntaxKind.UnitfilterKeyword */],
    ['unitgroup', 104 /* SyntaxKind.UnitgroupKeyword */],
    ['unitref', 105 /* SyntaxKind.UnitrefKeyword */],
    ['void', 106 /* SyntaxKind.VoidKeyword */],
    ['wave', 107 /* SyntaxKind.WaveKeyword */],
    ['waveinfo', 108 /* SyntaxKind.WaveinfoKeyword */],
    ['wavetarget', 109 /* SyntaxKind.WavetargetKeyword */],
    ['arrayref', 110 /* SyntaxKind.ArrayrefKeyword */],
    ['structref', 111 /* SyntaxKind.StructrefKeyword */],
    ['funcref', 112 /* SyntaxKind.FuncrefKeyword */],
    ['{', 4 /* SyntaxKind.OpenBraceToken */],
    ['}', 5 /* SyntaxKind.CloseBraceToken */],
    ['(', 6 /* SyntaxKind.OpenParenToken */],
    [')', 7 /* SyntaxKind.CloseParenToken */],
    ['[', 8 /* SyntaxKind.OpenBracketToken */],
    [']', 9 /* SyntaxKind.CloseBracketToken */],
    ["./index.js", 10 /* SyntaxKind.DotToken */],
    [';', 11 /* SyntaxKind.SemicolonToken */],
    [',', 12 /* SyntaxKind.CommaToken */],
    ['<', 13 /* SyntaxKind.LessThanToken */],
    ['>', 14 /* SyntaxKind.GreaterThanToken */],
    ['<=', 15 /* SyntaxKind.LessThanEqualsToken */],
    ['>=', 16 /* SyntaxKind.GreaterThanEqualsToken */],
    ['==', 17 /* SyntaxKind.EqualsEqualsToken */],
    ['!=', 18 /* SyntaxKind.ExclamationEqualsToken */],
    ['=>', 19 /* SyntaxKind.EqualsGreaterThanToken */],
    ['+', 20 /* SyntaxKind.PlusToken */],
    ['-', 21 /* SyntaxKind.MinusToken */],
    ['*', 22 /* SyntaxKind.AsteriskToken */],
    ['/', 23 /* SyntaxKind.SlashToken */],
    ['%', 24 /* SyntaxKind.PercentToken */],
    ['++', 25 /* SyntaxKind.PlusPlusToken */],
    ['--', 26 /* SyntaxKind.MinusMinusToken */],
    ['<<', 27 /* SyntaxKind.LessThanLessThanToken */],
    ['>>', 28 /* SyntaxKind.GreaterThanGreaterThanToken */],
    ['&', 29 /* SyntaxKind.AmpersandToken */],
    ['|', 30 /* SyntaxKind.BarToken */],
    ['^', 31 /* SyntaxKind.CaretToken */],
    ['!', 32 /* SyntaxKind.ExclamationToken */],
    ['~', 33 /* SyntaxKind.TildeToken */],
    ['&&', 34 /* SyntaxKind.AmpersandAmpersandToken */],
    ['||', 35 /* SyntaxKind.BarBarToken */],
    ['?', 36 /* SyntaxKind.QuestionToken */],
    [':', 37 /* SyntaxKind.ColonToken */],
    ['=', 39 /* SyntaxKind.EqualsToken */],
    ['+=', 40 /* SyntaxKind.PlusEqualsToken */],
    ['-=', 41 /* SyntaxKind.MinusEqualsToken */],
    ['*=', 42 /* SyntaxKind.AsteriskEqualsToken */],
    ['/=', 43 /* SyntaxKind.SlashEqualsToken */],
    ['%=', 44 /* SyntaxKind.PercentEqualsToken */],
    ['<<=', 45 /* SyntaxKind.LessThanLessThanEqualsToken */],
    ['>>=', 46 /* SyntaxKind.GreaterThanGreaterThanEqualsToken */],
    ['&=', 47 /* SyntaxKind.AmpersandEqualsToken */],
    ['|=', 48 /* SyntaxKind.BarEqualsToken */],
    ['^=', 49 /* SyntaxKind.CaretEqualsToken */],
]);
// const tokenStrings = new Map(Array.from(textToTokenTable).reverse());
function makeReverseMap(source) {
    const result = [];
    source.forEach((value, name) => {
        result[value] = name;
    });
    return result;
}
const tokenStrings = makeReverseMap(textToTokenTable);
export function stringToToken(s) {
    return textToTokenTable.get(s);
}
export function tokenToString(t) {
    return tokenStrings[t];
}
export function isIdentifierStart(ch) {
    return ((ch >= 65 /* CharacterCodes.A */ && ch <= 90 /* CharacterCodes.Z */) ||
        (ch >= 97 /* CharacterCodes.a */ && ch <= 122 /* CharacterCodes.z */));
}
export function isIdentifierPart(ch) {
    return ((ch >= 65 /* CharacterCodes.A */ && ch <= 90 /* CharacterCodes.Z */) ||
        (ch >= 97 /* CharacterCodes.a */ && ch <= 122 /* CharacterCodes.z */) ||
        (ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */) ||
        ch === 95 /* CharacterCodes._ */);
}
export function isLineBreak(ch) {
    return (ch === 10 /* CharacterCodes.lineFeed */ ||
        ch === 13 /* CharacterCodes.carriageReturn */ ||
        ch === 8232 /* CharacterCodes.lineSeparator */ ||
        ch === 8233 /* CharacterCodes.paragraphSeparator */);
}
export function isDigit(ch) {
    return ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */;
}
export function isOctalDigit(ch) {
    return ch >= 48 /* CharacterCodes._0 */ && ch <= 55 /* CharacterCodes._7 */;
}
export class Scanner {
    line;
    char;
    // Current position (end position of text of current token)
    pos;
    // end of text
    end;
    // Start position of whitespace before current token
    startPos;
    // Start position of text of current token
    tokenPos;
    text;
    token;
    tokenValue;
    // private precedingLineBreak: boolean;
    // private hasExtendedUnicodeEscape: boolean;
    // private tokenIsUnterminated: boolean;
    // private numericLiteralFlags: NumericLiteralFlags;
    onError;
    lineMap;
    constructor(onError) {
        this.onError = onError;
    }
    error(msg) {
        if (this.onError) {
            this.onError({
                category: DiagnosticCategory.Error,
                code: 0,
                message: msg,
            }, this.pos, 1);
        }
    }
    speculationHelper(callback, isLookahead) {
        const saveLine = this.line;
        const saveCol = this.char;
        const savePos = this.pos;
        const saveStartPos = this.startPos;
        const saveTokenPos = this.tokenPos;
        const saveToken = this.token;
        const saveTokenValue = this.tokenValue;
        const saveLineMapLength = this.lineMap.length;
        // const savePrecedingLineBreak = this.precedingLineBreak;
        const result = callback();
        // If our callback returned something 'falsy' or we're just looking ahead,
        // then unconditionally restore us to where we were.
        if (!result || isLookahead) {
            this.line = saveLine;
            this.char = saveCol;
            this.pos = savePos;
            this.startPos = saveStartPos;
            this.tokenPos = saveTokenPos;
            this.token = saveToken;
            this.tokenValue = saveTokenValue;
            if (this.lineMap.length !== saveLineMapLength) {
                this.lineMap = this.lineMap.slice(0, saveLineMapLength);
            }
            // this.precedingLineBreak = savePrecedingLineBreak;
        }
        return result;
    }
    lookAhead(callback) {
        return this.speculationHelper(callback, true);
    }
    tryScan(callback) {
        return this.speculationHelper(callback, false);
    }
    scanHexDigits(minCount, scanAsManyAsPossible) {
        let digits = 0;
        let value = 0;
        while (digits < minCount || scanAsManyAsPossible) {
            const ch = this.text.charCodeAt(this.pos);
            if (ch >= 48 /* CharacterCodes._0 */ && ch <= 57 /* CharacterCodes._9 */) {
                value = value * 16 + ch - 48 /* CharacterCodes._0 */;
            }
            else if (ch >= 65 /* CharacterCodes.A */ && ch <= 70 /* CharacterCodes.F */) {
                value = value * 16 + ch - 65 /* CharacterCodes.A */ + 10;
            }
            else if (ch >= 97 /* CharacterCodes.a */ && ch <= 102 /* CharacterCodes.f */) {
                value = value * 16 + ch - 97 /* CharacterCodes.a */ + 10;
            }
            else {
                break;
            }
            this.pos++;
            digits++;
        }
        if (digits < minCount) {
            value = -1;
        }
        return value;
    }
    scanEscapeSequence() {
        this.pos++;
        if (this.pos >= this.end) {
            this.error('Diagnostics.Unexpected_end_of_text');
            return '';
        }
        const ch = this.text.charCodeAt(this.pos);
        this.pos++;
        switch (ch) {
            case 48 /* CharacterCodes._0 */:
                return '\0';
            case 98 /* CharacterCodes.b */:
                return '\b';
            case 116 /* CharacterCodes.t */:
                return '\t';
            case 110 /* CharacterCodes.n */:
                return '\n';
            case 118 /* CharacterCodes.v */:
                return '\v';
            case 102 /* CharacterCodes.f */:
                return '\f';
            case 114 /* CharacterCodes.r */:
                return '\r';
            case 39 /* CharacterCodes.singleQuote */:
                return "'";
            case 34 /* CharacterCodes.doubleQuote */:
                return '"';
            case 120 /* CharacterCodes.x */: {
                // '\xDD'
                const escapedValue = this.scanHexDigits(2, false);
                if (escapedValue >= 0) {
                    return String.fromCharCode(escapedValue);
                }
                else {
                    this.error('Diagnostics.Hexadecimal_digit_expected');
                    return '';
                }
            }
            // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
            // the line terminator is interpreted to be "the empty code unit sequence".
            case 13 /* CharacterCodes.carriageReturn */:
                if (this.pos < this.end && this.text.charCodeAt(this.pos) === 10 /* CharacterCodes.lineFeed */) {
                    this.pos++;
                }
            // falls through
            case 10 /* CharacterCodes.lineFeed */:
            case 8232 /* CharacterCodes.lineSeparator */:
            case 8233 /* CharacterCodes.paragraphSeparator */:
                this.error('Multiline strings not supported');
                return '';
            default:
                return String.fromCharCode(ch);
        }
    }
    scanString(allowEscapes = true) {
        const quote = this.text.charCodeAt(this.pos);
        this.pos++;
        let result = '';
        let start = this.pos;
        while (true) {
            if (this.pos >= this.end) {
                result += this.text.substring(start, this.pos);
                // tokenIsUnterminated = true;
                this.error('Diagnostics.Unterminated_string_literal');
                break;
            }
            const ch = this.text.charCodeAt(this.pos);
            if (ch === quote) {
                result += this.text.substring(start, this.pos);
                this.pos++;
                break;
            }
            if (ch === 92 /* CharacterCodes.backslash */ && allowEscapes) {
                result += this.text.substring(start, this.pos);
                result += this.scanEscapeSequence();
                start = this.pos;
                continue;
            }
            if (isLineBreak(ch)) {
                result += this.text.substring(start, this.pos);
                // tokenIsUnterminated = true;
                this.error('Diagnostics.Unterminated_string_literal');
                break;
            }
            this.pos++;
        }
        return result;
    }
    scanNumber() {
        const start = this.pos;
        while (isDigit(this.text.charCodeAt(this.pos)))
            this.pos++;
        if (this.text.charCodeAt(this.pos) === 46 /* CharacterCodes.dot */) {
            this.pos++;
            while (isDigit(this.text.charCodeAt(this.pos)))
                this.pos++;
        }
        let end = this.pos;
        if (this.text.charCodeAt(this.pos) === 69 /* CharacterCodes.E */ ||
            this.text.charCodeAt(this.pos) === 101 /* CharacterCodes.e */) {
            this.pos++;
            // numericLiteralFlags = NumericLiteralFlags.Scientific;
            if (this.text.charCodeAt(this.pos) === 43 /* CharacterCodes.plus */ ||
                this.text.charCodeAt(this.pos) === 45 /* CharacterCodes.minus */)
                this.pos++;
            if (isDigit(this.text.charCodeAt(this.pos))) {
                this.pos++;
                while (isDigit(this.text.charCodeAt(this.pos)))
                    this.pos++;
                end = this.pos;
            }
            else {
                this.error('Diagnostics.Digit_expected');
            }
        }
        return '' + +this.text.substring(start, end);
    }
    scanBinaryOrOctalDigits(base) {
        if (base !== 2 && base !== 8)
            log.error('Expected either base 2 or base 8', { base });
        let value = 0;
        // For counting number of digits; Valid binaryIntegerLiteral must have at least one binary digit following B or b.
        // Similarly valid octalIntegerLiteral must have at least one octal digit following o or O.
        let numberOfDigits = 0;
        while (true) {
            const ch = this.text.charCodeAt(this.pos);
            const valueOfCh = ch - 48 /* CharacterCodes._0 */;
            if (!isDigit(ch) || valueOfCh >= base) {
                break;
            }
            value = value * base + valueOfCh;
            this.pos++;
            numberOfDigits++;
        }
        // Invalid binaryIntegerLiteral or octalIntegerLiteral
        if (numberOfDigits === 0) {
            return -1;
        }
        return value;
    }
    scanOctalDigits() {
        const start = this.pos;
        while (isOctalDigit(this.text.charCodeAt(this.pos))) {
            this.pos++;
        }
        return +this.text.substring(start, this.pos);
    }
    getIdentifierToken() {
        // Reserved words are between 2 and 11 characters long and start with a lowercase letter
        let token;
        const ch = this.tokenValue.charCodeAt(0);
        if (ch >= 97 /* CharacterCodes.a */ && ch <= 122 /* CharacterCodes.z */) {
            token = stringToToken(this.tokenValue);
            if (token !== undefined) {
                return token;
            }
        }
        return 113 /* SyntaxKind.Identifier */;
    }
    setText(text) {
        this.text = text;
        this.pos = 0;
        this.end = this.text.length;
        this.line = 0;
        this.char = 0;
        this.lineMap = [0];
    }
    scan() {
        this.startPos = this.pos;
        while (true) {
            this.tokenPos = this.pos;
            this.tokenValue = null;
            if (this.pos >= this.end) {
                return 114 /* SyntaxKind.EndOfFileToken */;
            }
            let ch = this.text.charCodeAt(this.pos);
            switch (ch) {
                case 9 /* CharacterCodes.tab */:
                case 11 /* CharacterCodes.verticalTab */:
                case 12 /* CharacterCodes.formFeed */:
                case 32 /* CharacterCodes.space */:
                    ++this.pos;
                    break;
                case 59 /* CharacterCodes.semicolon */:
                    ++this.pos;
                    return (this.token = 11 /* SyntaxKind.SemicolonToken */);
                case 40 /* CharacterCodes.openParen */:
                    this.pos++;
                    return (this.token = 6 /* SyntaxKind.OpenParenToken */);
                case 41 /* CharacterCodes.closeParen */:
                    this.pos++;
                    return (this.token = 7 /* SyntaxKind.CloseParenToken */);
                case 34 /* CharacterCodes.doubleQuote */:
                case 39 /* CharacterCodes.singleQuote */:
                    this.tokenValue = this.scanString();
                    return (this.token = 3 /* SyntaxKind.StringLiteral */);
                case 33 /* CharacterCodes.exclamation */:
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 18 /* SyntaxKind.ExclamationEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 32 /* SyntaxKind.ExclamationToken */);
                case 37 /* CharacterCodes.percent */:
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 44 /* SyntaxKind.PercentEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 24 /* SyntaxKind.PercentToken */);
                case 38 /* CharacterCodes.ampersand */:
                    if (this.text.charCodeAt(this.pos + 1) === 38 /* CharacterCodes.ampersand */) {
                        return ((this.pos += 2), (this.token = 34 /* SyntaxKind.AmpersandAmpersandToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 47 /* SyntaxKind.AmpersandEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 29 /* SyntaxKind.AmpersandToken */);
                case 42 /* CharacterCodes.asterisk */:
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 42 /* SyntaxKind.AsteriskEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 22 /* SyntaxKind.AsteriskToken */);
                case 43 /* CharacterCodes.plus */:
                    if (this.text.charCodeAt(this.pos + 1) === 43 /* CharacterCodes.plus */) {
                        return ((this.pos += 2), (this.token = 25 /* SyntaxKind.PlusPlusToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 40 /* SyntaxKind.PlusEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 20 /* SyntaxKind.PlusToken */);
                case 44 /* CharacterCodes.comma */:
                    this.pos++;
                    return (this.token = 12 /* SyntaxKind.CommaToken */);
                case 45 /* CharacterCodes.minus */:
                    if (this.text.charCodeAt(this.pos + 1) === 45 /* CharacterCodes.minus */) {
                        return ((this.pos += 2), (this.token = 26 /* SyntaxKind.MinusMinusToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 41 /* SyntaxKind.MinusEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 21 /* SyntaxKind.MinusToken */);
                case 46 /* CharacterCodes.dot */:
                    if (isDigit(this.text.charCodeAt(this.pos + 1))) {
                        this.tokenValue = this.scanNumber();
                        return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                    }
                    this.pos++;
                    return (this.token = 10 /* SyntaxKind.DotToken */);
                case 47 /* CharacterCodes.slash */:
                    // Single-line comment
                    if (this.text.charCodeAt(this.pos + 1) === 47 /* CharacterCodes.slash */) {
                        this.pos += 2;
                        while (this.pos < this.end) {
                            const char = this.text.charCodeAt(this.pos);
                            if (isLineBreak(char)) {
                                break;
                            }
                            this.pos++;
                        }
                        return (this.token = 1 /* SyntaxKind.SingleLineCommentTrivia */);
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 43 /* SyntaxKind.SlashEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 23 /* SyntaxKind.SlashToken */);
                case 48 /* CharacterCodes._0 */:
                    if (this.pos + 2 < this.end &&
                        (this.text.charCodeAt(this.pos + 1) === 88 /* CharacterCodes.X */ ||
                            this.text.charCodeAt(this.pos + 1) === 120 /* CharacterCodes.x */)) {
                        this.pos += 2;
                        let value = this.scanHexDigits(1, true);
                        if (value < 0) {
                            this.error('Diagnostics.Hexadecimal_digit_expected');
                            value = 0;
                        }
                        this.tokenValue = '' + value;
                        // numericLiteralFlags = NumericLiteralFlags.HexSpecifier;
                        return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                    }
                    else if (this.pos + 2 < this.end &&
                        (this.text.charCodeAt(this.pos + 1) === 66 /* CharacterCodes.B */ ||
                            this.text.charCodeAt(this.pos + 1) === 98 /* CharacterCodes.b */)) {
                        this.pos += 2;
                        let value = this.scanBinaryOrOctalDigits(/* base */ 2);
                        if (value < 0) {
                            this.error('Diagnostics.Binary_digit_expected');
                            value = 0;
                        }
                        this.tokenValue = '' + value;
                        // numericLiteralFlags = NumericLiteralFlags.BinarySpecifier;
                        return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                    }
                    else if (this.pos + 2 < this.end &&
                        (this.text.charCodeAt(this.pos + 1) === 79 /* CharacterCodes.O */ ||
                            this.text.charCodeAt(this.pos + 1) === 111 /* CharacterCodes.o */)) {
                        this.pos += 2;
                        let value = this.scanBinaryOrOctalDigits(/* base */ 8);
                        if (value < 0) {
                            this.error('Diagnostics.Octal_digit_expected');
                            value = 0;
                        }
                        this.tokenValue = '' + value;
                        // numericLiteralFlags = NumericLiteralFlags.OctalSpecifier;
                        return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                    }
                    // Try to parse as an octal
                    if (this.pos + 1 < this.end && isOctalDigit(this.text.charCodeAt(this.pos + 1))) {
                        this.tokenValue = '' + this.scanOctalDigits();
                        // numericLiteralFlags = NumericLiteralFlags.Octal;
                        return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                    }
                // This fall-through is a deviation from the EcmaScript grammar. The grammar says that a leading zero
                // can only be followed by an octal digit, a dot, or the end of the number literal. However, we are being
                // permissive and allowing decimal digits of the form 08* and 09* (which many browsers also do).
                // falls through
                case 49 /* CharacterCodes._1 */:
                case 50 /* CharacterCodes._2 */:
                case 51 /* CharacterCodes._3 */:
                case 52 /* CharacterCodes._4 */:
                case 53 /* CharacterCodes._5 */:
                case 54 /* CharacterCodes._6 */:
                case 55 /* CharacterCodes._7 */:
                case 56 /* CharacterCodes._8 */:
                case 57 /* CharacterCodes._9 */:
                    this.tokenValue = this.scanNumber();
                    return (this.token = 2 /* SyntaxKind.NumericLiteral */);
                case 60 /* CharacterCodes.lessThan */:
                    if (this.text.charCodeAt(this.pos + 1) === 60 /* CharacterCodes.lessThan */) {
                        if (this.text.charCodeAt(this.pos + 2) === 61 /* CharacterCodes.equals */) {
                            return ((this.pos += 3), (this.token = 45 /* SyntaxKind.LessThanLessThanEqualsToken */));
                        }
                        return ((this.pos += 2), (this.token = 27 /* SyntaxKind.LessThanLessThanToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 15 /* SyntaxKind.LessThanEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 13 /* SyntaxKind.LessThanToken */);
                case 61 /* CharacterCodes.equals */:
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 17 /* SyntaxKind.EqualsEqualsToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 62 /* CharacterCodes.greaterThan */) {
                        return ((this.pos += 2), (this.token = 19 /* SyntaxKind.EqualsGreaterThanToken */));
                    }
                    this.pos++;
                    return (this.token = 39 /* SyntaxKind.EqualsToken */);
                case 62 /* CharacterCodes.greaterThan */:
                    if (this.text.charCodeAt(this.pos + 1) === 62 /* CharacterCodes.greaterThan */) {
                        if (this.text.charCodeAt(this.pos + 2) === 61 /* CharacterCodes.equals */) {
                            return ((this.pos += 3), (this.token = 46 /* SyntaxKind.GreaterThanGreaterThanEqualsToken */));
                        }
                        return ((this.pos += 2), (this.token = 28 /* SyntaxKind.GreaterThanGreaterThanToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 16 /* SyntaxKind.GreaterThanEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 14 /* SyntaxKind.GreaterThanToken */);
                case 91 /* CharacterCodes.openBracket */:
                    this.pos++;
                    return (this.token = 8 /* SyntaxKind.OpenBracketToken */);
                case 93 /* CharacterCodes.closeBracket */:
                    this.pos++;
                    return (this.token = 9 /* SyntaxKind.CloseBracketToken */);
                case 94 /* CharacterCodes.caret */:
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 49 /* SyntaxKind.CaretEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 31 /* SyntaxKind.CaretToken */);
                case 123 /* CharacterCodes.openBrace */:
                    this.pos++;
                    return (this.token = 4 /* SyntaxKind.OpenBraceToken */);
                case 124 /* CharacterCodes.bar */:
                    if (this.text.charCodeAt(this.pos + 1) === 124 /* CharacterCodes.bar */) {
                        return ((this.pos += 2), (this.token = 35 /* SyntaxKind.BarBarToken */));
                    }
                    if (this.text.charCodeAt(this.pos + 1) === 61 /* CharacterCodes.equals */) {
                        return ((this.pos += 2), (this.token = 48 /* SyntaxKind.BarEqualsToken */));
                    }
                    this.pos++;
                    return (this.token = 30 /* SyntaxKind.BarToken */);
                case 125 /* CharacterCodes.closeBrace */:
                    this.pos++;
                    return (this.token = 5 /* SyntaxKind.CloseBraceToken */);
                case 126 /* CharacterCodes.tilde */:
                    this.pos++;
                    return (this.token = 33 /* SyntaxKind.TildeToken */);
                default:
                    if (isIdentifierStart(ch)) {
                        this.pos++;
                        while (this.pos < this.end && isIdentifierPart((ch = this.text.charCodeAt(this.pos))))
                            this.pos++;
                        this.tokenValue = this.text.substring(this.tokenPos, this.pos);
                        return (this.token = this.getIdentifierToken());
                    }
                    else if (isLineBreak(ch)) {
                        if (ch === 10 /* CharacterCodes.lineFeed */) {
                            this.char = this.pos;
                            this.line++;
                        }
                        this.pos++;
                        if (ch === 10 /* CharacterCodes.lineFeed */) {
                            this.lineMap.push(this.pos);
                        }
                        continue;
                    }
                    this.error(`Encountered invalid character: 0x${ch.toString(16)}`);
                    this.pos++;
                    return (this.token = 0 /* SyntaxKind.Unknown */);
            }
        }
    }
    getLine() {
        return this.line;
    }
    getChar() {
        return this.pos - this.char;
    }
    getCurrentPos() {
        return this.pos;
    }
    /**
     * Absolute start position - including adjacent whitespace
     */
    getStartPos() {
        return this.startPos;
    }
    /**
     * Actual start position - excluding adjacent whitespace
     */
    getTokenPos() {
        return this.tokenPos;
    }
    getTokenValue() {
        return this.tokenValue;
    }
    getTokenText() {
        return this.text.substring(this.tokenPos, this.pos);
    }
    getLineMap() {
        return this.lineMap;
    }
}
//# sourceMappingURL=scanner.js.map