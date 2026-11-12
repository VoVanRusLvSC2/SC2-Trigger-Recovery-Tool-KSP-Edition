import {lowerRetainedNominalWrite} from "../source-nominal-return-roles/retained-nominal-gui-interfaces.replay.mjs";
import {SyntaxKind as PrivateConcatSyntaxKind} from "../exact-function-signatures/index-alternate-3.js";
import {privateFrameConcatAssignmentRecipe} from "../bound-static-primary-storage/bound-source-access.concat.mjs";
import {mapParameterTypeToGalaxy as sourceAccessCarrier} from "../native-expression-identity/core-alternate.mjs";
import {buildPreservedSourceAggregateWrite} from "./preserved-source-aggregate-access.boolean-conditions.mjs";
import {triggerParamTypeFromGalaxyTypeName as sourceAccessGuiType} from "../exact-native-export/g2t-core-alternate-3.mjs";
import {stableIntegerCapture} from "../../model/constant-capture-stability.local-literals.mjs";
import {deferLocalRetirement} from "../../model/deferred-local-retirement.linear.mjs";
import {matchesConstLoopCapture} from "../../model/compiler-constant-capture.lifetime.mjs";
/**
 * g2t-actions — action and control-flow builders for Galaxy→trigger.
 *
 * Converts Galaxy AST statement patterns back into FunctionCallJson action
 * elements.  Each "tryBuild*" function recognises a specific multi-statement
 * Galaxy pattern emitted by ttg-actions and reconstructs the original trigger
 * action — returning the consumed statement count so the caller can skip them.
 *
 * Handled patterns (all reversals of ttg-actions output):
 *   - IfThenElse, WhileDo, RepeatForever, Repeat
 *   - WaitForCondition, WaitForConditionWithMaximumDuration
 *   - PickEachInteger, ForEachInteger
 *   - PickEachPlayerInGroup, PickEachUnitInGroup
 *   - Switch (assignment + if/else chain)
 *   - ActionQueueAdd (TriggerQueueEnter/Exit bracket)
 *   - SetVariable, compound assignments (+=, -= …) → IncrementInteger
 *   - return true → SkipRemaining, break → StopLooping, continue → Continue
 *
 * convertStatementListToActionRefs is the main loop: it runs all tryBuild*
 * recognisers in priority order and falls back to stmtToActionFCRef for
 * single-statement actions.
 *
 * Depends on: g2t-core, g2t-call.
 * Consumed by: g2t-trigger-body, galaxy-to-trigger.
 */
