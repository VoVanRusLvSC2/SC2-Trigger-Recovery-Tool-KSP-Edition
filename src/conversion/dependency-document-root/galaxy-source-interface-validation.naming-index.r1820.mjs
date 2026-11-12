import {nativeGuiInterfacesFor} from "./native-gui-source-interfaces.naming-index.r1820.mjs";

/** Bounded, declaration-driven checks for a conversion's script/header pair.

 * This is not a linker or an execution engine: missing includes remain explicit.

 */

import { Parser, tokenToString, stringToToken, isKeywordTypeKind, forEachChild, isAssignmentOperator, isComparisonOperator, getKeywordType, getBinaryResultType, LiteralType } from "../exact-function-signatures/index-alternate-3.js";

import { resolveGalaxyTypeAliases } from "../native-expression-identity/galaxy-type-resolution.mjs";

function typeName(node) {

    if (!node)

        return 'unknown';

    if (node.returnType && node.typeArguments)

        return `${typeName(node.returnType)}<${node.typeArguments.map(typeName).join(',')}>`;

    if (node.kind === 117 /* K.ArrayType */)

        return `${typeName(node.elementType)}[]`;

    if (node.kind === 113 /* K.Identifier */)

        return typeof node.name === 'string' && node.name ? node.name : 'unknown';

    if (node.kind === 115 /* K.TypeReference */)

        return node.typeName?.name ?? 'unknown';

    return isKeywordTypeKind(node.kind) ? tokenToString(node.kind) : 'unknown';

}

