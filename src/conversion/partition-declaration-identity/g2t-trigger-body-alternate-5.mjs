import { recoverClosedConditionFunction } from '../exact-function-signatures/closed-condition-function.ordered-inits.mjs';
import { bindTriggerPhaseParameters } from '../exact-function-signatures/bound-trigger-phase-parameters.mjs';
import { assertTriggerGuardPhases } from '../exact-function-signatures/trigger-guard-phases.mjs';
import { triggerRejectionGuards } from '../exact-function-signatures/trigger-rejection-guards.mjs';
import { localInitializerDependencyOrder } from '../exact-function-signatures/local-initializer-phased-order.mjs';
import { recoveredEditorLocalIdentity } from '../../model/editor-local-symbols.mjs';
import { stringInitializerCarrier } from '../exact-function-signatures/string-initializer-carrier.canonical-scalar.mjs';
import { importedLocalScope } from '../exact-native-export/imported-local-scope.mjs';
import { explicitIntegerZeroParam } from '../exact-native-export/explicit-zero-initializer-alternate-3.mjs';
import { localizedTextInitializerSequence } from '../../sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/localized-text-prefix.js';
import { mkParamRef } from '../exact-native-export/g2t-core.mjs';
import { legacyLocalArrayFill } from '../exact-native-export/legacy-local-array-fill.mjs';
import {
  structuredStatements,
  structuredNode,
  structuredParam,
  declareStructuredLocal,
} from './g2t-structured-alternate-2.mjs';
import { startupFunctionName } from '../../sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {
  generateId,
  extractLocalVarName,
  extractAutoVarName,
  attachDefaultParam,
  triggerParamTypeFromGalaxyTypeName,
  getTypeName,
  getBlockStatements,
  forStmtUsesCounterVar,
  isLoopCounterDeclaration,
  unwrapArrayType,
  parseArraySizeExpr,
  exprContainsIdentifier,
  getAssignSides,
  getIdentifierName,
  readSignedIntLiteral,
  structureMemberKey,
  unwrapParens,
  upcomingForStmtUsesName,
} from '../exact-native-export/g2t-core.mjs';
import {
  exprToParamRef,
  collectConditionRefs,
  exprContainsUnresolvedCall,
} from '../qualified-macro-binding/g2t-call-alternate-3.mjs';
import {
  stmtToActionFCRef,
  buildPickEachIntegerFromForStmt,
  tryBuildWaitForConditionWithMaxFromStmtSequence,
  tryBuildWaitForConditionFromStmtSequence,
  tryBuildActionQueueAddFromStmtSequence,
  tryBuildRepeatForeverFromStmt,
  tryBuildRepeatFromStmtSequence,
  tryBuildForEachIntegerFromStmtSequence,
  tryBuildSwitchFromStmtSequence,
  tryBuildLegacyPickEachPlayerFromStmtSequence,
  tryBuildPickEachPlayerFromStmtSequence,
  tryBuildPickEachUnitFromStmtSequence,
  buildCustomScriptActionFCRef,
  isTestCondsGuard,
  isRunActionsGuard,
} from '../qualified-macro-binding/g2t-actions-alternate-2.mjs';
// ---------------------------------------------------------------------------
// Local variable type helper
// ---------------------------------------------------------------------------
function makeLocalVar(varId, libId, name, typeNode, globalVarByGalaxyName, ctx) {
  const { baseType, sizes } = unwrapArrayType(typeNode);
  const galaxyTypeName = getTypeName(baseType);
  const varJson = {
    type: 'Variable',
    id: varId,
    library: libId,
    name,
    variableType: triggerParamTypeFromGalaxyTypeName(galaxyTypeName, ctx),
    isArray: sizes.length > 0 || undefined,
  };
  if (sizes.length > 0) {
    varJson.arraySizes = sizes.map((sizeExpr, dim) => ({
      dim,
      ...parseArraySizeExpr(sizeExpr, globalVarByGalaxyName, ctx.constants),
    }));
  }
  return varJson;
}
// ---------------------------------------------------------------------------
// Guard detection helpers
// ---------------------------------------------------------------------------
export { isTestCondsGuard, isRunActionsGuard };
/** The guards of the editor's conditions block, `if (testConds) { if (!(c)) { return false; } ... }`,
 *  or undefined when `statement` is anything else. */