import { Printer, getKindName } from "../exact-function-signatures/index.js";
import { conversionError, globalVariableName, lookupElement, lowerInitial, sanitizeIdentifier } from "../../sdk/core/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import { localVarName, triggerHandleName, triggerInitFuncName } from "../exact-native-export/core-alternate.mjs";
import { isGeneratedBodyBanner } from "../../sdk/core/modules/triggers/services/galaxy-conversion/internal/editor-layout.js";
import { mkParamRef, mkFCRef, claimAutoCallId, claimAutoCallIdFromNames, releaseAutoCallId, fdRef, buildFuncDefRoleMap, unwrapParens, getIdentifierName, lvalueKey, extractAutoVarName, isTrueExpr, readSignedIntLiteral, getAssignSides, isBreakGuardOnNegative, isBreakGuardOnNull, isGeneratedAutoLoopVarName, isCallStmtNamed, parseWaitCall, extractNegatedConditionExpr, getBlockStatements, forStmtUsesCounterVar, upcomingForStmtUsesName, functionSymbolIndex, generateId, idFromKey, } from "../../sdk/core/modules/triggers/services/galaxy-conversion/internal/g2t-core.js";
import { exprToParamRef, callExprToFCRef, collectConditionRefs, callExprHasResolvedFunctionDef, resolvedFunctionDefForCall, exprContainsUnresolvedCall, } from "./g2t-call.js";
import { resolveParamDefByRef } from "../exact-function-signatures/g2t-params.js";
import { matchTemplatePrefix, parseTemplateFragment, shapeText, syntaxChildren, templateAutoAccessors, templateBindingMatches, templateMacros, templateMakesProgress, } from "../exact-native-export/script-template.mjs";
// ---------------------------------------------------------------------------
// Statement → action FunctionCall ref
// ---------------------------------------------------------------------------
export function stmtToActionFCRef(stmt, subFuncTypeRef, ctx) {
    const retainedWrite=lowerRetainedNominalWrite(stmt,ctx,subFuncTypeRef,{idFromKey,mkFCRef,mkParamRef,exprToParamRef});
    if(retainedWrite)return retainedWrite;
    if (!stmt)
        return undefined;
    switch (stmt.kind) {
        case 129 /* SyntaxKind.IfStatement */: {
            if (isTestCondsGuard(stmt.expression, stmt.thenStatement))
                return undefined;
            if (isRunActionsGuard(stmt.expression))
                return undefined;
            if (exprContainsUnresolvedCall(stmt.expression, ctx)) {
                return buildCustomScriptActionFCRef(stmt, subFuncTypeRef, ctx);
            }
            return buildIfThenElseFCRef(stmt, subFuncTypeRef, ctx);
        }
        case 131 /* SyntaxKind.WhileStatement */:
            if (exprContainsUnresolvedCall(stmt.expression, ctx)) {
                return buildCustomScriptActionFCRef(stmt, subFuncTypeRef, ctx);
            }
            return buildWhileDoFCRef(stmt, subFuncTypeRef, ctx);
        case 130 /* SyntaxKind.DoStatement */:
            if (exprContainsUnresolvedCall(stmt.expression, ctx)) {
                return buildCustomScriptActionFCRef(stmt, subFuncTypeRef, ctx);
            }
            return buildWhileDoFCRef(stmt, subFuncTypeRef, ctx);
        case 132 /* SyntaxKind.ForStatement */:
            if (exprContainsUnresolvedCall(stmt.condition, ctx)) {
                return buildCustomScriptActionFCRef(stmt, subFuncTypeRef, ctx);
            }
            return buildPickEachIntegerFromForStmt(stmt, subFuncTypeRef, ctx);
        case 138 /* SyntaxKind.ExpressionStatement */:
            return exprStmtToActionFCRef(stmt.expression, subFuncTypeRef, ctx);
        case 137 /* SyntaxKind.ReturnStatement */:
            // Inside a user function every value-return is the NativeLib Return
            // action.  `return true` only means SkipRemaining in a trigger action
            // body, where it is the generated callback's success value.
            if (ctx.isUserFunction && stmt.expression) {
                return buildReturnValueFCRef(stmt.expression, subFuncTypeRef, ctx);
            }
            // A bare return in an authored void function is the editor's
            // Skip Remaining Actions operation.  It is not generated callback
            // boilerplate: dropping it changes control flow and used to leave an
            // empty Custom Script row in the editor.
            if (ctx.isUserFunction && !stmt.expression && ctx.returnType === 'void') {
                return buildZeroArgFCRef('SkipRemaining', subFuncTypeRef, ctx);
            }
            // `return true;` inside a trigger sub-block = SkipRemaining trigger action
            if (stmt.expression?.kind === 67 /* SyntaxKind.TrueKeyword */) {
                return buildZeroArgFCRef('SkipRemaining', subFuncTypeRef, ctx);
            }
            return undefined; // boilerplate (bare return, return false, etc.)
        case 133 /* SyntaxKind.BreakStatement */:
            // `break;` inside a sub-block = StopLooping trigger action
            return buildZeroArgFCRef('StopLooping', subFuncTypeRef, ctx);
        case 134 /* SyntaxKind.ContinueStatement */:
            // `continue;` inside a sub-block = Continue trigger action
            return buildZeroArgFCRef('Continue', subFuncTypeRef, ctx);
        default:
            return undefined;
    }
}
// ---------------------------------------------------------------------------
// Zero-argument action FunctionCall (SkipRemaining, StopLooping, Continue)
// ---------------------------------------------------------------------------
function findFuncDefByName(ctx, names) {
    for (const name of names) {
        const direct = ctx.funcNameToFuncDef.get(name);
        if (direct)
            return direct;
    }
    const wanted = new Set(names.map(n => n.toLowerCase()));
    const nativeDefs = ctx.nativeLibrary?.elementsByType?.FunctionDef;
    if (nativeDefs) {
        for (const funcDef of Object.values(nativeDefs)) {
            if (funcDef.name && wanted.has(funcDef.name.toLowerCase()))
                return funcDef;
        }
    }
    return undefined;
}
function findCustomScriptActionFuncDef(ctx) {
    const byName = findFuncDefByName(ctx, ['customscriptaction', 'CustomScriptAction']);
    if (byName)
        return byName;
    const nativeDefs = ctx.nativeLibrary?.elementsByType?.FunctionDef;
    if (!nativeDefs)
        return undefined;
    return Object.values(nativeDefs).find(funcDef => funcDef.isFuncAction &&
        funcDef.flags?.some(flag => flag.toLowerCase() === 'customscript'));
}
export function buildZeroArgFCRef(funcDefName, subFuncTypeRef, ctx) {
    const funcDef = findFuncDefByName(ctx, [funcDefName]);
    if (!funcDef)
        return undefined;
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [],
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function buildReturnValueFCRef(valueExpr, subFuncTypeRef, ctx) {
    const funcDef = findFuncDefByName(ctx, ['Return']);
    if (!funcDef)
        return undefined;
    const paramDefs = funcDef.parameters;
    const valParamRef = exprToParamRef(valueExpr, ctx, paramDefs?.[0], ctx.returnType);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [valParamRef],
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function exprStmtToActionFCRef(expr, subFuncTypeRef, ctx) {
 const sourceWrite=buildPreservedSourceAggregateWrite(expr,subFuncTypeRef,ctx,{generateId,fdRef,mkFCRef,param:exprToParamRef,triggerType:sourceAccessGuiType,mapType:sourceAccessCarrier,valueType:(value,scope)=>value?.kind===121?resolvedFunctionDefForCall(value,scope)?.returnType:undefined});
 if(sourceWrite)return sourceWrite;
    if (!expr)
        return undefined;
    const privateAppend = privateFrameConcatAssignmentRecipe({kind: PrivateConcatSyntaxKind.ExpressionStatement,
        expression: expr, pos: expr?.pos, end: expr?.end});
    if (privateAppend) return buildSetVariableFCRef(privateAppend.node.expression, subFuncTypeRef, ctx);
    if (exprContainsUnresolvedCall(expr, ctx)) {
        return buildCustomScriptActionFCRef({ kind: 138 /* SyntaxKind.ExpressionStatement */, expression: expr }, subFuncTypeRef, ctx);
    }
    if (expr.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const opKind = expr.operatorToken?.kind;
        if (opKind === 39 /* SyntaxKind.EqualsToken */) {
            return buildSetVariableFCRef(expr, subFuncTypeRef, ctx);
        }
        if (opKind === 40 /* SyntaxKind.PlusEqualsToken */ ||
            opKind === 41 /* SyntaxKind.MinusEqualsToken */ ||
            opKind === 42 /* SyntaxKind.AsteriskEqualsToken */ ||
            opKind === 43 /* SyntaxKind.SlashEqualsToken */ ||
            opKind === 44 /* SyntaxKind.PercentEqualsToken */) {
            return buildCompoundAssignFCRef(expr, subFuncTypeRef, ctx);
        }
    }
    if (expr.kind === 121 /* SyntaxKind.CallExpression */) {
        if (!callExprHasResolvedFunctionDef(expr, ctx)) {
            return buildCustomScriptActionFCRef({ kind: 138 /* SyntaxKind.ExpressionStatement */, expression: expr }, subFuncTypeRef, ctx);
        }
        const definition = resolvedFunctionDefForCall(expr, ctx);
        // An Event FunctionDef omits the trigger handle because its owning Trigger
        // supplies that argument.  A direct Event native inside an arbitrary
        // function body may target another trigger dynamically, so serializing it
        // as an action shifts every ParamDef and leaves the last argument orphaned
        // when the editor opens the document.  TriggerData has no structural slot
        // for that target in this context; preserve the statement as Custom Script.
        if (definition?.flags?.includes('Event') && !definition.flags.includes('Action')) {
            return buildCustomScriptActionFCRef({ kind: 138 /* SyntaxKind.ExpressionStatement */, expression: expr }, subFuncTypeRef, ctx);
        }
        return callExprToFCRef(expr, subFuncTypeRef, ctx);
    }
    return undefined;
}
// ---------------------------------------------------------------------------
// SetVariable FunctionCall
// ---------------------------------------------------------------------------
export function isSimpleVarExpr(expr, ctx) {
    if (!expr)
        return false;
    if (expr.kind === 113 /* SyntaxKind.Identifier */) {
        const name = expr.name;
        return ctx.localVarByGalaxyName.has(name) || ctx.globalVarByGalaxyName.has(name) || !!ctx.paramRefByGalaxyName?.has(name);
    }
    return false;
}
export function isAssignableVarTarget(expr, ctx) {
    if (!expr)
        return false;
    let e = expr;
    while (e?.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
        e = e.expression;
    while (e?.kind === 119 /* SyntaxKind.ElementAccessExpression */ || e?.kind === 120 /* SyntaxKind.PropertyAccessExpression */) {
        e = e.expression;
    }
    if (e?.kind !== 113 /* SyntaxKind.Identifier */)
        return false;
    const name = e.name;
    return ctx.localVarByGalaxyName.has(name) || ctx.globalVarByGalaxyName.has(name) || !!ctx.paramRefByGalaxyName?.has(name);
}
export function buildSetVariableFCRef(binExpr, subFuncTypeRef, ctx) {
 const sourceWrite=buildPreservedSourceAggregateWrite(binExpr,subFuncTypeRef,ctx,{generateId,fdRef,mkFCRef,param:exprToParamRef,triggerType:sourceAccessGuiType,mapType:sourceAccessCarrier,valueType:(value,scope)=>value?.kind===121?resolvedFunctionDefForCall(value,scope)?.returnType:undefined});
 if(sourceWrite)return sourceWrite;
    const funcDef = ctx.funcNameToFuncDef.get('SetVariable');
    if (!funcDef)
        return undefined; // NativeLib not loaded
    const paramDefs = funcDef.parameters;
    const rightIsSimpleVar = isSimpleVarExpr(binExpr.right, ctx);
    const leftIsSimpleVar = isSimpleVarExpr(binExpr.left, ctx);
    const leftIsAssignableTarget = isAssignableVarTarget(binExpr.left, ctx);
    const isReversed = rightIsSimpleVar && !leftIsSimpleVar && !leftIsAssignableTarget;
    // The SetVariable target MUST resolve to a known variable. Emitting a raw
    // identifier into the variable slot produces a Parameter Value the editor
    // reports as 'Unknown' and deletes. Bail → caller preserves custom script.
    if (!isReversed && !leftIsAssignableTarget)
        return undefined;
    const varExpr = isReversed ? binExpr.right : binExpr.left;
    const valExpr = isReversed ? binExpr.left : binExpr.right;
    const varRef = exprToParamRef(varExpr, ctx, paramDefs?.[0]);
    const targetParam = ctx.elements[varRef.id];
    let targetPath = targetParam;
    while (targetPath?.structMember?.id)
        targetPath = ctx.elements[targetPath.structMember.id];
    const targetRef = targetPath?.variable ?? targetPath?.paramRef;
    const libraries = new Map(ctx.dependencyLibraries);
    if (ctx.nativeLibrary)
        libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
    libraries.set(ctx.libId, { id: ctx.libId, items: [], elements: ctx.elements, elementsByType: {} });
    const target = lookupElement(libraries.values(), targetRef, ctx.libId);
    // Galaxy represents several editor handle domains as `int`.  When the
    // assigned expression resolves to a loaded function with a more specific
    // TriggerData return type, preserve that domain on the variable itself.
    // This is required for values such as DialogControlLastCreated(): leaving
    // the target as int makes the editor reject its own Set Variable action.
    const valueExpression = unwrapParens(valExpr);
    const returnedType = valueExpression?.kind === 121 /* SyntaxKind.CallExpression */
        ? resolvedFunctionDefForCall(valueExpression, ctx)?.returnType
        : undefined;
    if (target?.type === 'Variable' && target.variableType?.type === 'int' && returnedType?.type &&
        !['int', 'fixed', 'bool', 'string', 'void'].includes(returnedType.type)) {
        target.variableType = { ...returnedType };
    }
    const targetType = target?.type === 'Variable' ? target.variableType?.type
        : target?.type === 'ParamDef' ? target.paramType?.type
            : undefined;
    const valRef = exprToParamRef(valExpr, ctx, paramDefs?.[1], targetType);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [varRef, valRef],
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// Compound assignment (+=, -=) → IncrementInteger
// ---------------------------------------------------------------------------
export function buildCompoundAssignFCRef(binExpr, subFuncTypeRef, ctx) {
    const opKind = binExpr.operatorToken?.kind;
    const opStrMap = {
        [40 /* SyntaxKind.PlusEqualsToken */]: '+',
        [41 /* SyntaxKind.MinusEqualsToken */]: '-',
        [42 /* SyntaxKind.AsteriskEqualsToken */]: '*',
        [43 /* SyntaxKind.SlashEqualsToken */]: '/',
        [44 /* SyntaxKind.PercentEqualsToken */]: '%',
    };
    const opStr = opStrMap[opKind];
    if (!opStr)
        return undefined;
    const funcDef = ctx.funcNameToFuncDef.get('IncrementInteger');
    if (!funcDef)
        return undefined; // NativeLib not loaded
    // Target must resolve to a known variable — otherwise preserve custom script.
    if (!isAssignableVarTarget(binExpr.left, ctx))
        return undefined;
    const paramDefs = funcDef.parameters;
    const varRef = exprToParamRef(binExpr.left, ctx, paramDefs?.[0]);
    const presetRef = ctx.galaxyConstToPreset.get(opStr);
    const opParamData = presetRef ? { preset: presetRef } : { value: opStr };
    if (paramDefs?.[1])
        opParamData.parameterDef = paramDefs[1];
    const opRef = mkParamRef(opParamData, ctx);
    const valRef = exprToParamRef(binExpr.right, ctx, paramDefs?.[2]);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [varRef, opRef, valRef],
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// IfThenElse FunctionCall
// ---------------------------------------------------------------------------
export function buildIfThenElseFCRef(ifStmt, subFuncTypeRef, ctx) {
    // `if … else if …` without a final else is what the editor writes for If Then
    // Else (Multiple): every IfThen child after the first prints `else ` before its
    // `if` (#IFSUBFUNC(notfirst,else )). If Then Else always braces its else branch,
    // so folding the chain into nested If Then Else regenerated `else { if … }`.
    const chain = [];
    for (let link = ifStmt; link?.kind === 129 /* SyntaxKind.IfStatement */; link = link.elseStatement)
        chain.push(link);
    const multiple = ctx.funcNameToFuncDef.get('IfThenMultiple');
    const branch = ctx.funcNameToFuncDef.get('IfThen');
    if (chain.length > 1 && !chain[chain.length - 1].elseStatement && multiple && branch) {
        const branchRole = buildFuncDefRoleMap(multiple, ctx.nativeLibrary, ctx.roleToSubFuncType).get('IfThen');
        const branchRoles = buildFuncDefRoleMap(branch, ctx.nativeLibrary, ctx.roleToSubFuncType);
        const branches = chain.map(link => mkFCRef({
            functionDef: fdRef(branch),
            subFunctions: [
                ...collectConditionRefs(link.expression, branchRoles.get('if'), ctx),
                ...convertStatementListToActionRefs(getBlockStatements(link.thenStatement), branchRoles.get('then'), ctx),
            ],
            ...(branchRole ? { subFunctionType: branchRole } : {}),
        }, ctx));
        return mkFCRef({ functionDef: fdRef(multiple), subFunctions: branches, ...(subFuncTypeRef ? { subFunctionType: subFuncTypeRef } : {}) }, ctx);
    }
    const funcDef = ctx.funcNameToFuncDef.get('IfThenElse');
    if (!funcDef)
        return undefined; // NativeLib not loaded
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const ifRole = roleMap.get('If') ?? roleMap.get('Conditions');
    const thenRole = roleMap.get('Then') ?? roleMap.get('Actions');
    const elseRole = roleMap.get('Else');
    const subFunctions = [];
    const ifCondRefs = collectConditionRefs(ifStmt.expression, ifRole, ctx);
    for (const ref of ifCondRefs)
        subFunctions.push(ref);
    const thenStmts = getBlockStatements(ifStmt.thenStatement);
    for (const ref of convertStatementListToActionRefs(thenStmts, thenRole, ctx))
        subFunctions.push(ref);
    if (ifStmt.elseStatement) {
        const elseStmts = getBlockStatements(ifStmt.elseStatement);
        for (const ref of convertStatementListToActionRefs(elseStmts, elseRole, ctx))
            subFunctions.push(ref);
    }
    const data = {
        functionDef: fdRef(funcDef),
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// WhileDo FunctionCall
// ---------------------------------------------------------------------------
export function buildWhileDoFCRef(whileStmt, subFuncTypeRef, ctx) {
    const funcDef = whileStmt.kind === 130 /* SyntaxKind.DoStatement */
        ? ctx.funcNameToFuncDef.get('While2')
        : ctx.funcNameToFuncDef.get('WhileDo') ?? ctx.funcNameToFuncDef.get('While');
    if (!funcDef)
        return undefined; // NativeLib not loaded
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const condRole = localRoleMap.get('Conditions') ?? localRoleMap.get('If');
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const subFunctions = [];
    const condRefs = collectConditionRefs(whileStmt.expression, condRole, ctx);
    for (const ref of condRefs)
        subFunctions.push(ref);
    const bodyStmts = getBlockStatements(whileStmt.statement);
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// PickEachInteger FunctionCall
// ---------------------------------------------------------------------------
export function buildPickEachIntegerFCRef(forStmt, startExpr, endExpr, subFuncTypeRef, ctx, autoVarName, autoEndName) {
    const funcDef = ctx.funcNameToFuncDef.get('PickEachInteger');
    if (!funcDef)
        return undefined; // NativeLib not loaded
    const claimedId = claimAutoCallIdFromNames([autoVarName, autoEndName]);
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const paramDefs = funcDef.parameters;
    const startRef = exprToParamRef(startExpr ?? { kind: 2 /* SyntaxKind.NumericLiteral */, value: '1' }, ctx, paramDefs?.[0]);
    const endRef = exprToParamRef(endExpr ?? { kind: 2 /* SyntaxKind.NumericLiteral */, value: '0' }, ctx, paramDefs?.[1]);
    const bodyCtx = autoVarName ? { ...ctx, pickEachIntVarName: autoVarName } : ctx;
    const subFunctions = [];
    const bodyStmts = getBlockStatements(forStmt.statement);
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, bodyCtx))
        subFunctions.push(ref);
    if (autoVarName && generatedScriptMentions(subFunctions, iteratorSpellings([autoVarName], ctx), ctx)) {
        releaseAutoCallId(claimedId);
        return undefined;
    }
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [startRef, endRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx, claimedId);
}
export function buildPickEachIntegerFromForStmt(forStmt, subFuncTypeRef, ctx, _siblingStmts, _forIndex) {
    const cond = forStmt.condition;
    let autoVarName;
    let autoEndName;
    if (cond?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const left = cond.left;
        const right = cond.right;
        if (left?.kind === 113 /* SyntaxKind.Identifier */)
            autoVarName = left.name;
        if (right?.kind === 113 /* SyntaxKind.Identifier */)
            autoEndName = right.name;
    }
    // PickEachInteger represents an inclusive, unit-step loop. Do not silently
    // change an arbitrary C-style for loop into it.
    if (cond?.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    const increment = forStmt.incrementor;
    if (increment?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
        increment.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */ ||
        increment.left?.kind !== 113 /* SyntaxKind.Identifier */ || increment.left.name !== autoVarName ||
        increment.right?.kind !== 2 /* SyntaxKind.NumericLiteral */ || Number(increment.right.value ?? increment.right.text) !== 1)
        return undefined;
    let startExpr = autoVarName ? ctx.pendingAutoInits.get(autoVarName) : undefined;
    let endExpr = autoEndName ? ctx.pendingAutoEnds.get(autoEndName) : undefined;
    if (!startExpr) {
        const init = forStmt.initializer;
        if (init?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
            init.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ &&
            init.left?.kind === 113 /* SyntaxKind.Identifier */) {
            if (!autoVarName || init.left.name === autoVarName) {
                startExpr = init.right;
            }
        }
    }
    if (!endExpr) {
        const c = forStmt.condition;
        if (c?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
            c.left?.kind === 113 /* SyntaxKind.Identifier */ &&
            (!autoVarName || c.left.name === autoVarName)) {
            const opKind = c.operatorToken?.kind;
            if (opKind === 15 /* SyntaxKind.LessThanEqualsToken */ || opKind === 13 /* SyntaxKind.LessThanToken */) {
                endExpr = c.right;
            }
        }
    }
    if (!startExpr || !endExpr)
        return undefined;
    return buildPickEachIntegerFCRef(forStmt, startExpr, endExpr, subFuncTypeRef, ctx, autoVarName, autoEndName);
}
export function isFixedLiteralExpr(expr) {
    const e = unwrapParens(expr);
    if (!e)
        return false;
    if (e.kind === 2 /* SyntaxKind.NumericLiteral */) {
        const raw = String(e.text ?? e.value ?? '');
        return raw.includes('.');
    }
    if (e.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ && e.operator?.kind === 21 /* SyntaxKind.MinusToken */) {
        const op = e.operand;
        if (op?.kind === 2 /* SyntaxKind.NumericLiteral */) {
            const raw = String(op.text ?? op.value ?? '');
            return raw.includes('.');
        }
    }
    return false;
}
export function tryMatchForEachIntegerCondition(condExpr, iteratorKey) {
    const root = unwrapParens(condExpr);
    if (!root || root.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (root.operatorToken?.kind !== 35 /* SyntaxKind.BarBarToken */)
        return undefined;
    const leftAnd = unwrapParens(root.left);
    const rightAnd = unwrapParens(root.right);
    if (!leftAnd || leftAnd.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (!rightAnd || rightAnd.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (leftAnd.operatorToken?.kind !== 34 /* SyntaxKind.AmpersandAmpersandToken */)
        return undefined;
    if (rightAnd.operatorToken?.kind !== 34 /* SyntaxKind.AmpersandAmpersandToken */)
        return undefined;
    const incGEZero = unwrapParens(leftAnd.left);
    const iterLEEnd = unwrapParens(leftAnd.right);
    const incLTZero = unwrapParens(rightAnd.left);
    const iterGEEnd = unwrapParens(rightAnd.right);
    if (!incGEZero || !iterLEEnd || !incLTZero || !iterGEEnd)
        return undefined;
    if (incGEZero.kind !== 124 /* SyntaxKind.BinaryExpression */ || incLTZero.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (iterLEEnd.kind !== 124 /* SyntaxKind.BinaryExpression */ || iterGEEnd.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incGEZero.operatorToken?.kind !== 16 /* SyntaxKind.GreaterThanEqualsToken */)
        return undefined;
    const incLtKind = incLTZero.operatorToken?.kind;
    if (incLtKind !== 13 /* SyntaxKind.LessThanToken */ && incLtKind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (iterLEEnd.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (iterGEEnd.operatorToken?.kind !== 16 /* SyntaxKind.GreaterThanEqualsToken */)
        return undefined;
    const incNameA = getIdentifierName(incGEZero.left);
    const incNameB = getIdentifierName(incLTZero.left);
    if (!incNameA || !incNameB || incNameA !== incNameB)
        return undefined;
    if (readSignedIntLiteral(incGEZero.right) !== 0)
        return undefined;
    if (readSignedIntLiteral(incLTZero.right) !== 0)
        return undefined;
    if (lvalueKey(iterLEEnd.left) !== iteratorKey)
        return undefined;
    if (lvalueKey(iterGEEnd.left) !== iteratorKey)
        return undefined;
    const endNameA = getIdentifierName(iterLEEnd.right);
    const endNameB = getIdentifierName(iterGEEnd.right);
    if (!endNameA || !endNameB || endNameA !== endNameB)
        return undefined;
    return { incName: incNameA, endName: endNameA, negativeIncludesZero: incLtKind === 15 /* SyntaxKind.LessThanEqualsToken */ };
}
export function buildForEachIntegerFCRef(forStmt, iteratorExpr, startExpr, endExpr, incExpr, subFuncTypeRef, ctx, declaredIteratorType, claimedId) {
    // The iterator declaration is stronger type evidence than the spelling of a
    // range operand. An int loop can have a symbolic end and a parser-normalized
    // literal; choosing the fixed template then emits an invalid `int += fixed`.
    // Callers that can resolve a record/array path pass its declared type.
    const iteratorName = getIdentifierName(iteratorExpr);
    const iterator = iteratorName ? ctx.localVarByGalaxyName.get(iteratorName) : undefined;
    const iteratorType = declaredIteratorType?.toLowerCase() ?? (iterator
        ? ctx.elements[iterator]?.variableType?.type?.toLowerCase()
        : undefined);
    const fixedWanted = iteratorType === 'fixed' || (iteratorType !== 'int' &&
        (isFixedLiteralExpr(startExpr) || isFixedLiteralExpr(endExpr) || isFixedLiteralExpr(incExpr)));
    const nameCandidates = fixedWanted
        ? ['ForEachInteger2', 'ForEachInteger2Deprecated', 'ForEachInteger', 'ForEachIntegerDeprecated']
        : ['ForEachInteger', 'ForEachIntegerDeprecated', 'ForEachInteger2', 'ForEachInteger2Deprecated'];
    let funcDef;
    for (const n of nameCandidates) {
        const candidate = ctx.funcNameToFuncDef.get(n);
        if (!candidate)
            continue;
        // NativeLib exposes two superficially identical loop templates.  The
        // first parameter is `anyvariable`, but its VariableType is part of the
        // contract: choosing the fixed form for an int iterator emits
        // `int += fixed`.  Check that declaration as well as the AST evidence.
        const firstParam = candidate.parameters?.[0];
        const formal = firstParam && ctx.nativeLibrary?.elementsByType?.ParamDef?.[firstParam.id];
        const requiredType = formal?.paramType?.type === 'anyvariable'
            ? String(formal.paramType.variableType ?? '').toLowerCase()
            : undefined;
        if (iteratorType && requiredType && iteratorType !== requiredType)
            continue;
        funcDef = candidate;
        break;
    }
    if (!funcDef)
        return undefined;
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = roleMap.get('Actions') ?? roleMap.get('Then');
    const paramDefs = funcDef.parameters;
    const varRef = exprToParamRef(unwrapParens(iteratorExpr), ctx, paramDefs?.[0]);
    const startRef = exprToParamRef(startExpr, ctx, paramDefs?.[1]);
    const endRef = exprToParamRef(endExpr, ctx, paramDefs?.[2]);
    const incRef = exprToParamRef(incExpr, ctx, paramDefs?.[3]);
    const subFunctions = [];
    const bodyStmts = getBlockStatements(forStmt.statement);
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [varRef, startRef, endRef, incRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx, claimedId);
}
/** Resolve an editor-generated ae/ai helper back to the expression captured by
 * the original ForEachInteger template.  A helper is removable only when the
 * function-wide symbol index proves that its declaration/assignment and the
 * loop itself account for every occurrence. */
function capturedLoopValue(name, pending, loopUses, ctx) {
    const pendingExpression = pending.get(name);
    const fallback = pendingExpression ?? { kind: 113 /* SyntaxKind.Identifier */, name };
    const auto = extractAutoVarName(name);
    const id = ctx.localVarByGalaxyName.get(name);
    const functionStatements = ctx.structuredFunctionStatements;
    if (!auto || !id || !functionStatements || !ctx.structuredLocals)
        return { expression: fallback };
    const symbols = functionSymbolIndex(functionStatements);
    const declaration = symbols.declarations.get(name);
    if (!declaration)
        return { expression: fallback };
    const assignments = symbols.assignments.get(name) ?? 0;
    const uses = symbols.uses.get(name) ?? 0;
    const isConst = declaration.modifiers?.some((modifier) => modifier.kind === 53 /* SyntaxKind.ConstKeyword */) === true;
    const initializer = unwrapParens(declaration.initializer);
    const capturedByAssignment = pendingExpression !== undefined && !initializer && assignments === 1 && uses === loopUses + 1;
    const capturedByConst = matchesConstLoopCapture({initializer,pendingExpression,isConst,assignments,uses,loopUses,unwrap:unwrapParens,initializerStable:readSignedIntLiteral(initializer)!==undefined || stableIntegerCapture(initializer,{kinds:LocalScopeSyntaxKind,unwrap:unwrapParens,constants:ctx.constants,locals:ctx.localVarByGalaxyName,declarations:symbols.declarations})});
    // Keep the original snapshot, including its evaluation position and side effects.
    // The normal GUI loop may read this local; it must not reevaluate its initializer.
    if (initializer && isConst && !capturedByConst)
        return {expression:{kind:113,name}};
    if (!capturedByAssignment && !capturedByConst)
        return { expression: fallback };
    return {
        expression: capturedByAssignment ? pendingExpression : initializer,
        removable: { name, id },
    };
}
function generatedGraphRefersToLocal(roots, local, ctx) {
    return generatedGraphSome(roots, ctx, record => record['type'] === 'Variable' && record['id'] === local.id &&
        (record['library'] === undefined || record['library'] === ctx.libId));
}
/** A Custom Script keeps its source spelling, so it cannot follow an automatic
 *  variable the matched action regenerates under a new name. */
function generatedScriptMentions(roots, names, ctx) {
    if (!names.length)
        return false;
    const pattern = new RegExp(`(?<![\\w])(?:${names.join('|')})(?![\\w])`, 'u');
    return generatedGraphSome(roots, ctx, record => typeof record['scriptCode'] === 'string' && pattern.test(record['scriptCode']));
}
/** How a Custom Script may spell a loop iterator: its source name, or the local
 *  name the script rewriter gives it while the Variable element still exists. */
function iteratorSpellings(names, ctx) {
    return names.filter((name) => !!name).flatMap(name => {
        const local = ctx.elements[ctx.localVarByGalaxyName.get(name) ?? ''];
        return local?.type === 'Variable' ? [name, localVarName(local)] : [name];
    });
}
function generatedGraphSome(roots, ctx, test) {
    const pending = [...roots];
    const seenObjects = new Set();
    const seenElements = new Set();
    while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== 'object' || seenObjects.has(value))
            continue;
        seenObjects.add(value);
        if (Array.isArray(value)) {
            pending.push(...value);
            continue;
        }
        const record = value;
        const library = record['library'];
        if (test(record))
            return true;
        const id = typeof record['id'] === 'string' ? record['id'] : undefined;
        if (id && (library === undefined || library === ctx.libId) && !seenElements.has(id)) {
            const element = ctx.elements[id];
            if (element && element !== value) {
                seenElements.add(id);
                pending.push(element);
            }
        }
        pending.push(...Object.values(record));
    }
    return false;
}
function removeCapturedLoopLocal(local, roots, ctx) {
    // The lexical use proof is necessary but not sufficient: parameter creation
    // may have materialized a reference while rebuilding a nested template.  Do
    // not erase the target unless the graph created for this call agrees.  The
    // walk follows only reachable element refs, avoiding a quadratic scan of the
    // complete output library for every generated helper.
    if (generatedGraphRefersToLocal(roots, local, ctx))
        return;
    deferLocalRetirement(local.id,ctx);
    ctx.localVarByGalaxyName.delete(local.name);
    ctx.pendingAutoEnds.delete(local.name);
    ctx.pendingAutoIncrements.delete(local.name);
    if (!ctx.structuredLocals)
        return;
    const position = ctx.structuredLocals.findIndex(ref => ref.id === local.id && (ref.library ?? ctx.libId) === ctx.libId);
    /* Lexical ownership stays until the final pruned graph proves retirement. */
}
export function tryBuildForEachIntegerFromStmtSequence(stmts, index, subFuncTypeRef, ctx, iteratorType) {
    if (index + 1 >= stmts.length)
        return undefined;
    const s0 = stmts[index];
    const s1 = stmts[index + 1];
    if (!s0 || !s1 || s1.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const assign = getAssignSides(s0);
    if (!assign)
        return undefined;
    // The iterator may be any variable path the template's #PARAM(var) accepts.
    const iteratorKey = lvalueKey(assign.left);
    if (!iteratorKey)
        return undefined;
    if (getIdentifierName(assign.left) === undefined && !isAssignableVarTarget(assign.left, ctx))
        return undefined;
    const loopInfo = tryMatchForEachIntegerCondition(s1.condition, iteratorKey);
    if (!loopInfo)
        return undefined;
    const incExprFromMap = ctx.pendingAutoIncrements.get(loopInfo.incName);
    const endExprFromMap = ctx.pendingAutoEnds.get(loopInfo.endName);
    // An auto-generated helper name (auto{ID}_ae / auto{ID}_ai) that was never
    // captured does not exist as a variable — emitting it as an identifier param
    // would create a broken 'Unknown' Parameter Value. Bail to custom script.
    if (!incExprFromMap && extractAutoVarName(loopInfo.incName) && !ctx.localVarByGalaxyName.has(loopInfo.incName)) {
        return undefined;
    }
    if (!endExprFromMap && extractAutoVarName(loopInfo.endName) && !ctx.localVarByGalaxyName.has(loopInfo.endName)) {
        return undefined;
    }
    const increment = capturedLoopValue(loopInfo.incName, ctx.pendingAutoIncrements, 3, ctx);
    const end = capturedLoopValue(loopInfo.endName, ctx.pendingAutoEnds, 2, ctx);
    const incExpr = increment.expression;
    const endExpr = end.expression;
    const startExpr = assign.right;
    // Some authored code uses <= 0 in the negative branch. It is equivalent to
    // NativeLib's < 0 only when the captured increment is provably non-zero.
    if (loopInfo.negativeIncludesZero) {
        const signedIncrement = readSignedIntLiteral(incExpr);
        if (signedIncrement === undefined || signedIncrement === 0)
            return undefined;
    }
    const incr = s1.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */)
        return undefined;
    if (lvalueKey(incr.left) !== iteratorKey)
        return undefined;
    if (getIdentifierName(incr.right) !== loopInfo.incName)
        return undefined;
    const claimedId = claimAutoCallIdFromNames([loopInfo.endName, loopInfo.incName]);
    const ref = buildForEachIntegerFCRef(s1, assign.left, startExpr, endExpr, incExpr, subFuncTypeRef, ctx, iteratorType, claimedId);
    if (!ref) {
        releaseAutoCallId(claimedId);
        return undefined;
    }
    const call = ctx.elements[ref.id];
    const parameterRoots = call.parameters ?? [];
    if (end.removable)
        removeCapturedLoopLocal(end.removable, parameterRoots, ctx);
    if (increment.removable)
        removeCapturedLoopLocal(increment.removable, parameterRoots, ctx);
    return { ref, consumed: 2 };
}
export function buildRepeatFCRef(countExpr, bodyStmts, subFuncTypeRef, ctx) {
    const funcDef = ctx.funcNameToFuncDef.get('Repeat');
    if (!funcDef)
        return undefined;
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const paramDefs = funcDef.parameters;
    const countRef = exprToParamRef(countExpr, ctx, paramDefs?.[0]);
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [countRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function tryBuildRepeatFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    if (index + 1 >= stmts.length)
        return undefined;
    const s0 = stmts[index];
    const s1 = stmts[index + 1];
    if (!s0 || !s1 || s1.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const assign = getAssignSides(s0);
    if (!assign)
        return undefined;
    const iterVarName = getIdentifierName(assign.left);
    if (!iterVarName)
        return undefined;
    if (!isGeneratedAutoLoopVarName(iterVarName))
        return undefined;
    if (readSignedIntLiteral(assign.right) !== 1)
        return undefined;
    const cond = unwrapParens(s1.condition);
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (cond.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (getIdentifierName(cond.left) !== iterVarName)
        return undefined;
    const countExpr = cond.right;
    // PickEachInteger template uses auto{ID}_ae as upper bound.
    if (extractAutoVarName(getIdentifierName(countExpr) ?? '')?.suffix === 'ae')
        return undefined;
    const incr = s1.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */)
        return undefined;
    if (getIdentifierName(incr.left) !== iterVarName)
        return undefined;
    if (readSignedIntLiteral(incr.right) !== 1)
        return undefined;
    const bodyStmts = getBlockStatements(s1.statement);
    const ref = buildRepeatFCRef(countExpr, bodyStmts, subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: 2 };
}
export function buildRepeatForeverFCRef(bodyStmts, subFuncTypeRef, ctx) {
    const funcDef = ctx.funcNameToFuncDef.get('RepeatForever');
    if (!funcDef)
        return undefined;
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = roleMap.get('Actions') ?? roleMap.get('Then');
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function tryBuildRepeatForeverFromStmt(stmt, subFuncTypeRef, ctx) {
    if (stmt?.kind !== 131 /* SyntaxKind.WhileStatement */)
        return undefined;
    if (!isTrueExpr(stmt.expression))
        return undefined;
    return buildRepeatForeverFCRef(getBlockStatements(stmt.statement), subFuncTypeRef, ctx);
}
export function buildWaitForConditionFCRef(condExpr, tExpr, timeTypeExpr, subFuncTypeRef, ctx) {
    const funcDef = ctx.funcNameToFuncDef.get('WaitForCondition');
    if (!funcDef)
        return undefined;
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const condRole = roleMap.get('Conditions') ?? roleMap.get('If');
    const paramDefs = funcDef.parameters;
    const tRef = exprToParamRef(tExpr, ctx, paramDefs?.[0]);
    const timeTypeRef = exprToParamRef(timeTypeExpr, ctx, paramDefs?.[1]);
    const subFunctions = collectConditionRefs(condExpr, condRole, ctx);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [tRef, timeTypeRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function buildWaitForConditionWithMaximumDurationFCRef(condExpr, tExpr, timeTypeExpr, maxDurationExpr, subFuncTypeRef, ctx) {
    const funcDef = ctx.funcNameToFuncDef.get('WaitForConditionWithMaximumDuration');
    if (!funcDef)
        return undefined;
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const condRole = roleMap.get('Conditions') ?? roleMap.get('If');
    const paramDefs = funcDef.parameters;
    const tRef = exprToParamRef(tExpr, ctx, paramDefs?.[0]);
    const timeTypeRef = exprToParamRef(timeTypeExpr, ctx, paramDefs?.[1]);
    const maxRef = exprToParamRef(maxDurationExpr, ctx, paramDefs?.[2]);
    const subFunctions = collectConditionRefs(condExpr, condRole, ctx);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [tRef, timeTypeRef, maxRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function tryBuildWaitForConditionFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = stmts[index];
    if (!s0 || s0.kind !== 131 /* SyntaxKind.WhileStatement */)
        return undefined;
    const bodyStmts = getBlockStatements(s0.statement);
    if (bodyStmts.length !== 1)
        return undefined;
    const waitCall = parseWaitCall(bodyStmts[0]);
    if (!waitCall)
        return undefined;
    const condExpr = extractNegatedConditionExpr(s0.expression);
    if (!condExpr)
        return undefined;
    const ref = buildWaitForConditionFCRef(condExpr, waitCall.tExpr, waitCall.timeTypeExpr, subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: 1 };
}
export function tryBuildWaitForConditionWithMaxFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    if (index + 1 >= stmts.length)
        return undefined;
    const s0 = getAssignSides(stmts[index]);
    const s1 = stmts[index + 1];
    if (!s0 || !s1 || s1.kind !== 131 /* SyntaxKind.WhileStatement */)
        return undefined;
    const timerVarName = getIdentifierName(s0.left);
    if (!timerVarName)
        return undefined;
    if (readSignedIntLiteral(s0.right) !== 0)
        return undefined;
    const cond = unwrapParens(s1.expression);
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (cond.operatorToken?.kind !== 34 /* SyntaxKind.AmpersandAmpersandToken */)
        return undefined;
    const negExpr = extractNegatedConditionExpr(cond.left);
    const right = unwrapParens(cond.right);
    if (!negExpr || !right || right.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (right.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (getIdentifierName(right.left) !== timerVarName)
        return undefined;
    const bodyStmts = getBlockStatements(s1.statement);
    if (bodyStmts.length !== 2)
        return undefined;
    const waitCall = parseWaitCall(bodyStmts[0]);
    if (!waitCall)
        return undefined;
    const incAssign = getAssignSides(bodyStmts[1]);
    if (!incAssign || getIdentifierName(incAssign.left) !== timerVarName)
        return undefined;
    const incExpr = unwrapParens(incAssign.right);
    if (!incExpr || incExpr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incExpr.operatorToken?.kind !== 20 /* SyntaxKind.PlusToken */)
        return undefined;
    if (getIdentifierName(incExpr.left) !== timerVarName)
        return undefined;
    if (getIdentifierName(incExpr.right) !== getIdentifierName(waitCall.tExpr))
        return undefined;
    const ref = buildWaitForConditionWithMaximumDurationFCRef(negExpr, waitCall.tExpr, waitCall.timeTypeExpr, right.right, subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: 2 };
}
export function buildActionQueueAddFCRef(bodyStmts, subFuncTypeRef, ctx) {
    const funcDef = ctx.funcNameToFuncDef.get('ActionQueueAdd');
    if (!funcDef)
        return undefined;
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = roleMap.get('Actions') ?? roleMap.get('Then');
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function tryBuildActionQueueAddFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    if (!isCallStmtNamed(stmts[index], 'TriggerQueueEnter'))
        return undefined;
    let exitIndex = -1;
    for (let i = index + 1; i < stmts.length; i++) {
        if (isCallStmtNamed(stmts[i], 'TriggerQueueExit')) {
            exitIndex = i;
            break;
        }
    }
    if (exitIndex < 0)
        return undefined;
    const ref = buildActionQueueAddFCRef(stmts.slice(index + 1, exitIndex), subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: (exitIndex - index + 1) };
}
export function parseSwitchIfChain(stmt, switchVarName) {
    const cases = [];
    let cur = stmt;
    let defaultStmts = [];
    while (cur?.kind === 129 /* SyntaxKind.IfStatement */) {
        const cond = unwrapParens(cur.expression);
        if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
            return undefined;
        if (cond.operatorToken?.kind !== 17 /* SyntaxKind.EqualsEqualsToken */)
            return undefined;
        let valueExpr;
        if (getIdentifierName(cond.left) === switchVarName) {
            valueExpr = cond.right;
        }
        else if (getIdentifierName(cond.right) === switchVarName) {
            valueExpr = cond.left;
        }
        else {
            return undefined;
        }
        const bodyStmts = getBlockStatements(cur.thenStatement);
        cases.push({ valueExpr, bodyStmts });
        const elseStmt = cur.elseStatement;
        if (!elseStmt) {
            defaultStmts = [];
            break;
        }
        const elseStmts = getBlockStatements(elseStmt);
        // An unrelated if inside the default is not another SwitchCase.
        const nextIf = elseStmts.length === 1 && elseStmts[0]?.kind === 129 /* SyntaxKind.IfStatement */ ? elseStmts[0] : undefined;
        const nextCondition = unwrapParens(nextIf?.expression);
        if (nextCondition?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
            nextCondition.operatorToken?.kind === 17 /* SyntaxKind.EqualsEqualsToken */ &&
            (getIdentifierName(nextCondition.left) === switchVarName || getIdentifierName(nextCondition.right) === switchVarName)) {
            cur = nextIf;
            continue;
        }
        defaultStmts = elseStmts;
        break;
    }
    if (cases.length === 0)
        return undefined;
    return { cases, defaultStmts };
}
export function buildSwitchFCRef(switchValueExpr, switchCases, defaultStmts, subFuncTypeRef, ctx, claimedId) {
    const switchDef = ctx.funcNameToFuncDef.get('Switch');
    if (!switchDef)
        return undefined;
    const switchRoleMap = buildFuncDefRoleMap(switchDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const casesRole = switchRoleMap.get('Cases');
    const defaultsRole = switchRoleMap.get('Defaults') ??
        switchRoleMap.get('Default') ??
        switchRoleMap.get('Else') ??
        switchRoleMap.get('Actions');
    const switchParamDefs = switchDef.parameters;
    const switchValueRef = exprToParamRef(switchValueExpr, ctx, switchParamDefs?.[0]);
    const caseDef = ctx.funcNameToFuncDef.get('SwitchCase');
    if (!caseDef || !casesRole)
        return undefined;
    const caseRoleMap = buildFuncDefRoleMap(caseDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const caseActionsRole = caseRoleMap.get('Actions') ?? caseRoleMap.get('Then');
    const caseParamDefs = caseDef.parameters;
    const subFunctions = [];
    for (const c of switchCases) {
        const caseValueRef = exprToParamRef(c.valueExpr, ctx, caseParamDefs?.[0]);
        const caseActions = convertStatementListToActionRefs(c.bodyStmts, caseActionsRole, ctx);
        const caseData = {
            functionDef: fdRef(caseDef),
            parameters: [caseValueRef],
            subFunctions: caseActions,
            subFunctionType: casesRole,
        };
        subFunctions.push(mkFCRef(caseData, ctx));
    }
    if (defaultsRole && defaultStmts.length > 0) {
        const defaults = convertStatementListToActionRefs(defaultStmts, defaultsRole, ctx);
        subFunctions.push(...defaults);
    }
    const data = {
        functionDef: fdRef(switchDef),
        parameters: [switchValueRef],
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx, claimedId);
}
export function tryBuildSwitchFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = stmts[index + 1];
    if (!s0 || !s1 || s1.kind !== 129 /* SyntaxKind.IfStatement */)
        return undefined;
    const switchVarName = getIdentifierName(s0.left);
    if (!switchVarName || !/^auto[0-9A-Za-z]+_val$/.test(switchVarName))
        return undefined;
    const chain = parseSwitchIfChain(s1, switchVarName);
    if (!chain)
        return undefined;
    const claimedId = claimAutoCallIdFromNames([switchVarName]);
    const ref = buildSwitchFCRef(s0.right, chain.cases, chain.defaultStmts, subFuncTypeRef, ctx, claimedId);
    if (!ref) {
        releaseAutoCallId(claimedId);
        return undefined;
    }
    // `autoX_val` is the Switch's own auto variable; a function body that declared
    // it would otherwise keep it as a local the regenerated Switch never uses.
    const id = ctx.localVarByGalaxyName.get(switchVarName);
    const statements = ctx.structuredFunctionStatements;
    if (id && ctx.structuredLocals && statements) {
        const declaration = statements.find(node => node.kind === 141 /* SyntaxKind.VariableDeclaration */ && node.name?.name === switchVarName);
        if (!syntaxMentionsAny(statements, new Set([switchVarName]), new Set([stmts[index], s1, declaration]))) {
            const call = ctx.elements[ref.id];
            removeCapturedLoopLocal({ name: switchVarName, id }, [...(call.parameters ?? []), ...(call.subFunctions ?? [])], ctx);
        }
    }
    return { ref, consumed: 2 };
}
export function buildPickEachPlayerInGroupFCRef(groupExpr, iteratorExpr, bodyStmts, subFuncTypeRef, ctx, exactFuncDef) {
    const iteratorName = getIdentifierName(iteratorExpr);
    const preferForEach = !isGeneratedAutoLoopVarName(iteratorName);
    const funcDef = exactFuncDef ?? (preferForEach
        ? (ctx.funcNameToFuncDef.get('ForEachPlayerInGroup') ?? ctx.funcNameToFuncDef.get('PickEachPlayerInGroup'))
        : (ctx.funcNameToFuncDef.get('PickEachPlayerInGroup') ?? ctx.funcNameToFuncDef.get('ForEachPlayerInGroup')));
    if (!funcDef)
        return undefined;
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const paramDefs = funcDef.parameters;
    const hasVarParam = (funcDef.parameters?.length ?? 0) > 1;
    const iterRef = exprToParamRef(unwrapParens(iteratorExpr), ctx, hasVarParam ? paramDefs?.[0] : undefined);
    const groupRef = exprToParamRef(groupExpr, ctx, hasVarParam ? paramDefs?.[1] : paramDefs?.[0]);
    const bodyCtx = hasVarParam
        ? ctx
        : { ...ctx, pickEachPlayerVarName: iteratorName };
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, bodyCtx))
        subFunctions.push(ref);
    if (!hasVarParam && generatedScriptMentions(subFunctions, iteratorSpellings([iteratorName], ctx), ctx))
        return undefined;
    const params = hasVarParam ? [iterRef, groupRef] : [groupRef];
    const data = {
        functionDef: fdRef(funcDef),
        parameters: params,
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
function callExpressionFromStatement(stmt) {
    if (stmt?.kind !== 138 /* SyntaxKind.ExpressionStatement */)
        return undefined;
    const expression = unwrapParens(stmt.expression);
    return expression?.kind === 121 /* SyntaxKind.CallExpression */ ? expression : undefined;
}
function isZeroArgumentCall(expression, name) {
    const call = unwrapParens(expression);
    return call?.kind === 121 /* SyntaxKind.CallExpression */ &&
        getIdentifierName(call.expression) === name &&
        Array.from(call.arguments ?? []).length === 0;
}
/** Find the loaded TriggerLib operation whose template is the legacy editor
 * PlayerGroupLoopBegin/Done/Step/End expansion.  The structural check keeps
 * this version-independent and avoids depending on a particular element ID. */
function legacyPlayerGroupLoopFuncDef(ctx) {
    const direct = ctx.funcNameToFuncDef.get('PickEachPlayerInGroupDeprecated');
    if (direct)
        return direct;
    const defs = ctx.nativeLibrary?.elementsByType?.FunctionDef;
    if (!defs)
        return undefined;
    return Object.values(defs).find(funcDef => {
        const code = funcDef.scriptCode ?? '';
        return code.includes('PlayerGroupLoopBegin(') &&
            code.includes('PlayerGroupLoopDone()') &&
            code.includes('PlayerGroupLoopStep()') &&
            code.includes('PlayerGroupLoopEnd()') &&
            (funcDef.parameters?.length ?? 0) === 1;
    });
}
function deprecatedForEachPlayerFuncDef(ctx) {
    const direct = ctx.funcNameToFuncDef.get('ForEachPlayerInGroupDeprecated');
    if (direct)
        return direct;
    const defs = ctx.nativeLibrary?.elementsByType?.FunctionDef;
    if (!defs)
        return undefined;
    return Object.values(defs).find(funcDef => {
        const code = funcDef.scriptCode ?? '';
        return code.includes('PlayerGroupCount(#AUTOVAR(') &&
            code.includes('PlayerGroupPlayer(#AUTOVAR(') &&
            code.includes('BoolToInt(#PARAM(') &&
            (funcDef.parameters?.length ?? 0) === 2;
    });
}
function callNamedWithArgs(expression, name, count) {
    const call = unwrapParens(expression);
    if (call?.kind !== 121 /* SyntaxKind.CallExpression */ || getIdentifierName(call.expression) !== name)
        return undefined;
    const args = Array.from(call.arguments ?? []);
    return args.length === count ? args : undefined;
}
/** Older editor expansion of ForEachPlayerInGroup:
 *   auto_g = group; auto_p = 1;
 *   for (; auto_p <= PlayerGroupCount(auto_g);
 *          auto_p += BoolToInt(var == PlayerGroupPlayer(auto_g, auto_p))) {
 *     var = PlayerGroupPlayer(auto_g, auto_p); body
 *   }
 */
export function tryBuildDeprecatedForEachPlayerFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const groupAssign = getAssignSides(stmts[index]);
    const indexAssign = getAssignSides(stmts[index + 1]);
    const loop = stmts[index + 2];
    if (!groupAssign || !indexAssign || loop?.kind !== 132 /* SyntaxKind.ForStatement */ || loop.initializer != null)
        return undefined;
    const groupName = getIdentifierName(groupAssign.left);
    const indexName = getIdentifierName(indexAssign.left);
    if (extractAutoVarName(groupName ?? '')?.suffix !== 'g' ||
        extractAutoVarName(indexName ?? '')?.suffix !== 'p' ||
        readSignedIntLiteral(indexAssign.right) !== 1)
        return undefined;
    const condition = unwrapParens(loop.condition);
    if (condition?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
        condition.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */ ||
        getIdentifierName(condition.left) !== indexName)
        return undefined;
    const countArgs = callNamedWithArgs(condition.right, 'PlayerGroupCount', 1);
    if (!countArgs || getIdentifierName(countArgs[0]) !== groupName)
        return undefined;
    const increment = unwrapParens(loop.incrementor);
    if (increment?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
        increment.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */ ||
        getIdentifierName(increment.left) !== indexName)
        return undefined;
    const boolArgs = callNamedWithArgs(increment.right, 'BoolToInt', 1);
    const equality = boolArgs && unwrapParens(boolArgs[0]);
    if (equality?.kind !== 124 /* SyntaxKind.BinaryExpression */ || equality.operatorToken?.kind !== 17 /* SyntaxKind.EqualsEqualsToken */)
        return undefined;
    const currentArgs = callNamedWithArgs(equality.right, 'PlayerGroupPlayer', 2);
    if (!currentArgs || getIdentifierName(currentArgs[0]) !== groupName || getIdentifierName(currentArgs[1]) !== indexName)
        return undefined;
    const iteratorName = getIdentifierName(equality.left);
    if (!iteratorName)
        return undefined;
    const body = getBlockStatements(loop.statement);
    const iteratorAssign = getAssignSides(body[0]);
    const bodyCurrentArgs = iteratorAssign && callNamedWithArgs(iteratorAssign.right, 'PlayerGroupPlayer', 2);
    if (!iteratorAssign || getIdentifierName(iteratorAssign.left) !== iteratorName || !bodyCurrentArgs ||
        getIdentifierName(bodyCurrentArgs[0]) !== groupName || getIdentifierName(bodyCurrentArgs[1]) !== indexName)
        return undefined;
    // Auto locals belong exclusively to this template invocation. If authored
    // code observes either outside it, replacing the sequence would alter state.
    const allSymbols = functionSymbolIndex(ctx.structuredFunctionStatements ?? stmts);
    const ownSymbols = functionSymbolIndex([stmts[index], stmts[index + 1], loop]);
    if (allSymbols.uses.get(groupName) !== ownSymbols.uses.get(groupName) ||
        allSymbols.uses.get(indexName) !== ownSymbols.uses.get(indexName))
        return undefined;
    const funcDef = deprecatedForEachPlayerFuncDef(ctx);
    if (!funcDef)
        return undefined;
    const paramDefs = funcDef.parameters;
    const iteratorRef = exprToParamRef(equality.left, ctx, paramDefs?.[0]);
    const groupRef = exprToParamRef(groupAssign.right, ctx, paramDefs?.[1]);
    const roleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = roleMap.get('Actions') ?? roleMap.get('Then');
    const subFunctions = convertStatementListToActionRefs(body.slice(1), bodyRole, ctx);
    const ref = mkFCRef({ functionDef: fdRef(funcDef), parameters: [iteratorRef, groupRef], subFunctions,
        ...(subFuncTypeRef ? { subFunctionType: subFuncTypeRef } : {}) }, ctx);
    const generatedRoots = [iteratorRef, groupRef, ...subFunctions];
    for (const name of [groupName, indexName]) {
        const id = ctx.localVarByGalaxyName.get(name);
        if (id)
            removeCapturedLoopLocal({ name, id }, generatedRoots, ctx);
    }
    return { ref, consumed: 3 };
}
/** Legacy SC2 Editor expansion:
 *   PlayerGroupLoopBegin(group);
 *   for (; !PlayerGroupLoopDone(); PlayerGroupLoopStep()) { body }
 *   PlayerGroupLoopEnd();
 */
export function tryBuildLegacyPickEachPlayerFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const begin = callExpressionFromStatement(stmts[index]);
    const loop = stmts[index + 1];
    const end = callExpressionFromStatement(stmts[index + 2]);
    if (!begin || loop?.kind !== 132 /* SyntaxKind.ForStatement */ || !end)
        return undefined;
    if (getIdentifierName(begin.expression) !== 'PlayerGroupLoopBegin')
        return undefined;
    const beginArgs = Array.from(begin.arguments ?? []);
    if (beginArgs.length !== 1 || !isZeroArgumentCall(end, 'PlayerGroupLoopEnd'))
        return undefined;
    if (loop.initializer != null)
        return undefined;
    const condition = unwrapParens(loop.condition);
    if (condition?.kind !== 122 /* SyntaxKind.PrefixUnaryExpression */ ||
        condition.operator?.kind !== 32 /* SyntaxKind.ExclamationToken */ ||
        !isZeroArgumentCall(condition.operand, 'PlayerGroupLoopDone'))
        return undefined;
    if (!isZeroArgumentCall(loop.incrementor, 'PlayerGroupLoopStep'))
        return undefined;
    const funcDef = legacyPlayerGroupLoopFuncDef(ctx);
    if (!funcDef)
        return undefined;
    const ref = buildPickEachPlayerInGroupFCRef(beginArgs[0], { kind: 113 /* SyntaxKind.Identifier */, name: 'autoPlayerGroupLoop_var' }, getBlockStatements(loop.statement), subFuncTypeRef, ctx, funcDef);
    return ref ? { ref, consumed: 3 } : undefined;
}
export function buildPickEachUnitInGroupFCRef(groupExpr, iteratorExpr, bodyStmts, subFuncTypeRef, ctx) {
    const iteratorName = getIdentifierName(iteratorExpr);
    const preferForEach = !isGeneratedAutoLoopVarName(iteratorName);
    const funcDef = preferForEach
        ? (ctx.funcNameToFuncDef.get('ForEachUnitInGroup') ?? ctx.funcNameToFuncDef.get('PickEachUnitInGroup'))
        : (ctx.funcNameToFuncDef.get('PickEachUnitInGroup') ?? ctx.funcNameToFuncDef.get('ForEachUnitInGroup'));
    if (!funcDef)
        return undefined;
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const paramDefs = funcDef.parameters;
    const hasVarParam = (funcDef.parameters?.length ?? 0) > 1;
    const iterRef = exprToParamRef(unwrapParens(iteratorExpr), ctx, hasVarParam ? paramDefs?.[0] : undefined);
    const groupRef = exprToParamRef(groupExpr, ctx, hasVarParam ? paramDefs?.[1] : paramDefs?.[0]);
    const bodyCtx = hasVarParam
        ? ctx
        : { ...ctx, pickEachUnitVarName: iteratorName };
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, bodyCtx))
        subFunctions.push(ref);
    if (!hasVarParam && generatedScriptMentions(subFunctions, iteratorSpellings([iteratorName], ctx), ctx))
        return undefined;
    const params = hasVarParam ? [iterRef, groupRef] : [groupRef];
    const data = {
        functionDef: fdRef(funcDef),
        parameters: params,
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
export function tryBuildPickEachPlayerFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = getAssignSides(stmts[index + 1]);
    const s2 = stmts[index + 2];
    if (!s0 || !s1 || !s2 || s2.kind !== 131 /* SyntaxKind.WhileStatement */)
        return undefined;
    const groupVarName = getIdentifierName(s0.left);
    const iteratorKey = lvalueKey(s1.left);
    if (!groupVarName || !iteratorKey)
        return undefined;
    if (getIdentifierName(s1.left) === undefined && !isAssignableVarTarget(s1.left, ctx))
        return undefined;
    if (readSignedIntLiteral(s1.right) !== -1)
        return undefined;
    if (!isTrueExpr(s2.expression))
        return undefined;
    const loopBody = getBlockStatements(s2.statement);
    if (loopBody.length < 2)
        return undefined;
    const nextAssign = getAssignSides(loopBody[0]);
    if (!nextAssign)
        return undefined;
    if (lvalueKey(nextAssign.left) !== iteratorKey)
        return undefined;
    const nextCall = unwrapParens(nextAssign.right);
    if (!nextCall || nextCall.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    const calleeName = getIdentifierName(nextCall.expression);
    if (calleeName !== 'PlayerGroupNextPlayer')
        return undefined;
    const args = Array.from(nextCall.arguments ?? []);
    if (args.length !== 2)
        return undefined;
    if (getIdentifierName(args[0]) !== groupVarName)
        return undefined;
    if (lvalueKey(args[1]) !== iteratorKey)
        return undefined;
    if (!isBreakGuardOnNegative(loopBody[1], iteratorKey))
        return undefined;
    const userBody = loopBody.slice(2);
    const ref = buildPickEachPlayerInGroupFCRef(s0.right, s1.left, userBody, subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: 3 };
}
export function tryBuildPickEachUnitFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = getAssignSides(stmts[index + 1]);
    const s2 = stmts[index + 2];
    if (!s0 || !s1 || !s2 || s2.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const groupVarName = getIdentifierName(s0.left);
    const indexVarName = getIdentifierName(s1.left);
    if (!groupVarName || !indexVarName)
        return undefined;
    const countCall = unwrapParens(s1.right);
    if (!countCall || countCall.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(countCall.expression) !== 'UnitGroupCount')
        return undefined;
    const countArgs = Array.from(countCall.arguments ?? []);
    if (countArgs.length < 1)
        return undefined;
    if (getIdentifierName(countArgs[0]) !== groupVarName)
        return undefined;
    // for (;; idx -= 1)
    if (s2.condition != null)
        return undefined;
    const incr = s2.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 41 /* SyntaxKind.MinusEqualsToken */)
        return undefined;
    if (getIdentifierName(incr.left) !== indexVarName)
        return undefined;
    if (readSignedIntLiteral(incr.right) !== 1)
        return undefined;
    const loopBody = getBlockStatements(s2.statement);
    if (loopBody.length < 2)
        return undefined;
    const nextAssign = getAssignSides(loopBody[0]);
    if (!nextAssign)
        return undefined;
    const unitKey = lvalueKey(nextAssign.left);
    if (!unitKey)
        return undefined;
    if (getIdentifierName(nextAssign.left) === undefined && !isAssignableVarTarget(nextAssign.left, ctx))
        return undefined;
    const unitCall = unwrapParens(nextAssign.right);
    if (!unitCall || unitCall.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(unitCall.expression) !== 'UnitGroupUnitFromEnd')
        return undefined;
    const unitArgs = Array.from(unitCall.arguments ?? []);
    if (unitArgs.length < 2)
        return undefined;
    if (getIdentifierName(unitArgs[0]) !== groupVarName)
        return undefined;
    if (getIdentifierName(unitArgs[1]) !== indexVarName)
        return undefined;
    if (!isBreakGuardOnNull(loopBody[1], unitKey))
        return undefined;
    const userBody = loopBody.slice(2);
    const ref = buildPickEachUnitInGroupFCRef(s0.right, nextAssign.left, userBody, subFuncTypeRef, ctx);
    if (!ref)
        return undefined;
    return { ref, consumed: 3, scaffoldingVariables: [groupVarName, indexVarName] };
}
// ---------------------------------------------------------------------------
// ForEachCatalogEntryInCatalog pattern:
//   auto*_catalog = <catalogExpr>;
//   auto*_i = 1;
//   for (; auto*_i <= CatalogEntryCount(<any>); auto*_i += 1) {
//       <entry> = CatalogEntryGet(auto*_catalog, auto*_i);
//       body...
//   }
// ---------------------------------------------------------------------------
export function tryBuildForEachCatalogEntryFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = getAssignSides(stmts[index + 1]);
    const s2 = stmts[index + 2];
    if (!s0 || !s1 || !s2 || s2.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const catalogVarName = getIdentifierName(s0.left);
    const counterVarName = getIdentifierName(s1.left);
    if (!catalogVarName || !counterVarName)
        return undefined;
    if (!/^auto[0-9A-Fa-f]+_/.test(catalogVarName))
        return undefined;
    if (readSignedIntLiteral(s1.right) !== 1)
        return undefined;
    // for loop: no init, condition = counterVar <= CatalogEntryCount(...), incr = counterVar += 1
    if (s2.initializer != null)
        return undefined;
    const cond = s2.condition;
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (cond.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (getIdentifierName(cond.left) !== counterVarName)
        return undefined;
    const condRight = unwrapParens(cond.right);
    if (!condRight || condRight.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(condRight.expression) !== 'CatalogEntryCount')
        return undefined;
    const catalogExpr = s0.right; // the original catalog expression
    const incr = s2.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */)
        return undefined;
    if (getIdentifierName(incr.left) !== counterVarName)
        return undefined;
    if (readSignedIntLiteral(incr.right) !== 1)
        return undefined;
    const loopBody = getBlockStatements(s2.statement);
    if (loopBody.length < 1)
        return undefined;
    // body[0] = <entry> = CatalogEntryGet(<catalogVar>, <counterVar>)
    const entryAssign = getAssignSides(loopBody[0]);
    if (!entryAssign)
        return undefined;
    const getCall = unwrapParens(entryAssign.right);
    if (!getCall || getCall.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(getCall.expression) !== 'CatalogEntryGet')
        return undefined;
    const getArgs = Array.from(getCall.arguments ?? []);
    if (getArgs.length < 2)
        return undefined;
    if (getIdentifierName(getArgs[0]) !== catalogVarName)
        return undefined;
    if (getIdentifierName(getArgs[1]) !== counterVarName)
        return undefined;
    const entryExpr = entryAssign.left;
    const userBody = loopBody.slice(1);
    const funcDef = ctx.funcNameToFuncDef.get('ForEachCatalogEntryInCatalog');
    if (!funcDef)
        return undefined;
    const paramDefs = funcDef.parameters;
    const catalogRef = exprToParamRef(catalogExpr, ctx, paramDefs?.[0]);
    const entryRef = exprToParamRef(entryExpr, ctx, paramDefs?.[1]);
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(userBody, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [catalogRef, entryRef].filter(Boolean),
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return { ref: mkFCRef(data, ctx), consumed: 3 };
}
// ---------------------------------------------------------------------------
// ForEachUserDataInstanceInUserType pattern:
//   auto*_userType = <userTypeExpr>;
//   auto*_i = 1;
//   for (; auto*_i <= UserDataInstanceCount(auto*_userType); auto*_i += 1) {
//       <instance> = UserDataInstance(auto*_userType, auto*_i);
//       body...
//   }
// ---------------------------------------------------------------------------
export function tryBuildForEachUserDataInstanceFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = getAssignSides(stmts[index + 1]);
    const s2 = stmts[index + 2];
    if (!s0 || !s1 || !s2 || s2.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const userTypeVarName = getIdentifierName(s0.left);
    const counterVarName = getIdentifierName(s1.left);
    if (!userTypeVarName || !counterVarName)
        return undefined;
    if (!/^auto[0-9A-Fa-f]+_/.test(userTypeVarName))
        return undefined;
    if (readSignedIntLiteral(s1.right) !== 1)
        return undefined;
    if (s2.initializer != null)
        return undefined;
    const cond = s2.condition;
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (cond.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (getIdentifierName(cond.left) !== counterVarName)
        return undefined;
    const condRight = unwrapParens(cond.right);
    if (!condRight || condRight.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(condRight.expression) !== 'UserDataInstanceCount')
        return undefined;
    const incr = s2.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */)
        return undefined;
    if (getIdentifierName(incr.left) !== counterVarName)
        return undefined;
    if (readSignedIntLiteral(incr.right) !== 1)
        return undefined;
    const loopBody = getBlockStatements(s2.statement);
    if (loopBody.length < 1)
        return undefined;
    const instanceAssign = getAssignSides(loopBody[0]);
    if (!instanceAssign)
        return undefined;
    const getCall = unwrapParens(instanceAssign.right);
    if (!getCall || getCall.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(getCall.expression) !== 'UserDataInstance')
        return undefined;
    const getArgs = Array.from(getCall.arguments ?? []);
    if (getArgs.length < 2)
        return undefined;
    if (getIdentifierName(getArgs[0]) !== userTypeVarName)
        return undefined;
    if (getIdentifierName(getArgs[1]) !== counterVarName)
        return undefined;
    const instanceExpr = instanceAssign.left;
    const userTypeExpr = s0.right;
    const userBody = loopBody.slice(1);
    const funcDef = ctx.funcNameToFuncDef.get('ForEachUserDataInstanceInUserType');
    if (!funcDef)
        return undefined;
    const paramDefs = funcDef.parameters;
    const instanceRef = exprToParamRef(instanceExpr, ctx, paramDefs?.[0]);
    const userTypeRef = exprToParamRef(userTypeExpr, ctx, paramDefs?.[1]);
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(userBody, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [instanceRef, userTypeRef].filter(Boolean),
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return { ref: mkFCRef(data, ctx), consumed: 3 };
}
// ---------------------------------------------------------------------------
// ForEachUIFrame pattern (no auto-vars):
//   <var> = c_syncFrameTypeFirst;
//   for (; <var> <= c_syncFrameTypeLast; <var> += 1) { body... }
// ---------------------------------------------------------------------------
export function tryBuildForEachUIFrameFromStmtSequence(stmts, index, subFuncTypeRef, ctx) {
    const s0 = getAssignSides(stmts[index]);
    const s1 = stmts[index + 1];
    if (!s0 || !s1 || s1.kind !== 132 /* SyntaxKind.ForStatement */)
        return undefined;
    const varKey = lvalueKey(s0.left);
    if (!varKey)
        return undefined;
    if (getIdentifierName(s0.left) === undefined && !isAssignableVarTarget(s0.left, ctx))
        return undefined;
    const rightId = getIdentifierName(s0.right);
    if (rightId !== 'c_syncFrameTypeFirst')
        return undefined;
    if (s1.initializer != null)
        return undefined;
    const cond = s1.condition;
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (cond.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */)
        return undefined;
    if (lvalueKey(cond.left) !== varKey)
        return undefined;
    if (getIdentifierName(unwrapParens(cond.right)) !== 'c_syncFrameTypeLast')
        return undefined;
    const incr = s1.incrementor;
    if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */)
        return undefined;
    if (lvalueKey(incr.left) !== varKey)
        return undefined;
    if (readSignedIntLiteral(incr.right) !== 1)
        return undefined;
    const funcDef = ctx.funcNameToFuncDef.get('ForEachUIFrame');
    if (!funcDef)
        return undefined;
    const paramDefs = funcDef.parameters;
    const varRef = exprToParamRef(s0.left, ctx, paramDefs?.[0]);
    const bodyStmts = getBlockStatements(s1.statement);
    const localRoleMap = buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
    const bodyRole = localRoleMap.get('Actions') ?? localRoleMap.get('Then');
    const subFunctions = [];
    for (const ref of convertStatementListToActionRefs(bodyStmts, bodyRole, ctx))
        subFunctions.push(ref);
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [varRef].filter(Boolean),
        subFunctions,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return { ref: mkFCRef(data, ctx), consumed: 2 };
}
// ---------------------------------------------------------------------------
// Custom Script fallback
// ---------------------------------------------------------------------------
const _printer = new Printer();
/** Rewrite only identifiers whose binding is already proven by the reverse
 * conversion context. Custom Script is a lossless fallback for syntax that has
 * no GUI representation, but the enclosing TriggerData document may rename
 * globals, parameters, locals and trigger handles when Galaxy is emitted
 * again. Leaving the authored spelling in the raw text creates valid-looking
 * yet unbound Galaxy. String literals, comments, property names and unknown
 * external symbols are deliberately untouched. */
function rewriteCustomScriptBindings(stmt, ctx) {
    if (typeof ctx.sourceText !== 'string')
        return undefined;
    // exprStmtToActionFCRef sometimes creates a lightweight wrapper around the
    // original expression. Such wrappers intentionally have no source range;
    // the expression still does. Include the statement terminator explicitly.
    const range = typeof stmt?.pos === 'number' && typeof stmt?.end === 'number' ? stmt
        : stmt?.kind === 138 /* SyntaxKind.ExpressionStatement */ && typeof stmt.expression?.pos === 'number' && typeof stmt.expression?.end === 'number'
            ? stmt.expression
            : undefined;
    if (!range)
        return undefined;
    const start = range.pos;
    const suffix = range === stmt ? '' : ';';
    const source = ctx.sourceText.slice(start, range.end) + suffix;
    // Source ranges are meaningful only for the SourceFile that owns the AST.
    // A node transplanted from a template wrapper can carry valid-looking
    // offsets into a different document; slicing those offsets produced broken
    // fragments such as the tail of a for condition plus a truncated body call.
    // Prove that the slice reconstructs this exact statement before rewriting.
    const parsedSource = parseTemplateFragment(source, false);
    if (parsedSource?.length !== 1 || shapeText(parsedSource[0]) !== shapeText(stmt))
        return undefined;
    const replacements = [];
    const seen = new Set();
    const stack = [{ node: stmt }];
    while (stack.length) {
        const { node, parent } = stack.pop();
        if (!node || typeof node !== 'object' || seen.has(node))
            continue;
        seen.add(node);
        if (node.kind === 113 /* SyntaxKind.Identifier */ && typeof node.name === 'string' &&
            typeof node.pos === 'number' && typeof node.end === 'number' &&
            !(parent?.kind === 120 /* SyntaxKind.PropertyAccessExpression */ && parent.name === node)) {
            const name = node.name;
            let replacement;
            // A loop iterator has no text spelling inside a counter-based loop: the
            // *LoopCurrent natives read only the deprecated *LoopBegin loops. The
            // loop recognizers reject a body whose Custom Script reads the iterator.
            if (![ctx.pickEachIntVarName, ctx.pickEachPlayerVarName, ctx.pickEachUnitVarName].includes(name)) {
                const localId = ctx.localVarByGalaxyName.get(name);
                const local = localId ? ctx.elements[localId] : undefined;
                if (local?.type === 'Variable')
                    replacement = localVarName(local);
                const parameter = ctx.paramRefByGalaxyName?.get(name);
                const paramDef = parameter ? ctx.elements[parameter.id] : undefined;
                if (!replacement && paramDef?.type === 'ParamDef') {
                    const stem = lowerInitial(sanitizeIdentifier(paramDef.name ?? paramDef.id));
                    replacement = stem.startsWith('lp_') ? stem : `lp_${stem}`;
                }
                const global = ctx.globalVarByGalaxyName.get(name);
                const variable = global?.library === ctx.libId ? ctx.elements[global.id] : undefined;
                if (!replacement && variable?.type === 'Variable')
                    replacement = globalVariableName(global.library, variable);
                const triggerRef = ctx.triggerByGalaxyName?.get(name);
                const trigger = triggerRef ? ctx.elements[triggerRef.id] : undefined;
                if (!replacement && trigger?.type === 'Trigger')
                    replacement = triggerHandleName(triggerRef.library ?? ctx.libId, trigger);
                if (!replacement && name.endsWith('_Init')) {
                    const handleName = name.slice(0, -5);
                    const initRef = ctx.triggerByGalaxyName?.get(handleName);
                    const initTrigger = initRef ? ctx.elements[initRef.id] : undefined;
                    if (initTrigger?.type === 'Trigger')
                        replacement = triggerInitFuncName(initRef.library ?? ctx.libId, initTrigger);
                }
            }
            if (replacement && replacement !== name)
                replacements.push({ start: node.pos - start, end: node.end - start, text: replacement });
        }
        for (const child of syntaxChildren(node)) {
            if (Array.isArray(child))
                for (let i = child.length - 1; i >= 0; i--)
                    stack.push({ node: child[i], parent: node });
            else
                stack.push({ node: child, parent: node });
        }
    }
    replacements.sort((a, b) => b.start - a.start || b.end - a.end);
    let rewritten = source;
    for (const replacement of replacements) {
        if (replacement.start < 0 || replacement.end > rewritten.length || replacement.start >= replacement.end)
            continue;
        rewritten = rewritten.slice(0, replacement.start) + replacement.text + rewritten.slice(replacement.end);
    }
    if (globalThis.process?.env?.['MX_G2T_TRACE_CUSTOM_SCRIPT'] === '1') {
        // The legacy logger can be disabled by the embedding host; stderr makes an
        // explicitly requested conversion trace observable in CLI and UI workers.
        console.error(`[triggers:g2t] custom-script bindings=${replacements.length} pos=${range.pos} loop=${ctx.pickEachIntVarName ?? '-'} globals=${ctx.globalVarByGalaxyName.size} triggers=${ctx.triggerByGalaxyName?.size ?? 0} source=${JSON.stringify(source.slice(0, 180))}`);
    }
    return rewritten.trim();
}
export function buildCustomScriptActionFCRef(stmt, subFuncTypeRef, ctx) {
    const funcDef = findCustomScriptActionFuncDef(ctx);
    if (!funcDef) {
        throw new Error('NativeLib CustomScript action FunctionDef is required for unresolved Galaxy statements');
    }
    const rewritten = rewriteCustomScriptBindings(stmt, ctx);
    // rewriteCustomScriptBindings is the only path allowed to reuse source
    // offsets because it first proves AST/source ownership. Otherwise print the
    // AST itself; repeating the unverified slice here would reintroduce the same
    // truncated-fragment failure.
    // A CRLF source keeps its line breaks in the slice; ScriptCode is stored as
    // indented lines, so CR would not survive a save and reload of the document.
    const raw = (rewritten ?? _printer.printNode(stmt).trim()).replace(/\r\n?/gu, '\n');
    const parsedRaw = parseTemplateFragment(raw, false);
    if (parsedRaw?.length !== 1) {
        return conversionError('CUSTOM_SCRIPT_SYNTAX', 'Custom Script fallback is not one complete Galaxy statement', {
            kind: getKindName(stmt?.kind) || stmt?.kind,
            pos: stmt?.pos,
            end: stmt?.end,
            source: raw.slice(0, 4096),
        });
    }
    if (globalThis.process?.env?.['MX_G2T_TRACE_CUSTOM_SCRIPT'] === '1') {
        const location = typeof stmt?.pos === 'number' ? ` pos=${stmt.pos}` : '';
        console.error(`[triggers:g2t] custom-script kind=${getKindName(stmt?.kind) || stmt?.kind}${location}\n${raw}`);
    }
    const data = {
        functionDef: fdRef(funcDef),
        parameters: [],
        scriptCode: raw,
    };
    if (subFuncTypeRef)
        data.subFunctionType = subFuncTypeRef;
    return mkFCRef(data, ctx);
}
const loadedAutoSequenceIndexes = new WeakMap();
const loadedStatementSequenceIndexes = new WeakMap();
function loadedAutoSequenceTemplates(ctx) {
    const candidates = ctx.templateCandidates;
    if (!candidates)
        return [];
    let indexed = loadedAutoSequenceIndexes.get(candidates);
    if (indexed)
        return indexed;
    indexed = candidates.filter(template => {
        // A promoted #INITAUTOVAR moves the other statements into declarations, so
        // Repeat over a literal count is a single `for`.
        if (template.expression || template.nodes.length < (template.promotedAutos ? 1 : 2) || ![...template.holes.values()].some(hole => hole.kind === 'auto'))
            return false;
        if ([...template.holes.values()].some(hole => hole.kind === 'block' && hole.separator !== undefined))
            return false;
        const macros = templateMacros(template.definition.scriptCode ?? '');
        return macros[0]?.name === 'AUTOVAR' && !macros.some(macro => macro.args.some(arg => arg.startsWith('ancestor:')));
    });
    loadedAutoSequenceIndexes.set(candidates, indexed);
    return indexed;
}
function syntaxMentionsAny(nodes, names, excluded) {
    const pending = [...nodes];
    while (pending.length) {
        const node = pending.pop();
        if (!node || excluded.has(node))
            continue;
        if (node.kind === 113 /* SyntaxKind.Identifier */ && names.has(node.name))
            return true;
        pending.push(...syntaxChildren(node));
    }
    return false;
}
/** Read each promoted `#INITAUTOVAR` input back from its const auto declaration. */
function bindPromotedAutoParameters(template, bindings, ctx) {
    for (const [auto, parameter] of template.promotedAutos ?? []) {
        const name = getIdentifierName(bindings.autos.get(auto));
        const declaration = name ? ctx.structuredFunctionStatements?.find(node => node.kind === 141 /* SyntaxKind.VariableDeclaration */ && node.name?.name === name) : undefined;
        if (!declaration?.initializer || !declaration.modifiers?.some((modifier) => modifier.kind === 53 /* SyntaxKind.ConstKeyword */))
            return false;
        bindings.parameters.set(parameter, declaration.initializer);
    }
    return true;
}
function privateGeneratedAutoLocals(nodes, bindings, ctx, promoted) {
    if (!bindings.autos.size || !ctx.structuredFunctionStatements || !ctx.structuredLocals)
        return undefined;
    const names = new Set(), declarations = [], locals = [];
    for (const [auto, value] of bindings.autos) {
        const name = getIdentifierName(value);
        // Loaded FunctionDef templates own a fresh auto-variable scope per call.
        // Nested calls may legitimately reuse macro role names such as `u`/`i`;
        // their generated Galaxy identifiers remain distinct. Ancestor access is
        // handled explicitly by `ancestor:` macros, which this matcher excludes.
        if (!name || !extractAutoVarName(name) || names.has(name))
            return undefined;
        const id = ctx.localVarByGalaxyName.get(name);
        const variable = id ? ctx.elements[id] : undefined;
        const declaration = ctx.structuredFunctionStatements.find(node => node.kind === 141 /* SyntaxKind.VariableDeclaration */ && node.name?.name === name);
        if (!id || variable?.type !== 'Variable' || variable.isArray || !declaration || declaration.initializer && !promoted?.has(auto))
            return undefined;
        names.add(name);
        declarations.push(declaration);
        locals.push({ name, id });
    }
    if (syntaxMentionsAny(ctx.structuredFunctionStatements, names, new Set([...nodes, ...declarations])))
        return undefined;
    return locals;
}
function loadedTemplateLibraries(ctx) {
    const libraries = new Map(ctx.dependencyLibraries);
    if (ctx.nativeLibrary)
        libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
    libraries.set(ctx.libId, { id: ctx.libId, items: [], elements: ctx.elements, elementsByType: {} });
    return [...libraries.values()];
}
function boundVariableType(node, ctx) {
    while (node?.kind === 126 /* SyntaxKind.ParenthesizedExpression */ || node?.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
        node = node.expression;
    }
    const name = getIdentifierName(node);
    if (!name)
        return undefined;
    const localId = ctx.localVarByGalaxyName.get(name);
    const local = localId ? ctx.elements[localId] : undefined;
    if (local?.type === 'Variable')
        return String(local.variableType?.type ?? '').toLowerCase() || undefined;
    const global = ctx.globalVarByGalaxyName.get(name);
    if (!global)
        return undefined;
    const owner = global.library === ctx.libId
        ? { elements: ctx.elements, elementsByType: {} }
        : ctx.dependencyLibraries?.get(global.library);
    const variable = owner?.elements?.[global.id] ?? owner?.elementsByType?.Variable?.[global.id];
    return variable?.type === 'Variable' ? String(variable.variableType?.type ?? '').toLowerCase() || undefined : undefined;
}
/** Multi-statement templates without generated locals must also be considered
 * inside native if/loop roles. Top-level lowering already does this in the
 * structural pass, while nested roles arrive here. Without the same atomic
 * match, Begin/for/End is lowered as three unrelated actions and the middle
 * statement falls back to Custom Script. */
function loadedStatementSequenceTemplates(ctx) {
    const candidates = ctx.templateCandidates;
    if (!candidates)
        return [];
    let indexed = loadedStatementSequenceIndexes.get(candidates);
    if (indexed)
        return indexed;
    indexed = candidates.filter(template => !template.expression && template.nodes.length >= 2 &&
        ![...template.holes.values()].some(hole => hole.kind === 'auto' || hole.separator !== undefined && !hole.join));
    loadedStatementSequenceIndexes.set(candidates, indexed);
    return indexed;
}
function loadedTemplateParameterExpectedType(template, bindings, ref, ctx) {
    const ownerId = ref.library ?? template.definition.library ?? ctx.libId;
    const owner = ownerId === ctx.libId
        ? { elements: ctx.elements, elementsByType: {} }
        : ownerId === ctx.nativeLibrary?.id ? ctx.nativeLibrary : ctx.dependencyLibraries?.get(ownerId);
    const formal = (owner?.elements?.[ref.id] ?? owner?.elementsByType?.ParamDef?.[ref.id]);
    const kind = formal?.paramType?.type?.toLowerCase();
    if (kind === 'return')
        return ctx.returnType;
    if ((kind === 'sameas' || kind === 'sameasparent') && formal?.paramType?.typeElement) {
        const target = formal.paramType.typeElement;
        for (const [name, candidate] of template.parameters) {
            if (candidate.id !== target.id || (candidate.library ?? ownerId) !== (target.library ?? ownerId))
                continue;
            return boundVariableType(bindings.parameters.get(name), ctx);
        }
    }
    return undefined;
}
function loadedTemplateVariableBindingsCompatible(template, bindings, ctx) {
    // Only the variable on the left of the increment is the loop iterator.
    // Other `anyvariable` parameters may describe a value domain (for example a
    // game link) and need not share the host Galaxy spelling of that domain.
    const iteratorParameter = /#PARAM\(([^)]+)\)\s*\+=\s*#AUTOVAR\(/u.exec(template.definition.scriptCode ?? '')?.[1]?.trim();
    if (!iteratorParameter)
        return true;
    for (const [name, ref] of template.parameters) {
        if (name !== iteratorParameter)
            continue;
        const ownerId = ref.library ?? template.definition.library ?? ctx.libId;
        const owner = ownerId === ctx.libId
            ? { elements: ctx.elements, elementsByType: {} }
            : ownerId === ctx.nativeLibrary?.id
                ? ctx.nativeLibrary
                : ctx.dependencyLibraries?.get(ownerId);
        const formal = owner?.elements?.[ref.id] ?? owner?.elementsByType?.ParamDef?.[ref.id];
        if (formal?.paramType?.type !== 'anyvariable')
            continue;
        const required = String(formal.paramType.variableType ?? '').toLowerCase();
        const actual = boundVariableType(bindings.parameters.get(name), ctx);
        // A known mismatch is a proof that the superficially matching template
        // cannot represent this source. Leave it to the typed structural matcher.
        if (required && actual && required !== actual)
            return false;
    }
    return true;
}
/** Restore any loaded multi-statement #AUTOVAR template from its own ScriptCode.
 * This covers library-defined collection loops without naming a game action or ID. */
export function tryBuildLoadedAutoTemplateSequence(stmts, index, subFuncTypeRef, ctx) {
    // A loaded collection loop starts by assigning one of its auto variables, either
    // as a statement or, when the editor promoted the other inputs to const
    // declarations (Repeat), as the initializer of the `for` itself.
    const first = stmts[index];
    const firstTarget = first?.kind === 132 /* SyntaxKind.ForStatement */
        ? first.initializer?.kind === 124 /* SyntaxKind.BinaryExpression */ && first.initializer.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ ? first.initializer.left : undefined
        : getAssignSides(first)?.left;
    const firstName = getIdentifierName(firstTarget);
    if (!firstName || !extractAutoVarName(firstName))
        return undefined;
    const remaining = stmts.slice(index);
    const libraries = loadedTemplateLibraries(ctx);
    // Pick Each Player (`#AUTOVAR(var)`) and For Each Player (`#PARAM(var)`) expand to
    // the same Galaxy. A loop variable that is itself a private editor auto variable
    // belongs to the action, so the match owning the most bound autos wins; taking
    // the first match restored 88 Pick Each loops of Star Party v as For Each loops
    // over an extra local.
    let best;
    for (const template of loadedAutoSequenceTemplates(ctx)) {
        const matched = matchTemplatePrefix(template, remaining, ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined);
        if (!matched?.consumed || !bindPromotedAutoParameters(template, matched.bindings, ctx))
            continue;
        const nodes = remaining.slice(0, matched.consumed);
        if (!templateMakesProgress(nodes, matched.bindings) ||
            [...template.parameters.keys()].some(name => !matched.bindings.parameters.has(name) && !template.fixedParameters?.has(name)) ||
            !templateBindingMatches(template, nodes, matched.bindings, libraries, ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined) ||
            !loadedTemplateVariableBindingsCompatible(template, matched.bindings, ctx))
            continue;
        const privateLocals = privateGeneratedAutoLocals(nodes, matched.bindings, ctx, template.promotedAutos);
        if (!privateLocals)
            continue;
        if (!best || matched.bindings.autos.size > best.matched.bindings.autos.size)
            best = { template, matched, privateLocals };
    }
    if (best) {
        const { template, matched, privateLocals } = best;
        const claimedId = claimAutoCallId(matched.bindings.autos);
        const nested = {
            ...ctx,
            structuredActiveAutoNames: new Set([...(ctx.structuredActiveAutoNames ?? []), ...matched.bindings.autos.keys()]),
            structuredAncestorDefinitions: [...(ctx.structuredAncestorDefinitions ?? []), template.definition.name ?? ''],
            structuredAutoAccessors: templateAutoAccessors(template.definition.name ?? '', matched.bindings, libraries, ctx.structuredAutoAccessors),
        };
        const parameters = [...template.parameters].map(([name, ref]) => template.fixedParameters?.has(name)
            ? mkParamRef({ parameterDef: ref, preset: template.fixedParameters.get(name) }, nested)
            : exprToParamRef(matched.bindings.parameters.get(name), nested, ref, loadedTemplateParameterExpectedType(template, matched.bindings, ref, nested)));
        const subFunctions = [...template.roles].flatMap(([name, ref]) => convertStatementListToActionRefs(matched.bindings.blocks.get(name) ?? [], ref, nested));
        const ref = mkFCRef({ functionDef: fdRef(template.definition), parameters, subFunctions,
            ...(subFuncTypeRef ? { subFunctionType: subFuncTypeRef } : {}) }, nested, claimedId);
        const call = ctx.elements[ref.id];
        const generatedRoots = [...(call.parameters ?? []), ...(call.subFunctions ?? [])];
        // Unreachable elements built above are pruned with the rest of the pass.
        const autos = [...matched.bindings.autos.values()].map((node) => node.name);
        if (generatedScriptMentions(generatedRoots, iteratorSpellings(autos, ctx), ctx)) {
            releaseAutoCallId(claimedId);
            return undefined;
        }
        for (const local of privateLocals)
            removeCapturedLoopLocal(local, generatedRoots, ctx);
        return { ref, consumed: matched.consumed };
    }
    return undefined;
}
function tryBuildLoadedStatementTemplateSequence(stmts, index, subFuncTypeRef, ctx) {
    const remaining = stmts.slice(index);
    const libraries = loadedTemplateLibraries(ctx);
    for (const template of loadedStatementSequenceTemplates(ctx)) {
        const defaultReturn = ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined;
        const matched = matchTemplatePrefix(template, remaining, defaultReturn);
        if (!matched?.consumed)
            continue;
        const nodes = remaining.slice(0, matched.consumed);
        if (!templateMakesProgress(nodes, matched.bindings) ||
            [...template.parameters.keys()].some(name => !matched.bindings.parameters.has(name) && !template.fixedParameters?.has(name)) ||
            !templateBindingMatches(template, nodes, matched.bindings, libraries, defaultReturn) ||
            !loadedTemplateVariableBindingsCompatible(template, matched.bindings, ctx))
            continue;
        const nested = {
            ...ctx,
            structuredAncestorDefinitions: [...(ctx.structuredAncestorDefinitions ?? []), template.definition.name ?? ''],
        };
        const parameters = [...template.parameters].map(([name, ref]) => template.fixedParameters?.has(name)
            ? mkParamRef({ parameterDef: ref, preset: template.fixedParameters.get(name) }, nested)
            : exprToParamRef(matched.bindings.parameters.get(name), nested, ref, loadedTemplateParameterExpectedType(template, matched.bindings, ref, nested)));
        const subFunctions = [...template.roles].flatMap(([name, ref]) => convertStatementListToActionRefs(matched.bindings.blocks.get(name) ?? [], ref, nested));
        return {
            ref: mkFCRef({
                functionDef: fdRef(template.definition),
                parameters,
                subFunctions,
                ...(subFuncTypeRef ? { subFunctionType: subFuncTypeRef } : {}),
            }, nested),
            consumed: matched.consumed,
        };
    }
    return undefined;
}
export function convertStatementListToActionRefs(stmts, subFuncTypeRef, ctx) {
    const out = [];
    // The editor writes a Comment action as `// text` where it stands; the parser keeps comments aside.
    const comments = commentActionsBetween(stmts, ctx, subFuncTypeRef);
    let nextComment = 0;
    const emitCommentsUpTo = (index) => {
        while (nextComment < comments.length && comments[nextComment].before <= index) {
            const ref = comments[nextComment++].take();
            if (ref)
                out.push(ref);
        }
    };
    for (let i = 0; i < stmts.length; i++) {
        emitCommentsUpTo(i);
        // A lone `;` does nothing and the GUI has no element for it; it was a Custom Script action each
        // (EditorTest.SC2Map: 161, after the if/else in old Pick Each Player loops).
        if (stmts[i]?.kind === 139 /* SyntaxKind.EmptyStatement */)
            continue;
        const deprecatedForEachPlayer = tryBuildDeprecatedForEachPlayerFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (deprecatedForEachPlayer) {
            out.push(deprecatedForEachPlayer.ref);
            i += deprecatedForEachPlayer.consumed - 1;
            continue;
        }
        const loadedAutoTemplate = tryBuildLoadedAutoTemplateSequence(stmts, i, subFuncTypeRef, ctx);
        if (loadedAutoTemplate) {
            out.push(loadedAutoTemplate.ref);
            i += loadedAutoTemplate.consumed - 1;
            continue;
        }
        const waitMax = tryBuildWaitForConditionWithMaxFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (waitMax) {
            out.push(waitMax.ref);
            i += waitMax.consumed - 1;
            continue;
        }
        const waitCond = tryBuildWaitForConditionFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (waitCond) {
            out.push(waitCond.ref);
            i += waitCond.consumed - 1;
            continue;
        }
        const actionQueueAdd = tryBuildActionQueueAddFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (actionQueueAdd) {
            out.push(actionQueueAdd.ref);
            i += actionQueueAdd.consumed - 1;
            continue;
        }
        const repeatForever = tryBuildRepeatForeverFromStmt(stmts[i], subFuncTypeRef, ctx);
        if (repeatForever) {
            out.push(repeatForever);
            continue;
        }
        const repeatRef = tryBuildRepeatFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (repeatRef) {
            out.push(repeatRef.ref);
            i += repeatRef.consumed - 1;
            continue;
        }
        const forEachInteger = tryBuildForEachIntegerFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (forEachInteger) {
            out.push(forEachInteger.ref);
            i += forEachInteger.consumed - 1;
            continue;
        }
        // Consume auto-loop helpers
        const s = stmts[i];
        if (s?.kind === 138 /* SyntaxKind.ExpressionStatement */) {
            const expr = s.expression;
            if (expr?.kind === 124 /* SyntaxKind.BinaryExpression */ && expr.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */) {
                const leftName = getIdentifierName(expr.left);
                if (leftName) {
                    const auto = extractAutoVarName(leftName);
                    if (auto?.suffix === 'var') {
                        const nextStmt = stmts[i + 1];
                        if (forStmtUsesCounterVar(nextStmt, leftName)) {
                            ctx.pendingAutoInits.set(leftName, expr.right);
                            continue;
                        }
                    }
                    // `auto*_ae` / `auto*_ai` are loop scaffolding generated by the editor.
                    // When an upcoming for-statement references them they MUST be consumed
                    // here — falling through would also convert the assignment into a
                    // SetVariable action on a non-existent variable (broken 'Unknown'
                    // param the editor strips, leaving the loop without its bound).
                    if (auto?.suffix === 'ae' && upcomingForStmtUsesName(stmts, i, leftName)) {
                        ctx.pendingAutoEnds.set(leftName, expr.right);
                        continue;
                    }
                    if (auto?.suffix === 'ai' && upcomingForStmtUsesName(stmts, i, leftName)) {
                        ctx.pendingAutoIncrements.set(leftName, expr.right);
                        continue;
                    }
                }
            }
        }
        const switchRef = tryBuildSwitchFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (switchRef) {
            out.push(switchRef.ref);
            i += switchRef.consumed - 1;
            continue;
        }
        const legacyPickEachPlayer = tryBuildLegacyPickEachPlayerFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (legacyPickEachPlayer) {
            out.push(legacyPickEachPlayer.ref);
            i += legacyPickEachPlayer.consumed - 1;
            continue;
        }
        const pickEachPlayer = tryBuildPickEachPlayerFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (pickEachPlayer) {
            out.push(pickEachPlayer.ref);
            i += pickEachPlayer.consumed - 1;
            continue;
        }
        const pickEachUnit = tryBuildPickEachUnitFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (pickEachUnit) {
            out.push(pickEachUnit.ref);
            i += pickEachUnit.consumed - 1;
            continue;
        }
        const catalogEntry = tryBuildForEachCatalogEntryFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (catalogEntry) {
            out.push(catalogEntry.ref);
            i += catalogEntry.consumed - 1;
            continue;
        }
        const userDataInstance = tryBuildForEachUserDataInstanceFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (userDataInstance) {
            out.push(userDataInstance.ref);
            i += userDataInstance.consumed - 1;
            continue;
        }
        const uiFrame = tryBuildForEachUIFrameFromStmtSequence(stmts, i, subFuncTypeRef, ctx);
        if (uiFrame) {
            out.push(uiFrame.ref);
            i += uiFrame.consumed - 1;
            continue;
        }
        // Loaded ScriptCode contracts can span several statements inside any
        // nested action role, not only at a function's top level. Match the whole
        // sequence before an individual for-statement can become Custom Script.
        const loadedStatementTemplate = tryBuildLoadedStatementTemplateSequence(stmts, i, subFuncTypeRef, ctx);
        if (loadedStatementTemplate) {
            out.push(loadedStatementTemplate.ref);
            i += loadedStatementTemplate.consumed - 1;
            continue;
        }
        if (stmts[i]?.kind === 132 /* SyntaxKind.ForStatement */) {
            const ref = buildPickEachIntegerFromForStmt(stmts[i], subFuncTypeRef, ctx, stmts, i);
            // NEVER drop a loop silently — preserve as custom script when no
            // structured conversion matched.
            out.push(ref ?? buildCustomScriptActionFCRef(stmts[i], subFuncTypeRef, ctx));
            continue;
        }
        const ref = stmtToActionFCRef(stmts[i], subFuncTypeRef, ctx);
        if (ref) {
            out.push(ref);
            continue;
        }
        // Last resort: wrap unrecognized statement in a customscriptaction block.
        out.push(buildCustomScriptActionFCRef(stmts[i], subFuncTypeRef, ctx));
    }
    emitCommentsUpTo(stmts.length);
    return out;
}
/**
 * The comments standing among a list of statements, as Comment actions, each with the index of the
 * statement it precedes (`stmts.length` after the last). A comment belongs to the list when it sits
 * at the statements' indentation (a deeper one is inside a nested block) and the next statement of
 * the block is in the list. Consecutive comment lines are one Comment, as the editor writes a
 * multi-line one; the banners the generator writes (`// Implementation` …) are not comments.
 */
/** Source offsets of the comments already written as actions, per converted library. */
const takenComments = new WeakMap();
export function commentActionsBetween(stmts, ctx, role) {
    const text = ctx.sourceText;
    const block = stmts[0]?.parent;
    if (typeof text !== 'string' || block?.kind !== 128 /* SyntaxKind.Block */ || typeof block.pos !== 'number')
        return [];
    const siblings = Array.from(block.statements ?? []);
    const lineStart = (offset) => text.lastIndexOf('\n', offset - 1) + 1;
    const indentOf = (offset) => /^[ \t]*/u.exec(text.slice(lineStart(offset), offset))?.[0] ?? '';
    const indent = indentOf(stmts[0].pos);
    if (text.slice(lineStart(stmts[0].pos), stmts[0].pos) !== indent)
        return [];
    const lastInList = stmts[stmts.length - 1] === siblings[siblings.length - 1];
    const found = [];
    const pattern = /^([ \t]*)\/\/ ?(.*?)[ \t]*\r?$/gmu;
    const body = text.slice(block.pos, block.end);
    let lineNumber = 0, lastIndex = 0;
    for (const match of body.matchAll(pattern)) {
        lineNumber += (body.slice(lastIndex, match.index).match(/\n/gu) ?? []).length;
        lastIndex = match.index;
        if (match[1] !== indent)
            continue;
        const comment = match[2];
        if (isGeneratedBodyBanner(comment))
            continue;
        const offset = block.pos + match.index + match[1].length;
        const next = siblings.find(statement => statement.pos > offset);
        const before = next === undefined ? (lastInList ? stmts.length : -1) : stmts.indexOf(next);
        if (before < 0)
            continue;
        if (commentTemplateMatches(comment, ctx)) {
            found.push({ before, lines: [comment], line: lineNumber, offset, call: comment });
            continue;
        }
        const previous = found[found.length - 1];
        if (previous && !previous.call && previous.before === before && previous.line + 1 === lineNumber) {
            previous.lines.push(comment);
            previous.line = lineNumber;
        }
        else
            found.push({ before, lines: [comment], line: lineNumber, offset });
    }
    let taken = takenComments.get(ctx.elements);
    if (!taken)
        takenComments.set(ctx.elements, taken = new Set());
    const once = taken;
    return found.filter(item => item.call !== undefined || item.lines.some(line => line !== '')).map(item => ({ before: item.before, take: () => {
            if (once.has(item.offset))
                return undefined;
            once.add(item.offset);
            const call = item.call === undefined ? undefined : commentTemplateCall(item.call, ctx, role);
            if (call)
                return call;
            const id = generateId();
            ctx.elements[id] = { type: 'Comment', id, library: ctx.libId, comment: item.lines.join('\n'),
                ...(role ? { subFunctionType: { ...role, type: 'SubFuncType' } } : {}) };
            return { type: 'Comment', library: ctx.libId, id };
        } }));
}
const commentTemplateCache = new WeakMap();
/**
 * Actions whose ScriptCode is one line comment, such as NativeLib's Transmission Comment (Sound):
 * `// Transmission - #PARAM(sound)`. The editor writes that line for the action, so it is read back as the
 * action, not as an authored Comment (TTosh1 holds 21 of them and no such Comment).
 */
function commentTemplates(ctx) {
    const key = ctx.nativeLibrary ?? ctx;
    const cached = commentTemplateCache.get(key);
    if (cached)
        return cached;
    const templates = [];
    const libraries = [...(ctx.nativeLibrary ? [ctx.nativeLibrary] : []), ...(ctx.dependencyLibraries?.values() ?? [])];
    for (const library of libraries) {
        for (const element of Object.values(library.elements ?? {})) {
            if (element.type !== 'FunctionDef' || !element.isFuncAction)
                continue;
            const code = element.scriptCode?.trim();
            if (!code || !/^\/\/[^\r\n]*$/u.test(code) || /#(?!PARAM\()[A-Z]+\(/u.test(code))
                continue;
            const parts = code.replace(/^\/\/ ?/u, '').split(/#PARAM\((\w+)\)/u);
            if (parts.length < 3)
                continue;
            const names = new Map();
            (element.parameters ?? []).forEach((ref, index) => {
                const definition = lookupElement([library], { ...ref, type: 'ParamDef' }, library.id);
                if (definition?.name)
                    names.set(definition.name, index);
            });
            const order = [];
            let source = '^';
            parts.forEach((part, index) => {
                if (index % 2 === 0) {
                    source += part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
                    return;
                }
                const parameter = names.get(part);
                order.push(parameter ?? -1);
                source += '(.+?)';
            });
            // Every parameter must be written in the line once, or the call cannot be rebuilt from it.
            const count = element.parameters?.length ?? 0;
            if (order.includes(-1) || order.length !== count || new Set(order).size !== count)
                continue;
            templates.push({ definition: element, pattern: new RegExp(`${source}$`, 'u'), parameters: order.map(index => element.parameters?.[index]) });
        }
    }
    commentTemplateCache.set(key, templates);
    return templates;
}
function commentTemplateMatches(comment, ctx) {
    return commentTemplates(ctx).some(template => template.pattern.test(comment));
}
function commentTemplateCall(comment, ctx, role) {
    const matches = commentTemplates(ctx).flatMap(template => {
        const match = template.pattern.exec(comment);
        if (!match)
            return [];
        const values = match.slice(1).map(text => parseTemplateFragment(text, true)?.[0]);
        return values.every(Boolean) ? [{ template, values }] : [];
    });
    // Transmission Comment (Sound) and (Conversation) share one line; a SoundLink(…) value names the sound one.
    const soundLink = (value) => value?.kind === 121 /* SyntaxKind.CallExpression */ && value.expression?.name === 'SoundLink';
    const typeOf = (ref) => ref ? resolveParamDefByRef(ref, ctx)?.paramType?.type?.toLowerCase() : undefined;
    const chosen = matches.find(({ template, values }) => values.every((value, index) => soundLink(value) === (typeOf(template.parameters[index]) === 'soundlink')))
        ?? (matches.length === 1 ? matches[0] : undefined);
    if (!chosen)
        return undefined;
    const { template, values } = chosen;
    const parameters = (template.definition.parameters ?? []).map(ref => exprToParamRef(values[template.parameters.indexOf(ref)], ctx, ref));
    return mkFCRef({
        functionDef: fdRef(template.definition),
        parameters,
        ...(role ? { subFunctionType: { library: role.library ?? ctx.libId, id: role.id, type: 'SubFuncType' } } : {}),
    }, ctx);
}
// ---------------------------------------------------------------------------
// Guard detection helpers (needed by g2t-trigger-body.ts too, keep exported)
// ---------------------------------------------------------------------------
export function isTestCondsGuard(expression, _thenStatement) {
    return expression?.kind === 113 /* SyntaxKind.Identifier */ && expression.name === 'testConds';
}
export function isRunActionsGuard(expression) {
    return (expression?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
        expression.operator?.kind === 32 /* SyntaxKind.ExclamationToken */ &&
        expression.operand?.kind === 113 /* SyntaxKind.Identifier */ &&
        expression.operand.name === 'runActions');
}
//# sourceMappingURL=g2t-actions.js.map