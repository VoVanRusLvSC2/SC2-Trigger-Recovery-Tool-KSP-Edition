import { tokenToString } from "./scanner.js";
import { getKindName, isToken } from "./utils.js";
const DEFAULT_PRINTER_OPTIONS = {
    indent: '\t',
    spaceBeforeParameterList: false,
    functionBraceOnSameLine: false,
};
export function editorPrinterOptions() {
    return { indent: '    ', spaceBeforeParameterList: true, functionBraceOnSameLine: true };
}
export class Printer {
    output;
    indent;
    emptyLine = true;
    options;
    write(text) {
        if (this.emptyLine) {
            this.output.push(this.options.indent.repeat(this.indent));
            this.emptyLine = false;
        }
        this.output.push(text);
    }
    whitespace(text = ' ') {
        if (this.emptyLine) {
            this.output.push(this.options.indent.repeat(this.indent));
            this.emptyLine = false;
        }
        if (text === '\n') {
            this.newLine();
        }
        else {
            this.output.push(text);
        }
    }
    newLine() {
        this.output.push('\n');
        this.emptyLine = true;
    }
    increaseIndent() {
        ++this.indent;
    }
    decreaseIndent() {
        --this.indent;
    }
    emitNode(node) {
        switch (node.kind) {
            // A synthesized comment line. The parser keeps comments as trivia, so one
            // reaches the printer only when a generator put it in a statement list —
            // SC2 Editor's own section banners are written this way.
            case 1 /* gt.SyntaxKind.SingleLineCommentTrivia */:
                {
                    this.write(`// ${node.text ?? ''}`);
                    break;
                }
            case 142 /* gt.SyntaxKind.FunctionDeclaration */:
                {
                    const func = node;
                    if (func.modifiers && func.modifiers.length > 0) {
                        this.emitNodeList(func.modifiers, ' ');
                        this.write(' ');
                    }
                    this.emitNode(func.type);
                    this.write(' ');
                    this.emitNode(func.name);
                    if (this.options.spaceBeforeParameterList)
                        this.write(' ');
                    this.write('(');
                    this.emitNodeList(func.parameters, ',', ' ');
                    this.write(')');
                    if (func.body) {
                        if (this.options.functionBraceOnSameLine)
                            this.write(' ');
                        else
                            this.newLine();
                        this.emitNode(func.body);
                    }
                    else {
                        this.write(';');
                    }
                    this.newLine();
                    break;
                }
            case 140 /* gt.SyntaxKind.StructDeclaration */:
                {
                    const struct = node;
                    this.write('struct ');
                    this.emitNode(struct.name);
                    this.write(' {');
                    this.newLine();
                    this.increaseIndent();
                    this.emitNodeList(struct.members, '', '\n', true);
                    this.decreaseIndent();
                    this.write('};');
                    this.newLine();
                    break;
                }
            case 141 /* gt.SyntaxKind.VariableDeclaration */:
            case 144 /* gt.SyntaxKind.PropertyDeclaration */:
                {
                    const variable = node;
                    if (variable.modifiers && variable.modifiers.length > 0) {
                        this.emitNodeList(variable.modifiers, ' ');
                        this.write(' ');
                    }
                    this.emitNode(variable.type);
                    this.write(' ');
                    this.emitNode(variable.name);
                    if (variable.kind === 141 /* gt.SyntaxKind.VariableDeclaration */ && variable.initializer) {
                        this.whitespace(' ');
                        this.write('=');
                        this.whitespace(' ');
                        this.emitNode(variable.initializer);
                    }
                    this.write(';');
                    break;
                }
            case 143 /* gt.SyntaxKind.ParameterDeclaration */:
                {
                    const param = node;
                    if (param.modifiers && param.modifiers.length > 0) {
                        this.emitNodeList(param.modifiers, ' ');
                        this.write(' ');
                    }
                    this.emitNode(param.type);
                    this.write(' ');
                    this.emitNode(param.name);
                    break;
                }
            case 145 /* gt.SyntaxKind.TypedefDeclaration */:
                {
                    const typedef = node;
                    this.write('typedef ');
                    this.emitNode(typedef.type);
                    this.write(' ');
                    this.emitNode(typedef.name);
                    this.write(';');
                    break;
                }
            case 113 /* gt.SyntaxKind.Identifier */:
                {
                    const identifier = node;
                    this.write(identifier.name);
                    break;
                }
            case 2 /* gt.SyntaxKind.NumericLiteral */:
            case 3 /* gt.SyntaxKind.StringLiteral */:
                {
                    const literal = node;
                    this.write(literal.text);
                    break;
                }
            case 117 /* gt.SyntaxKind.ArrayType */:
                {
                    const type = node;
                    this.emitNode(type.elementType);
                    this.write('[');
                    this.emitNode(type.size);
                    this.write(']');
                    break;
                }
            case 116 /* gt.SyntaxKind.MappedType */:
                {
                    const type = node;
                    this.emitNode(type.returnType);
                    this.write('<');
                    this.emitNodeList(type.typeArguments, ',', ' ');
                    this.write('>');
                    break;
                }
            case 124 /* gt.SyntaxKind.BinaryExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.left);
                    this.whitespace(' ');
                    this.emitNode(expr.operatorToken);
                    this.whitespace(' ');
                    this.emitNode(expr.right);
                    break;
                }
            case 122 /* gt.SyntaxKind.PrefixUnaryExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.operator);
                    this.emitNode(expr.operand);
                    break;
                }
            case 123 /* gt.SyntaxKind.PostfixUnaryExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.operand);
                    this.emitNode(expr.operator);
                    break;
                }
            case 126 /* gt.SyntaxKind.ParenthesizedExpression */:
                {
                    const expr = node;
                    this.write('(');
                    this.emitNode(expr.expression);
                    this.write(')');
                    break;
                }
            case 121 /* gt.SyntaxKind.CallExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.expression);
                    this.write('(');
                    this.emitNodeList(expr.arguments, ',', ' ');
                    this.write(')');
                    break;
                }
            case 119 /* gt.SyntaxKind.ElementAccessExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.expression);
                    this.write('[');
                    this.emitNode(expr.argumentExpression);
                    this.write(']');
                    break;
                }
            case 120 /* gt.SyntaxKind.PropertyAccessExpression */:
                {
                    const expr = node;
                    this.emitNode(expr.expression);
                    this.write("./index.js");
                    this.emitNode(expr.name);
                    break;
                }
            case 128 /* gt.SyntaxKind.Block */:
                {
                    const block = node;
                    this.write('{');
                    this.newLine();
                    this.increaseIndent();
                    this.emitNodeList(block.statements, '', '\n', true);
                    this.decreaseIndent();
                    this.write('}');
                    break;
                }
            case 129 /* gt.SyntaxKind.IfStatement */:
                {
                    const ifStmt = node;
                    this.write('if (');
                    this.emitNode(ifStmt.expression);
                    this.write(')');
                    if (ifStmt.thenStatement.kind === 128 /* gt.SyntaxKind.Block */) {
                        this.whitespace(' ');
                        this.emitNode(ifStmt.thenStatement);
                    }
                    else {
                        this.newLine();
                        this.increaseIndent();
                        this.emitNode(ifStmt.thenStatement);
                        this.decreaseIndent();
                    }
                    if (ifStmt.elseStatement) {
                        this.whitespace(' ');
                        this.write('else');
                        if (ifStmt.elseStatement.kind === 128 /* gt.SyntaxKind.Block */ ||
                            ifStmt.elseStatement.kind === 129 /* gt.SyntaxKind.IfStatement */) {
                            this.whitespace(' ');
                            this.emitNode(ifStmt.elseStatement);
                        }
                        else {
                            this.newLine();
                            this.increaseIndent();
                            this.emitNode(ifStmt.elseStatement);
                            this.decreaseIndent();
                        }
                    }
                    break;
                }
            case 131 /* gt.SyntaxKind.WhileStatement */:
                {
                    const whileStmt = node;
                    this.write('while (');
                    this.emitNode(whileStmt.expression);
                    this.write(')');
                    if (whileStmt.statement.kind === 128 /* gt.SyntaxKind.Block */) {
                        this.whitespace(' ');
                        this.emitNode(whileStmt.statement);
                    }
                    else {
                        this.newLine();
                        this.increaseIndent();
                        this.emitNode(whileStmt.statement);
                        this.decreaseIndent();
                    }
                    break;
                }
            case 130 /* gt.SyntaxKind.DoStatement */:
                {
                    const doStmt = node;
                    this.write('do');
                    if (doStmt.statement.kind === 128 /* gt.SyntaxKind.Block */) {
                        this.whitespace(' ');
                        this.emitNode(doStmt.statement);
                    }
                    else {
                        this.newLine();
                        this.increaseIndent();
                        this.emitNode(doStmt.statement);
                        this.decreaseIndent();
                    }
                    this.whitespace(' ');
                    this.write('while (');
                    this.emitNode(doStmt.expression);
                    this.write(');');
                    break;
                }
            case 132 /* gt.SyntaxKind.ForStatement */:
                {
                    const forStmt = node;
                    this.write('for (');
                    this.write(' ');
                    if (forStmt.initializer) {
                        this.emitNode(forStmt.initializer);
                    }
                    this.write(';');
                    if (forStmt.condition) {
                        this.whitespace(' ');
                        this.emitNode(forStmt.condition);
                    }
                    this.write(';');
                    if (forStmt.incrementor) {
                        this.whitespace(' ');
                        this.emitNode(forStmt.incrementor);
                    }
                    this.write(' )');
                    if (forStmt.statement.kind === 128 /* gt.SyntaxKind.Block */) {
                        this.whitespace(' ');
                        this.emitNode(forStmt.statement);
                    }
                    else {
                        this.newLine();
                        this.increaseIndent();
                        this.emitNode(forStmt.statement);
                        this.decreaseIndent();
                    }
                    break;
                }
            case 137 /* gt.SyntaxKind.ReturnStatement */:
                {
                    const ret = node;
                    this.write('return');
                    if (ret.expression) {
                        this.whitespace(' ');
                        this.emitNode(ret.expression);
                    }
                    this.write(';');
                    break;
                }
            case 138 /* gt.SyntaxKind.ExpressionStatement */:
                {
                    const exprStmt = node;
                    this.emitNode(exprStmt.expression);
                    this.write(';');
                    break;
                }
            case 136 /* gt.SyntaxKind.IncludeStatement */:
                {
                    const inc = node;
                    this.write('include ');
                    this.emitNode(inc.path);
                    break;
                }
            case 139 /* gt.SyntaxKind.EmptyStatement */:
                {
                    this.write(';');
                    break;
                }
            case 133 /* gt.SyntaxKind.BreakStatement */:
                {
                    this.write('break;');
                    break;
                }
            case 134 /* gt.SyntaxKind.ContinueStatement */:
                {
                    this.write('continue;');
                    break;
                }
            case 135 /* gt.SyntaxKind.BreakpointStatement */:
                {
                    this.write('breakpoint;');
                    break;
                }
            case 127 /* gt.SyntaxKind.SourceFile */:
                {
                    const sf = node;
                    this.emitNodeList(sf.statements, '', '\n', true);
                    break;
                }
            case 0 /* gt.SyntaxKind.Unknown */:
                {
                    // TODO: throw exception?
                    break;
                }
            default:
                {
                    if (isToken(node)) {
                        this.write(tokenToString(node.kind));
                        break;
                    }
                    throw new Error(`unhandled node '${getKindName(node.kind)}'`);
                }
        }
    }
    emitNodeList(nodesList, textSeparator, whitespaceSeparator, includeSeparatorAtEnd = false) {
        nodesList.forEach((node, index) => {
            this.emitNode(node);
            if (includeSeparatorAtEnd || nodesList.length !== (index + 1)) {
                if (textSeparator) {
                    this.write(textSeparator);
                }
                if (whitespaceSeparator) {
                    this.whitespace(whitespaceSeparator);
                }
            }
        });
    }
    reset() {
        this.output = [];
        this.indent = 0;
    }
    flush() {
        const text = this.output.join('');
        this.reset();
        return text;
    }
    printNode(node) {
        this.emitNode(node);
        return this.flush();
    }
    printFile(sourceFile) {
        this.emitNode(sourceFile);
        this.newLine();
        return this.flush();
    }
    constructor(options = {}) {
        this.options = { ...DEFAULT_PRINTER_OPTIONS, ...options };
        this.reset();
    }
}
//# sourceMappingURL=printer.js.map