export function triggerConditionGuards(statement, phaseGuards) {
  const matchesConditions = phaseGuards?.isTestCondsGuard ?? isTestCondsGuard;
  if (
    statement?.kind !== 129 ||
    statement.elseStatement ||
    !matchesConditions(unwrapParens(statement.expression), statement.thenStatement)
  )
    return undefined;
  const block = statement.thenStatement;
  if (block?.kind === 128 && block.statements.length === 0) return [];
  const guards = triggerRejectionGuards(block);
  if (!guards)
    throw new Error(
      'Trigger condition control flow is not representable without changing evaluation order',
    );
  return guards;
}
export function extractConditionsFromGuard(thenBlock, ctx) {
  // Pattern: if (testConds) { if (!(cond)) { return false; } }
  const out = [];
  for (const stmt of thenBlock.statements ?? []) {
    if (stmt.kind === 129 /* SyntaxKind.IfStatement */) {
      const innerIf = stmt;
      const cond = innerIf.expression;
      // The guard condition is !cond → we want cond
      if (
        cond?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
        cond.operator?.kind === 32 /* SyntaxKind.ExclamationToken */
      ) {
        const innerCond = cond.operand;
        if (exprContainsUnresolvedCall(innerCond, ctx)) continue;
        for (const ref of collectConditionRefs(innerCond, undefined, ctx)) out.push(ref);
      }
    }
  }
  return out;
}
// ---------------------------------------------------------------------------
// User function body conversion
// ---------------------------------------------------------------------------
export function convertUserFunctionBody(
  funcDecl,
  funcDef,
  libId,
  elements,
  funcNameToFuncDef,
  roleToSubFuncType,
  globalVarByGalaxyName,
  galaxyConstToPreset,
  structureByGalaxyTypeName,
  structureMemberByKey,
  nativeLibrary,
  externalFuncParamTypes,
  crossLibFuncDefs,
  sourceText,
  triggerByGalaxyName,
  dependencyLibraries,
  constants,
) {
  const actions = [];
  const localVariables = [];
  const localVarByGalaxyName = new Map();
  const paramRefByGalaxyName = new Map();
  const paramDefs = funcDef.parameters ?? [];
  const galaxyParams = Array.from(funcDecl.parameters ?? []);
  for (let i = 0; i < galaxyParams.length; i++) {
    const galaxyParamName = galaxyParams[i]?.name?.name ?? '';
    const paramDefRef = paramDefs[i];
    if (paramDefRef && galaxyParamName) {
      paramRefByGalaxyName.set(galaxyParamName, paramDefRef);
    }
  }
  const pendingAutoInits = new Map();
  const pendingAutoEnds = new Map();
  const pendingAutoIncrements = new Map();
  const ctx = {
    libId,
    elements,
    nativeLibrary,
    dependencyLibraries,
    constants: constants?.scope([
      ...(funcDecl.parameters ?? []),
      ...(funcDecl.body?.statements ?? []),
    ]),
    funcNameToFuncDef,
    roleToSubFuncType,
    localVarByGalaxyName,
    globalVarByGalaxyName,
    pendingAutoInits,
    pendingAutoEnds,
    pendingAutoIncrements,
    galaxyConstToPreset,
    structureByGalaxyTypeName,
    structureMemberByKey,
    isUserFunction: true,
    paramRefByGalaxyName,
    externalFuncParamTypes,
    crossLibFuncDefs,
    sourceText,
    triggerByGalaxyName,
  };
  const body = funcDecl.body;
  if (!body) return { actions, localVariables };
  // A loaded Galaxy-only record cannot be encoded as <Type Value="gs_*">:
  // Editor emits a blank type. Retain one complete lexical body instead.
  const importedScope = importedLocalScope(body, ctx);
  if (importedScope) {
    actions.push(buildCustomScriptActionFCRef(body, undefined, ctx, true));
    return { actions, localVariables };
  }
  ctx.returnType = getTypeName(funcDecl.type) || 'void';
  ctx.structuredLocals = localVariables;
  ctx.structuredTemplates = new Map();
  const statements = Array.from(body.statements ?? []);
  ctx.structuredFunctionStatements = statements;
  // Like a trigger, a generated function assigns initial values before its actions.
  // As actions, an array fill became For Each Integer over `lv_d[IntLoopCurrent()]`
  // with a stray `init_i` local.
  const start = generatedImplementationStart(body, statements, sourceText);
  const prefix = start === undefined ? undefined : localInitialization(statements, start);
  if (prefix) {
    for (const declaration of prefix.declarations) declareStructuredLocal(declaration, ctx);
    for (const initial of prefix.initializers) {
      const variable = elements[localVarByGalaxyName.get(initial.name)];
      variable.initialValue =
        explicitIntegerZeroParam(initial.expression, variable, ctx, ctx.constants) ??
        structuredParam(
          stringInitializerCarrier(initial.expression, variable),
          ctx,
          undefined,
          variable.variableType?.type,
        );
    }
  }
  actions.push(...structuredStatements(statements.slice(prefix?.length ?? 0), ctx));
  return { actions, localVariables };
}
export function isInitVariablesCompletedGuard(stmt, libId) {
  if (stmt?.kind !== 129 /* SyntaxKind.IfStatement */) return false;
  if (stmt.expression?.kind !== 113 /* SyntaxKind.Identifier */) return false;
  if (stmt.expression.name !== `${startupFunctionName(libId, 'InitVariables')}_completed`)
    return false;
  const thenStmts = getBlockStatements(stmt.thenStatement);
  return thenStmts.length === 1 && thenStmts[0]?.kind === 137 /* SyntaxKind.ReturnStatement */;
}
export function isInitVariablesCompletedSet(stmt, libId) {
  if (stmt?.kind !== 138 /* SyntaxKind.ExpressionStatement */) return false;
  const expr = stmt.expression;
  if (expr?.kind !== 124 /* SyntaxKind.BinaryExpression */) return false;
  if (expr.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */) return false;
  if (expr.left?.kind !== 113 /* SyntaxKind.Identifier */) return false;
  if (expr.left.name !== `${startupFunctionName(libId, 'InitVariables')}_completed`) return false;
  const right = expr.right;
  return (
    right?.kind === 67 /* SyntaxKind.TrueKeyword */ ||
    (right?.kind === 113 /* SyntaxKind.Identifier */ && right.name === 'true')
  );
}
/**
 * Matches the array-initialization loop chains that appear in InitVariables
 * and returns the assignment target/value, the loop counters (outer→inner),
 * and how many top-level statements the chain consumes.
 *
 * Editor shape (counter initialized inside the for):
 *   for (init_i = 0; init_i <= 16; init_i += 1) {
 *     gv_arr[init_i] = <expr>;             // or a nested for for 2-D arrays
 *   }
 *
 * T2G shape (auto counter primed by a preceding assignment):
 *   autoX_var = 0;
 *   for ( ; autoX_var <= autoX_ae; autoX_var += 1 ) {
 *     gv_arr[autoX_var] = <expr>;
 *   }
 */
