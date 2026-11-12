import * as gt from './types.js';
/**
 * True if node is of some token syntax kind.
 * For example, this is true for an IfKeyword but not for an IfStatement.
 */
export function isToken(n) {
    return (n.kind >= 2 /* gt.SyntaxKindMarker.FirstToken */ &&
        n.kind <= 113 /* gt.SyntaxKindMarker.LastToken */);
}
/** Return semantic children and syntax tokens in source order. */
export function getNodeChildren(node) {
    const children = [];
    forEachChild(node, child => {
        children.push(child);
    });
    children.push(...node.syntaxTokens);
    children.sort((left, right) => left.pos - right.pos);
    return children;
}
export function nodeHasTokens(node) {
    return node.end - node.pos > 0;
}
/** Return the syntax token containing a source offset. */
export function getTokenAtPosition(position, sourceFile, preferFollowing) {
    function findRightmostChildNodeWithTokens(children, inclusiveStartPosition) {
        for (let index = inclusiveStartPosition; index >= 0; index--) {
            const child = children[index];
            if (nodeHasTokens(child) && position < child.end)
                return child;
        }
        return undefined;
    }
    function findRightmostToken(node) {
        if (isToken(node))
            return node;
        const children = getNodeChildren(node);
        const candidate = findRightmostChildNodeWithTokens(children, children.length - 1);
        return candidate && findRightmostToken(candidate);
    }
    function find(node) {
        const children = getNodeChildren(node);
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            if (child.pos > position) {
                const candidate = findRightmostChildNodeWithTokens(children, preferFollowing ? index : index - 1);
                return candidate && findRightmostToken(candidate);
            }
            if (position < child.end) {
                if (isToken(child))
                    return child;
                if (nodeHasTokens(child))
                    return find(child);
            }
        }
        return undefined;
    }
    return find(sourceFile);
}
export function isModifierKind(token) {
    switch (token) {
        case 53 /* gt.SyntaxKind.ConstKeyword */:
        case 52 /* gt.SyntaxKind.StaticKeyword */:
        case 54 /* gt.SyntaxKind.NativeKeyword */:
            return true;
    }
    return false;
}
export function isKeywordKind(token) {
    return (token >= 50 /* gt.SyntaxKindMarker.FirstKeyword */ &&
        token <= 112 /* gt.SyntaxKindMarker.LastKeyword */);
}
export function isKeywordTypeKind(token) {
    return (token >= 71 /* gt.SyntaxKindMarker.FirstKeywordType */ &&
        token <= 117 /* gt.SyntaxKindMarker.LastKeywordType */);
}
export function isComplexTypeKind(token) {
    if (77 /* gt.SyntaxKindMarker.FirstComplexType */ <= token &&
        109 /* gt.SyntaxKindMarker.LastComplexType */ >= token) {
        return true;
    }
    return false;
}
export function isReferenceKeywordKind(token) {
    switch (token) {
        case 110 /* gt.SyntaxKind.ArrayrefKeyword */:
        case 111 /* gt.SyntaxKind.StructrefKeyword */:
        case 112 /* gt.SyntaxKind.FuncrefKeyword */:
            return true;
    }
    return false;
}
export function isComparisonOperator(token) {
    return token >= 13 /* gt.SyntaxKind.LessThanToken */ && token <= 19 /* gt.SyntaxKind.EqualsGreaterThanToken */;
}
export function isAssignmentOperator(token) {
    return token >= 39 /* gt.SyntaxKind.EqualsToken */ && token <= 49 /* gt.SyntaxKind.CaretEqualsToken */;
}
export function isAssignmentExpression(node) {
    switch (node.kind) {
        case 124 /* gt.SyntaxKind.BinaryExpression */:
            return isAssignmentOperator(node.operatorToken.kind);
        case 126 /* gt.SyntaxKind.ParenthesizedExpression */:
            return isAssignmentExpression(node.expression);
        default:
            return false;
    }
}
export function isLeftHandSideExpressionKind(kind) {
    return (kind === 120 /* gt.SyntaxKind.PropertyAccessExpression */ ||
        kind === 119 /* gt.SyntaxKind.ElementAccessExpression */ ||
        kind === 121 /* gt.SyntaxKind.CallExpression */ ||
        kind === 126 /* gt.SyntaxKind.ParenthesizedExpression */ ||
        kind === 118 /* gt.SyntaxKind.ArrayLiteralExpression */ ||
        kind === 113 /* gt.SyntaxKind.Identifier */ ||
        kind === 2 /* gt.SyntaxKind.NumericLiteral */ ||
        kind === 3 /* gt.SyntaxKind.StringLiteral */ ||
        kind === 68 /* gt.SyntaxKind.FalseKeyword */ ||
        kind === 69 /* gt.SyntaxKind.NullKeyword */ ||
        kind === 67 /* gt.SyntaxKind.TrueKeyword */);
}
export function isContainerKind(kind) {
    return (kind === 127 /* gt.SyntaxKind.SourceFile */ ||
        kind === 142 /* gt.SyntaxKind.FunctionDeclaration */ ||
        kind === 140 /* gt.SyntaxKind.StructDeclaration */);
}
export function isNamedDeclarationKind(kind) {
    return (kind === 127 /* gt.SyntaxKind.SourceFile */ ||
        kind === 141 /* gt.SyntaxKind.VariableDeclaration */ ||
        kind === 142 /* gt.SyntaxKind.FunctionDeclaration */ ||
        kind === 140 /* gt.SyntaxKind.StructDeclaration */ ||
        kind === 144 /* gt.SyntaxKind.PropertyDeclaration */ ||
        kind === 143 /* gt.SyntaxKind.ParameterDeclaration */ ||
        kind === 145 /* gt.SyntaxKind.TypedefDeclaration */);
}
export function isDeclarationKind(kind) {
    return isNamedDeclarationKind(kind);
}
export function isLeftHandSideExpression(node) {
    return isLeftHandSideExpressionKind(node.kind);
}
export function isPartOfExpression(node) {
    switch (node.kind) {
        case 69 /* gt.SyntaxKind.NullKeyword */:
        case 67 /* gt.SyntaxKind.TrueKeyword */:
        case 68 /* gt.SyntaxKind.FalseKeyword */:
        case 118 /* gt.SyntaxKind.ArrayLiteralExpression */:
        case 120 /* gt.SyntaxKind.PropertyAccessExpression */:
        case 119 /* gt.SyntaxKind.ElementAccessExpression */:
        case 121 /* gt.SyntaxKind.CallExpression */:
        case 125 /* gt.SyntaxKind.TypeAssertionExpression */:
        case 126 /* gt.SyntaxKind.ParenthesizedExpression */:
        case 122 /* gt.SyntaxKind.PrefixUnaryExpression */:
        case 123 /* gt.SyntaxKind.PostfixUnaryExpression */:
        case 124 /* gt.SyntaxKind.BinaryExpression */:
        case 113 /* gt.SyntaxKind.Identifier */:
            return true;
        case 2 /* gt.SyntaxKind.NumericLiteral */:
        case 3 /* gt.SyntaxKind.StringLiteral */: {
            const parent = node.parent;
            switch (parent.kind) {
                case 141 /* gt.SyntaxKind.VariableDeclaration */:
                case 144 /* gt.SyntaxKind.PropertyDeclaration */:
                case 138 /* gt.SyntaxKind.ExpressionStatement */:
                case 129 /* gt.SyntaxKind.IfStatement */:
                case 130 /* gt.SyntaxKind.DoStatement */:
                case 131 /* gt.SyntaxKind.WhileStatement */:
                case 137 /* gt.SyntaxKind.ReturnStatement */:
                case 132 /* gt.SyntaxKind.ForStatement */: {
                    const forStatement = parent;
                    return (forStatement.initializer === node ||
                        forStatement.condition === node ||
                        forStatement.incrementor === node);
                }
                default:
                    if (isPartOfExpression(parent)) {
                        return true;
                    }
            }
            break;
        }
    }
    return false;
}
export function isPartOfTypeNode(node) {
    if (115 /* gt.SyntaxKindMarker.FirstTypeNode */ <= node.kind &&
        node.kind <= 117 /* gt.SyntaxKindMarker.LastTypeNode */) {
        return true;
    }
    switch (node.kind) {
        case 74 /* gt.SyntaxKind.IntKeyword */:
        case 75 /* gt.SyntaxKind.FixedKeyword */:
        case 76 /* gt.SyntaxKind.StringKeyword */:
        case 71 /* gt.SyntaxKind.BoolKeyword */:
        case 106 /* gt.SyntaxKind.VoidKeyword */:
            return true;
        // Identifiers and qualified names may be type nodes, depending on their context. Climb
        // above them to find the lowest container
        case 113 /* gt.SyntaxKind.Identifier */:
            // If the identifier is the RHS of a qualified name, then it's a type iff its parent is.
            if (node.parent.kind === 120 /* gt.SyntaxKind.PropertyAccessExpression */ &&
                node.parent.name === node) {
                node = node.parent;
            }
        // At this point, node is either a qualified name or an identifier
        // Debug.assert(node.kind === gt.SyntaxKind.Identifier || node.kind === gt.SyntaxKind.QualifiedName || node.kind === gt.SyntaxKind.PropertyAccessExpression,
        //     "'node' was expected to be a qualified name, identifier or property access in 'isPartOfTypeNode'.");
        // falls through
        case 120 /* gt.SyntaxKind.PropertyAccessExpression */: {
            const parent = node.parent;
            // Do not recursively call isPartOfTypeNode on the parent. In the example:
            //
            //     let a: A.B.C;
            //
            // Calling isPartOfTypeNode would consider the qualified name A.B a type node.
            // Only C and A.B.C are type nodes.
            if (115 /* gt.SyntaxKindMarker.FirstTypeNode */ <= parent.kind &&
                parent.kind <= 117 /* gt.SyntaxKindMarker.LastTypeNode */) {
                return true;
            }
            switch (parent.kind) {
                case 144 /* gt.SyntaxKind.PropertyDeclaration */:
                case 143 /* gt.SyntaxKind.ParameterDeclaration */:
                case 141 /* gt.SyntaxKind.VariableDeclaration */:
                    return node === parent.type;
                case 142 /* gt.SyntaxKind.FunctionDeclaration */:
                    return node === parent.type;
                // TODO:
                // case gt.SyntaxKind.CallExpression:
                //     return (<gt.CallExpression>parent).typeArguments && indexOf((<gt.CallExpression>parent).typeArguments, node) >= 0;
            }
            break;
        }
    }
    return false;
}
export function isRightSideOfPropertyAccess(node) {
    return (node.parent.kind === 120 /* gt.SyntaxKind.PropertyAccessExpression */ &&
        node.parent.name === node);
}
function isNodeOrArray(a) {
    return a !== undefined && a.kind !== undefined;
}
export function getKindName(k) {
    if (typeof k === 'string') {
        return k;
    }
    return gt.SyntaxKind[k];
}
export function sourceFileToJSON(file) {
    return JSON.stringify(file, (_, v) => (isNodeOrArray(v) ? serializeNode(v) : v), '    ');
    function serializeNode(n) {
        const o = { kind: getKindName(n.kind) };
        // if (ts.containsParseError(n)) {
        //     o.containsParseError = true;
        // }
        for (const propertyName in n) {
            switch (propertyName) {
                case 'parent':
                case 'symbol':
                case 'locals':
                case 'localSymbol':
                case 'kind':
                case 'semanticDiagnostics':
                case 'id':
                case 'nodeCount':
                case 'symbolCount':
                case 'identifierCount':
                case 'scriptSnapshot':
                    // Blacklist of items we never put in the baseline file.
                    break;
                case 'originalKeywordKind':
                    o[propertyName] = getKindName(n[propertyName]);
                    break;
                case 'flags':
                    // Clear the flags that are produced by aggregating child values. That is ephemeral
                    // data we don't care about in the dump. We only care what the parser set directly
                    // on the AST.
                    // const flags = n.flags & ~(ts.NodeFlags.JavaScriptFile | ts.NodeFlags.HasAggregatedChildData);
                    // if (flags) {
                    //     o[propertyName] = getNodeFlagName(flags);
                    // }
                    break;
                case 'referenceDiagnostics':
                case 'parseDiagnostics':
                    // o[propertyName] = Utils.convertDiagnostics((<any>n)[propertyName]);
                    break;
                // case "nextContainer":
                //     if (n.nextContainer) {
                //         o[propertyName] = { kind: n.nextContainer.kind, pos: n.nextContainer.pos, end: n.nextContainer.end };
                //     }
                //     break;
                case 'text':
                    // Include 'text' field for identifiers/literals, but not for source files.
                    if (n.kind !== 127 /* gt.SyntaxKind.SourceFile */) {
                        o[propertyName] = n[propertyName];
                    }
                    break;
                default:
                    o[propertyName] = n[propertyName];
            }
        }
        return o;
    }
}
export function findAncestor(node, callback) {
    while (node) {
        const result = callback(node);
        if (result === 'quit') {
            return undefined;
        }
        else if (result) {
            return node;
        }
        node = node.parent;
    }
    return undefined;
}
export function findAncestorByKind(node, kind) {
    while (node && node.kind !== kind) {
        node = node.parent;
    }
    return node;
}
export function getSourceFileOfNode(node) {
    while (node && node.kind !== 127 /* gt.SyntaxKind.SourceFile */) {
        node = node.parent;
    }
    return node;
}
export function fixupParentReferences(rootNode) {
    let parent = rootNode;
    forEachChild(rootNode, visitNode);
    function visitNode(n) {
        // walk down setting parents that differ from the parent we think it should be.  This
        // allows us to quickly bail out of setting parents for subtrees during incremental
        // parsing
        if (n.parent !== parent) {
            n.parent = parent;
            const saveParent = parent;
            parent = n;
            forEachChild(n, visitNode);
            parent = saveParent;
        }
    }
}
function visitNode(cbNode, node) {
    return node && cbNode(node);
}
function visitNodes(cbNode, cbNodes, nodes) {
    if (nodes) {
        if (cbNodes) {
            return cbNodes(nodes);
        }
        for (const node of nodes) {
            const result = cbNode(node);
            if (result) {
                return result;
            }
        }
    }
}
/**
 * Invokes a callback for each child of the given node. The 'cbNode' callback is invoked for all child nodes
 * stored in properties. If a 'cbNodes' callback is specified, it is invoked for embedded arrays; otherwise,
 * embedded arrays are flattened and the 'cbNode' callback is invoked for each element. If a callback returns
 * a truthy value, iteration stops and that value is returned. Otherwise, undefined is returned.
 *
 * @param node a given node to visit its children
 * @param cbNode a callback to be invoked for all child nodes
 * @param cbNodes a callback to be invoked for embedded array
 *
 * @remarks `forEachChild` must visit the children of a node in the order
 * that they appear in the source code.
 */