export function validateGalaxyPair(primary, declarations = [], strictSymbols = false, {nativeGuiInterfaces} = {}) {

    const parser = new Parser();

    const sources = [...declarations.map(file => ({ ...file, external: true })), ...primary.map(file => ({ ...file, external: false }))]

        .map(file => ({ ...file, ast: parser.parseFile(file.fileName, file.text) }));

    const globals = new Map(), structures = new Map();

    resolveGalaxyTypeAliases(sources.flatMap(source => [...source.ast.statements]));

    const diagnostics = [];

    const reported = new Set(), unresolved = new Set();

    let omitted = 0, errors = 0, uncheckedTypes = 0;

    const primaryDefinitions = new Set();

    const declaredSymbols = new Set();

    const report = (code, node, fileName, message, symbol, missing = false) => {

        const key = `${code}:${fileName}:${node?.pos}:${symbol ?? ''}`;

        if (reported.has(key))

            return;

        reported.add(key);

        const severity = missing && !strictSymbols ? 'warning' : 'error';

        if (severity === 'error')

            errors++;

        if (diagnostics.length >= 1000) {

            omitted++;

            return;

        }

        diagnostics.push({ code: `sc2-triggers/${code}`, severity, message, details: { fileName, start: Math.max(0, node?.pos ?? 0), end: Math.max(0, node?.end ?? 0), ...(symbol ? { symbol } : {}) } });

    };

    const symbolFor = (node, fileName) => ({

        type: typeName(node.type), node, fileName,

        ...(node.kind === 142 /* K.FunctionDeclaration */ ? { parameters: [...node.parameters].map(p => typeName(p.type)) } : {}),

        constant: node.modifiers?.some((m) => m.kind === 53 /* K.ConstKeyword */),

    });

    for (const source of sources) {

        for (const diagnostic of source.ast.parseDiagnostics)

            report('galaxy-syntax', { pos: diagnostic.start ?? 0, end: (diagnostic.start ?? 0) + (diagnostic.length ?? 0) }, source.fileName, diagnostic.messageText ?? 'Invalid Galaxy syntax');

        for (const node of source.ast.statements) {

            if (node.kind === 140 /* K.StructDeclaration */) {

                structures.set(node.name.name, new Map([...node.members].map((member) => [member.name.name, symbolFor(member, source.fileName)])));

            }

            else if (node.kind === 141 /* K.VariableDeclaration */ || node.kind === 142 /* K.FunctionDeclaration */) {

                const name = node.name.name, info = symbolFor(node, source.fileName), existing = globals.get(name);

                if (!source.external)

                    declaredSymbols.add(name);

                if (!source.external && (node.kind === 141 /* K.VariableDeclaration */ || node.body)) {

                    if (primaryDefinitions.has(name))

                        report('galaxy-duplicate-definition', node, source.fileName, `Duplicate definition of '${name}'.`, name);

                    primaryDefinitions.add(name);

                }

                if (existing && (existing.type !== info.type || JSON.stringify(existing.parameters) !== JSON.stringify(info.parameters))) {

                    report('galaxy-signature-conflict', node, source.fileName, `Conflicting declarations for '${name}'.`, name);

                }

                globals.set(name, info);

            }

        }

    }

    let catalogDerivedInterfaces = 0;

    // Interface facts never become source files or authored declarations.

    if (nativeGuiInterfaces) for (const record of nativeGuiInterfacesFor(nativeGuiInterfaces, [...declarations, ...primary])) {

        if (globals.has(record.name)) throw new Error('NATIVE_GUI_INTERFACE_SHADOWS_REAL_DECLARATION');

        catalogDerivedInterfaces++;

        globals.set(record.name, {type:record.signature.returnType, parameters:[...record.signature.parameters],

            fileName:'@catalog-interface', interfaceOnly:true, catalog:record.catalog, definition:record.definition});

    }

    // Use the language core's singleton types and predicates. The declaration

    // walker remains bounded and can explicitly defer unavailable named types.

    const coreTypes = new Map();

    const coreType = (name) => {

        if (!coreTypes.has(name)) {

            const kind = name === 'null' ? 69 /* K.NullKeyword */ : stringToToken(name);

            coreTypes.set(name, kind === undefined ? undefined : getKeywordType(kind));

        }

        return coreTypes.get(name);

    };

    const expressionTypes = new WeakMap();

    const functionSignature = type => {

        const name = /^funcref<([A-Za-z0-9_]+)>$/u.exec(type)?.[1];

        const fn = name ? globals.get(name) : undefined;

        return fn?.parameters ? fn : undefined;

    };

    const sameFunctionSignature = (left, right) => {

        const a=functionSignature(left),b=functionSignature(right);

        return !!a && !!b && a.type===b.type && JSON.stringify(a.parameters)===JSON.stringify(b.parameters);

    };

    const assignable = (expected, actual, actualNode) => {

        if (expected === 'unknown' || actual === 'unknown')

            return true;

        const target = coreType(expected), value = expressionTypes.get(actualNode ?? {}) ?? coreType(actual);

        if (target && value)

            return value.isAssignableTo(target);

        if (actual === 'null')

            return expected.startsWith('funcref<');

        if (expected.startsWith('funcref<') || actual.startsWith('funcref<'))

            return sameFunctionSignature(expected,actual);

        return expected === actual || expected === `structref<${actual}>`;

    };

    const lookup = (name, scopes) => { for (const scope of scopes) {

        const found = scope.get(name);

        if (found)

            return found;

    } return globals.get(name); };

    for (const source of sources.filter(file => !file.external)) {

        const mismatch = (expected, actual, node, label, actualNode = node) => {

            if (expected === 'unknown' || actual === 'unknown')

                uncheckedTypes++;

            if (!assignable(expected, actual, actualNode))

                report('galaxy-type-mismatch', node, source.fileName, `${label} expects '${expected}', got '${actual}'.`);

        };

        const resolve = (node, scopes) => {

            const value = lookup(node.name, scopes);

            if (!value) {

                unresolved.add(node.name);

                report('galaxy-unresolved-symbol', node, source.fileName, `No loaded declaration for '${node.name}'.`, node.name, true);

            }

            return value;

        };

        const inferExpression = (node, scopes) => {

            if (!node)

                return 'unknown';

            switch (node.kind) {

                case 113 /* K.Identifier */: {

                    const info=resolve(node, scopes);

                    return info?.parameters ? `funcref<${node.name}>` : info?.type ?? 'unknown';

                }

                case 2 /* K.NumericLiteral */: {

                    const fixed = (node.text ?? '').includes('.');

                    expressionTypes.set(node, new LiteralType(512 /* TypeFlags.NumericLiteral */ | (fixed ? 32 /* TypeFlags.Fixed */ : 4 /* TypeFlags.Integer */), node));

                    return fixed ? 'fixed' : 'int';

                }

                case 3 /* K.StringLiteral */:

                    expressionTypes.set(node, new LiteralType(256 /* TypeFlags.StringLiteral */ | 2 /* TypeFlags.String */ | 128 /* TypeFlags.Nullable */, node));

                    return 'string';

                case 67 /* K.TrueKeyword */:

                case 68 /* K.FalseKeyword */: return 'bool';

                case 69 /* K.NullKeyword */: return 'null';

                case 126 /* K.ParenthesizedExpression */: {

                    const type = expression(node.expression, scopes), value = expressionTypes.get(node.expression);

                    if (value)

                        expressionTypes.set(node, value);

                    return type;

                }

                case 121 /* K.CallExpression */: {

                    let fn;

                    if(node.expression.kind === 113 /* K.Identifier */){

                        const value=resolve(node.expression, scopes);

                        fn=value?.parameters ? value : functionSignature(value?.type ?? '') ?? value;

                    }else{

                        fn=functionSignature(expression(node.expression, scopes));

                    }

                    const args = [...node.arguments].map(arg => expression(arg, scopes));

                    if (fn?.parameters) {

                        if (args.length !== fn.parameters.length)

                            report('galaxy-call-arity', node, source.fileName, `Function '${node.expression.name}' expects ${fn.parameters.length} argument(s), got ${args.length}.`, node.expression.name);

                        args.forEach((actual, i) => { if (fn.parameters[i])

                            mismatch(fn.parameters[i], actual, node.arguments[i], `Argument ${i + 1} of '${node.expression.name}'`); });

                    }

                    else if (fn && fn.type !== 'unknown' && !fn.type.startsWith('funcref'))

                        report('galaxy-not-callable', node, source.fileName, `'${node.expression.name}' is not a function.`, node.expression.name);

                    return fn?.parameters ? fn.type : 'unknown';

                }

                case 119 /* K.ElementAccessExpression */: {

                    const type = expression(node.expression, scopes);

                    mismatch('int', expression(node.argumentExpression, scopes), node.argumentExpression, 'Array index');

                    return type.endsWith('[]') ? type.slice(0, -2) : 'unknown';

                }

                case 120 /* K.PropertyAccessExpression */: {

                    const type = expression(node.expression, scopes), structure = structures.get(/^structref<(.+)>$/u.exec(type)?.[1] ?? type);

                    const member = structure?.get(node.name.name);

                    if (structure && !member)

                        report('galaxy-unknown-member', node.name, source.fileName, `Type '${type}' has no member '${node.name.name}'.`, node.name.name);

                    return member?.type ?? 'unknown';

                }

                case 124 /* K.BinaryExpression */: {

                    const left = expression(node.left, scopes), right = expression(node.right, scopes), op = node.operatorToken.kind;

                    if (isAssignmentOperator(op)) {

                        mismatch(left, right, node.right, 'Assignment');

                        if (node.left.kind === 113 /* K.Identifier */ && lookup(node.left.name, scopes)?.constant)

                            report('galaxy-constant-write', node.left, source.fileName, `Cannot assign to constant '${node.left.name}'.`, node.left.name);

                        return left;

                    }

                    if ([34 /* K.AmpersandAmpersandToken */, 35 /* K.BarBarToken */].includes(op)) {

                        mismatch('bool', left, node.left, 'Logical operand');

                        mismatch('bool', right, node.right, 'Logical operand');

                        return 'bool';

                    }

                    const leftType = expressionTypes.get(node.left), rightType = expressionTypes.get(node.right);

                    if (isComparisonOperator(op)) {

                        if (leftType && rightType) {

                            if (!rightType.isComparableTo(leftType))

                                report('galaxy-type-mismatch', node.right, source.fileName, `Cannot compare '${left}' with '${right}'.`);

                        }

                        else if(left.startsWith('funcref<')||right.startsWith('funcref<')){

                            if(!((left==='null'&&functionSignature(right))||(right==='null'&&functionSignature(left))||sameFunctionSignature(left,right)))

                                report('galaxy-type-mismatch',node.right,source.fileName,`Cannot compare '${left}' with '${right}'.`);

                        }else

                            uncheckedTypes++;

                        return 'bool';

                    }

                    if (!leftType || !rightType) {

                        uncheckedTypes++;

                        return 'unknown';

                    }

                    if (!leftType.isValidBinaryOperation(op, rightType))

                        report('galaxy-type-mismatch', node, source.fileName, `Operator '${tokenToString(op)}' is not supported between '${left}' and '${right}'.`);

                    const result = getBinaryResultType(leftType, rightType, op);

                    expressionTypes.set(node, result);

                    return result.flags & 32 /* TypeFlags.Fixed */ ? 'fixed' : result.flags & 4 /* TypeFlags.Integer */ ? 'int' : left;

                }

                case 122 /* K.PrefixUnaryExpression */:

                case 123 /* K.PostfixUnaryExpression */: {

                    const operand = expression(node.operand, scopes);

                    const value = expressionTypes.get(node.operand);

                    if (value) {

                        if (node.kind === 122 /* K.PrefixUnaryExpression */ && !value.isValidPrefixOperation(node.operator.kind))

                            report('galaxy-type-mismatch', node, source.fileName, `Prefix '${tokenToString(node.operator.kind)}' is not supported for '${operand}'.`);

                        // The existing core checker preserves the operand type for unary

                        // expressions, including !; do not invent a separate conversion rule.

                        expressionTypes.set(node, value);

                    }

                    else

                        uncheckedTypes++;

                    return operand;

                }

                case 125 /* K.TypeAssertionExpression */:

                    expression(node.expression, scopes);

                    return typeName(node.type);

                default:

                    uncheckedTypes++;

                    return 'unknown';

            }

        };

        const definitelyReturns = (node) => {

            if (!node)

                return false;

            if (node.kind === 137 /* K.ReturnStatement */)

                return true;

            if (node.kind === 128 /* K.Block */)

                return [...node.statements].some(definitelyReturns);

            return node.kind === 129 /* K.IfStatement */ && definitelyReturns(node.thenStatement) && definitelyReturns(node.elseStatement);

        };

        const expression = (node, scopes) => {

            const name = inferExpression(node, scopes);

            if (node && !expressionTypes.has(node)) {

                const value = coreType(name);

                if (value)

                    expressionTypes.set(node, value);

            }

            return name;

        };

        const condition = (node, scopes, label) => {

            const name = expression(node, scopes), value = expressionTypes.get(node);

            if (!value)

                uncheckedTypes++;

            else if (!value.isBoolExpression(false))

                report('galaxy-type-mismatch', node, source.fileName, `${label} cannot use '${name}' as a boolean expression.`);

        };

        const walk = (node, scopes, returnType, loopDepth = 0) => {

            if (!node)

                return;

            switch (node.kind) {

                case 136 /* K.IncludeStatement */:

                case 140 /* K.StructDeclaration */: return;

                case 142 /* K.FunctionDeclaration */: {

                    for (const parameter of node.parameters)

                        declaredSymbols.add(parameter.name.name);

                    const local = new Map([...node.parameters].map((param) => [param.name.name, symbolFor(param, source.fileName)]));

                    if (node.body) {

                        const functionReturnType = typeName(node.type);

                        walk(node.body, [local], functionReturnType, 0);

                        if (functionReturnType !== 'void' && !definitelyReturns(node.body)) {

                            report('galaxy-missing-return', node.name, source.fileName, `Function '${node.name.name}' can complete without returning '${functionReturnType}'.`, node.name.name);

                        }

                    }

                    return;

                }

                case 128 /* K.Block */: {

                    const inner = new Map();

                    for (const child of node.statements)

                        walk(child, [inner, ...scopes], returnType, loopDepth);

                    return;

                }

                case 141 /* K.VariableDeclaration */:

                    declaredSymbols.add(node.name.name);

                    for (let type = node.type; type?.kind === 117 /* K.ArrayType */; type = type.elementType)

                        if (type.size)

                            mismatch('int', expression(type.size, scopes), type.size, 'Array length');

                    if (node.initializer)

                        mismatch(typeName(node.type), expression(node.initializer, scopes), node.initializer, 'Initializer');

                    if (scopes.length)

                        scopes[0].set(node.name.name, symbolFor(node, source.fileName));

                    return;

                case 137 /* K.ReturnStatement */:

                    mismatch(returnType ?? 'unknown', node.expression ? expression(node.expression, scopes) : 'void', node, 'Return', node.expression);

                    return;

                case 138 /* K.ExpressionStatement */:

                    expression(node.expression, scopes);

                    return;

                case 129 /* K.IfStatement */:

                    condition(node.expression, scopes, 'Condition');

                    walk(node.thenStatement, scopes, returnType, loopDepth);

                    walk(node.elseStatement, scopes, returnType, loopDepth);

                    return;

                case 132 /* K.ForStatement */: {

                    const inner = [new Map(), ...scopes];

                    if (node.initializer?.kind === 141 /* K.VariableDeclaration */)

                        walk(node.initializer, inner, returnType);

                    else if (node.initializer)

                        expression(node.initializer, inner);

                    if (node.condition)

                        condition(node.condition, inner, 'Loop condition');

                    if (node.incrementor)

                        expression(node.incrementor, inner);

                    walk(node.statement, inner, returnType, loopDepth + 1);

                    return;

                }

                case 131 /* K.WhileStatement */:

                case 130 /* K.DoStatement */:

                    condition(node.expression, scopes, 'Loop condition');

                    walk(node.statement, scopes, returnType, loopDepth + 1);

                    return;

                case 133 /* K.BreakStatement */:

                case 134 /* K.ContinueStatement */:

                    if (loopDepth === 0)

                        report('galaxy-loop-control', node, source.fileName, `${node.kind === 133 /* K.BreakStatement */ ? 'break' : 'continue'} used outside a loop.`);

                    return;

                default: forEachChild(node, child => { walk(child, scopes, returnType, loopDepth); return undefined; });

            }

        };

        for (const node of source.ast.statements)

            walk(node, []);

    }

    return { diagnostics, declaredSymbols: [...declaredSymbols], verification: { ...(nativeGuiInterfaces ? {catalogDerivedInterfaces, interfaceBasis:'CATALOG_DERIVED', sourceDeclaration:false, engineAvailabilityProved:false} : {}), status: errors ? 'failed' : unresolved.size || omitted || uncheckedTypes ? 'incomplete' : 'passed', errors, unresolvedSymbols: [...unresolved].sort(), uncheckedTypes, diagnosticsOmitted: omitted, declarationFiles: declarations.map(file => file.fileName) } };

}

//# sourceMappingURL=validation.js.map