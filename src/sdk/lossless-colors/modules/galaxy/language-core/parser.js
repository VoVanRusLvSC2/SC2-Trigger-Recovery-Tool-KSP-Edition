import * as Types from "./types.js";
import { Scanner } from "./scanner.js";
import { getKindName, isModifierKind, isKeywordTypeKind, isLeftHandSideExpression, isAssignmentOperator, fixupParentReferences, isReferenceKeywordKind, isAssignmentExpression, createFileDiagnostic, } from "./utils.js";
var ParsingContext;
(function (ParsingContext) {
    ParsingContext[ParsingContext["SourceElements"] = 0] = "SourceElements";
    ParsingContext[ParsingContext["BlockStatements"] = 1] = "BlockStatements";
    ParsingContext[ParsingContext["StructMembers"] = 2] = "StructMembers";
    ParsingContext[ParsingContext["Parameters"] = 3] = "Parameters";
    ParsingContext[ParsingContext["TypeArguments"] = 4] = "TypeArguments";
    ParsingContext[ParsingContext["ArgumentExpressions"] = 5] = "ArgumentExpressions";
})(ParsingContext || (ParsingContext = {}));
// Reading `process.env` costs a host lookup, and this decision is the same for
// every node in the file: settle it once at load. Browser-safe — the parser also
// runs in the browser client, where `process` does not exist.
const debugKindNames = typeof process !== 'undefined' && !!process.env['PLAXTONY_DEBUG'];
export class Parser {
    scanner;
    currentToken;
    parsingContext = 0;
    sourceFile;
    syntaxTokens;
    token() {
        return this.currentToken;
    }
    nextToken() {
        this.currentToken = this.scanner.scan();
        while (this.currentToken === 1 /* SyntaxKind.SingleLineCommentTrivia */) {
            const commentToken = (this.createNode(this.token(), undefined, false));
            this.currentToken = this.scanner.scan();
            this.finishNode(commentToken, undefined, false);
            this.sourceFile.commentsLineMap.set(commentToken.line, commentToken);
        }
        return this.currentToken;
    }
    parseErrorAtCurrentToken(message, _arg0) {
        const start = this.scanner.getStartPos();
        const length = this.scanner.getCurrentPos() - start;
        this.parseErrorAtPosition(start, length, message);
    }
    parseErrorAtPosition(start, length, message, _arg0) {
        const diag = createFileDiagnostic(this.sourceFile, start, length, {
            code: 1001,
            category: Types.DiagnosticCategory.Error,
            message: message,
        });
        // TODO: line & col should not be here
        diag.line = this.scanner.getLine();
        diag.col = this.scanner.getChar();
        this.sourceFile.parseDiagnostics.push(diag);
        // throw new Error(`${diag.file!.fileName} [${diag.start}]: ${diag.messageText}`);
        // throw new Error(`${diag.file!.fileName} [${this.scanner.getLine()}:${this.scanner.getCol()}]: ${diag.messageText}`);
    }
    speculationHelper(callback, isLookAhead) {
        // Keep track of the state we'll need to rollback to if lookahead fails (or if the
        // caller asked us to always reset our state).
        const saveToken = this.currentToken;
        const saveSyntaxTokensLength = this.syntaxTokens.length;
        const saveSyntaxTokensCurrentLength = this.syntaxTokens[this.syntaxTokens.length - 1].length;
        const saveParseDiagnosticsLength = this.sourceFile.parseDiagnostics.length;
        // const saveParseErrorBeforeNextFinishedNode = parseErrorBeforeNextFinishedNode;
        // Note: it is not actually necessary to save/restore the context flags here.  That's
        // because the saving/restoring of these flags happens naturally through the recursive
        // descent nature of our parser.  However, we still store this here just so we can
        // assert that invariant holds.
        // const saveContextFlags = contextFlags;
        // If we're only looking ahead, then tell the scanner to only lookahead as well.
        // Otherwise, if we're actually speculatively parsing, then tell the scanner to do the
        // same.
        const result = isLookAhead ? this.scanner.lookAhead(callback) : this.scanner.tryScan(callback);
        // Debug.assert(saveContextFlags === contextFlags);
        // If our callback returned something 'falsy' or we're just looking ahead,
        // then unconditionally restore us to where we were.
        if (!result || isLookAhead) {
            this.currentToken = saveToken;
            if (this.syntaxTokens.length > saveSyntaxTokensLength) {
                this.syntaxTokens = this.syntaxTokens.slice(0, saveSyntaxTokensLength);
            }
            if (this.syntaxTokens[this.syntaxTokens.length - 1].length > saveSyntaxTokensCurrentLength) {
                this.syntaxTokens[this.syntaxTokens.length - 1] = this.syntaxTokens[this.syntaxTokens.length - 1].slice(0, saveSyntaxTokensCurrentLength);
            }
            this.sourceFile.parseDiagnostics.length = saveParseDiagnosticsLength;
            // parseErrorBeforeNextFinishedNode = saveParseErrorBeforeNextFinishedNode;
        }
        return result;
    }
    lookAhead(callback) {
        return this.speculationHelper(callback, true);
    }
    parseExpected(kind, diagnosticMessage, shouldAdvance = true) {
        if (this.token() === kind) {
            if (shouldAdvance) {
                this.syntaxTokens[this.syntaxTokens.length - 1].push(this.parseTokenNode());
            }
            return true;
        }
        if (diagnosticMessage == null) {
            diagnosticMessage =
                'Expected ' + getKindName(kind) + ', found ' + getKindName(this.currentToken);
        }
        this.parseErrorAtCurrentToken(diagnosticMessage);
        return false;
    }
    parseOptional(t) {
        if (this.token() === t) {
            this.syntaxTokens[this.syntaxTokens.length - 1].push(this.parseTokenNode());
            return true;
        }
        return false;
    }
    parseTokenNode() {
        const node = this.createNode(this.token(), undefined, false);
        this.nextToken();
        return this.finishNode(node, undefined, false);
    }
    createNode(kind, pos, assignSyntaxTokens = true) {
        const node = {};
        node.kind = kind;
        node.pos = pos === undefined ? this.scanner.getTokenPos() : pos;
        node.end = node.pos;
        node.line = this.scanner.getLine();
        node.char = this.scanner.getChar();
        if (debugKindNames) {
            ;
            node.kindName = getKindName(node.kind);
        }
        if (assignSyntaxTokens) {
            this.syntaxTokens.push([]);
        }
        return node;
    }
    createNodeArray(elements, pos) {
        const array = (elements || []);
        if (pos === undefined) {
            pos = this.scanner.getStartPos();
        }
        array.pos = pos;
        array.end = pos;
        return array;
    }
    createMissingNode(kind, emitErrorMessage = true) {
        if (emitErrorMessage) {
            this.parseErrorAtCurrentToken(`Missing node: ${getKindName(kind)}`);
        }
        return this.createNode(0 /* SyntaxKind.Unknown */, undefined, false);
    }
    createMissingList() {
        return this.createNodeArray();
    }
    finishNode(node, end, assignSyntaxTokens = true) {
        node.end = end === undefined ? this.scanner.getStartPos() : end;
        if (assignSyntaxTokens) {
            node.syntaxTokens = this.syntaxTokens.pop();
            for (const token of node.syntaxTokens) {
                token.parent = node;
            }
        }
        return node;
    }
    isListTerminator(kind) {
        if (this.token() === 114 /* SyntaxKind.EndOfFileToken */) {
            // Being at the end of the file ends all lists.
            return true;
        }
        switch (kind) {
            case 0 /* ParsingContext.SourceElements */:
                return false;
            case 1 /* ParsingContext.BlockStatements */:
            case 2 /* ParsingContext.StructMembers */:
                return this.token() === 5 /* SyntaxKind.CloseBraceToken */;
            case 5 /* ParsingContext.ArgumentExpressions */:
            case 3 /* ParsingContext.Parameters */:
                return this.token() === 7 /* SyntaxKind.CloseParenToken */;
            case 4 /* ParsingContext.TypeArguments */:
                return this.token() === 14 /* SyntaxKind.GreaterThanToken */;
        }
    }
    parsingContextErrors(context) {
        switch (context) {
            case 0 /* ParsingContext.SourceElements */:
                return 'expected declaration';
            case 1 /* ParsingContext.BlockStatements */:
                return 'expected declaration or statement';
            case 2 /* ParsingContext.StructMembers */:
                return 'expected property declaration';
            case 4 /* ParsingContext.TypeArguments */:
                return 'expected type argumnt definition';
            case 5 /* ParsingContext.ArgumentExpressions */:
                return 'expected argumnt expression';
            case 3 /* ParsingContext.Parameters */:
                return 'expected parameter declaration';
        }
    }
    isListElement(parsingContext, _inErrorRecovery) {
        switch (parsingContext) {
            case 0 /* ParsingContext.SourceElements */:
                return this.isStartOfRootStatement();
            case 1 /* ParsingContext.BlockStatements */:
                return this.isStartOfStatement();
            case 2 /* ParsingContext.StructMembers */:
                return this.isStartOfTypeDefinition();
            case 4 /* ParsingContext.TypeArguments */:
                return this.isStartOfTypeDefinition();
            case 3 /* ParsingContext.Parameters */:
                return this.isStartOfParameter();
            case 5 /* ParsingContext.ArgumentExpressions */:
                return this.isStartOfExpression();
        }
    }
    parseList(kind, parseElement) {
        const saveParsingContext = this.parsingContext;
        this.parsingContext |= 1 << kind;
        const result = this.createNodeArray();
        while (!this.isListTerminator(kind)) {
            if (this.isListElement(kind, false)) {
                result.push(parseElement());
                continue;
            }
            const start = this.scanner.getTokenPos();
            this.nextToken();
            this.parseErrorAtPosition(start, this.scanner.getTokenPos() - start, this.parsingContextErrors(kind));
            if (kind !== 0 /* ParsingContext.SourceElements */ && kind !== 1 /* ParsingContext.BlockStatements */) {
                break;
            }
        }
        result.end = this.scanner.getTokenPos();
        this.parsingContext = saveParsingContext;
        return result;
    }
    parseBracketedList(kind, parseElement, open, close) {
        if (this.parseExpected(open)) {
            const result = this.parseDelimitedList(kind, parseElement);
            this.parseExpected(close);
            return result;
        }
        return this.createMissingList();
    }
    parseDelimitedList(kind, parseElement) {
        const saveParsingContext = this.parsingContext;
        this.parsingContext |= 1 << kind;
        const result = this.createNodeArray();
        let commaStart = -1; // Meaning the previous token was not a comma
        while (true) {
            if (this.isListElement(kind, false)) {
                result.push(parseElement());
                commaStart = this.scanner.getTokenPos();
                if (this.parseOptional(12 /* SyntaxKind.CommaToken */)) {
                    // No need to check for a zero length node since we know we parsed a comma
                    continue;
                }
                commaStart = -1; // Back to the state where the last token was not a comma
                if (this.isListTerminator(kind)) {
                    break;
                }
                // We didn't get a comma, and the list wasn't terminated, explicitly parse
                // out a comma so we give a good error message.
                this.parseExpected(12 /* SyntaxKind.CommaToken */);
                continue;
            }
            else if (this.token() === 12 /* SyntaxKind.CommaToken */) {
                // If list element was *invalid* it might as well be empty
                // swallow the comma and try again
                this.parseErrorAtCurrentToken(this.parsingContextErrors(kind));
                this.nextToken();
                continue;
            }
            if (this.isListTerminator(kind)) {
                break;
            }
            this.parseErrorAtCurrentToken(this.parsingContextErrors(kind));
            this.nextToken();
            // give up, even if list wasn't properly terminated. because it might never be, if termination character is missing..
            break;
        }
        if (commaStart >= 0) {
            this.parseErrorAtPosition(commaStart, 1, 'trailing comma');
        }
        result.end = this.scanner.getTokenPos();
        this.parsingContext = saveParsingContext;
        return result;
    }
    isVariableDeclaration() {
        while (this.token() === 53 /* SyntaxKind.ConstKeyword */ || this.token() === 52 /* SyntaxKind.StaticKeyword */) {
            this.nextToken();
        }
        if (!isKeywordTypeKind(this.token()) && this.token() !== 113 /* SyntaxKind.Identifier */) {
            return false;
        }
        this.parseTypeDefinition();
        if (this.token() !== 113 /* SyntaxKind.Identifier */) {
            return false;
        }
        this.nextToken();
        switch (this.token()) {
            // we're expecting ";" or "=", but let's allow everything else than "(" for better error tolerance
            // "(" indicates that it might be CallExpression or FunctionDeclaration
            case 6 /* SyntaxKind.OpenParenToken */:
                return false;
        }
        return true;
    }
    isFunctionDeclaration() {
        while (this.token() === 54 /* SyntaxKind.NativeKeyword */ || this.token() === 52 /* SyntaxKind.StaticKeyword */) {
            this.nextToken();
        }
        if (!isKeywordTypeKind(this.token()) && this.token() !== 113 /* SyntaxKind.Identifier */) {
            return false;
        }
        this.parseTypeDefinition();
        if (this.token() !== 113 /* SyntaxKind.Identifier */) {
            return false;
        }
        this.nextToken();
        if (this.token() !== 6 /* SyntaxKind.OpenParenToken */) {
            return false;
        }
        return true;
    }
    isParameter() {
        this.parseTypeDefinition();
        if (this.token() !== 113 /* SyntaxKind.Identifier */) {
            return false;
        }
        return true;
    }
    isStartOfExpression() {
        if (this.isStartOfLeftHandSideExpression()) {
            return true;
        }
        switch (this.token()) {
            case 20 /* SyntaxKind.PlusToken */:
            case 21 /* SyntaxKind.MinusToken */:
            case 33 /* SyntaxKind.TildeToken */:
            case 32 /* SyntaxKind.ExclamationToken */:
            case 25 /* SyntaxKind.PlusPlusToken */:
            case 26 /* SyntaxKind.MinusMinusToken */:
                return true;
            default:
                // Error tolerance.  If we see the start of some binary operator, we consider
                // that the start of an expression.  That way we'll parse out a missing identifier,
                // give a good message about an identifier being missing, and then consume the
                // rest of the binary expression.
                if (this.isBinaryOperator()) {
                    return true;
                }
                return false;
        }
    }
    isStartOfStatement() {
        switch (this.token()) {
            case 51 /* SyntaxKind.StructKeyword */:
            case 50 /* SyntaxKind.IncludeKeyword */:
            case 70 /* SyntaxKind.TypedefKeyword */:
                return false;
        }
        return true;
    }
    isStartOfVariableDeclaration() {
        return this.lookAhead(this.isVariableDeclaration.bind(this));
    }
    isStartOfFunctionDeclaration() {
        return this.lookAhead(this.isFunctionDeclaration.bind(this));
    }
    isStartOfRootStatement() {
        switch (this.token()) {
            case 65 /* SyntaxKind.IfKeyword */:
            case 62 /* SyntaxKind.DoKeyword */:
            case 64 /* SyntaxKind.WhileKeyword */:
            case 63 /* SyntaxKind.ForKeyword */:
            case 56 /* SyntaxKind.ContinueKeyword */:
            case 55 /* SyntaxKind.BreakKeyword */:
            case 58 /* SyntaxKind.ReturnKeyword */:
            case 57 /* SyntaxKind.BreakpointKeyword */:
            case 4 /* SyntaxKind.OpenBraceToken */:
                return false;
        }
        return true;
    }
    isStartOfTypeDefinition() {
        return isKeywordTypeKind(this.token()) || this.token() === 113 /* SyntaxKind.Identifier */;
    }
    isStartOfParameter() {
        return this.lookAhead(this.isParameter.bind(this));
    }
    parseLiteral(kind) {
        const node = this.createNode(kind, void 0, false);
        node.end = this.scanner.getCurrentPos();
        node.value = this.scanner.getTokenValue() || '';
        node.text = this.scanner.getTokenText() || '';
        if (this.parseExpected(kind, void 0, false)) {
            this.nextToken();
        }
        return this.finishNode(node, node.end, false);
    }
    parseInclude() {
        const node = this.createNode(136 /* SyntaxKind.IncludeStatement */);
        this.parseExpected(50 /* SyntaxKind.IncludeKeyword */);
        node.path = this.parseLiteral(3 /* SyntaxKind.StringLiteral */);
        return this.finishNode(node);
    }
    parseIdentifier(alwaysAdvance = true) {
        const identifier = this.createNode(113 /* SyntaxKind.Identifier */);
        this.parseExpected(113 /* SyntaxKind.Identifier */, undefined, false);
        identifier.name = this.scanner.getTokenValue() || '';
        if (alwaysAdvance || this.token() === 113 /* SyntaxKind.Identifier */) {
            this.nextToken();
        }
        return this.finishNode(identifier);
    }
    parseExpectedIdentifier() {
        return this.parseIdentifier(false);
    }
    parseTypeDefinition() {
        let baseType;
        if (this.token() === 113 /* SyntaxKind.Identifier */) {
            baseType = this.parseIdentifier();
        }
        else if (isKeywordTypeKind(this.token())) {
            baseType = this.parseTokenNode();
        }
        else {
            this.parseErrorAtCurrentToken('expected identifier or keyword');
            baseType = this.createMissingNode(113 /* SyntaxKind.Identifier */);
        }
        if (isReferenceKeywordKind(baseType.kind)) {
            if (this.token() === 13 /* SyntaxKind.LessThanToken */) {
                const mappedType = (this.createNode(116 /* SyntaxKind.MappedType */, baseType.pos));
                mappedType.returnType = baseType;
                mappedType.typeArguments = this.parseBracketedList(4 /* ParsingContext.TypeArguments */, this.parseTypeDefinition.bind(this), 13 /* SyntaxKind.LessThanToken */, 14 /* SyntaxKind.GreaterThanToken */);
                baseType = this.finishNode(mappedType);
            }
        }
        while (this.token() === 8 /* SyntaxKind.OpenBracketToken */) {
            const arrayType = this.createNode(117 /* SyntaxKind.ArrayType */, baseType.pos);
            this.parseExpected(8 /* SyntaxKind.OpenBracketToken */);
            arrayType.size = this.parseExpectedExpression();
            arrayType.elementType = baseType;
            this.parseExpected(9 /* SyntaxKind.CloseBracketToken */);
            baseType = this.finishNode(arrayType);
        }
        return baseType;
    }
    parseParameter() {
        const param = this.createNode(143 /* SyntaxKind.ParameterDeclaration */);
        param.type = this.parseTypeDefinition();
        param.name = this.parseIdentifier();
        return this.finishNode(param);
    }
    parsePropertyDeclaration() {
        const property = this.createNode(144 /* SyntaxKind.PropertyDeclaration */);
        property.type = this.parseTypeDefinition();
        property.name = this.parseExpectedIdentifier();
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(property);
    }
    parseStructDeclaration() {
        const node = this.createNode(140 /* SyntaxKind.StructDeclaration */);
        this.parseExpected(51 /* SyntaxKind.StructKeyword */);
        node.name = this.parseIdentifier();
        this.parseExpected(4 /* SyntaxKind.OpenBraceToken */);
        node.members = this.parseList(2 /* ParsingContext.StructMembers */, this.parsePropertyDeclaration.bind(this));
        this.parseExpected(5 /* SyntaxKind.CloseBraceToken */);
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseModifiers() {
        const mods = this.createNodeArray();
        while (isModifierKind(this.token())) {
            mods.push(this.parseTokenNode());
        }
        mods.end = this.scanner.getTokenPos();
        return mods;
    }
    parseFunctionDeclaration() {
        const func = this.createNode(142 /* SyntaxKind.FunctionDeclaration */);
        func.modifiers = this.parseModifiers();
        func.type = this.parseTypeDefinition();
        func.name = this.parseIdentifier();
        func.parameters = this.parseBracketedList(3 /* ParsingContext.Parameters */, this.parseParameter.bind(this), 6 /* SyntaxKind.OpenParenToken */, 7 /* SyntaxKind.CloseParenToken */);
        if (this.token() === 4 /* SyntaxKind.OpenBraceToken */) {
            func.body = this.parseBlock(true);
        }
        else {
            this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        }
        return this.finishNode(func);
    }
    parseVariableDeclaration() {
        const variable = this.createNode(141 /* SyntaxKind.VariableDeclaration */);
        variable.modifiers = this.parseModifiers();
        variable.type = this.parseTypeDefinition();
        variable.name = this.parseIdentifier();
        if (this.token() === 39 /* SyntaxKind.EqualsToken */) {
            this.parseExpected(39 /* SyntaxKind.EqualsToken */);
            variable.initializer = this.parseBinaryExpressionOrHigher(0);
        }
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(variable);
    }
    parseBlock(allowVarDeclarations = false) {
        if (this.parseExpected(4 /* SyntaxKind.OpenBraceToken */, undefined, false)) {
            const node = this.createNode(128 /* SyntaxKind.Block */);
            this.parseExpected(4 /* SyntaxKind.OpenBraceToken */);
            node.statements = this.parseList(1 /* ParsingContext.BlockStatements */, () => {
                const child = this.parseStatement();
                if (child.kind === 141 /* SyntaxKind.VariableDeclaration */) {
                    if (!allowVarDeclarations) {
                        this.parseErrorAtPosition(child.pos, child.end - child.pos, 'Local variables must be declared at the begining of function block');
                    }
                }
                else {
                    allowVarDeclarations = false;
                }
                return child;
            });
            this.parseExpected(5 /* SyntaxKind.CloseBraceToken */);
            return this.finishNode(node);
        }
        else {
            return this.createMissingNode(128 /* SyntaxKind.Block */);
        }
    }
    isUpdateExpression() {
        // This function is called inside parseUnaryExpression to decide
        // whether to call parseSimpleUnaryExpression or call parseUpdateExpression directly
        switch (this.token()) {
            case 20 /* SyntaxKind.PlusToken */:
            case 21 /* SyntaxKind.MinusToken */:
            case 33 /* SyntaxKind.TildeToken */:
            case 32 /* SyntaxKind.ExclamationToken */:
                return false;
            default:
                return true;
        }
    }
    isStartOfLeftHandSideExpression() {
        switch (this.token()) {
            case 69 /* SyntaxKind.NullKeyword */:
            case 67 /* SyntaxKind.TrueKeyword */:
            case 68 /* SyntaxKind.FalseKeyword */:
            case 2 /* SyntaxKind.NumericLiteral */:
            case 3 /* SyntaxKind.StringLiteral */:
            case 6 /* SyntaxKind.OpenParenToken */:
            case 113 /* SyntaxKind.Identifier */:
                return true;
            default:
                return false;
        }
    }
    makeBinaryExpression(left, operatorToken, right) {
        const node = this.createNode(124 /* SyntaxKind.BinaryExpression */, left.pos);
        node.left = left;
        node.operatorToken = operatorToken;
        node.right = right;
        return this.finishNode(node);
    }
    isBinaryOperator() {
        return this.getBinaryOperatorPrecedence() > 0;
    }
    getBinaryOperatorPrecedence() {
        switch (this.token()) {
            case 35 /* SyntaxKind.BarBarToken */:
                return 1;
            case 34 /* SyntaxKind.AmpersandAmpersandToken */:
                return 2;
            case 30 /* SyntaxKind.BarToken */:
                return 3;
            case 31 /* SyntaxKind.CaretToken */:
                return 4;
            case 29 /* SyntaxKind.AmpersandToken */:
                return 5;
            case 17 /* SyntaxKind.EqualsEqualsToken */:
            case 18 /* SyntaxKind.ExclamationEqualsToken */:
                return 6;
            case 13 /* SyntaxKind.LessThanToken */:
            case 14 /* SyntaxKind.GreaterThanToken */:
            case 15 /* SyntaxKind.LessThanEqualsToken */:
            case 16 /* SyntaxKind.GreaterThanEqualsToken */:
                return 7;
            case 27 /* SyntaxKind.LessThanLessThanToken */:
            case 28 /* SyntaxKind.GreaterThanGreaterThanToken */:
                return 8;
            case 20 /* SyntaxKind.PlusToken */:
            case 21 /* SyntaxKind.MinusToken */:
                return 9;
            case 22 /* SyntaxKind.AsteriskToken */:
            case 23 /* SyntaxKind.SlashToken */:
            case 24 /* SyntaxKind.PercentToken */:
                return 10;
        }
        // -1 is lower than all other precedences.  Returning it will cause binary expression
        // parsing to stop.
        return -1;
    }
    parsePrimaryExpression() {
        switch (this.token()) {
            case 2 /* SyntaxKind.NumericLiteral */:
            case 3 /* SyntaxKind.StringLiteral */:
                return this.parseLiteral(this.token());
            case 69 /* SyntaxKind.NullKeyword */:
            case 67 /* SyntaxKind.TrueKeyword */:
            case 68 /* SyntaxKind.FalseKeyword */:
                return this.parseTokenNode();
            case 6 /* SyntaxKind.OpenParenToken */:
                return this.parseParenthesizedExpression();
            case 113 /* SyntaxKind.Identifier */:
                return this.parseIdentifier();
        }
        this.parseErrorAtCurrentToken(`Invalid expression`);
        return this.createNode(0 /* SyntaxKind.Unknown */, undefined, false);
    }
    parseParenthesizedExpression() {
        const node = this.createNode(126 /* SyntaxKind.ParenthesizedExpression */);
        this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
        node.expression = this.parseExpectedExpression();
        this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
        return this.finishNode(node);
    }
    parseMemberExpressionOrHigher() {
        const expression = this.parsePrimaryExpression();
        return this.parseMemberExpressionRest(expression);
    }
    parseMemberExpressionRest(expression) {
        while (true) {
            if (this.token() === 10 /* SyntaxKind.DotToken */) {
                const propertyAccess = (this.createNode(120 /* SyntaxKind.PropertyAccessExpression */, expression.pos));
                this.parseExpected(10 /* SyntaxKind.DotToken */);
                propertyAccess.expression = expression;
                propertyAccess.name = this.parseExpectedIdentifier();
                expression = this.finishNode(propertyAccess);
                continue;
            }
            if (this.token() === 8 /* SyntaxKind.OpenBracketToken */) {
                const indexedAccess = (this.createNode(119 /* SyntaxKind.ElementAccessExpression */, expression.pos));
                this.parseExpected(8 /* SyntaxKind.OpenBracketToken */);
                indexedAccess.expression = expression;
                indexedAccess.argumentExpression = this.parseExpectedExpression();
                this.parseExpected(9 /* SyntaxKind.CloseBracketToken */);
                expression = this.finishNode(indexedAccess);
                continue;
            }
            return expression;
        }
    }
    parseCallExpressionRest(expression) {
        while (true) {
            expression = this.parseMemberExpressionRest(expression);
            if (this.token() === 6 /* SyntaxKind.OpenParenToken */) {
                const callExpr = (this.createNode(121 /* SyntaxKind.CallExpression */, expression.pos));
                callExpr.expression = expression;
                this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
                callExpr.arguments = this.parseDelimitedList(5 /* ParsingContext.ArgumentExpressions */, this.parseExpression.bind(this));
                this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
                expression = this.finishNode(callExpr);
                continue;
            }
            return expression;
        }
    }
    parseLeftHandSideExpressionOrHigher() {
        const expression = this.parseMemberExpressionOrHigher();
        return this.parseCallExpressionRest(expression);
    }
    parseUpdateExpression() {
        if (this.token() === 25 /* SyntaxKind.PlusPlusToken */ || this.token() === 26 /* SyntaxKind.MinusMinusToken */) {
            this.parseErrorAtCurrentToken('unary increment operators not allowed');
            const node = this.createNode(122 /* SyntaxKind.PrefixUnaryExpression */);
            node.operator = this.parseTokenNode();
            node.operand = this.parseLeftHandSideExpressionOrHigher();
            return this.finishNode(node);
        }
        const expression = this.parseLeftHandSideExpressionOrHigher();
        if (this.token() === 25 /* SyntaxKind.PlusPlusToken */ || this.token() === 26 /* SyntaxKind.MinusMinusToken */) {
            this.parseErrorAtCurrentToken('unary increment operators not supported');
            const node = (this.createNode(123 /* SyntaxKind.PostfixUnaryExpression */, expression.pos));
            node.operand = expression;
            node.operator = this.parseTokenNode();
            return this.finishNode(node);
        }
        return expression;
    }
    parsePrefixUnaryExpression() {
        const node = this.createNode(122 /* SyntaxKind.PrefixUnaryExpression */);
        node.operator = this.parseTokenNode();
        node.operand = this.parseSimpleUnaryExpression();
        return this.finishNode(node);
    }
    parseSimpleUnaryExpression() {
        switch (this.token()) {
            case 20 /* SyntaxKind.PlusToken */:
            case 21 /* SyntaxKind.MinusToken */:
            case 33 /* SyntaxKind.TildeToken */:
            case 32 /* SyntaxKind.ExclamationToken */:
                return this.parsePrefixUnaryExpression();
            default:
                return this.parseUpdateExpression();
        }
    }
    parseUnaryExpressionOrHigher() {
        /**
         * UpdateExpression:
         *     1) LeftHandSideExpression
         *     2) LeftHandSideExpression++
         *     3) LeftHandSideExpression--
         *     4) ++UnaryExpression
         *     5) --UnaryExpression
         */
        if (this.isUpdateExpression()) {
            return this.parseUpdateExpression();
        }
        /**
         * UnaryExpression:
         *     1) UpdateExpression
         *     2) + UpdateExpression
         *     3) - UpdateExpression
         *     4) ~ UpdateExpression
         *     5) ! UpdateExpression
         */
        return this.parseSimpleUnaryExpression();
    }
    parseBinaryExpressionOrHigher(precedence) {
        const leftOperand = this.parseUnaryExpressionOrHigher();
        return this.parseBinaryExpressionRest(precedence, leftOperand);
    }
    parseBinaryExpressionRest(precedence, leftOperand) {
        while (true) {
            const newPrecedence = this.getBinaryOperatorPrecedence();
            // Check the precedence to see if we should "take" this operator
            // - For left associative operator, consume the operator,
            //   recursively call the function below, and parse binaryExpression as a rightOperand
            //   of the caller if the new precedence of the operator is greater then or equal to the current precedence.
            //   For example:
            //      a - b - c;
            //            ^token; leftOperand = b. Return b to the caller as a rightOperand
            //      a * b - c
            //            ^token; leftOperand = b. Return b to the caller as a rightOperand
            //      a - b * c;
            //            ^token; leftOperand = b. Return b * c to the caller as a rightOperand
            const consumeCurrentOperator = newPrecedence > precedence;
            if (!consumeCurrentOperator) {
                break;
            }
            leftOperand = this.makeBinaryExpression(leftOperand, this.parseTokenNode(), this.parseBinaryExpressionOrHigher(newPrecedence));
        }
        return leftOperand;
    }
    parseAssignmentExpressionOrHigher() {
        const expr = this.parseBinaryExpressionOrHigher(0);
        if (isLeftHandSideExpression(expr) && isAssignmentOperator(this.token())) {
            // multiple assigments in single statement is not allowed
            // return this.makeBinaryExpression(expr, <Types.BinaryOperatorToken>this.parseTokenNode(), this.parseAssignmentExpressionOrHigher());
            return this.makeBinaryExpression(expr, this.parseTokenNode(), this.parseBinaryExpressionOrHigher(0));
        }
        return expr;
    }
    parseExpression(allowAssignment = false) {
        const expr = this.parseAssignmentExpressionOrHigher();
        if (!allowAssignment && isAssignmentExpression(expr)) {
            this.parseErrorAtPosition(expr.pos, expr.end - expr.pos, `Assignment expression not allowed in this context`);
        }
        return expr;
    }
    parseExpectedExpression(allowAssignment = false) {
        if (this.isStartOfExpression()) {
            return this.parseExpression(allowAssignment);
        }
        else {
            this.parseErrorAtCurrentToken('Expected expression');
            return this.createNode(0 /* SyntaxKind.Unknown */, undefined, false);
        }
    }
    parseTypedefDeclaration() {
        const node = this.createNode(145 /* SyntaxKind.TypedefDeclaration */);
        this.parseExpected(70 /* SyntaxKind.TypedefKeyword */);
        node.type = this.parseTypeDefinition();
        node.name = this.parseIdentifier();
        return this.finishNode(node);
    }
    parseReturnStatement() {
        const node = this.createNode(137 /* SyntaxKind.ReturnStatement */);
        this.parseExpected(58 /* SyntaxKind.ReturnKeyword */);
        if (this.token() !== 11 /* SyntaxKind.SemicolonToken */) {
            node.expression = this.parseExpectedExpression();
        }
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseBreakOrContinueStatement(kind) {
        const node = this.createNode(kind);
        this.parseExpected(kind === 133 /* SyntaxKind.BreakStatement */ ? 55 /* SyntaxKind.BreakKeyword */ : 56 /* SyntaxKind.ContinueKeyword */);
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseBreakpointStatement() {
        const node = this.createNode(135 /* SyntaxKind.BreakpointStatement */);
        this.parseExpected(57 /* SyntaxKind.BreakpointKeyword */);
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseExpressionStatement() {
        const node = this.createNode(138 /* SyntaxKind.ExpressionStatement */);
        node.expression = this.parseAssignmentExpressionOrHigher();
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        this.finishNode(node);
        switch (node.expression.kind) {
            case 121 /* Types.SyntaxKind.CallExpression */:
                break;
            case 124 /* Types.SyntaxKind.BinaryExpression */:
                if (isAssignmentOperator(node.expression.operatorToken.kind))
                    break;
            /* falls through */
            default:
                this.parseErrorAtPosition(node.pos, node.end - node.pos, 'Statement has no effect');
        }
        return node;
    }
    parseEmptyStatement() {
        const node = this.createNode(139 /* SyntaxKind.EmptyStatement */);
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseIfStatement() {
        const node = this.createNode(129 /* SyntaxKind.IfStatement */);
        this.parseExpected(65 /* SyntaxKind.IfKeyword */);
        this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
        node.expression = this.parseExpectedExpression();
        this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
        node.thenStatement = this.parseBlock();
        if (this.parseOptional(66 /* SyntaxKind.ElseKeyword */)) {
            node.elseStatement =
                this.token() === 65 /* SyntaxKind.IfKeyword */ ? this.parseIfStatement() : this.parseBlock();
        }
        return this.finishNode(node);
    }
    parseDoStatement() {
        const node = this.createNode(130 /* SyntaxKind.DoStatement */);
        this.parseExpected(62 /* SyntaxKind.DoKeyword */);
        node.statement = this.parseBlock();
        this.parseExpected(64 /* SyntaxKind.WhileKeyword */);
        this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
        node.expression = this.parseExpectedExpression();
        this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        return this.finishNode(node);
    }
    parseWhileStatement() {
        const node = this.createNode(131 /* SyntaxKind.WhileStatement */);
        this.parseExpected(64 /* SyntaxKind.WhileKeyword */);
        this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
        node.expression = this.parseExpectedExpression();
        this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
        node.statement = this.parseBlock();
        return this.finishNode(node);
    }
    parseForStatement() {
        const node = this.createNode(132 /* SyntaxKind.ForStatement */);
        this.parseExpected(63 /* SyntaxKind.ForKeyword */);
        this.parseExpected(6 /* SyntaxKind.OpenParenToken */);
        if (this.token() !== 11 /* SyntaxKind.SemicolonToken */ && this.token() !== 7 /* SyntaxKind.CloseParenToken */) {
            node.initializer = this.parseExpectedExpression(true);
        }
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        if (this.token() !== 11 /* SyntaxKind.SemicolonToken */ && this.token() !== 7 /* SyntaxKind.CloseParenToken */) {
            node.condition = this.parseExpectedExpression();
        }
        this.parseExpected(11 /* SyntaxKind.SemicolonToken */);
        if (this.token() !== 7 /* SyntaxKind.CloseParenToken */) {
            node.incrementor = this.parseExpectedExpression(true);
        }
        this.parseExpected(7 /* SyntaxKind.CloseParenToken */);
        node.statement = this.parseBlock();
        return this.finishNode(node);
    }
    parseStatement() {
        switch (this.token()) {
            case 11 /* SyntaxKind.SemicolonToken */:
                return this.parseEmptyStatement();
            case 50 /* SyntaxKind.IncludeKeyword */:
                return this.parseInclude();
            case 51 /* SyntaxKind.StructKeyword */:
                return this.parseStructDeclaration();
            case 65 /* SyntaxKind.IfKeyword */:
                return this.parseIfStatement();
            case 62 /* SyntaxKind.DoKeyword */:
                return this.parseDoStatement();
            case 64 /* SyntaxKind.WhileKeyword */:
                return this.parseWhileStatement();
            case 63 /* SyntaxKind.ForKeyword */:
                return this.parseForStatement();
            case 56 /* SyntaxKind.ContinueKeyword */:
                return this.parseBreakOrContinueStatement(134 /* SyntaxKind.ContinueStatement */);
            case 55 /* SyntaxKind.BreakKeyword */:
                return this.parseBreakOrContinueStatement(133 /* SyntaxKind.BreakStatement */);
            case 57 /* SyntaxKind.BreakpointKeyword */:
                return this.parseBreakpointStatement();
            case 58 /* SyntaxKind.ReturnKeyword */:
                return this.parseReturnStatement();
            case 70 /* SyntaxKind.TypedefKeyword */:
                return this.parseTypedefDeclaration();
            case 4 /* SyntaxKind.OpenBraceToken */:
                return this.parseBlock(false);
            case 113 /* SyntaxKind.Identifier */:
            case 53 /* SyntaxKind.ConstKeyword */:
            case 52 /* SyntaxKind.StaticKeyword */:
            case 54 /* SyntaxKind.NativeKeyword */:
            case 77 /* SyntaxKind.AbilcmdKeyword */:
            case 78 /* SyntaxKind.ActorKeyword */:
            case 79 /* SyntaxKind.ActorscopeKeyword */:
            case 80 /* SyntaxKind.AifilterKeyword */:
            case 81 /* SyntaxKind.BankKeyword */:
            case 82 /* SyntaxKind.BitmaskKeyword */:
            case 71 /* SyntaxKind.BoolKeyword */:
            case 72 /* SyntaxKind.ByteKeyword */:
            case 83 /* SyntaxKind.CamerainfoKeyword */:
            case 73 /* SyntaxKind.CharKeyword */:
            case 84 /* SyntaxKind.ColorKeyword */:
            case 86 /* SyntaxKind.DoodadKeyword */:
            case 85 /* SyntaxKind.DatetimeKeyword */:
            case 75 /* SyntaxKind.FixedKeyword */:
            case 87 /* SyntaxKind.HandleKeyword */:
            case 88 /* SyntaxKind.GenerichandleKeyword */:
            case 89 /* SyntaxKind.EffecthistoryKeyword */:
            case 74 /* SyntaxKind.IntKeyword */:
            case 90 /* SyntaxKind.MarkerKeyword */:
            case 91 /* SyntaxKind.OrderKeyword */:
            case 92 /* SyntaxKind.PlayergroupKeyword */:
            case 93 /* SyntaxKind.PointKeyword */:
            case 94 /* SyntaxKind.RegionKeyword */:
            case 95 /* SyntaxKind.RevealerKeyword */:
            case 96 /* SyntaxKind.SoundKeyword */:
            case 97 /* SyntaxKind.SoundlinkKeyword */:
            case 76 /* SyntaxKind.StringKeyword */:
            case 98 /* SyntaxKind.TextKeyword */:
            case 99 /* SyntaxKind.TimerKeyword */:
            case 100 /* SyntaxKind.TransmissionsourceKeyword */:
            case 101 /* SyntaxKind.TriggerKeyword */:
            case 102 /* SyntaxKind.UnitKeyword */:
            case 103 /* SyntaxKind.UnitfilterKeyword */:
            case 104 /* SyntaxKind.UnitgroupKeyword */:
            case 105 /* SyntaxKind.UnitrefKeyword */:
            case 106 /* SyntaxKind.VoidKeyword */:
            case 107 /* SyntaxKind.WaveKeyword */:
            case 108 /* SyntaxKind.WaveinfoKeyword */:
            case 109 /* SyntaxKind.WavetargetKeyword */:
            case 110 /* SyntaxKind.ArrayrefKeyword */:
            case 111 /* SyntaxKind.StructrefKeyword */:
            case 112 /* SyntaxKind.FuncrefKeyword */:
                if (!(this.parsingContext & (1 << 1 /* ParsingContext.BlockStatements */)) &&
                    this.isStartOfFunctionDeclaration()) {
                    return this.parseFunctionDeclaration();
                }
                else if (this.isStartOfVariableDeclaration()) {
                    return this.parseVariableDeclaration();
                }
                else if ((this.parsingContext & (1 << 0 /* ParsingContext.SourceElements */) ||
                    this.parsingContext & (1 << 1 /* ParsingContext.BlockStatements */) ||
                    this.parsingContext & (1 << 4 /* ParsingContext.TypeArguments */) ||
                    this.parsingContext & (1 << 5 /* ParsingContext.ArgumentExpressions */)) &&
                    this.isStartOfExpression()) {
                    return this.parseExpressionStatement();
                }
            /* falls through */
            default: {
                this.parseErrorAtCurrentToken(`Expected declaration or statement, found ${getKindName(this.token())}`);
                const node = this.createMissingNode(138 /* SyntaxKind.ExpressionStatement */, false);
                this.nextToken();
                return node;
            }
        }
    }
    constructor() {
        this.scanner = new Scanner((message, pos, length) => {
            this.parseErrorAtPosition(pos, length, message.message);
        });
    }
    setText(text) {
        this.scanner.setText(text);
    }
    parseFile(fileName, text) {
        this.scanner.setText(text);
        this.syntaxTokens = [];
        this.sourceFile = this.createNode(127 /* SyntaxKind.SourceFile */, 0);
        this.sourceFile.commentsLineMap = new Map();
        this.sourceFile.parseDiagnostics = [];
        this.sourceFile.bindDiagnostics = [];
        this.sourceFile.additionalSyntacticDiagnostics = [];
        this.sourceFile.fileName = fileName;
        this.nextToken();
        this.sourceFile.statements = this.parseList(0 /* ParsingContext.SourceElements */, this.parseStatement.bind(this));
        this.finishNode(this.sourceFile);
        this.sourceFile.lineMap = this.scanner.getLineMap();
        this.sourceFile.text = text;
        fixupParentReferences(this.sourceFile);
        return this.sourceFile;
    }
}
//# sourceMappingURL=parser.js.map