function matchInitLoopHeader(forStmt, ctx, presetCounter) {
  if (!forStmt || forStmt.kind !== 132 /* SyntaxKind.ForStatement */) return undefined;
  let counterName = presetCounter;
  if (forStmt.initializer != null) {
    if (presetCounter) return undefined; // both preceding assign and initializer — not our shape
    const init = forStmt.initializer;
    if (init?.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
    if (init.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */) return undefined;
    counterName = getIdentifierName(init.left);
    if (!counterName) return undefined;
    if (readSignedIntLiteral(init.right) !== 0) return undefined;
  }
  if (!counterName) return undefined;
  const cond = unwrapParens(forStmt.condition);
  if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
  if (cond.operatorToken?.kind !== 15 /* SyntaxKind.LessThanEqualsToken */) return undefined;
  if (getIdentifierName(cond.left) !== counterName) return undefined;
  const endName = getIdentifierName(cond.right);
  let literalBound;
  let boundVarName;
  if (endName) {
    if (extractAutoVarName(endName)?.suffix === 'ae') {
      // Captured const auto*_ae — fold only when its value is an int literal
      // or a global-variable identifier (matched against arraySizes later).
      const aeExpr = ctx.pendingAutoEnds.get(endName);
      if (!aeExpr) return undefined;
      literalBound = readSignedIntLiteral(aeExpr);
      if (literalBound === undefined) {
        const aeId = getIdentifierName(aeExpr);
        if (!aeId || !ctx.globalVarByGalaxyName.has(aeId)) return undefined;
        boundVarName = aeId;
      }
    } else if (ctx.globalVarByGalaxyName.has(endName)) {
      // Editor-style symbolic bound: a (const) global, e.g.
      //   for (init_i = 0; init_i <= lib1_gv_panels; ...)
      boundVarName = endName;
    } else {
      return undefined;
    }
  } else {
    literalBound = readSignedIntLiteral(cond.right);
    if (literalBound === undefined) return undefined;
  }
  const incr = forStmt.incrementor;
  if (!incr || incr.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
  if (incr.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */) return undefined;
  if (getIdentifierName(incr.left) !== counterName) return undefined;
  if (readSignedIntLiteral(incr.right) !== 1) return undefined;
  return { counterName, literalBound, boundVarName };
}
function matchArrayInitChain(forStmt, ctx, counters, bounds, presetCounter) {
  const header = matchInitLoopHeader(forStmt, ctx, presetCounter);
  if (!header) return undefined;
  counters.push(header.counterName);
  bounds.push(header.literalBound ?? header.boundVarName);
  const body = getBlockStatements(forStmt.statement);
  if (body.length === 1 && body[0]?.kind === 138 /* SyntaxKind.ExpressionStatement */) {
    const inner = getAssignSides(body[0]);
    if (!inner) return undefined;
    return { targetExpr: inner.left, valueExpr: inner.right };
  }
  // Nested editor-style loop (counter initialized inside the for)
  if (body.length === 1 && body[0]?.kind === 132 /* SyntaxKind.ForStatement */) {
    return matchArrayInitChain(body[0], ctx, counters, bounds);
  }
  // Nested T2G-style pair: counter-prime assignment + for
  if (body.length === 2 && body[1]?.kind === 132 /* SyntaxKind.ForStatement */) {
    const primed = primeCounterName(body[0]);
    if (!primed) return undefined;
    return matchArrayInitChain(body[1], ctx, counters, bounds, primed);
  }
  return undefined;
}
/** Matches `autoX_var = 0;` (or any `c = 0;`) and returns the counter name. */
function primeCounterName(assignStmt) {
  const assign = getAssignSides(assignStmt);
  if (!assign) return undefined;
  const name = getIdentifierName(assign.left);
  if (!name) return undefined;
  if (readSignedIntLiteral(assign.right) !== 0) return undefined;
  return name;
}
function collectElementAccessIndices(expr) {
  const indices = [];
  let base = expr;
  while (base?.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
    indices.unshift(getIdentifierName(base.argumentExpression) ?? '');
    base = base.expression;
  }
  return { base, indices };
}
function boundsCoverArraySizes(bounds, arraySizes, offset, ctx) {
  if (!arraySizes || offset + arraySizes.length > bounds.length) return false;
  for (let k = 0; k < arraySizes.length; k++) {
    const b = bounds[offset + k];
    if (b === undefined) return false;
    if (typeof b === 'number') {
      const declared = arraySizes[k]?.value !== undefined ? Number(arraySizes[k].value) : undefined;
      if (declared === undefined || b !== declared) return false;
    } else {
      const sizeVar = arraySizes[k]?.variable;
      const boundRef = ctx.globalVarByGalaxyName.get(b);
      if (!sizeVar?.id || !boundRef || boundRef.id !== sizeVar.id) return false;
    }
  }
  return true;
}
function tryFoldStructMemberInitIntoInitialValue(
  targetExpr,
  valueExpr,
  counters,
  bounds,
  ctx,
  globalVarByGalaxyName,
  elements,
  libId,
) {
  const trailing = collectElementAccessIndices(targetExpr);
  if (trailing.base?.kind !== 120 /* SyntaxKind.PropertyAccessExpression */) return false;
  const memberName = trailing.base.name?.name;
  if (!memberName) return false;
  const baseAccess = collectElementAccessIndices(trailing.base.expression);
  const baseName = getIdentifierName(baseAccess.base);
  if (!baseName) return false;
  const indexNames = [...baseAccess.indices, ...trailing.indices];
  if (indexNames.length !== counters.length) return false;
  if (!indexNames.every((n, k) => n === counters[k])) return false;
  const baseRef = globalVarByGalaxyName.get(baseName);
  if (!baseRef || baseRef.library !== libId) return false;
  const baseVar = elements[baseRef.id];
  const structureRef = baseVar?.variableType?.typeElement;
  if (!baseVar || baseVar.type !== 'Variable' || !structureRef?.id) return false;
  const memberRef = ctx.structureMemberByKey?.get(structureMemberKey(structureRef.id, memberName));
  if (!memberRef || memberRef.library !== libId) return false;
  const memberVar = elements[memberRef.id];
  if (!memberVar || memberVar.type !== 'Variable') return false;
  const baseArraySizes = baseVar.arraySizes;
  const memberArraySizes = memberVar.arraySizes;
  if (!boundsCoverArraySizes(bounds, baseArraySizes, 0, ctx)) return false;
  if (trailing.indices.length > 0) {
    if (!boundsCoverArraySizes(bounds, memberArraySizes, baseAccess.indices.length, ctx))
      return false;
  } else if (memberArraySizes?.length) {
    return false;
  }
  for (const c of counters) {
    if (exprContainsIdentifier(valueExpr, c)) return false;
  }
  const newInitRef = exprToParamRef(
    stringInitializerCarrier(valueExpr, memberVar),
    ctx,
    undefined,
    memberVar.variableType?.type,
  );
  // Do not eagerly delete the previous value. Template reconstruction can
  // legitimately share that Param with another generated call. The final
  // reachability pass removes it if no retained element owns it.
  memberVar.initialValue = newInitRef;
  return true;
}
function tryFoldStructMemberInitBlock(
  stmts,
  counters,
  bounds,
  ctx,
  globalVarByGalaxyName,
  elements,
  libId,
) {
  let folded = 0;
  for (const stmt of stmts) {
    if (stmt?.kind === 138 /* SyntaxKind.ExpressionStatement */) {
      const sides = getAssignSides(stmt);
      if (!sides) return false;
      if (
        !tryFoldStructMemberInitIntoInitialValue(
          sides.left,
          sides.right,
          counters,
          bounds,
          ctx,
          globalVarByGalaxyName,
          elements,
          libId,
        )
      ) {
        return false;
      }
      folded++;
      continue;
    }
    if (stmt?.kind === 132 /* SyntaxKind.ForStatement */) {
      const header = matchInitLoopHeader(stmt, ctx);
      if (!header) return false;
      counters.push(header.counterName);
      bounds.push(header.literalBound ?? header.boundVarName);
      const ok = tryFoldStructMemberInitBlock(
        getBlockStatements(stmt.statement),
        counters,
        bounds,
        ctx,
        globalVarByGalaxyName,
        elements,
        libId,
      );
      counters.pop();
      bounds.pop();
      if (!ok) return false;
      folded++;
      continue;
    }
    return false;
  }
  return folded > 0;
}
function tryFoldStructMemberInitLoopIntoInitialValue(
  stmts,
  index,
  ctx,
  globalVarByGalaxyName,
  elements,
  libId,
) {
  const stmt = stmts[index];
  if (stmt?.kind !== 132 /* SyntaxKind.ForStatement */) return undefined;
  const header = matchInitLoopHeader(stmt, ctx);
  if (!header) return undefined;
  const counters = [header.counterName];
  const bounds = [header.literalBound ?? header.boundVarName];
  const ok = tryFoldStructMemberInitBlock(
    getBlockStatements(stmt.statement),
    counters,
    bounds,
    ctx,
    globalVarByGalaxyName,
    elements,
    libId,
  );
  return ok ? { consumed: 1 } : undefined;
}
/**
 * Folds an array init loop into Variable.initialValue and returns the consumed
 * statement count. The editor regenerates these loops in InitVariables from
 * the initial value itself — a synthetic __InitVariablesRaw holder must NOT
 * exist for them.
 */
function tryFoldGlobalArrayInitIntoInitialValue(
  stmts,
  index,
  ctx,
  globalVarByGalaxyName,
  elements,
  libId,
) {
  const s0 = stmts[index];
  let matched;
  let consumed = 0;
  const counters = [];
  const bounds = [];
  if (s0?.kind === 132 /* SyntaxKind.ForStatement */) {
    matched = matchArrayInitChain(s0, ctx, counters, bounds);
    consumed = 1;
  } else if (
    index + 1 < stmts.length &&
    stmts[index + 1]?.kind === 132 /* SyntaxKind.ForStatement */
  ) {
    const primed = primeCounterName(s0);
    if (primed) {
      matched = matchArrayInitChain(stmts[index + 1], ctx, counters, bounds, primed);
      consumed = 2;
    }
  }
  if (!matched) return undefined;
  if (
    tryFoldStructMemberInitIntoInitialValue(
      matched.targetExpr,
      matched.valueExpr,
      counters,
      bounds,
      ctx,
      globalVarByGalaxyName,
      elements,
      libId,
    )
  ) {
    return { consumed };
  }
  // Target must be gv[c1][c2]... over exactly the chain counters, in order.
  let t = matched.targetExpr;
  const indexNames = [];
  while (t?.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
    indexNames.unshift(getIdentifierName(t.argumentExpression) ?? '');
    t = t.expression;
  }
  const gvName = getIdentifierName(t);
  if (!gvName) return undefined;
  if (indexNames.length !== counters.length) return undefined;
  if (!indexNames.every((n, k) => n === counters[k])) return undefined;
  const varRef = globalVarByGalaxyName.get(gvName);
  if (!varRef || varRef.library !== libId) return undefined;
  const variable = elements[varRef.id];
  if (!variable || variable.type !== 'Variable' || !variable.isArray) return undefined;
  // Each loop bound must cover the full declared dimension — a partial init
  // (bound < size) is real logic and must stay as actions, not initialValue.
  const arraySizes = variable.arraySizes;
  if (!arraySizes || arraySizes.length !== bounds.length) return undefined;
  for (let k = 0; k < bounds.length; k++) {
    const b = bounds[k];
    if (b === undefined) return undefined;
    if (typeof b === 'number') {
      const declared = arraySizes[k]?.value !== undefined ? Number(arraySizes[k].value) : undefined;
      if (declared === undefined || b !== declared) return undefined;
    } else {
      // Symbolic bound: the bound's global variable must be the SAME variable
      // the array dimension was declared with ([gv + 1] → arraySizes.variable).
      const sizeVar = arraySizes[k]?.variable;
      const boundRef = ctx.globalVarByGalaxyName.get(b);
      if (!sizeVar?.id || !boundRef || boundRef.id !== sizeVar.id) return undefined;
    }
  }
  // The per-element value must not depend on the loop counters.
  for (const c of counters) {
    if (exprContainsIdentifier(matched.valueExpr, c)) return undefined;
  }
  const newInitRef = exprToParamRef(
    stringInitializerCarrier(matched.valueExpr, variable),
    ctx,
    undefined,
    variable.variableType?.type,
  );
  // Ownership is graph-based rather than exclusive to this variable. Leave
  // cleanup to pruneUnreachableElements after every body has been rebuilt.
  variable.initialValue = newInitRef;
  return { consumed };
}
export function convertInitVariablesBody(
  funcDecl,
  libId,
  elements,
  funcNameToFuncDef,
  roleToSubFuncType,
  globalVarByGalaxyName,
  galaxyConstToPreset,
  structureByGalaxyTypeName,
  structureMemberByKey,
  nativeLibrary,
  externalFuncParamTypes,
  crossLibFuncDefs,
  sourceText,
  triggerByGalaxyName,
  dependencyLibraries,
  constants,
) {
  const actions = [];
  const localVariables = [];
  const localVarByGalaxyName = new Map();
  const pendingAutoInits = new Map();
  const pendingAutoEnds = new Map();
  const pendingAutoIncrements = new Map();
  const ctx = {
    libId,
    elements,
    nativeLibrary,
    dependencyLibraries,
    constants: constants?.scope([
      ...(funcDecl.parameters ?? []),
      ...(funcDecl.body?.statements ?? []),
    ]),
    funcNameToFuncDef,
    roleToSubFuncType,
    localVarByGalaxyName,
    globalVarByGalaxyName,
    pendingAutoInits,
    pendingAutoEnds,
    pendingAutoIncrements,
    galaxyConstToPreset,
    structureByGalaxyTypeName,
    structureMemberByKey,
    isUserFunction: true,
    externalFuncParamTypes,
    crossLibFuncDefs,
    sourceText,
    triggerByGalaxyName,
  };
  const body = funcDecl.body;
  if (!body) return { actions, localVariables };
  const topStmts = Array.from(body.statements ?? []);
  for (let i = 0; i < topStmts.length; i++) {
    const s = topStmts[i];
    const foldedStructMemberInits = tryFoldStructMemberInitLoopIntoInitialValue(
      topStmts,
      i,
      ctx,
      globalVarByGalaxyName,
      elements,
      libId,
    );
    if (foldedStructMemberInits) {
      i += foldedStructMemberInits.consumed - 1;
      continue;
    }
    // Editor-style array init loop → Variable.initialValue (the editor
    // regenerates the loop itself; never keep it as a raw action).
    const foldedArrayInit = tryFoldGlobalArrayInitIntoInitialValue(
      topStmts,
      i,
      ctx,
      globalVarByGalaxyName,
      elements,
      libId,
    );
    if (foldedArrayInit) {
      i += foldedArrayInit.consumed - 1;
      continue;
    }
    const topWaitMax = tryBuildWaitForConditionWithMaxFromStmtSequence(topStmts, i, undefined, ctx);
    if (topWaitMax) {
      actions.push(topWaitMax.ref);
      i += topWaitMax.consumed - 1;
      continue;
    }
    const topWaitCond = tryBuildWaitForConditionFromStmtSequence(topStmts, i, undefined, ctx);
    if (topWaitCond) {
      actions.push(topWaitCond.ref);
      i += topWaitCond.consumed - 1;
      continue;
    }
    const topActionQueueAdd = tryBuildActionQueueAddFromStmtSequence(topStmts, i, undefined, ctx);
    if (topActionQueueAdd) {
      actions.push(topActionQueueAdd.ref);
      i += topActionQueueAdd.consumed - 1;
      continue;
    }
    const topRepeatForever = tryBuildRepeatForeverFromStmt(s, undefined, ctx);
    if (topRepeatForever) {
      actions.push(topRepeatForever);
      continue;
    }
    const topRepeat = tryBuildRepeatFromStmtSequence(topStmts, i, undefined, ctx);
    if (topRepeat) {
      actions.push(topRepeat.ref);
      i += topRepeat.consumed - 1;
      continue;
    }
    const topForEachInteger = tryBuildForEachIntegerFromStmtSequence(topStmts, i, undefined, ctx);
    if (topForEachInteger) {
      actions.push(topForEachInteger.ref);
      i += topForEachInteger.consumed - 1;
      continue;
    }
    // Skip boilerplate guard emitted by converter-generated galaxy.
    if (isInitVariablesCompletedGuard(s, libId) || isInitVariablesCompletedSet(s, libId)) {
      continue;
    }
    if (s.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      const varName = s.name?.name ?? '';
      const autoVar = extractAutoVarName(varName);
      if (autoVar?.suffix === 'ae') {
        if (s.initializer) pendingAutoEnds.set(varName, s.initializer);
        continue;
      }
      if (autoVar?.suffix === 'ai') {
        if (s.initializer) pendingAutoIncrements.set(varName, s.initializer);
        continue;
      }
      if (autoVar?.suffix === 'at' && getTypeName(s.type) === 'fixed') continue;
      if (autoVar?.suffix === 'var' && getTypeName(s.type) === 'int') continue;
      // Skip loop/switch temp vars emitted by T2G and SC2 Editor
      if (autoVar?.suffix === 'g') continue;
      if (autoVar?.suffix === 'u') continue;
      if (autoVar?.suffix === 'val') continue;
      if (
        !s.initializer &&
        getTypeName(s.type) === 'int' &&
        varName.length > 0 &&
        isLoopCounterDeclaration(topStmts, i, varName)
      ) {
        continue;
      }
      const { name: localName, identifier: recoveredName } = recoveredEditorLocalIdentity(varName);
      const varId = generateId();
      const varJson = makeLocalVar(varId, libId, localName, s.type, globalVarByGalaxyName, ctx);
      if (recoveredName !== undefined) varJson.identifier = recoveredName;
      if (autoVar) varJson.flags = ['NoScriptPrefix'];
      if (s.initializer) {
        varJson.initialValue = exprToParamRef(
          stringInitializerCarrier(s.initializer, varJson),
          ctx,
          undefined,
          varJson.variableType?.type,
        );
      } else {
        varJson.initialValue = attachDefaultParam(varJson, elements, libId);
      }
      elements[varId] = varJson;
      localVariables.push({ type: 'Variable', library: libId, id: varId });
      localVarByGalaxyName.set(varName, varId);
      continue;
    }
    const topSwitch = tryBuildSwitchFromStmtSequence(topStmts, i, undefined, ctx);
    if (topSwitch) {
      actions.push(topSwitch.ref);
      i += topSwitch.consumed - 1;
      continue;
    }
    const legacyPickEachPlayer = tryBuildLegacyPickEachPlayerFromStmtSequence(
      topStmts,
      i,
      undefined,
      ctx,
    );
    if (legacyPickEachPlayer) {
      actions.push(legacyPickEachPlayer.ref);
      i += legacyPickEachPlayer.consumed - 1;
      continue;
    }
    const pickEachPlayer = tryBuildPickEachPlayerFromStmtSequence(topStmts, i, undefined, ctx);
    if (pickEachPlayer) {
      actions.push(pickEachPlayer.ref);
      i += pickEachPlayer.consumed - 1;
      continue;
    }
    const pickEachUnit = tryBuildPickEachUnitFromStmtSequence(topStmts, i, undefined, ctx);
    if (pickEachUnit) {
      actions.push(pickEachUnit.ref);
      i += pickEachUnit.consumed - 1;
      continue;
    }
    if (s.kind === 132 /* SyntaxKind.ForStatement */) {
      if (exprContainsUnresolvedCall(s.condition, ctx)) {
        actions.push(buildCustomScriptActionFCRef(s, undefined, ctx));
        continue;
      }
      const ref = buildPickEachIntegerFromForStmt(s, undefined, ctx, topStmts, i);
      // NEVER drop a loop silently — preserve as custom script when no
      // structured conversion matched.
      actions.push(ref ?? buildCustomScriptActionFCRef(s, undefined, ctx));
      continue;
    }
    if (s.kind === 138 /* SyntaxKind.ExpressionStatement */) {
      const expr = s.expression;
      if (exprContainsUnresolvedCall(expr, ctx)) {
        actions.push(buildCustomScriptActionFCRef(s, undefined, ctx));
        continue;
      }
      if (expr?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const opKind = expr.operatorToken?.kind;
        const left = expr.left;
        if (
          opKind === 39 /* SyntaxKind.EqualsToken */ &&
          left?.kind === 113 /* SyntaxKind.Identifier */
        ) {
          const leftName = left.name;
          if (extractAutoVarName(leftName)?.suffix === 'var') {
            const nextStmt = topStmts[i + 1];
            if (forStmtUsesCounterVar(nextStmt, leftName)) {
              pendingAutoInits.set(leftName, expr.right);
              continue;
            }
          }
          // Loop scaffolding referenced by an upcoming for-statement must be
          // consumed — falling through double-converts it into a broken
          // SetVariable on a non-existent variable.
          if (
            extractAutoVarName(leftName)?.suffix === 'ae' &&
            upcomingForStmtUsesName(topStmts, i, leftName)
          ) {
            pendingAutoEnds.set(leftName, expr.right);
            continue;
          }
          if (
            extractAutoVarName(leftName)?.suffix === 'ai' &&
            upcomingForStmtUsesName(topStmts, i, leftName)
          ) {
            pendingAutoIncrements.set(leftName, expr.right);
            continue;
          }
          // Fold scalar global variable initializations into Variable.initialValue
          // instead of emitting a SetVariable action.
          const varRef = globalVarByGalaxyName.get(leftName);
          if (varRef && varRef.library === libId) {
            const variable = elements[varRef.id];
            if (variable?.type === 'Variable' && !variable.isArray) {
              const newInitRef = exprToParamRef(
                stringInitializerCarrier(expr.right, variable),
                ctx,
                undefined,
                variable.variableType?.type,
              );
              // A generated call may also reference the old default Param;
              // the final reachability pass is the safe place to reclaim it.
              variable.initialValue = newInitRef;
              continue;
            }
          }
        }
      }
    }
    const ref = stmtToActionFCRef(s, undefined, ctx);
    if (ref) actions.push(ref);
  }
  return { actions, localVariables };
}
// ---------------------------------------------------------------------------
// Trigger body conversion
// ---------------------------------------------------------------------------
/** Only a prefix representable as ordered local initial values may become GUI conditions. */
export function analyzeTriggerPrefix(funcDecl, structureTypes, phaseGuards) {
  if (!phaseGuards) {
    try {
      phaseGuards = bindTriggerPhaseParameters(funcDecl);
    } catch {
      return undefined;
    }
  }
  const { isTestCondsGuard, isRunActionsGuard } = phaseGuards;
  const nodes = [...(funcDecl.body?.statements ?? [])];
  let length = nodes.findIndex(
    (node) =>
      node.kind === 129 /* SyntaxKind.IfStatement */ &&
      (isRunActionsGuard(unwrapParens(node.expression)) ||
        isTestCondsGuard(unwrapParens(node.expression), node.thenStatement)),
  );
  if (length < 0) {
    // The editor omits the runActions guard for an entirely empty Trigger and
    // emits only its final `return true;`.  The matching _Init/TriggerCreate
    // pair is checked by the caller, so accepting that exact terminal shape
    // does not turn an arbitrary bool function into a Trigger.
    const tail = nodes.at(-1);
    if (
      tail?.kind !== 137 /* SyntaxKind.ReturnStatement */ ||
      unwrapParens(tail.expression)?.kind !== 67 /* SyntaxKind.TrueKeyword */
    )
      return undefined;
    length = nodes.length - 1;
  }
  return localInitialization(nodes, length, funcDecl.name?.name);
}
/** Where a generated function body starts its actions: the editor heads them with
 * `// Implementation`, and only its own locals and their initial values precede it.
 * Hand-written Galaxy has no such banner, so its statements all stay actions. */
function generatedImplementationStart(body, statements, sourceText) {
  if (
    typeof sourceText !== 'string' ||
    typeof body?.pos !== 'number' ||
    typeof body.end !== 'number'
  )
    return undefined;
  // A line holding only the comment cannot be inside a Galaxy string literal.
  const banner = /^[ \t]*\/\/ Implementation[ \t]*\r?$/mu.exec(
    sourceText.slice(body.pos, body.end),
  );
  if (!banner) return undefined;
  const position = body.pos + banner.index;
  const index = statements.findIndex((statement) => statement.pos > position);
  return index < 0 ? statements.length : index;
}
/** The first `length` statements as local declarations and the initial values the
 * editor assigns them, or undefined when any of them is something else. */
function localInitialization(nodes, length, callbackName) {
  const declarations = [],
    initializers = [],
    names = new Set(),
    initialized = new Set();
  const fillLoops = new Set(),
    counters = new Set();
  for (let index = 0; index < length; index += 1) {
    const node = nodes[index];
    const text =
      callbackName && localizedTextInitializerSequence(nodes, index, declarations, callbackName);
    if (text && index + text.consumed <= length) {
      if (initialized.has(text.name)) return undefined;
      initialized.add(text.name);
      initializers.push(text);
      index += text.consumed - 1;
      continue;
    }

    const legacy = legacyLocalArrayFill(node, nodes[index + 1], declarations);
    if (legacy && index + 1 < length) {
      if (initialized.has(legacy.name)) return undefined;
      initialized.add(legacy.name);
      initializers.push({ name: legacy.name, expression: legacy.expression });
      fillLoops.add(node);
      fillLoops.add(nodes[index + 1]);
      for (const counter of legacy.counters) counters.add(counter);
      index += 1;
      continue;
    }
    if (node.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      declarations.push(node);
      names.add(node.name.name);
      if (node.initializer) {
        initialized.add(node.name.name);
        initializers.push({ name: node.name.name, expression: node.initializer });
      }
    } else if (node.kind === 132 /* SyntaxKind.ForStatement */) {
      // An array local with an initial value is filled by a counted loop; the
      // model stores the element value, the declaration carries the bound.
      const filled = arrayFillLoop(node, names);
      if (!filled || initialized.has(filled.name)) return undefined;
      initialized.add(filled.name);
      initializers.push({ name: filled.name, expression: filled.expression });
      fillLoops.add(node);
      for (const counter of filled.counters) counters.add(counter);
    } else {
      const expression =
        node.kind === 138 /* SyntaxKind.ExpressionStatement */ ? node.expression : undefined;
      const name =
        expression?.left?.kind === 113 /* SyntaxKind.Identifier */
          ? expression.left.name
          : undefined;
      if (
        expression?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
        expression.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */ ||
        !name ||
        !names.has(name) ||
        initialized.has(name)
      )
        return undefined;
      initialized.add(name);
      initializers.push({ name, expression: expression.right });
    }
  }
  // The model stores an initial value per local, not a statement order, so what
  // has to hold is that no value reads a local initialized after it. Demanding
  // that the two orders coincide instead rejected the editor's own output,
  // where a local whose value is not a constant is declared plain and assigned
  // after the const loop scaffolding.

  // Token setters are observable: XML local order must preserve their execution.
  if (initializers.some((v) => v.expressionTokens)) {
    const order = declarations.filter((d) => initialized.has(d.name.name)).map((d) => d.name.name);
    if (order.length !== initializers.length || !order.every((n, i) => n === initializers[i].name))
      return undefined;
  }
  const initializerOrder = localInitializerDependencyOrder(declarations, initializers);
  if (!initializerOrder) return undefined;
  const initializedAt = new Map(initializers.map((value, index) => [value.name, index]));
  for (const [index, value] of initializers.entries()) {
    for (const name of prefixIdentifiers([
      value.expression,
      value.expressionTokens?.tokens.map((t) => t.value),
    ])) {
      const other = initializedAt.get(name);
      if (!initializerOrder.preservesRead(index, name)) return undefined;
    }
  }
  // The fill loops count with `int init_i;`, which the editor declares for them and
  // generates again; kept, it became a stray local in every such trigger.
  const read = prefixIdentifiers(
    nodes.flatMap((node) =>
      fillLoops.has(node)
        ? []
        : node.kind === 141 /* SyntaxKind.VariableDeclaration */
          ? [node.initializer]
          : [node],
    ),
  );
  if ([...counters].some((counter) => read.has(counter))) return undefined;
  return {
    length,
    declarations: declarations.filter(
      (node) => !counters.has(node.name.name) || read.has(node.name.name),
    ),
    initializers,
  };
}
/** `for (i = 0; i <= bound; i += 1) { name[i][...] = value; }` as written by the
 *  editor for an array local with an initial value, or undefined for any other
 *  loop. The counter and the bound live in the declaration, so only the element
 *  value is recovered. */
function arrayFillLoop(node, names) {
  const counters = [];
  let statement = node;
  while (statement?.kind === 132 /* SyntaxKind.ForStatement */) {
    const init = unwrapParens(statement.initializer);
    const counter =
      init?.left?.kind === 113 /* SyntaxKind.Identifier */ ? init.left.name : undefined;
    const condition = unwrapParens(statement.condition);
    const increment = statement.incrementor;
    if (
      !counter ||
      counters.includes(counter) ||
      init?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
      init.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */ ||
      unwrapParens(init.right)?.kind !== 2 /* SyntaxKind.NumericLiteral */ ||
      Number(unwrapParens(init.right).value) !== 0 ||
      condition?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
      condition.left?.name !== counter ||
      ![13 /* SyntaxKind.LessThanToken */, 15 /* SyntaxKind.LessThanEqualsToken */].includes(
        condition.operatorToken?.kind,
      ) ||
      increment?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
      increment.operatorToken?.kind !== 40 /* SyntaxKind.PlusEqualsToken */ ||
      increment.left?.name !== counter ||
      unwrapParens(increment.right)?.kind !== 2 /* SyntaxKind.NumericLiteral */ ||
      Number(unwrapParens(increment.right).value) !== 1
    )
      return undefined;
    const body =
      statement.statement?.kind === 128 /* SyntaxKind.Block */
        ? [...statement.statement.statements]
        : [statement.statement];
    if (body.length !== 1) return undefined;
    counters.push(counter);
    statement = body[0];
  }
  const write =
    statement?.kind === 138 /* SyntaxKind.ExpressionStatement */ ? statement.expression : undefined;
  if (
    write?.kind !== 124 /* SyntaxKind.BinaryExpression */ ||
    write.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */
  )
    return undefined;
  let target = unwrapParens(write.left);
  const indices = [];
  while (target?.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
    const index = unwrapParens(target.argumentExpression);
    if (index?.kind !== 113 /* SyntaxKind.Identifier */) return undefined;
    indices.unshift(index.name);
    target = unwrapParens(target.expression);
  }
  const name = target?.kind === 113 /* SyntaxKind.Identifier */ ? target.name : undefined;
  if (
    !name ||
    !names.has(name) ||
    indices.length !== counters.length ||
    !indices.every((index, position) => index === counters[position])
  )
    return undefined;
  return { name, expression: write.right, counters };
}
/** Every identifier an initializer expression reads. */
function prefixIdentifiers(node) {
  const names = new Set();
  const pending = [node];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (value.kind === 113 /* SyntaxKind.Identifier */ && typeof value.name === 'string')
      names.add(value.name);
    for (const [key, child] of Object.entries(value)) {
      if (key === 'parent' || key === 'syntaxTokens') continue;
      if (child && typeof child === 'object') pending.push(child);
    }
  }
  return names;
}
export function convertTriggerBody(
  funcDecl,
  triggerName,
  libId,
  elements,
  funcNameToFuncDef,
  roleToSubFuncType,
  globalVarByGalaxyName,
  galaxyConstToPreset,
  structureByGalaxyTypeName,
  structureMemberByKey,
  nativeLibrary,
  externalFuncParamTypes,
  crossLibFuncDefs,
  sourceText,
  triggerByGalaxyName,
  dependencyLibraries,
  constants,
  reservedId,
  regionOptions = {},
) {
  const recoveredConditionFunctions = [];
  const phaseGuards = bindTriggerPhaseParameters(funcDecl);
  const { isTestCondsGuard, isRunActionsGuard } = phaseGuards;
  // The caller reserves this identity before any body is read, so that a
  // forward reference to this trigger already resolves while it is converted.
  const triggerId = reservedId ?? generateId();
  const events = [];
  const conditions = [];
  const actions = [];
  const localVariables = [];
  const localVarByGalaxyName = new Map();
  const pendingAutoInits = new Map();
  const pendingAutoEnds = new Map();
  const pendingAutoIncrements = new Map();
  const ctx = {
    libId,
    elements,
    nativeLibrary,
    dependencyLibraries,
    constants: constants?.scope([
      ...(funcDecl.parameters ?? []),
      ...(funcDecl.body?.statements ?? []),
    ]),
    funcNameToFuncDef,
    roleToSubFuncType,
    localVarByGalaxyName,
    globalVarByGalaxyName,
    pendingAutoInits,
    pendingAutoEnds,
    pendingAutoIncrements,
    galaxyConstToPreset,
    structureByGalaxyTypeName,
    structureMemberByKey,
    externalFuncParamTypes,
    crossLibFuncDefs,
    sourceText,
    triggerByGalaxyName,
  };
  const body = funcDecl.body;
  if (!body) {
    return {
      type: 'Trigger',
      id: triggerId,
      library: libId,
      name: triggerName,
      events,
      conditions,
      actions,
      localVariables,
    };
  }
  ctx.returnType = 'bool';
  ctx.structuredLocals = localVariables;
  ctx.structuredTemplates = new Map();
  const topStmts = Array.from(body.statements ?? []);
  ctx.structuredFunctionStatements = topStmts;
  const prefix = analyzeTriggerPrefix(funcDecl, undefined, phaseGuards);
  if (!prefix) throw new Error('Trigger prefix is not representable as ordered GUI initial values');
  assertTriggerGuardPhases(topStmts, prefix.length, { isTestCondsGuard, isRunActionsGuard });
  for (const declaration of prefix.declarations) declareStructuredLocal(declaration, ctx);
  for (const initial of prefix.initializers) {
    const variable = elements[localVarByGalaxyName.get(initial.name)];

    if (initial.expressionTokens) {
      const expression = initial.expressionTokens;
      if (elements[expression.id])
        throw new Error('Localized expression identity collision: ' + expression.id);
      // Reserve the exact observed localization identity before creating children.
      const parent = mkParamRef(
        { valueType: { type: 'text' }, expressionType: 'text', expressionParams: [] },
        ctx,
        expression.id,
      );
      const children = expression.tokens.map((token) => {
        const child = structuredParam(token.value, ctx, undefined, 'text');
        elements[child.id].expressionCode = token.code;
        return child;
      });
      elements[parent.id].expressionParams = children;
      variable.initialValue = parent;
    } else {
      variable.initialValue =
        explicitIntegerZeroParam(initial.expression, variable, ctx, ctx.constants) ??
        structuredParam(
          stringInitializerCarrier(initial.expression, variable),
          ctx,
          undefined,
          variable.variableType?.type,
        );
    }
  }
  const retained = [];
  const returns = (statement, kind) =>
    statement?.kind === 128 /* SyntaxKind.Block */ &&
    statement.statements.length === 1 &&
    statement.statements[0].kind === 137 /* SyntaxKind.ReturnStatement */ &&
    statement.statements[0].expression?.kind === kind;
  for (let i = prefix.length; i < topStmts.length; i++) {
    const s = topStmts[i];
    if (s.kind === 129 /* SyntaxKind.IfStatement */ && !s.elseStatement) {
      if (
        isRunActionsGuard(unwrapParens(s.expression)) &&
        returns(s.thenStatement, 67 /* SyntaxKind.TrueKeyword */)
      )
        continue;
      let guards;
      try {
        guards = triggerConditionGuards(s, phaseGuards);
      } catch (error) {
        if (
          !regionOptions.allowTransparentConditionFunctions ||
          !error.message.startsWith('Trigger condition control flow')
        )
          throw error;
        const recovered = recoverClosedConditionFunction({
          declaration: funcDecl,
          guard: s,
          prefix,
          ctx,
          allocateId: generateId,
          lower: structuredStatements,
        });
        conditions.push(recovered.condition);
        recoveredConditionFunctions.push(recovered.record);
        continue;
      }
      if (guards) {
        for (const guard of guards)
          conditions.push(
            structuredNode(unwrapParens(unwrapParens(guard.expression).operand), true, ctx),
          );
        continue;
      }
    }
    if (
      s.kind === 137 /* SyntaxKind.ReturnStatement */ &&
      i === topStmts.length - 1 &&
      s.expression?.kind === 67 /* SyntaxKind.TrueKeyword */
    )
      continue;
    retained.push(s);
  }
  actions.push(...structuredStatements(retained, ctx));
  const result = {
    type: 'Trigger',
    id: triggerId,
    library: libId,
    name: triggerName,
    events,
    conditions,
    actions,
    localVariables,
  };
  Object.defineProperty(result, 'recoveredConditionFunctions', {
    value: recoveredConditionFunctions,
    enumerable: false,
  });
  return result;
}
//# sourceMappingURL=g2t-trigger-body.js.map
