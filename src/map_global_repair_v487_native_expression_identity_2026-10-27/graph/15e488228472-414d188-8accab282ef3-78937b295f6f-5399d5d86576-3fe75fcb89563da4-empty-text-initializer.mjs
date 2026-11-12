import { recoverySessionFor } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/63fa7142cea6--b83fe67fcf37-4c31b5ee2404-77d04ff83b81-1aab20ef3b27-4f328c3710a2b421-recovery-session.mjs";
import { lookupElement } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import { mkParamRef, getTypeName, unwrapParens } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs";
import { SyntaxKind as K } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js";
export function emptyTextInitializerParam(node, variable, ctx, completeLocale) {
    if (completeLocale !== true || variable?.variableType?.type !== 'text')
        return undefined;
    node = unwrapParens(node);
    const callee = node?.kind === K.CallExpression && unwrapParens(node.expression);
    const arg = node?.arguments?.length === 1 && unwrapParens(node.arguments[0]);
    if (callee?.kind !== K.Identifier || callee.name !== 'StringToText' || arg?.kind !== K.StringLiteral || arg.value !== '')
        return undefined;
    const session = recoverySessionFor(ctx.elements), program = session?.program;
    if (!program || program.getBinding(callee).status !== 'BOUND' || program.conflictingDeclarationNames().includes(callee.name))
        return undefined;
    const decl = program.declarationAt(callee);
    if (decl?.kind !== K.FunctionDeclaration || decl.body || !decl.modifiers?.some(m => m.kind === K.NativeKeyword) || getTypeName(decl.type) !== 'text' || decl.parameters?.length !== 1 || getTypeName(decl.parameters[0].type) !== 'string')
        return undefined;
    let source = decl;
    while (source.parent)
        source = source.parent;
    const owner = program.verifiedInputIdentity(source.fileName);
    if (!owner || owner.owned !== false || !owner.contentSha256)
        return undefined;
    const candidates = [];
    for (const library of session.candidates.libraries.values())
        for (const fn of Object.values(library.elementsByType.FunctionDef ?? {}))
            if (fn.name === callee.name && fn.returnType?.type === 'text')
                candidates.push(fn);
    if (candidates.length !== 1)
        return undefined;
    const fn = candidates[0];
    if (!fn.library)
        return undefined;
    const formal = fn.parameters?.length === 1 ? lookupElement(session.candidates.libraries.values(), fn.parameters[0], fn.library) : undefined;
    if (!fn.flags?.includes('Native') || fn.flags.includes('CustomScript') || fn.disabled || fn.returnType?.type !== 'text' || formal?.type !== 'ParamDef' || formal.paramType?.type !== 'string')
        return undefined;
    const ref = mkParamRef({ valueType: { type: 'text' } }, ctx);
    session.record(node, ctx, 'LIBRARY_GUI_TEMPLATE', 'proved-empty-text-initializer', [`${fn.library}:FunctionDef:${fn.id}`], ref);
    return ref;
}