export function forEachChild(node, cbNode, cbNodes) {
    if (!node || !node.kind) {
        return;
    }
    switch (node.kind) {
        case 144 /* gt.SyntaxKind.PropertyDeclaration */:
            return (visitNodes(cbNode, cbNodes, node.modifiers) ||
                visitNode(cbNode, node.type) ||
                visitNode(cbNode, node.name));
        case 141 /* gt.SyntaxKind.VariableDeclaration */:
            return (visitNodes(cbNode, cbNodes, node.modifiers) ||
                visitNode(cbNode, node.type) ||
                visitNode(cbNode, node.name) ||
                visitNode(cbNode, node.initializer));
        case 142 /* gt.SyntaxKind.FunctionDeclaration */:
            return (visitNodes(cbNode, cbNodes, node.modifiers) ||
                visitNode(cbNode, node.type) ||
                visitNode(cbNode, node.name) ||
                visitNodes(cbNode, cbNodes, node.parameters) ||
                visitNode(cbNode, node.body));
        case 140 /* gt.SyntaxKind.StructDeclaration */:
            return (visitNodes(cbNode, cbNodes, node.modifiers) ||
                visitNode(cbNode, node.name) ||
                visitNodes(cbNode, cbNodes, node.members));
        case 143 /* gt.SyntaxKind.ParameterDeclaration */:
            return (visitNodes(cbNode, cbNodes, node.modifiers) ||
                visitNode(cbNode, node.name) ||
                visitNode(cbNode, node.type));
        case 145 /* gt.SyntaxKind.TypedefDeclaration */:
            return (visitNode(cbNode, node.type) ||
                visitNode(cbNode, node.name));
        case 117 /* gt.SyntaxKind.ArrayType */:
            return (visitNode(cbNode, node.elementType) ||
                visitNode(cbNode, node.size));
        case 116 /* gt.SyntaxKind.MappedType */:
            return (visitNode(cbNode, node.returnType) ||
                visitNodes(cbNode, cbNodes, node.typeArguments));
        case 120 /* gt.SyntaxKind.PropertyAccessExpression */:
            return (visitNode(cbNode, node.expression) ||
                visitNode(cbNode, node.name));
        case 119 /* gt.SyntaxKind.ElementAccessExpression */:
            return (visitNode(cbNode, node.expression) ||
                visitNode(cbNode, node.argumentExpression));
        case 121 /* gt.SyntaxKind.CallExpression */:
            return (visitNode(cbNode, node.expression) ||
                visitNodes(cbNode, cbNodes, node.arguments));
        case 126 /* gt.SyntaxKind.ParenthesizedExpression */:
            return visitNode(cbNode, node.expression);
        case 122 /* gt.SyntaxKind.PrefixUnaryExpression */:
            return (visitNode(cbNode, node.operator) ||
                visitNode(cbNode, node.operand));
        case 123 /* gt.SyntaxKind.PostfixUnaryExpression */:
            return (visitNode(cbNode, node.operand) ||
                visitNode(cbNode, node.operator));
        case 124 /* gt.SyntaxKind.BinaryExpression */:
            return (visitNode(cbNode, node.left) ||
                visitNode(cbNode, node.operatorToken) ||
                visitNode(cbNode, node.right));
        case 128 /* gt.SyntaxKind.Block */:
            return visitNodes(cbNode, cbNodes, node.statements);
        case 127 /* gt.SyntaxKind.SourceFile */:
            return visitNodes(cbNode, cbNodes, node.statements);
        case 138 /* gt.SyntaxKind.ExpressionStatement */:
            return visitNode(cbNode, node.expression);
        case 129 /* gt.SyntaxKind.IfStatement */:
            return (visitNode(cbNode, node.expression) ||
                visitNode(cbNode, node.thenStatement) ||
                visitNode(cbNode, node.elseStatement));
        case 130 /* gt.SyntaxKind.DoStatement */:
            return (visitNode(cbNode, node.statement) ||
                visitNode(cbNode, node.expression));
        case 131 /* gt.SyntaxKind.WhileStatement */:
            return (visitNode(cbNode, node.expression) ||
                visitNode(cbNode, node.statement));
        case 132 /* gt.SyntaxKind.ForStatement */:
            return (visitNode(cbNode, node.initializer) ||
                visitNode(cbNode, node.condition) ||
                visitNode(cbNode, node.incrementor) ||
                visitNode(cbNode, node.statement));
        case 134 /* gt.SyntaxKind.ContinueStatement */:
        case 133 /* gt.SyntaxKind.BreakStatement */:
        case 135 /* gt.SyntaxKind.BreakpointStatement */:
            break;
        case 137 /* gt.SyntaxKind.ReturnStatement */:
            return visitNode(cbNode, node.expression);
        case 136 /* gt.SyntaxKind.IncludeStatement */:
            return visitNode(cbNode, node.path);
    }
}
export function createFileDiagnostic(file, start, length, message) {
    // const end = start + length;
    return {
        file: file,
        code: message.code,
        category: message.category,
        start: start,
        length: length,
        messageText: message.message,
        toString() {
            return `${this.file?.fileName} [${this.start}]: ${this.messageText}`.toString();
        },
    };
}
export function getPositionOfLineAndCharacter(sourceFile, line, character) {
    return sourceFile.lineMap[line] + character;
}
export function getLineAndCharacterOfPosition(sourceFile, pos) {
    let loc = { line: 0, character: 0 };
    for (let i = 0; i < sourceFile.lineMap.length; i++) {
        if (sourceFile.lineMap[i] <= pos) {
            loc = {
                line: i,
                character: pos - sourceFile.lineMap[i],
            };
            continue;
        }
        break;
    }
    return loc;
}
export function getNodeRange(node) {
    const sourceFile = getSourceFileOfNode(node);
    return {
        start: getLineAndCharacterOfPosition(sourceFile, node.pos),
        end: getLineAndCharacterOfPosition(sourceFile, node.end),
    };
}
export function createDiagnosticForNode(node, category, msg, tags) {
    const d = {
        file: getSourceFileOfNode(node),
        category: category,
        start: node.pos,
        length: node.end - node.pos,
        line: node.line,
        col: node.char,
        messageText: msg,
        toString() {
            return `${this.file?.fileName} [${this.start}]: ${this.messageText}`.toString();
        },
    };
    if (tags) {
        d.tags = tags.concat();
    }
    return d;
}
