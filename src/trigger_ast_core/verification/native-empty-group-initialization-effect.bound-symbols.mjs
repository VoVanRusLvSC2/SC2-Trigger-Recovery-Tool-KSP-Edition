import {SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// These are engine API contracts, not purity inferred from a native signature.
// Empty-group allocation may change engine allocation state. The caller must
// retain allocation order and only cross unrelated, nonthrowing literal stores.
const contracts = new Map([
    ['UnitGroupEmpty', {returnKind:K.UnitgroupKeyword, returnType:'unitgroup',
        reference:'https://mapster.talv.space/galaxy/reference/unit-group-empty'}],
    ['PlayerGroupEmpty', {returnKind:K.PlayergroupKeyword, returnType:'playergroup',
        reference:'https://mapster.talv.space/galaxy/reference/player-group-empty'}],
]);

export function proveEmptyGroupAllocationEffect(call, asts) {
    if (call.kind !== K.CallExpression || call.expression?.kind !== K.Identifier || call.arguments.length) return;
    const name = call.expression.name, contract = contracts.get(name);
    if (!contract || contract.returnKind === undefined) return;
    let declarations = 0, unsafe = false;
    function visit(n, topLevel) {
        if (n.name?.name === name) {
            if (!topLevel || n.kind !== K.FunctionDeclaration || n.body ||
                n.modifiers?.length !== 1 || n.modifiers[0].kind !== K.NativeKeyword ||
                n.type?.kind !== contract.returnKind || n.parameters.length !== 0) {
                unsafe = true;
            } else declarations++;
        }
        // A direct assignment/update to a native's symbol invalidates resolution.
        if (n.kind === K.BinaryExpression && n.left?.kind === K.Identifier && n.left.name === name) {
            const op = n.operatorToken?.kind;
            if (isAssignmentOperator(op)) unsafe = true;
        }
        forEachChild(n, child => visit(child, false));
    }
    for (const ast of asts) for (const n of ast.statements) visit(n, true);
    if (unsafe || declarations === 0) return;
    return {kind:'EMPTY_GROUP_ALLOCATION_EFFECT_CONTRACT', functionName:name,
        nativeDeclarationsVerified:declarations, returnType:contract.returnType,
        engineContractReference:contract.reference, scriptGlobalReads:false,
        scriptCallbacks:false, allocationEffectRetained:true,
        requiresUnchangedAllocationOrderAndOnlyCrossedLiteralStores:true,
        arbitraryNativePurityInferred:false, sourceOrCandidateChanged:false};
}
