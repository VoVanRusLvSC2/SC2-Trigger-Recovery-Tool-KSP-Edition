let nodeId = 0;
function makePos(line = 0, char = 0, pos = 0, end = 0) {
    return { line, char, pos, end };
}
function makeNode(base) {
    base.id = ++nodeId;
    return base;
}
export function createIdentifier(name) {
    return makeNode({
        kind: 113 /* SyntaxKind.Identifier */,
        ...makePos(),
        name,
        syntaxTokens: [],
    });
}
export function createStringLiteral(text) {
    const escaped = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
    return makeNode({
        kind: 3 /* SyntaxKind.StringLiteral */,
        ...makePos(),
        text: `"${escaped}"`,
        value: text,
        syntaxTokens: [],
    });
}
export function createNumericLiteral(value) {
    const text = typeof value === 'string' ? value : String(value);
    return makeNode({
        kind: 2 /* SyntaxKind.NumericLiteral */,
        ...makePos(),
        text,
        value: text,
        syntaxTokens: [],
    });
}
export function createToken(kind) {
    return makeNode({
        kind,
        ...makePos(),
    });
}
export function createType(name) {
    // Для простых типов (int, void, string, bool) — используем Identifier как TypeNode
    return createIdentifier(name);
}
export function createVariableDeclaration(type, name, initializer, isConst) {
    let modifiers = undefined;
    if (isConst) {
        const constMod = makeNode({ kind: 53 /* SyntaxKind.ConstKeyword */, ...makePos(), syntaxTokens: [] });
        modifiers = [constMod];
        modifiers.line = 0;
        modifiers.char = 0;
        modifiers.pos = 0;
        modifiers.end = 0;
    }
    return makeNode({
        kind: 141 /* SyntaxKind.VariableDeclaration */,
        ...makePos(),
        name: createIdentifier(name),
        type: createType(type),
        initializer,
        modifiers,
        syntaxTokens: [],
    });
}
export function createParameter(type, name) {
    return makeNode({
        kind: 143 /* SyntaxKind.ParameterDeclaration */,
        ...makePos(),
        name: createIdentifier(name),
        type: createType(type),
        syntaxTokens: [],
    });
}
export function createCallExpression(functionName, args) {
    const arr = args;
    arr.line = 0;
    arr.char = 0;
    arr.pos = 0;
    arr.end = 0;
    return makeNode({
        kind: 121 /* SyntaxKind.CallExpression */,
        ...makePos(),
        expression: createIdentifier(functionName),
        arguments: arr,
        syntaxTokens: [],
    });
}
export function createBinaryExpression(left, operator, right) {
    return makeNode({
        kind: 124 /* SyntaxKind.BinaryExpression */,
        ...makePos(),
        left,
        operatorToken: createToken(operator),
        right,
        syntaxTokens: [],
    });
}
export function createExpressionStatement(expression) {
    return makeNode({
        kind: 138 /* SyntaxKind.ExpressionStatement */,
        ...makePos(),
        expression,
        syntaxTokens: [],
    });
}
/** One SC2 Editor section banner (`// Actions`). The printer writes it as a comment line. */
export function createCommentStatement(text) {
    return makeNode({
        kind: 1 /* SyntaxKind.SingleLineCommentTrivia */,
        ...makePos(),
        text,
        syntaxTokens: [],
    });
}
export function createReturnStatement(expression) {
    return makeNode({
        kind: 137 /* SyntaxKind.ReturnStatement */,
        ...makePos(),
        expression,
        syntaxTokens: [],
    });
}
export function createBreakStatement() {
    return makeNode({
        kind: 133 /* SyntaxKind.BreakStatement */,
        ...makePos(),
        syntaxTokens: [],
    });
}
export function createContinueStatement() {
    return makeNode({
        kind: 134 /* SyntaxKind.ContinueStatement */,
        ...makePos(),
        syntaxTokens: [],
    });
}
export function createIfStatement(condition, thenStatements, elseStatements) {
    const thenBlock = createBlock(thenStatements);
    return makeNode({
        kind: 129 /* SyntaxKind.IfStatement */,
        ...makePos(),
        expression: condition,
        thenStatement: thenBlock,
        elseStatement: elseStatements ? createBlock(elseStatements) : undefined,
        syntaxTokens: [],
    });
}
export function createWhileStatement(condition, statements) {
    return makeNode({
        kind: 131 /* SyntaxKind.WhileStatement */,
        ...makePos(),
        expression: condition,
        statement: createBlock(statements),
        syntaxTokens: [],
    });
}
export function createPrefixUnaryExpression(operator, operand) {
    return makeNode({
        kind: 122 /* SyntaxKind.PrefixUnaryExpression */,
        ...makePos(),
        operator: createToken(operator),
        operand,
        syntaxTokens: [],
    });
}
export function createUnaryNot(operand) {
    return createPrefixUnaryExpression(32 /* SyntaxKind.ExclamationToken */, operand);
}
export function createElementAccessExpression(expression, argumentExpression) {
    return makeNode({
        kind: 119 /* SyntaxKind.ElementAccessExpression */,
        ...makePos(),
        expression,
        argumentExpression,
        syntaxTokens: [],
    });
}
export function createPropertyAccessExpression(expression, name) {
    return makeNode({
        kind: 120 /* SyntaxKind.PropertyAccessExpression */,
        ...makePos(),
        expression,
        name: createIdentifier(name),
        syntaxTokens: [],
    });
}
export function createPropertyDeclaration(type, name) {
    return makeNode({
        kind: 144 /* SyntaxKind.PropertyDeclaration */,
        ...makePos(),
        name: createIdentifier(name),
        type: createType(type),
        syntaxTokens: [],
    });
}
export function createStructDeclaration(name, members) {
    const arr = members;
    arr.line = 0;
    arr.char = 0;
    arr.pos = 0;
    arr.end = 0;
    return makeNode({
        kind: 140 /* SyntaxKind.StructDeclaration */,
        ...makePos(),
        name: createIdentifier(name),
        members: arr,
        syntaxTokens: [],
    });
}
export function createParenthesizedExpression(expression) {
    return makeNode({
        kind: 126 /* SyntaxKind.ParenthesizedExpression */,
        ...makePos(),
        expression,
        syntaxTokens: [],
    });
}
export function createForStatement(initializer, condition, incrementor, statements) {
    const body = createBlock(statements);
    return makeNode({
        kind: 132 /* SyntaxKind.ForStatement */,
        ...makePos(),
        initializer: initializer ?? undefined,
        condition,
        incrementor,
        statement: body,
        syntaxTokens: [],
    });
}
export function createBlock(statements) {
    const arr = statements;
    arr.line = 0;
    arr.char = 0;
    arr.pos = 0;
    arr.end = 0;
    return makeNode({
        kind: 128 /* SyntaxKind.Block */,
        ...makePos(),
        statements: arr,
        syntaxTokens: [],
    });
}
export function createFunctionDeclaration(returnType, name, parameters, bodyStatements, modifiers) {
    const paramsArr = parameters;
    paramsArr.line = 0;
    paramsArr.char = 0;
    paramsArr.pos = 0;
    paramsArr.end = 0;
    const modsArr = modifiers ? modifiers : undefined;
    if (modsArr) {
        modsArr.line = 0;
        modsArr.char = 0;
        modsArr.pos = 0;
        modsArr.end = 0;
    }
    return makeNode({
        kind: 142 /* SyntaxKind.FunctionDeclaration */,
        ...makePos(),
        name: createIdentifier(name),
        type: createType(returnType),
        parameters: paramsArr,
        body: bodyStatements !== null ? createBlock(bodyStatements) : undefined,
        modifiers: modsArr,
        syntaxTokens: [],
    });
}
export function createIncludeStatement(path) {
    return makeNode({
        kind: 136 /* SyntaxKind.IncludeStatement */,
        ...makePos(),
        path: createStringLiteral(path),
        syntaxTokens: [],
    });
}
export function createSourceFile(fileName, statements) {
    const arr = statements;
    arr.line = 0;
    arr.char = 0;
    arr.pos = 0;
    arr.end = 0;
    const sf = makeNode({
        kind: 127 /* SyntaxKind.SourceFile */,
        ...makePos(),
        fileName,
        statements: arr,
        lineMap: [],
        commentsLineMap: new Map(),
        syntaxTokens: [],
    });
    sf.parseDiagnostics = [];
    sf.bindDiagnostics = [];
    sf.additionalSyntacticDiagnostics = [];
    sf.text = '';
    return sf;
}
//# sourceMappingURL=ast-factory.js.map