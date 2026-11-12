import { forEachChild, isDeclarationKind, isContainerKind, getSourceFileOfNode } from './utils.js';
// import { SignatureMeta, TypeChecker } from './checker.js';
export function getDeclarationName(node) {
    switch (node.kind) {
        case 127 /* SyntaxKind.SourceFile */:
            {
                return node.fileName;
                break;
            }
        case 141 /* SyntaxKind.VariableDeclaration */:
        case 142 /* SyntaxKind.FunctionDeclaration */:
        case 140 /* SyntaxKind.StructDeclaration */:
        case 143 /* SyntaxKind.ParameterDeclaration */:
        case 144 /* SyntaxKind.PropertyDeclaration */:
        case 145 /* SyntaxKind.TypedefDeclaration */:
            {
                return node.name.name;
                break;
            }
        case 120 /* SyntaxKind.PropertyAccessExpression */:
            {
                return '__prop__' + node.name.name;
                break;
            }
        case 121 /* SyntaxKind.CallExpression */:
            {
                const call = node;
                if (call.expression.kind === 113 /* gt.SyntaxKind.Identifier */) {
                    return call.expression.name;
                }
                else {
                    // TODO: properly named call expressions such as: st.member_fns[12]();
                    return '__()';
                }
                break;
            }
    }
    return '';
}
function isDeclNodeDefined(node) {
    if ((node.kind === 142 /* gt.SyntaxKind.FunctionDeclaration */ && node.body) ||
        (node.kind === 141 /* gt.SyntaxKind.VariableDeclaration */ && node.initializer)) {
        return true;
    }
    return false;
}
// function createSymbolTable(symbols?: ReadonlyArray<Symbol>): SymbolTable {
//     const result = new Map<string, Symbol>() as SymbolTable;
//     if (symbols) {
//         for (const symbol of symbols) {
//             result.set(symbol.escapedName, symbol);
//         }
//     }
//     return result;
// }
export function declareSymbol(node, store, parentSymbol) {
    let nodeSymbol;
    let name;
    name = getDeclarationName(node);
    if (!name) {
        name = '__anonymous';
    }
    if (parentSymbol && parentSymbol.members.has(name)) {
        nodeSymbol = parentSymbol.members.get(name);
    }
    else {
        let isStatic = false;
        if (node.modifiers) {
            isStatic = node.modifiers.some((value) => value.kind === 52 /* gt.SyntaxKind.StaticKeyword */);
        }
        if (parentSymbol && !isStatic && parentSymbol.declarations[0].kind === 127 /* gt.SyntaxKind.SourceFile */) {
            nodeSymbol = store.resolveGlobalSymbol(name);
        }
        if (!nodeSymbol) {
            nodeSymbol = {
                escapedName: name,
                declarations: [],
                valueDeclaration: undefined,
                isAssigned: false,
                isReferenced: false,
                members: new Map(),
                parent: parentSymbol,
            };
            switch (node.kind) {
                case 143 /* gt.SyntaxKind.ParameterDeclaration */:
                    nodeSymbol.flags = 4 /* gt.SymbolFlags.FunctionParameter */;
                    break;
                case 141 /* gt.SyntaxKind.VariableDeclaration */:
                    nodeSymbol.flags = ((parentSymbol &&
                        parentSymbol.declarations[0].kind === 127 /* gt.SyntaxKind.SourceFile */) ? 8 /* gt.SymbolFlags.GlobalVariable */ : 2 /* gt.SymbolFlags.LocalVariable */);
                    break;
                case 142 /* gt.SyntaxKind.FunctionDeclaration */:
                    nodeSymbol.flags = 32 /* gt.SymbolFlags.Function */;
                    break;
                case 140 /* gt.SyntaxKind.StructDeclaration */:
                    nodeSymbol.flags = 64 /* gt.SymbolFlags.Struct */;
                    break;
                case 144 /* gt.SyntaxKind.PropertyDeclaration */:
                    nodeSymbol.flags = 16 /* gt.SymbolFlags.Property */;
                    break;
                case 145 /* gt.SyntaxKind.TypedefDeclaration */:
                    nodeSymbol.flags = 128 /* gt.SymbolFlags.Typedef */;
                    break;
            }
            switch (node.kind) {
                case 141 /* gt.SyntaxKind.VariableDeclaration */:
                case 142 /* gt.SyntaxKind.FunctionDeclaration */:
                    {
                        if (isStatic) {
                            nodeSymbol.flags |= 1024 /* gt.SymbolFlags.Static */;
                        }
                        if (node.modifiers.some((value) => value.kind === 54 /* gt.SyntaxKind.NativeKeyword */)) {
                            nodeSymbol.flags |= 2048 /* gt.SymbolFlags.Native */;
                        }
                        break;
                    }
            }
        }
        if (parentSymbol) {
            parentSymbol.members.set(name, nodeSymbol);
        }
    }
    node.symbol = nodeSymbol;
    nodeSymbol.declarations.push(node);
    if (!node.symbol.valueDeclaration && isDeclNodeDefined(node)) {
        nodeSymbol.valueDeclaration = node;
    }
    return nodeSymbol;
}
export function bindSourceFile(sourceFile, store) {
    let currentScope;
    let currentContainer;
    bind(sourceFile);
    function bind(node) {
        const parentScope = currentScope;
        const parentContainer = currentContainer;
        if (isDeclarationKind(node.kind)) {
            switch (node.kind) {
                case 127 /* SyntaxKind.SourceFile */:
                    {
                        declareSymbol(node, store, undefined);
                        break;
                    }
                default:
                    {
                        declareSymbol(node, store, currentContainer.symbol);
                        break;
                    }
            }
        }
        // if (node.kind === SyntaxKind.SourceFile || node.kind === SyntaxKind.FunctionDeclaration || node.kind === SyntaxKind.StructDeclaration) {
        if (isContainerKind(node.kind)) {
            currentContainer = node;
        }
        if (isDeclarationKind(node.kind)) {
            currentScope = node;
        }
        forEachChild(node, child => bind(child));
        currentScope = parentScope;
        currentContainer = parentContainer;
    }
}
export function unbindSourceFile(sourceFile, _store) {
    function unbindSymbol(parentSymbol) {
        for (const symbol of parentSymbol.members.values()) {
            symbol.declarations = symbol.declarations.filter((decl) => {
                return getSourceFileOfNode(decl) !== sourceFile;
            });
            if (!symbol.declarations.find(x => x === symbol.valueDeclaration) &&
                getSourceFileOfNode(symbol.valueDeclaration) === sourceFile) {
                delete symbol.valueDeclaration;
            }
            if (symbol.declarations.length) {
                unbindSymbol(symbol);
                if (!symbol.valueDeclaration) {
                    for (const childDecl of symbol.declarations) {
                        if (!isDeclNodeDefined(childDecl))
                            continue;
                        symbol.valueDeclaration = childDecl;
                        break;
                    }
                }
            }
            else {
                parentSymbol.members.delete(symbol.escapedName);
            }
        }
    }
    unbindSymbol(sourceFile.symbol);
}
//# sourceMappingURL=binder.js.map