import { recoverySessionFor } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/4f328c3710a2b421-recovery-session.mjs";
import { getTypeName, unwrapParens } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs";
import { xmlTree } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js";
import { SyntaxKind as K } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js";
const objectsBySession = new WeakMap();
export function registerDoodadObjects(session, input, hashText) {
    if (!input)
        return;
    if (input.fileName !== 'Objects' || !hashText || hashText(input.text) !== input.contentSha256)
        throw new Error('Original Objects identity is not verified');
    const root = xmlTree(input.text), ids = new Set(), allIds = new Set();
    if (root.tag !== 'PlacedObjects')
        throw new Error('Original placed-object document is absent');
    for (const node of root.children)
        if (node.tag.startsWith('Object')) {
            const id = node.attributes.Id;
            if (!/^\d+$/u.test(id ?? '') || !Number.isSafeInteger(Number(id)) || allIds.has(id))
                throw new Error('Placed-object ID is absent or ambiguous');
            allIds.add(id);
            if (node.tag === 'ObjectDoodad')
                ids.add(id);
        }
    objectsBySession.set(session, ids);
}
export function verifiedDoodadScalarCall(expression, expected, ctx) {
    const call = unwrapParens(expression), isIdentifier = (n) => n.kind === K.Identifier;
    if (call?.kind !== K.CallExpression || !isIdentifier(call.expression) || call.expression.name !== 'DoodadFromId' || call.arguments.length !== 1 || !ctx)
        return false;
    if (expected && !/^(?:any|sameas)/u.test(expected) && expected !== 'doodad')
        return false;
    const argument = unwrapParens(call.arguments[0]);
    if (argument?.kind !== K.NumericLiteral || !/^\d+$/u.test(String(argument.text ?? argument.value)) || !Number.isSafeInteger(Number(argument.value)))
        return false;
    const session = recoverySessionFor(ctx.elements), program = session?.program;
    if (!session || !program || !objectsBySession.get(session)?.has(String(argument.text ?? argument.value)))
        return false;
    let source = call;
    while (source.parent)
        source = source.parent;
    const isSource = (n) => n.kind === K.SourceFile;
    const binding = program.getBinding(call.expression);
    if (!isSource(source) || program.verifiedInputIdentity(source.fileName)?.owned !== true || binding.status !== 'BOUND' || binding.declarations?.length !== 1)
        return false;
    const declaration = program.declarationAt(call.expression);
    if (declaration?.kind !== K.FunctionDeclaration || declaration.body || !declaration.modifiers?.some(m => m.kind === K.NativeKeyword) || getTypeName(declaration.type) !== 'doodad' || declaration.parameters.length !== 1 || getTypeName(declaration.parameters[0].type) !== 'int')
        return false;
    let owner = declaration;
    while (owner.parent)
        owner = owner.parent;
    return isSource(owner) && program.verifiedInputIdentity(owner.fileName)?.owned === false;
}
