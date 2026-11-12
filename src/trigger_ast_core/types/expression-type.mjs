// Shared lexical type model. It reads the current conversion context only;
// arithmetic selection and structured GUI binding must not infer types twice.
import {lookupElement} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/explicit-numeric-global-model.mjs';
import {unwrapParens,structureMemberKey,extractLocalVarName,getTypeName,triggerParamTypeFromGalaxyTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {localVarName,memberVarName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
export function contextLibraries(ctx) {
    const libraries = new Map(ctx.dependencyLibraries);
    if (ctx.nativeLibrary)
        libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
    libraries.set(ctx.libId, { id: ctx.libId, items: [], elements: ctx.elements, elementsByType: {} });
    return [...libraries.values()];
}
export function element(ref, ctx) {
    return lookupElement(contextLibraries(ctx), ref, ctx.libId);
}
export function structureMember(type, name, ctx) {
    const structure = type?.typeElement;
    if (!structure)
        return undefined;
    const local = (structure.library ?? ctx.libId) === ctx.libId && ctx.structureMemberByKey?.get(structureMemberKey(structure.id, name));
    if (local)
        return local;
    const declaration = element(structure, ctx);
    return declaration?.type === 'Structure' ? declaration.variables.find((ref) => {
        const variable = element(ref, ctx);
        return variable?.name === name || variable?.name === extractLocalVarName(name) ||
            variable?.type === 'Variable' && [localVarName(variable), memberVarName(variable, ctx.libId)].includes(name);
    }) : undefined;
}
export function expressionParameterType(node, ctx) {
    node = unwrapParens(node);
    if (!node)
        return undefined;
    if (node.kind === 3 /* SyntaxKind.StringLiteral */)
        return { type: 'string' };
    if (node.kind === 2 /* SyntaxKind.NumericLiteral */)
        return { type: !/^0x/iu.test(node.text ?? node.value ?? '') && /[.eE]/u.test(node.text ?? node.value ?? '') ? 'fixed' : 'int' };
    if ([67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */].includes(node.kind))
        return { type: 'bool' };
    if (node.kind === 113 /* SyntaxKind.Identifier */) {
        const accessor = ctx.structuredAutoAccessors?.get(node.name);
        if (accessor)
            return accessor.returnType;
        const local = ctx.localVarByGalaxyName.get(node.name);
        const global = ctx.globalVarByGalaxyName.get(node.name);
        const ref = local ? { type: 'Variable', library: ctx.libId, id: local } : ctx.paramRefByGalaxyName?.get(node.name) ?? (global ? { ...global, type: 'Variable' } : undefined);
        const value = element(ref, ctx);
        return value?.variableType ?? value?.paramType;
    }
    if (node.kind === 121 /* SyntaxKind.CallExpression */) {
        const definition = ctx.funcNameToFuncDef.get(node.expression?.name);
        return definition?.flags?.includes('Operator') && !definition.scriptCode ? undefined : definition?.returnType;
    }
    if (node.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const kind = node.operatorToken?.kind;
        if ([17 /* SyntaxKind.EqualsEqualsToken */, 18 /* SyntaxKind.ExclamationEqualsToken */, 14 /* SyntaxKind.GreaterThanToken */, 13 /* SyntaxKind.LessThanToken */,
            16 /* SyntaxKind.GreaterThanEqualsToken */, 15 /* SyntaxKind.LessThanEqualsToken */, 34 /* SyntaxKind.AmpersandAmpersandToken */, 35 /* SyntaxKind.BarBarToken */].includes(kind))
            return { type: 'bool' };
        const left = expressionParameterType(node.left, ctx), right = expressionParameterType(node.right, ctx);
        return left?.type === 'fixed' || right?.type === 'fixed' ? { type: 'fixed' } : left ?? right;
    }
    if (node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */)
        return node.operator?.kind === 32 /* SyntaxKind.ExclamationToken */ ? { type: 'bool' } : expressionParameterType(node.operand, ctx);
    if (node.kind === 123 /* SyntaxKind.PostfixUnaryExpression */)
        return expressionParameterType(node.operand, ctx);
    if (node.kind === 119 /* SyntaxKind.ElementAccessExpression */)
        return expressionParameterType(node.expression, ctx);
    if (node.kind === 120 /* SyntaxKind.PropertyAccessExpression */)
        return element(structureMember(expressionParameterType(node.expression, ctx), node.name.name, ctx), ctx)?.variableType;
    if (node.kind === 125 /* SyntaxKind.TypeAssertionExpression */)
        return triggerParamTypeFromGalaxyTypeName(getTypeName(node.type), ctx);
    return undefined;
}
