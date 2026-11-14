import { withNativeGuiFacts } from './native-gui-recipes.mjs';
import { GalaxyProgramContext } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';
import { RecoverySession } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/recovery-session.js';
import { bindLegacyLoopAccessor } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/legacy-loop-accessor-binding.js';
import { SyntaxKind } from '../sdk/array-values/modules/galaxy/language-core/index.js';
import { ownedTriggerInitPrototypes } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/owned-trigger-init-prototypes.js';
import { triggerInitFuncName } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import { rewriteBoundInitializationBody } from './g2t-actions.mjs';
import { recoverOrdinalPresetOwners } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ordinal-preset-owners.js';
import { retainInlineCustomGlobals } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/inline-custom-globals.js';
import { declaredExternalTriggerReferences } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/external-trigger-reference.js';
import { retainPrimaryCustomIncludes } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/retained-primary-includes.js';
import { attachExternalStructureFields } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/external-structure-fields.js';
import { explicitIntegerZeroParam } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/explicit-zero-initializer.js';
import { GalaxyConstantIndex } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/galaxy-constants.js';
import { structuredNode, structuredParam } from './g2t-structured.mjs';
import {
  conversionError,
  globalVariables,
  globalVariableNames,
  globalVariableSpellings,
  libraryPrefix,
  withImplicitLibrary,
} from './explicit-numeric-global-model.mjs';
import {
  placeAdditionalScriptFolders,
  restoreEditorLayout,
} from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/editor-layout.js';
import { recognizeGeneratedInitialization } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-initialization.js';
import { contextualAutoAncestor, printNode } from './balanced-script-template.mjs';
import { Parser, forEachChild } from '../sdk/array-values/modules/galaxy/language-core/index.js';
import { resolveGalaxyTypeAliases } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/galaxy-type-resolution.js';
import {
  generateId,
  idFromKey,
  resetGalaxyToTriggerIdCounter,
  withIsolatedGalaxyToTriggerIds,
  extractGlobalVarName,
  extractLocalVarName,
  extractAutoVarName,
  extractUserFunctionName,
  extractTriggerName,
  isLibraryBoilerplate,
  isTriggerInitFunction,
  isTriggerBodyFunction,
  structureMemberKey,
  triggerParamTypeFromGalaxyTypeName,
  fdRef,
  buildFuncNameToFuncDefMap,
  buildGalaxyConstToPresetMap,
  buildRoleToSubFuncTypeMap,
  unwrapArrayType,
  parseArraySizeExpr,
  getTypeName,
  getIdentifierName,
  unwrapParens,
} from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import { pruneUnreachableElements } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-prune.js';
import { syntaxShape } from './balanced-script-template.mjs';
import { matchDependencyFunctionDeclarations } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/dependency-functions.js';
import { resolveParamDefByRef } from './g2t-params.mjs';
import {
  indexDeclaredGalaxySymbols,
  namingIndexes,
  withNamingIndexes,
  withIsolatedNamingIndexes,
} from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {
  convertTriggerBody,
  convertUserFunctionBody,
  analyzeTriggerPrefix,
  triggerConditionGuards,
} from './g2t-trigger-body.mjs';
function resolveParamDefType(ref, elements, nativeLibrary, libId) {
  if (!ref?.id) return undefined;
  const local = elements[ref.id];
  if (local?.type === 'ParamDef') return local.paramType?.type;
  if ((ref.library ?? libId) === (nativeLibrary?.id ?? 'Ntve')) {
    const nativeParamDef = nativeLibrary?.elementsByType?.ParamDef?.[ref.id];
    return nativeParamDef?.paramType?.type;
  }
  return undefined;
}
function calledFunctionNames(statements) {
  const names = new Set();
  const visit = (node) => {
    if (
      node?.kind === 121 /* SyntaxKind.CallExpression */ &&
      node.expression?.kind === 113 /* SyntaxKind.Identifier */
    ) {
      names.add(node.expression.name);
    }
    forEachChild(node, visit);
  };
  for (const statement of statements) visit(statement);
  return names;
}
function nativeDependencyDeclarations(sources, calledNames) {
  const declarations = new Map();
  for (const source of sources)
    for (const statement of Array.from(source.statements)) {
      if (
        statement.kind !== 142 /* SyntaxKind.FunctionDeclaration */ ||
        statement.body ||
        !statement.modifiers?.some(
          (modifier) => modifier.kind === 54 /* SyntaxKind.NativeKeyword */,
        )
      )
        continue;
      const name = statement.name?.name;
      if (!name || !calledNames.has(name)) continue;
      const existing = declarations.get(name);
      if (existing) {
        const signature = (declaration) =>
          JSON.stringify({
            returnType: getTypeName(declaration.type) || 'void',
            parameters: Array.from(declaration.parameters ?? []).map((parameter) =>
              getTypeName(parameter.type),
            ),
          });
        if (signature(existing) !== signature(statement)) {
          conversionError(
            'NATIVE_DECLARATION_CONFLICT',
            'Loaded Galaxy declarations disagree about a called native function',
            { function: name },
          );
        }
        continue;
      }
      declarations.set(name, statement);
    }
  return declarations;
}
function normalizeTriggerValueParams(elements, libId, nativeLibrary, triggerByGalaxyName) {
  for (const el of Object.values(elements)) {
    if (el.type !== 'Param') continue;
    const param = el;
    if (typeof param.value !== 'string') continue;
    const triggerRef = triggerByGalaxyName.get(param.value);
    if (!triggerRef) continue;
    const paramType = resolveParamDefType(
      param.parameterDef,
      elements,
      nativeLibrary,
      libId,
    )?.toLowerCase();
    if (paramType !== 'trigger') continue;
    delete param.value;
    param.valueType = { type: 'trigger' };
    param.valueElement = {
      type: 'Trigger',
      library: triggerRef.library ?? libId,
      id: triggerRef.id,
    };
  }
}
function readBoolLiteral(expr) {
  const unwrapped =
    expr?.kind === 126 /* SyntaxKind.ParenthesizedExpression */ ? expr.expression : expr;
  if (unwrapped?.kind === 67 /* SyntaxKind.TrueKeyword */) return true;
  if (unwrapped?.kind === 68 /* SyntaxKind.FalseKeyword */) return false;
  if (unwrapped?.kind === 113 /* SyntaxKind.Identifier */) {
    if (unwrapped.name === 'true') return true;
    if (unwrapped.name === 'false') return false;
  }
  return undefined;
}
function getTopLevelStatements(...sources) {
  return sources.flatMap((source) => Array.from(source.statements ?? []));
}
function assignmentExpression(statement) {
  const expression =
    statement?.kind === 138 /* SyntaxKind.ExpressionStatement */
      ? unwrapParens(statement.expression)
      : undefined;
  return expression?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
    expression.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */
    ? expression
    : undefined;
}
function exactIdentifier(node, name) {
  return getIdentifierName(unwrapParens(node)) === name;
}
function sameGalaxyType(left, right) {
  return getTypeName(left) === getTypeName(right);
}
function recognizeThreadedFunctions(statements, libId) {
  const functions = new Map();
  const globals = new Map();
  for (const statement of statements) {
    if (statement?.kind === 142 /* SyntaxKind.FunctionDeclaration */ && statement.body)
      functions.set(statement.name?.name, statement);
    if (statement?.kind === 141 /* SyntaxKind.VariableDeclaration */)
      globals.set(statement.name?.name, statement);
  }
  const result = new Map();
  for (const wrapper of functions.values()) {
    const wrapperName = wrapper.name?.name;
    if (
      !wrapperName ||
      !extractUserFunctionName(wrapperName, libId) ||
      getTypeName(wrapper.type) !== 'void'
    )
      continue;
    const callbackName = `auto_${wrapperName}_TriggerFunc`;
    const handleName = `auto_${wrapperName}_Trigger`;
    const callback = functions.get(callbackName);
    const handle = globals.get(handleName);
    const parameters = Array.from(wrapper.parameters ?? []);
    const parameterGlobals = parameters.map(
      (parameter) => `auto_${wrapperName}_${parameter.name?.name ?? ''}`,
    );
    if (
      !callback ||
      !handle ||
      getTypeName(handle.type) !== 'trigger' ||
      unwrapParens(handle.initializer)?.kind !== 69 /* SyntaxKind.NullKeyword */
    )
      continue;
    if (
      getTypeName(callback.type) !== 'bool' ||
      callback.parameters?.length !== 2 ||
      !callback.parameters.every((parameter) => getTypeName(parameter.type) === 'bool') ||
      callback.parameters[0]?.name?.name !== 'testConds' ||
      callback.parameters[1]?.name?.name !== 'runActions'
    )
      continue;
    if (
      parameterGlobals.some((name, index) => {
        const declaration = globals.get(name);
        return (
          !declaration ||
          declaration.initializer ||
          !sameGalaxyType(declaration.type, parameters[index]?.type)
        );
      })
    )
      continue;
    const wrapperBody = Array.from(wrapper.body?.statements ?? []);
    if (wrapperBody.length !== parameters.length + 2) continue;
    const parameterCopiesValid = parameters.every((parameter, index) => {
      const assignment = assignmentExpression(wrapperBody[index]);
      return (
        assignment &&
        exactIdentifier(assignment.left, parameterGlobals[index]) &&
        exactIdentifier(assignment.right, parameter.name?.name)
      );
    });
    if (!parameterCopiesValid) continue;
    const createIf = wrapperBody[parameters.length];
    const condition = unwrapParens(createIf?.expression);
    const createBody =
      createIf?.thenStatement?.kind === 128 /* SyntaxKind.Block */
        ? Array.from(createIf.thenStatement.statements ?? [])
        : [createIf?.thenStatement];
    const createAssignment =
      createBody.length === 1 ? assignmentExpression(createBody[0]) : undefined;
    const createCall = unwrapParens(createAssignment?.right);
    const conditionValid =
      createIf?.kind === 129 /* SyntaxKind.IfStatement */ &&
      !createIf.elseStatement &&
      condition?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      condition.operatorToken?.kind === 17 /* SyntaxKind.EqualsEqualsToken */ &&
      ((exactIdentifier(condition.left, handleName) &&
        unwrapParens(condition.right)?.kind === 69) /* SyntaxKind.NullKeyword */ ||
        (exactIdentifier(condition.right, handleName) &&
          unwrapParens(condition.left)?.kind === 69)); /* SyntaxKind.NullKeyword */
    const createValid =
      createAssignment &&
      exactIdentifier(createAssignment.left, handleName) &&
      createCall?.kind === 121 /* SyntaxKind.CallExpression */ &&
      exactIdentifier(createCall.expression, 'TriggerCreate') &&
      createCall.arguments?.length === 1 &&
      unwrapParens(createCall.arguments[0])?.kind === 3 /* SyntaxKind.StringLiteral */ &&
      String(unwrapParens(createCall.arguments[0]).value ?? '') === callbackName;
    if (!conditionValid || !createValid) continue;
    const execute = unwrapParens(wrapperBody[parameters.length + 1]?.expression);
    if (
      wrapperBody[parameters.length + 1]?.kind !== 138 /* SyntaxKind.ExpressionStatement */ ||
      execute?.kind !== 121 /* SyntaxKind.CallExpression */ ||
      !exactIdentifier(execute.expression, 'TriggerExecute') ||
      execute.arguments?.length !== 3 ||
      !exactIdentifier(execute.arguments[0], handleName) ||
      readBoolLiteral(execute.arguments[1]) !== false ||
      readBoolLiteral(execute.arguments[2]) !== false
    )
      continue;
    const callbackBody = Array.from(callback.body?.statements ?? []);
    if (callbackBody.length < parameters.length + 1) continue;
    const localCopiesValid = parameters.every((parameter, index) => {
      const declaration = callbackBody[index];
      return (
        declaration?.kind === 141 /* SyntaxKind.VariableDeclaration */ &&
        declaration.name?.name === parameter.name?.name &&
        sameGalaxyType(declaration.type, parameter.type) &&
        exactIdentifier(declaration.initializer, parameterGlobals[index])
      );
    });
    const finalReturn = callbackBody[callbackBody.length - 1];
    if (
      !localCopiesValid ||
      finalReturn?.kind !== 137 /* SyntaxKind.ReturnStatement */ ||
      unwrapParens(finalReturn.expression)?.kind !== 67 /* SyntaxKind.TrueKeyword */
    )
      continue;
    const restoreVoidReturns = (node) => {
      if (!node || typeof node !== 'object') return node;
      if (
        node.kind === 137 /* SyntaxKind.ReturnStatement */ &&
        unwrapParens(node.expression)?.kind === 67 /* SyntaxKind.TrueKeyword */
      ) {
        return { ...node, expression: undefined };
      }
      if (node.kind === 128 /* SyntaxKind.Block */)
        return { ...node, statements: [...(node.statements ?? [])].map(restoreVoidReturns) };
      if (node.kind === 129 /* SyntaxKind.IfStatement */)
        return {
          ...node,
          thenStatement: restoreVoidReturns(node.thenStatement),
          elseStatement: node.elseStatement ? restoreVoidReturns(node.elseStatement) : undefined,
        };
      if (
        [
          131 /* SyntaxKind.WhileStatement */, 130 /* SyntaxKind.DoStatement */,
          132 /* SyntaxKind.ForStatement */,
        ].includes(node.kind)
      ) {
        return { ...node, statement: restoreVoidReturns(node.statement) };
      }
      return node;
    };
    const authoredStatements = callbackBody.slice(parameters.length, -1).map(restoreVoidReturns);
    result.set(wrapperName, {
      wrapperName,
      callbackName,
      machineryGlobals: new Set([handleName, ...parameterGlobals]),
      authoredFunction: { ...wrapper, body: { ...callback.body, statements: authoredStatements } },
    });
  }
  return result;
}
function splitLocalPresetConstName(name, libId) {
  const prefix = `${libraryPrefix(libId)}ge_`;
  if (!name.startsWith(prefix)) return undefined;
  const rest = name.slice(prefix.length);
  for (let idx = rest.lastIndexOf('_'); idx > 0; idx = rest.lastIndexOf('_', idx - 1)) {
    const valueName = rest.slice(idx + 1);
    if (valueName === '' || /^\d/u.test(valueName)) continue;
    return { presetName: rest.slice(0, idx), valueName };
  }
  return undefined;
}
function collectLocalPresetDeclarations(statements, libId, elements) {
  const ordinalOwners = recoverOrdinalPresetOwners(statements, libId, {
    libraryPrefix,
    getTypeName,
  });
  const ordinalOwnerNames = new Set([...ordinalOwners.values()].map((o) => o.presetName));
  const presetValuesByPreset = new Map();
  const constToPresetValue = new Map();
  const presetIdByName = new Map();
  const valueIdByKey = new Map();
  for (const stmt of statements) {
    if (stmt?.kind !== 141 /* SyntaxKind.VariableDeclaration */) continue;
    if (
      !stmt.modifiers?.some((modifier) => modifier.kind === 53 /* SyntaxKind.ConstKeyword */) ||
      !stmt.initializer
    )
      continue;
    let scalar = unwrapParens(stmt.initializer);
    if (scalar.kind === 122 /* SyntaxKind.PrefixUnaryExpression */)
      scalar = unwrapParens(scalar.operand);
    if (
      ![
        2 /* SyntaxKind.NumericLiteral */, 3 /* SyntaxKind.StringLiteral */,
        67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */,
      ].includes(scalar.kind)
    )
      continue;
    const name = stmt.name?.name;
    if (!name) continue;
    const parsed = ordinalOwners.get(name) ?? splitLocalPresetConstName(name, libId);
    if (!parsed) continue;
    const presetKey = `${libId}|preset|${parsed.presetName}`;
    const presetId = presetIdByName.get(presetKey) ?? idFromKey(presetKey);
    presetIdByName.set(presetKey, presetId);
    if (!elements[presetId]) {
      elements[presetId] = {
        type: 'Preset',
        id: presetId,
        library: libId,
        name: parsed.presetName,
        baseType: getTypeName(stmt.type) || 'int',
        generateConstants: true,
        // NativeLib uses PresetCustom for explicit values; omission lets the
        // Editor replace int values with 0..N-1 even without PresetInteger.
        unknownXml: [{ tag: 'PresetCustom', position: 0 }],
        values: [],
      };
    }
    const valueKey = `${libId}|preset-value|${parsed.presetName}|${parsed.valueName}`;
    const valueId = valueIdByKey.get(valueKey) ?? idFromKey(valueKey);
    valueIdByKey.set(valueKey, valueId);
    const valueRef = { type: 'PresetValue', library: libId, id: valueId };
    if (!elements[valueId]) {
      elements[valueId] = {
        type: 'PresetValue',
        id: valueId,
        library: libId,
        name: parsed.valueName,
        identifier: parsed.valueName,
        value: printNode(stmt.initializer),
      };
    }
    const values = presetValuesByPreset.get(presetId) ?? [];
    if (!values.some((v) => v.id === valueId)) values.push(valueRef);
    presetValuesByPreset.set(presetId, values);
    constToPresetValue.set(name, valueRef);
  }
  for (const [presetId, values] of presetValuesByPreset) {
    const preset = elements[presetId];
    if (preset?.type === 'Preset') preset.values = values;
    if (ordinalOwnerNames.has(preset.name)) {
      preset.values = [...values].sort(
        (a, b) => Number(elements[a.id].value) - Number(elements[b.id].value),
      );
      const numbers = preset.values.map((ref) => Number(elements[ref.id].value));
      const active = numbers.filter((value) => value !== -1);
      // Editor disabled choices declare -1 and consume no ordinal.
      // Accept only the complete 0..N-1 source sequence plus -1.
      if (numbers.every(Number.isSafeInteger) && active.every((value, index) => value === index)) {
        preset.integer = true;
        // Integer ordinals and explicit script values are distinct modes.
        preset.unknownXml = (preset.unknownXml ?? []).filter((x) => x.tag !== 'PresetCustom');
        for (const ref of preset.values)
          if (Number(elements[ref.id].value) === -1) elements[ref.id].disabled = true;
      }
    }
  }
  return constToPresetValue;
}
function makePresetTypeFromValueRef(valueRef, elements) {
  for (const el of Object.values(elements)) {
    if (el.type !== 'Preset') continue;
    const preset = el;
    if (
      (preset.values ?? []).some(
        (v) => (v.library ?? valueRef.library) === (valueRef.library ?? '') && v.id === valueRef.id,
      )
    ) {
      return {
        type: 'preset',
        typeElement: { type: 'Preset', library: preset.library, id: preset.id },
      };
    }
  }
  return undefined;
}
function walkAst(node, visit, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 128) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'pos' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) walkAst(item, visit, depth + 1);
    } else if (value && typeof value === 'object') {
      walkAst(value, visit, depth + 1);
    }
  }
}
function applyGlobalVariableDomainInference(statements, declarationSources, ctx) {
  const signatures = new Map();
  for (const source of declarationSources)
    for (const statement of source.statements) {
      if (statement.kind !== 142 /* SyntaxKind.FunctionDeclaration */) continue;
      const name = getIdentifierName(statement.name);
      if (!name) continue;
      const signature = {
        result: getTypeName(statement.type),
        parameters: Array.from(statement.parameters ?? []).map((parameter) =>
          getTypeName(parameter.type),
        ),
      };
      const prior = signatures.get(name);
      if (prior === undefined) signatures.set(name, signature);
      else if (
        prior === null ||
        prior.result !== signature.result ||
        prior.parameters.length !== signature.parameters.length ||
        prior.parameters.some((type, index) => type !== signature.parameters[index])
      )
        signatures.set(name, null);
    }
  const declaredGalaxyTypes = new Map();
  const symbolGalaxyTypes = new Map();
  for (const source of declarationSources)
    for (const statement of source.statements)
      if (statement.kind === 141 /* SyntaxKind.VariableDeclaration */) {
        const name = getIdentifierName(statement.name);
        if (name)
          symbolGalaxyTypes.set(name, getTypeName(unwrapArrayType(statement.type).baseType));
      }
  for (const statement of statements)
    if (statement.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      const name = getIdentifierName(statement.name);
      if (name) {
        const type = getTypeName(unwrapArrayType(statement.type).baseType);
        declaredGalaxyTypes.set(name, type);
        symbolGalaxyTypes.set(name, type);
      }
    }
  const votes = new Map();
  const primitive = new Set(['void', 'bool', 'byte', 'char', 'int', 'fixed', 'string', 'text']);
  const scalarOrArrayRootName = (node) => {
    let current = unwrapParens(node);
    while (current?.kind === 119 /* SyntaxKind.ElementAccessExpression */)
      current = unwrapParens(current.expression);
    // A property access selects a structure member. Changing the root
    // structure's type would be wrong; member-domain inference is handled
    // separately. Plain arrays, including multiple dimensions, retain the
    // semantic domain of their root Variable.
    return current?.kind === 113 /* SyntaxKind.Identifier */
      ? getIdentifierName(current)
      : undefined;
  };
  const concrete = (candidate) => {
    if (!candidate?.type) return undefined;
    const normalized = candidate.type.toLowerCase();
    if (
      /^(?:any|sameas)/u.test(normalized) &&
      candidate.variableType &&
      !/^(?:any|sameas)/u.test(candidate.variableType)
    ) {
      return { type: candidate.variableType };
    }
    if (primitive.has(normalized) || /^(?:any|sameas|preset|struct)/u.test(normalized))
      return undefined;
    return candidate;
  };
  const addVote = (name, candidate, abiType, shadowed) => {
    const global = name && !shadowed.has(name) ? ctx.globalVarByGalaxyName.get(name) : undefined;
    if (
      !name ||
      !global ||
      global.library !== ctx.libId ||
      !abiType ||
      declaredGalaxyTypes.get(name) !== abiType
    )
      return;
    const variable = ctx.elements[global.id];
    const domain = concrete(candidate);
    if (!variable || variable.type !== 'Variable' || !domain) return;
    const key = JSON.stringify(domain);
    const variableVotes = votes.get(global.id) ?? new Map();
    variableVotes.set(key, domain);
    votes.set(global.id, variableVotes);
  };
  const callContract = (node) => {
    const call = unwrapParens(node);
    if (call?.kind !== 121 /* SyntaxKind.CallExpression */) return {};
    const callee = getIdentifierName(call.expression);
    const signature = callee ? signatures.get(callee) : undefined;
    const definition = callee ? ctx.funcNameToFuncDef.get(callee) : undefined;
    return signature && definition ? { type: definition.returnType, abi: signature.result } : {};
  };
  const presetContract = (node) => {
    const name = getIdentifierName(unwrapParens(node));
    const valueRef = name ? ctx.galaxyConstToPreset.get(name) : undefined;
    if (!name || !valueRef) return {};
    const libraries = [
      { id: ctx.libId, elements: ctx.elements },
      ...(ctx.nativeLibrary ? [ctx.nativeLibrary] : []),
      ...(ctx.dependencyLibraries?.values() ?? []),
    ];
    for (const library of libraries)
      for (const element of Object.values(library.elements ?? {})) {
        if (element.type !== 'Preset') continue;
        const preset = element;
        if (
          !preset.baseType ||
          !(preset.values ?? []).some(
            (ref) =>
              ref.id === valueRef.id &&
              (ref.library ?? preset.library ?? library.id) === (valueRef.library ?? ctx.libId),
          )
        )
          continue;
        return { type: { type: preset.baseType }, abi: symbolGalaxyTypes.get(name) };
      }
    return {};
  };
  for (const statement of statements) {
    const shadowed = new Set();
    if (statement.kind === 142 /* SyntaxKind.FunctionDeclaration */) {
      for (const parameter of statement.parameters ?? []) {
        const name = getIdentifierName(parameter.name);
        if (name) shadowed.add(name);
      }
      walkAst(statement.body, (node) => {
        if (node.kind === 141 /* SyntaxKind.VariableDeclaration */) {
          const name = getIdentifierName(node.name);
          if (name) shadowed.add(name);
        }
      });
    }
    walkAst(statement, (node) => {
      if (node.kind !== 121 /* SyntaxKind.CallExpression */) return;
      const callee = getIdentifierName(node.expression);
      const signature = callee ? signatures.get(callee) : undefined;
      const definition = callee ? ctx.funcNameToFuncDef.get(callee) : undefined;
      if (!signature || !definition) return;
      // An event registration passes the trigger first; the event's own
      // parameters start at the second argument. Pairing them by position voted
      // the player of TriggerAddEventButtonPressed(t, player, button) into the
      // button's gamelink type (traynor2: const string gv_pLAYER_01_USER = 1).
      const offset = definition.flags?.includes('Event') ? 1 : 0;
      for (const [index, argument] of Array.from(node.arguments ?? []).entries()) {
        if (index < offset) continue;
        const name = scalarOrArrayRootName(argument);
        const paramRef = definition.parameters?.[index - offset];
        const formal = paramRef && resolveParamDefByRef(paramRef, ctx);
        addVote(name, formal?.paramType, signature.parameters[index], shadowed);
      }
      return;
    });
    walkAst(statement, (node) => {
      if (node.kind !== 124 /* SyntaxKind.BinaryExpression */) return;
      if (node.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */) {
        const contract = Object.keys(callContract(node.right)).length
          ? callContract(node.right)
          : presetContract(node.right);
        addVote(scalarOrArrayRootName(node.left), contract.type, contract.abi, shadowed);
        return;
      }
      if (
        node.operatorToken?.kind === 17 /* SyntaxKind.EqualsEqualsToken */ ||
        node.operatorToken?.kind === 18 /* SyntaxKind.ExclamationEqualsToken */
      ) {
        const left = callContract(node.left);
        const right = callContract(node.right);
        addVote(scalarOrArrayRootName(node.right), left.type, left.abi, shadowed);
        addVote(scalarOrArrayRootName(node.left), right.type, right.abi, shadowed);
      }
    });
  }
  for (const [id, candidates] of votes)
    if (candidates.size === 1) {
      const variable = ctx.elements[id];
      variable.variableType = { ...candidates.values().next().value };
    }
}
function applyLocalPresetParamInference(
  statements,
  funcNameToFuncDef,
  elements,
  constToPresetValue,
) {
  const apply = (funcDef, index, constName) => {
    if (!funcDef || index < 0 || !constName) return;
    const valueRef = constToPresetValue.get(constName);
    if (!valueRef) return;
    const presetType = makePresetTypeFromValueRef(valueRef, elements);
    const paramRef = funcDef.parameters?.[index];
    const paramDef = paramRef?.id ? elements[paramRef.id] : undefined;
    if (
      presetType &&
      paramDef?.type === 'ParamDef' &&
      paramDef.paramType?.type?.toLowerCase() === 'int'
    ) {
      paramDef.paramType = presetType;
    }
  };
  for (const stmt of statements) {
    if (stmt?.kind !== 142 /* SyntaxKind.FunctionDeclaration */) continue;
    const fd = stmt;
    const funcName = fd.name?.name;
    const funcDef = funcName ? funcNameToFuncDef.get(funcName) : undefined;
    const params = Array.from(fd.parameters ?? []);
    const paramIndexByName = new Map();
    params.forEach((param, index) => {
      const name = param.name?.name;
      if (name) paramIndexByName.set(name, index);
    });
    walkAst(fd.body, (node) => {
      if (node?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const leftName = getIdentifierName(node.left);
        const rightName = getIdentifierName(node.right);
        if (leftName && constToPresetValue.has(rightName ?? ''))
          apply(funcDef, paramIndexByName.get(leftName) ?? -1, rightName);
        if (rightName && constToPresetValue.has(leftName ?? ''))
          apply(funcDef, paramIndexByName.get(rightName) ?? -1, leftName);
      }
    });
  }
  for (const stmt of statements) {
    walkAst(stmt, (node) => {
      if (node?.kind !== 121 /* SyntaxKind.CallExpression */) return;
      const calleeName = getIdentifierName(node.expression);
      const funcDef = calleeName ? funcNameToFuncDef.get(calleeName) : undefined;
      if (!funcDef) return;
      const args = Array.from(node.arguments ?? []);
      args.forEach((arg, index) => apply(funcDef, index, getIdentifierName(arg)));
    });
  }
}
export {
  resetGalaxyToTriggerIdCounter,
  extractGlobalVarName,
  extractLocalVarName,
  extractAutoVarName,
  extractTriggerName,
  isLibraryBoilerplate,
  isTriggerInitFunction,
  isTriggerBodyFunction,
};
export function parseGalaxySource(galaxyCode, fileName) {
  const parser = new Parser();
  const sourceFile = parser.parseFile(fileName ?? 'Lib.galaxy', galaxyCode);
  sourceFile.__sourceText = galaxyCode;
  return sourceFile;
}
function customScriptIncludes(source, headerInclude) {
  const statements = Array.from(source.statements);
  const include = (statement) => statement.kind === 136; /* SyntaxKind.IncludeStatement */
  // The editor heads custom script with a `// Custom Script` banner and writes its own
  // includes above the first one: HotCargo's custom script "Triggers" includes
  // TriggerLibs/AI and TriggerLibs/Computer before any declaration of the map.
  const text = source.__sourceText;
  const banner = typeof text === 'string' ? text.search(/^[ \t]*\/\/ Custom Script\b/mu) : -1;
  const aboveBanner = (statement) => {
    if (banner < 0 || typeof text !== 'string') return true;
    const keyword = text.slice(statement.pos).search(/\binclude\s*"/u);
    return keyword < 0 || statement.pos + keyword < banner;
  };
  let first = statements.findIndex((statement) => !include(statement) || !aboveBanner(statement));
  if (first < 0) first = statements.length;
  const header =
    headerInclude === undefined
      ? -1
      : statements.findIndex(
          (statement) =>
            include(statement) && (statement.path?.value ?? statement.path?.text) === headerInclude,
        );
  const lead = header >= 0 && header < first ? header + 1 : first;
  let last = statements.length - 1;
  while (last >= lead && include(statements[last])) last -= 1;
  return statements.slice(lead, last + 1).filter(include);
}
export function convertGalaxyToTriggerLibrary(galaxySource, headerSource, options) {
  // A map's script names nothing after the document, so the whole reading of it
  // runs in that namespace -- the same one the forward direction wrote in.
  const scriptName = galaxySource.fileName;
  const headerName =
    headerSource.fileName === scriptName
      ? '__header__/' + headerSource.fileName
      : headerSource.fileName;
  const offeredFiles = [
    { fileName: scriptName, text: galaxySource.text, sourceId: 'owned:script', owned: true },
    { fileName: headerName, text: headerSource.text, sourceId: 'owned:header', owned: true },
    ...(options.semanticDeclarations ?? options.galaxyDeclarations ?? [])
      .filter((f) => ![scriptName, headerName].includes(f.fileName))
      .map((f) => ({ ...f, sourceId: 'active-dependency:' + f.fileName, owned: false })),
  ];
  const files = offeredFiles.map((f) => {
    const identity = options.inputSnapshot?.files.find((s) => s.fileName === f.fileName);
    return identity ? { ...identity, text: f.text } : f;
  });
  const completeSnapshot =
    options.inputSnapshot &&
    files.every((f) => options.inputSnapshot.files.some((s) => s.fileName === f.fileName))
      ? options.inputSnapshot
      : undefined;
  const program =
    options.programContext ?? new GalaxyProgramContext(files, completeSnapshot, options.hashText);
  program.attachOriginal(galaxySource, scriptName);
  program.attachOriginal(headerSource, headerName);
  const session = new RecoverySession(program, [
    ...new Map(
      [options.nativeLibrary, ...(options.dependencyLibraries?.values() ?? [])]
        .filter(Boolean)
        .map((l) => [l.id, l]),
    ).values(),
  ]);
  try {
    const conflicts = program
      .report()
      .diagnostics.filter((d) => d.code === 'AMBIGUOUS_DECLARATION');
    if (program.conflictingDeclarationNames().length)
      conversionError(
        'CONFLICTING_DECLARATIONS',
        'Active Galaxy declarations conflict before lowering',
        { symbols: program.conflictingDeclarationNames(), diagnostics: conflicts },
      );
    return withNativeGuiFacts(
      [galaxySource, headerSource],
      () =>
        withImplicitLibrary(options.implicitLibrary === true ? options.libraryId : undefined, () =>
          withNamingIndexes(() =>
            convertGalaxyToTriggerLibraryBody(galaxySource, headerSource, {
              ...options,
              programContext: program,
              recoverySession: session,
            }),
          ),
        ),
      options.semanticDeclarations ?? options.galaxyDeclarations ?? [],
    );
  } finally {
    try {
      options.onRecoveryReport?.(session.report());
    } finally {
      session.dispose();
      session.plan.dispose();
      if (!options.programContext) program.dispose();
    }
  }
}
function reportConversionProgress(options, phase, completed, total, elements) {
  if (!options.onProgress) return;
  try {
    withIsolatedGalaxyToTriggerIds(() =>
      withIsolatedNamingIndexes(() =>
        options.onProgress({ phase, completed, total, elements: Object.keys(elements).length }),
      ),
    );
  } catch {
    // Progress is observational. AbortSignal, not a UI callback exception, is
    // the supported way to cancel a conversion.
  }
}
function convertGalaxyToTriggerLibraryBody(galaxySource, headerSource, options) {
  for (const source of [galaxySource, headerSource])
    if (source.parseDiagnostics?.length) {
      conversionError('GALAXY_SYNTAX', 'Galaxy input contains syntax errors', {
        file: source.fileName,
        diagnostics: source.parseDiagnostics.map((diagnostic) => diagnostic.messageText),
      });
    }
  const dependencyDeclarationSources = (options.galaxyDeclarations ?? []).map((file) =>
    parseGalaxySource(file.text, file.fileName),
  );
  const externalFuncParamTypes = new Map(options.externalFuncParamTypes ?? []);
  const ambiguousFunctionSignatures = new Set();
  for (const source of [...dependencyDeclarationSources, headerSource, galaxySource]) {
    for (const statement of source.statements) {
      if (statement.kind !== 142 /* SyntaxKind.FunctionDeclaration */) continue;
      const name = getIdentifierName(statement.name);
      if (!name || ambiguousFunctionSignatures.has(name)) continue;
      const parameterTypes = Array.from(statement.parameters ?? []).map((parameter) =>
        getTypeName(parameter.type),
      );
      const prior = externalFuncParamTypes.get(name);
      if (
        prior &&
        (prior.length !== parameterTypes.length ||
          prior.some((type, index) => type !== parameterTypes[index]))
      ) {
        // Conflicting declarations are not sufficient evidence for ABI-guided
        // lowering. Keep the structural TriggerData contract and decline the
        // hint instead of choosing one declaration by load order.
        externalFuncParamTypes.delete(name);
        ambiguousFunctionSignatures.add(name);
      } else if (!prior) {
        externalFuncParamTypes.set(name, parameterTypes);
      }
    }
  }
  const constants = new GalaxyConstantIndex(
    [...dependencyDeclarationSources, headerSource, galaxySource],
    options.constantFolds,
  );
  const elements = {};
  options.recoverySession?.attach(elements);
  const libId = options.libraryId;
  // Build reverse lookup maps (requires nativeLibrary)
  const funcNameToFuncDef =
    options.recoverySession?.candidates.uniqueMap() ??
    buildFuncNameToFuncDefMap(options.nativeLibrary);
  const roleToSubFuncType = buildRoleToSubFuncTypeMap(options.nativeLibrary);
  const galaxyConstToPreset = buildGalaxyConstToPresetMap(
    options.nativeLibrary,
    options.dependencyLibraries,
  );
  // A shipped library can drop every preset name (SwarmCampaignLib) while its
  // header still declares the generated constants. The forward converter aligns
  // them with the header; the reverse direction reads the same alignment, or
  // `libSwaC_ge_CampaignHeroes_None` stays an unbound name.
  // ponytail: parses the declarations a second time; share the parsed sources if it shows up in profiles.
  withNamingIndexes(() => {
    indexDeclaredGalaxySymbols(
      options.galaxyDeclarations,
      [options.nativeLibrary, ...(options.dependencyLibraries?.values() ?? [])].filter(
        (library) => !!library,
      ),
    );
    for (const [key, name] of namingIndexes().presetValueNames) {
      if (galaxyConstToPreset.has(name)) continue;
      const [library, type, id] = JSON.parse(key);
      galaxyConstToPreset.set(name, { type: type, library, id });
    }
  });
  if (!options.recoverySession) {
    for (const library of options.dependencyLibraries?.values() ?? []) {
      for (const [name, definition] of buildFuncNameToFuncDefMap(library))
        if (!funcNameToFuncDef.has(name)) funcNameToFuncDef.set(name, definition);
    }
  }
  for (const [name, definition] of matchDependencyFunctionDeclarations(
    dependencyDeclarationSources,
    options.dependencyLibraries?.values() ?? [],
  ))
    if (!funcNameToFuncDef.has(name)) funcNameToFuncDef.set(name, definition);
  // Seed funcNameToFuncDef with cross-library function defs from already-converted libraries.
  // This allows callExprToFCRef to resolve lib{OTHER}_gf_{name} to proper element refs.
  if (options.crossLibFuncDefs) {
    for (const [galaxyName, ref] of options.crossLibFuncDefs) {
      if (funcNameToFuncDef.has(galaxyName)) continue;
      const match = /^lib([A-Za-z0-9]+)_gf_([A-Za-z0-9_]+)$/.exec(galaxyName);
      const displayName = match?.[2];
      if (!displayName) continue;
      funcNameToFuncDef.set(galaxyName, {
        type: 'FunctionDef',
        id: ref.id,
        library: ref.library,
        name: displayName,
        parameters: ref.parameters ?? [],
      });
    }
  }
  // Global var map: galaxy identifier → {id, library}; seeded with cross-library vars
  const globalVarByGalaxyName = new Map(options.crossLibVars ?? []);
  for (const library of options.dependencyLibraries?.values() ?? [])
    if (library.id !== libId) {
      const variables = globalVariables(library);
      const names = globalVariableNames(library.id, variables);
      for (const variable of variables) {
        const name = names.get(variable.id);
        // A loaded library's explicit identifier may be spelled either way (globalVariableSpellings).
        const spellings =
          name === globalVariableSpellings(library.id, variable)[0]
            ? globalVariableSpellings(library.id, variable)
            : [name];
        for (const spelling of spellings)
          if (!globalVarByGalaxyName.has(spelling))
            globalVarByGalaxyName.set(spelling, { id: variable.id, library: library.id });
      }
    }
  const structureByGalaxyTypeName = new Map();
  const structureMemberByKey = new Map();
  const topLevelStatements = getTopLevelStatements(headerSource, galaxySource);
  const threadedPatterns = recognizeThreadedFunctions(topLevelStatements, libId);
  const threadedCallbacks = new Set(
    [...threadedPatterns.values()].map((pattern) => pattern.callbackName),
  );
  const threadedGlobals = new Set(
    [...threadedPatterns.values()].flatMap((pattern) => [...pattern.machineryGlobals]),
  );
  reportConversionProgress(options, 'index', 0, topLevelStatements.length, elements);
  resolveGalaxyTypeAliases(topLevelStatements);
  // Register every structure before resolving parameters or nested members.
  for (const statement of topLevelStatements)
    if (statement.kind === 140 /* SyntaxKind.StructDeclaration */) {
      structureByGalaxyTypeName.set(statement.name.name, {
        type: 'Structure',
        library: libId,
        id: generateId(),
      });
    }
  const dependencyStructures = namingIndexes().dependencyStructures;
  for (const [name, ref] of dependencyStructures.refsByName) {
    if (structureByGalaxyTypeName.has(name)) continue;
    structureByGalaxyTypeName.set(name, ref);
    const members =
      dependencyStructures.membersByRef.get(JSON.stringify([ref.library, ref.type, ref.id])) ?? [];
    for (const member of members)
      structureMemberByKey.set(structureMemberKey(ref.id, member.name, ref.library), member.ref);
  }
  attachExternalStructureFields(structureByGalaxyTypeName, dependencyDeclarationSources);
  // Naming conventions are evidence only when the callback signature and guards agree.
  const generatedBodies = new Set(
    topLevelStatements
      .filter((node) => {
        if (
          node.kind !== 142 /* SyntaxKind.FunctionDeclaration */ ||
          !isTriggerBodyFunction(node.name?.name ?? '', libId) ||
          getTypeName(node.type) !== 'bool'
        )
          return false;
        const callbackName = node.name.name;
        // An unqualified gt_* callback can be arbitrary hand-written Galaxy and
        // cannot be represented as a library Trigger without changing its public
        // symbol. A map's document format makes its global namespace explicit.
        const ownPrefix = libraryPrefix(libId);
        if (
          !(ownPrefix && callbackName.startsWith(`${ownPrefix}gt_`)) &&
          !(
            options.implicitLibrary &&
            (/^lib[A-Za-z0-9_]+_gt_/u.test(callbackName) || callbackName.startsWith('gt_'))
          )
        )
          return false;
        // Split library conversions own their lib<Id>_ callbacks. A root map
        // cannot fold another library's callback into its gt_ namespace.
        if (options.implicitLibrary === true && /^lib[A-Za-z0-9_]+_gt_/u.test(node.name.name))
          return false;
        const parameters = node.parameters ?? [];
        const body = node.body?.statements ?? [];
        const prefix = analyzeTriggerPrefix(node);
        const emptyCallback = prefix?.length === body.length - 1 && body.length > 0;
        // A trigger with conditions and no actions: the editor writes its conditions
        // block, then `return true;` with no runActions guard (UEDFL Ouroboros, Mercs).
        const conditionsOnly =
          prefix?.length === body.length - 2 &&
          triggerConditionGuards(body[body.length - 2]) !== undefined;
        return (
          !!prefix &&
          parameters.length === 2 &&
          parameters.every((p) => getTypeName(p.type) === 'bool') &&
          parameters[0].name?.name === 'testConds' &&
          parameters[1].name?.name === 'runActions' &&
          body[body.length - 1]?.kind === 137 /* SyntaxKind.ReturnStatement */ &&
          unwrapParens(body[body.length - 1]?.expression)?.kind ===
            67 /* SyntaxKind.TrueKeyword */ &&
          (emptyCallback ||
            conditionsOnly ||
            body.some((s) => {
              const expression = unwrapParens(s.expression);
              const branch =
                s.thenStatement?.kind === 128 /* SyntaxKind.Block */
                  ? s.thenStatement.statements
                  : [s.thenStatement];
              return (
                s.kind === 129 /* SyntaxKind.IfStatement */ &&
                !s.elseStatement &&
                expression?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
                expression.operator?.kind === 32 /* SyntaxKind.ExclamationToken */ &&
                getIdentifierName(expression.operand) === 'runActions' &&
                branch.length === 1 &&
                branch[0]?.kind === 137 /* SyntaxKind.ReturnStatement */ &&
                unwrapParens(branch[0]?.expression)?.kind === 67 /* SyntaxKind.TrueKeyword */
              );
            }))
        );
      })
      .map((node) => node.name.name),
  );
  const generatedInitializers = new Set();
  const unrecoveredTriggerHandles = new Set();
  for (const node of topLevelStatements) {
    if (
      node.kind !== 142 /* SyntaxKind.FunctionDeclaration */ ||
      !node.body ||
      !isTriggerInitFunction(node.name.name, libId)
    )
      continue;
    const bodyName = node.name.name.slice(0, -5) + '_Func';
    if (!generatedBodies.has(bodyName)) continue;
    const handle = node.name.name.slice(0, -5);
    const [create, ...remaining] = Array.from(node.body.statements);
    const assignment =
      create?.kind === 138 /* SyntaxKind.ExpressionStatement */ ? create.expression : undefined;
    const call = assignment?.right;
    // The map document kind is explicit namespace evidence.  A disabled or
    // dynamically registered trigger can legitimately have no static event in
    // its _Init body; requiring one misclassifies the handle as a Variable and
    // leaves the exact _Func/_Init pair as ordinary user functions.
    const validCreate =
      getTypeName(node.type) === 'void' &&
      node.parameters.length === 0 &&
      assignment?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      assignment.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ &&
      getIdentifierName(assignment.left) === handle &&
      call?.kind === 121 /* SyntaxKind.CallExpression */ &&
      getIdentifierName(call.expression) === 'TriggerCreate' &&
      call.arguments.length === 1 &&
      call.arguments[0]?.value === bodyName;
    const valid =
      validCreate &&
      remaining.every((statement) => {
        const event =
          statement.kind === 138 /* SyntaxKind.ExpressionStatement */
            ? statement.expression
            : undefined;
        if (
          event?.kind !== 121 /* SyntaxKind.CallExpression */ ||
          getIdentifierName(event.arguments[0]) !== handle
        )
          return false;
        const name = getIdentifierName(event.expression);
        if (name === 'TriggerEnable')
          return event.arguments.length === 2 && readBoolLiteral(event.arguments[1]) !== undefined;
        const definition = name && funcNameToFuncDef.get(name);
        return (
          definition &&
          definition.flags?.includes('Event') &&
          event.arguments.length === definition.parameters.length + 1
        );
      });
    if (valid) generatedInitializers.add(node.name.name);
    else {
      generatedBodies.delete(bodyName);
      if (validCreate) unrecoveredTriggerHandles.add(handle);
    }
  }
  const generatedInit = (name) => generatedInitializers.has(name);
  const initialization = options.preserveInitialization
    ? undefined
    : recognizeGeneratedInitialization(
        topLevelStatements,
        libId,
        options.nativeLibrary?.id ?? 'Ntve',
        new Set(
          topLevelStatements
            .filter(
              (node) =>
                node.kind === 142 /* SyntaxKind.FunctionDeclaration */ &&
                node.body &&
                generatedInit(node.name.name),
            )
            .map((node) => node.name.name),
        ),
        [...(options.dependencyLibraries?.keys() ?? [])].filter(
          (id) => id !== (options.nativeLibrary?.id ?? 'Ntve'),
        ),
        options.initializedDependencies ? new Set(options.initializedDependencies) : undefined,
      );
  if (initialization?.droppedDependencyCalls)
    options.droppedStartupCalls?.push(...initialization.droppedDependencyCalls);
  const generatedBoilerplate = (name) => initialization?.functions.has(name) ?? false;
  const completionGlobals = initialization?.completionGlobals ?? new Set();
  const functionsWithBodies = new Set(
    topLevelStatements
      .filter((node) => node.kind === 142 /* SyntaxKind.FunctionDeclaration */ && node.body)
      .map((node) => node.name.name),
  );
  // A map-wide fallback can retain code of several embedded libraries.
  // Their prefixes identify distinct executable symbols, never root aliases.
  const qualifiedSourceSymbol = (name) =>
    options.implicitLibrary === true && /^lib[A-Za-z0-9_]+_(?:gf|gv|ge)_/u.test(name);
  const declarationFlags = (name) => [
    ...(!qualifiedSourceSymbol(name) &&
    extractUserFunctionName(name, libId) &&
    !/^\d/u.test(extractUserFunctionName(name, libId))
      ? []
      : ['NoScriptPrefix']),
    ...(!functionsWithBodies.has(name) ? ['Native'] : []),
  ];
  // Bodyless declarations use Native to suppress a generated body. Native
  // names are emitted verbatim, so retain their complete source identifier.
  const declarationName = (name) =>
    functionsWithBodies.has(name)
      ? /^\d/u.test(extractUserFunctionName(name, libId) ?? '')
        ? name
        : (extractUserFunctionName(name, libId) ?? name)
      : name;
  const headerCtx = {
    constants,
    libId,
    elements,
    nativeLibrary: options.nativeLibrary,
    dependencyLibraries: options.dependencyLibraries,
    funcNameToFuncDef,
    roleToSubFuncType,
    localVarByGalaxyName: new Map(),
    globalVarByGalaxyName,
    pendingAutoInits: new Map(),
    pendingAutoEnds: new Map(),
    pendingAutoIncrements: new Map(),
    galaxyConstToPreset,
    structureByGalaxyTypeName,
    structureMemberByKey,
    externalFuncParamTypes,
    crossLibFuncDefs: options.crossLibFuncDefs,
    // A global initializer can call a library function whose definition is not
    // loaded (a COOP map whose commander mod is missing). Trigger and function
    // bodies keep such a call as a synthesized template; without this the header
    // pass would instead name a FunctionDef that exists in no loaded library.
    structuredExpression: (expression, role, scope, expectedType) =>
      structuredNode(
        expression,
        true,
        scope,
        role,
        expectedType ? { type: expectedType } : undefined,
      ),
    sourceText: headerSource.__sourceText,
  };
  reportConversionProgress(
    options,
    'index',
    topLevelStatements.length,
    topLevelStatements.length,
    elements,
  );
  const localPresetConstRefs = collectLocalPresetDeclarations(topLevelStatements, libId, elements);
  for (const [name, ref] of localPresetConstRefs) {
    if (!galaxyConstToPreset.has(name)) galaxyConstToPreset.set(name, ref);
  }
  const headerGlobalVarRefs = new Map(globalVarByGalaxyName);
  for (const stmt of topLevelStatements) {
    if (stmt.kind !== 141 /* SyntaxKind.VariableDeclaration */) continue;
    const vd = stmt;
    const name = vd.name.name;
    if (completionGlobals.has(name)) continue;
    if (threadedGlobals.has(name)) continue;
    if (localPresetConstRefs.has(name)) continue;
    const varName =
      getTypeName(vd.type) === 'trigger' && generatedBodies.has(`${name}_Func`)
        ? undefined
        : (extractGlobalVarName(name, libId) ?? name);
    if (!varName || headerGlobalVarRefs.has(name)) continue;
    headerGlobalVarRefs.set(name, { id: idFromKey(`${libId}|gv|${name}`), library: libId });
  }
  // Some maps keep user-function declarations in MapScript.galaxy itself rather than
  // a separate *_h.galaxy file. Seed those body-less declarations here so the body
  // pass can resolve and serialize the matching FunctionDef elements.
  for (const stmt of galaxySource.statements) {
    if (stmt.kind !== 142 /* SyntaxKind.FunctionDeclaration */) continue;
    const fd = stmt;
    if (fd.body) continue;
    const funcName = fd.name.name;
    if (threadedCallbacks.has(funcName)) continue;
    const displayName =
      generatedBoilerplate(funcName) || generatedInit(funcName) || generatedBodies.has(funcName)
        ? undefined
        : declarationName(funcName);
    if (!displayName) continue;
    if (
      funcNameToFuncDef.has(funcName) &&
      (!functionsWithBodies.has(funcName) || funcNameToFuncDef.get(funcName)?.library === libId)
    )
      continue;
    const returnTypeName = getTypeName(fd.type);
    const isVoid = !returnTypeName || returnTypeName === 'void';
    const id = idFromKey(`${libId}|gf|${funcName}`);
    // declarationName already keeps a bodyless (Native) name verbatim and strips
    // gf_ from a function with a body. The editor prefixes such a name itself, so
    // storing gf_X compiled to gf_gf_X (37 functions of a restored Star Party v).
    // A forward declaration and its body must keep the same qualified ABI.
    const storedName = qualifiedSourceSymbol(funcName) ? funcName : displayName;
    const params = [];
    const galaxyParams = Array.from(fd.parameters ?? []);
    for (let paramIndex = 0; paramIndex < galaxyParams.length; paramIndex++) {
      const p = galaxyParams[paramIndex];
      const paramGalaxyName = p.name?.name ?? '';
      const localName = paramGalaxyName.startsWith('lp_')
        ? paramGalaxyName.slice(3)
        : (extractLocalVarName(paramGalaxyName) ?? paramGalaxyName);
      const paramTypeName = getTypeName(p.type);
      const paramDefId = idFromKey(`${libId}|gf-param|${funcName}|${paramIndex}|${localName}`);
      const paramDef = {
        type: 'ParamDef',
        id: paramDefId,
        library: libId,
        name: localName,
        paramType: triggerParamTypeFromGalaxyTypeName(paramTypeName, headerCtx, true),
      };
      elements[paramDefId] = paramDef;
      params.push({ type: 'ParamDef', library: libId, id: paramDefId });
    }
    const funcDef = {
      type: 'FunctionDef',
      id,
      library: libId,
      name: storedName,
      flags: declarationFlags(funcName),
      parameters: params,
      isFuncAction: isVoid,
      isFuncCall: !isVoid,
      returnType: isVoid
        ? undefined
        : triggerParamTypeFromGalaxyTypeName(returnTypeName, headerCtx),
    };
    elements[id] = funcDef;
    funcNameToFuncDef.set(funcName, funcDef);
  }
  // ---- Header: global variables, trigger handles, and user function declarations ----
  reportConversionProgress(options, 'declarations', 0, topLevelStatements.length, elements);
  for (const stmt of topLevelStatements) {
    if (stmt.kind !== 140 /* SyntaxKind.StructDeclaration */) continue;
    const sd = stmt;
    const structTypeName = sd.name?.name;
    if (!structTypeName) continue;
    const structId = structureByGalaxyTypeName.get(structTypeName).id;
    const memberRefs = [];
    const structureRef = { type: 'Structure', library: libId, id: structId };
    structureByGalaxyTypeName.set(structTypeName, structureRef);
    for (const member of Array.from(sd.members ?? [])) {
      const memberName = member.name?.name ?? '';
      const recoveredMember = extractLocalVarName(memberName);
      const localName = /^\d/u.test(recoveredMember ?? '')
        ? memberName
        : (recoveredMember ?? memberName);
      const { baseType, sizes } = unwrapArrayType(member.type);
      const galaxyTypeName = getTypeName(baseType);
      const variableId = generateId();
      const variable = {
        type: 'Variable',
        id: variableId,
        library: libId,
        name: localName,
        // Bare hand-authored fields are not Editor lv_ names.
        ...(recoveredMember === undefined ? { identifier: memberName } : {}),
        variableType: triggerParamTypeFromGalaxyTypeName(galaxyTypeName, headerCtx),
        isArray: sizes.length > 0 || undefined,
      };
      if (sizes.length > 0) {
        variable.arraySizes = sizes.map((sizeExpr, dim) => {
          const parsed = parseArraySizeExpr(sizeExpr, headerGlobalVarRefs, constants);
          return { dim, ...parsed };
        });
      }
      elements[variableId] = variable;
      const variableRef = { type: 'Variable', library: libId, id: variableId };
      memberRefs.push(variableRef);
      structureMemberByKey.set(structureMemberKey(structId, memberName), variableRef);
    }
    // A map has no owning library wrapper, but authored/generated Galaxy can
    // still carry a historical `lib…_gs_` spelling.  It is linkage syntax, not
    // the editor-visible structure name.  Keep non-map library namespaces
    // intact; only the implicit-map document form establishes this rule.
    const mapStructName = options.implicitLibrary
      ? /^lib[A-Za-z0-9_]+_gs_(.+)$/u.exec(structTypeName)?.[1]
      : undefined;
    // A library names its own structures `lib<Id>_gs_<Name>`; the compiler adds that
    // prefix again, so keeping it in the name wrote `libCAI2_gs_LibCAI2_gs_AIData`.
    const ownPrefix = `lib${libId}_gs_`;
    const structureName =
      mapStructName ??
      (structTypeName.startsWith(ownPrefix)
        ? structTypeName.slice(ownPrefix.length)
        : structTypeName.startsWith('gs_')
          ? structTypeName.slice(3)
          : structTypeName);
    // The Editor normally uppercases the structure stem. A recovered
    // source declaration may have an authored lower-case stem, a bare
    // name or a historical library namespace. Keep its actual ABI.
    const defaultStructureTypeName = `${options.implicitLibrary ? '' : `lib${libId}_`}gs_${structureName.charAt(0).toUpperCase() + structureName.slice(1)}`;
    const preserveStructureIdentifier =
      /^\d/u.test(structureName) || structTypeName !== defaultStructureTypeName;
    const actualOwnPrefix = `${options.implicitLibrary ? '' : `lib${libId}_`}gs_`;
    const sourceStem = structTypeName.startsWith(actualOwnPrefix)
      ? structTypeName.slice(actualOwnPrefix.length)
      : undefined;
    const ownStructureStem =
      sourceStem && /^[A-Za-z_][A-Za-z_0-9]*$/u.test(sourceStem) ? sourceStem : undefined;
    elements[structId] = {
      type: 'Structure',
      id: structId,
      library: libId,
      name: ownStructureStem ?? (preserveStructureIdentifier ? structTypeName : structureName),
      ...(ownStructureStem !== undefined
        ? { identifier: ownStructureStem, flags: ['NoScriptPrefix'] }
        : preserveStructureIdentifier
          ? { identifier: structTypeName, flags: ['NoScriptPrefix'] }
          : {}),
      variables: memberRefs,
    };
  }
  reportConversionProgress(
    options,
    'declarations',
    topLevelStatements.length,
    topLevelStatements.length,
    elements,
  );
  for (const stmt of topLevelStatements) {
    if (stmt.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      const vd = stmt;
      const name = vd.name.name;
      if (completionGlobals.has(name)) continue;
      if (threadedGlobals.has(name)) continue;
      if (localPresetConstRefs.has(name)) continue;
      // Global variable: lib{LIB}_gv_{NAME}
      const varName =
        getTypeName(vd.type) === 'trigger' && generatedBodies.has(`${name}_Func`)
          ? undefined
          : (extractGlobalVarName(name, libId) ?? name);
      if (varName) {
        // Skip if already registered (e.g. duplicate declarations in header)
        if (globalVarByGalaxyName.has(name)) continue;
        const id = headerGlobalVarRefs.get(name)?.id ?? idFromKey(`${libId}|gv|${name}`);
        const { baseType, sizes } = unwrapArrayType(vd.type);
        const galaxyTypeName = getTypeName(baseType);
        const isArray = sizes.length > 0;
        const isConstant = !!(vd.modifiers ?? []).find(
          (m) => m?.kind === 53 /* SyntaxKind.ConstKeyword */,
        );
        const variable = {
          type: 'Variable',
          id,
          library: libId,
          // A digit-leading recovered suffix is not an authored numeric name.
          // Preserve its entire source ABI through the supported XML flag.
          name: qualifiedSourceSymbol(name) || /^\d/u.test(varName) ? name : varName,
          variableType: triggerParamTypeFromGalaxyTypeName(galaxyTypeName, headerCtx),
          ...(qualifiedSourceSymbol(name) ||
          (galaxyTypeName === 'trigger' && unrecoveredTriggerHandles.has(name)) ||
          (extractGlobalVarName(name, libId) === undefined &&
            structureByGalaxyTypeName.get(galaxyTypeName)?.library !== libId) ||
          /^\d/u.test(varName)
            ? { flags: ['NoScriptPrefix'] }
            : {}),
          isArray: isArray || undefined,
          isConstant: isConstant || undefined,
        };
        // Native Editor ignores NoScriptPrefix on GUI global Variables.
        // Preserve the authored stem/case as Identifier and use native gv_.
        // Do not change loaded libraries, function flags, or local names.
        if (variable.flags?.includes('NoScriptPrefix')) {
          variable.identifier = extractGlobalVarName(name, libId) ?? variable.name;
          variable.name = variable.identifier;
          variable.flags = variable.flags.filter((flag) => flag !== 'NoScriptPrefix');
        }
        if (isArray) {
          variable.arraySizes = sizes.map((sizeExpr, dim) => {
            const parsed = parseArraySizeExpr(sizeExpr, headerGlobalVarRefs, constants);
            return { dim, ...parsed };
          });
        }
        elements[id] = variable;
        globalVarByGalaxyName.set(name, { id, library: libId });
        if (vd.initializer) {
          variable.initialValue = structuredParam(
            vd.initializer,
            headerCtx,
            undefined,
            variable.variableType?.type,
          );
        }
        continue;
      }
      // Trigger handle (lib{LIB}_gt_{NAME}) → skip, resolved via body function
    }
    // User function forward declaration: returnType lib{LIB}_gf_{NAME}(params...) or gf_{NAME}(params...)
    if (stmt.kind === 142 /* SyntaxKind.FunctionDeclaration */) {
      const fd = stmt;
      const funcName = fd.name.name;
      if (threadedCallbacks.has(funcName)) continue;
      const displayName =
        generatedBoilerplate(funcName) || generatedInit(funcName) || generatedBodies.has(funcName)
          ? undefined
          : declarationName(funcName);
      if (!displayName) continue;
      // Skip if already registered (e.g. both header and body have this decl)
      if (
        funcNameToFuncDef.has(funcName) &&
        (!functionsWithBodies.has(funcName) || funcNameToFuncDef.get(funcName)?.library === libId)
      )
        continue;
      const returnTypeName = getTypeName(fd.type);
      const isVoid = !returnTypeName || returnTypeName === 'void';
      const id = idFromKey(`${libId}|gf|${funcName}`);
      const storedName = qualifiedSourceSymbol(funcName) ? funcName : displayName;
      const params = [];
      const galaxyParams = Array.from(fd.parameters ?? []);
      for (let paramIndex = 0; paramIndex < galaxyParams.length; paramIndex++) {
        const p = galaxyParams[paramIndex];
        const paramGalaxyName = p.name?.name ?? '';
        // ParamDef names are stored WITHOUT the lp_ prefix — T2G re-adds it.
        // Keeping the prefix here produces lp_lp_* body references (mismatch
        // with the generated signature) after roundtrip.
        const localName = paramGalaxyName.startsWith('lp_')
          ? paramGalaxyName.slice(3)
          : (extractLocalVarName(paramGalaxyName) ?? paramGalaxyName);
        const paramTypeName = getTypeName(p.type);
        const paramDefId = idFromKey(`${libId}|gf-param|${funcName}|${paramIndex}|${localName}`);
        const paramDef = {
          type: 'ParamDef',
          id: paramDefId,
          library: libId,
          name: localName,
          paramType: triggerParamTypeFromGalaxyTypeName(paramTypeName, headerCtx, true),
        };
        elements[paramDefId] = paramDef;
        params.push({ type: 'ParamDef', library: libId, id: paramDefId });
      }
      const funcDef = {
        type: 'FunctionDef',
        id,
        library: libId,
        name: storedName,
        flags: declarationFlags(funcName),
        parameters: params,
        isFuncAction: isVoid,
        isFuncCall: !isVoid,
        returnType: isVoid
          ? undefined
          : triggerParamTypeFromGalaxyTypeName(returnTypeName, headerCtx),
      };
      elements[id] = funcDef;
      funcNameToFuncDef.set(funcName, funcDef);
    }
  }
  // Native declarations outside TriggerLib XML are still valid editor
  // contracts. The editor materializes a local FlagNative FunctionDef when a
  // library calls one of them. Reconstruct only declarations that are actually
  // called, and only when no loaded TriggerLib definition already represents
  // the function; this keeps arbitrary API declaration files from bloating the
  // trigger document.
  const calledNames = calledFunctionNames(topLevelStatements);
  const materializedNativeDefinitions = new Map();
  for (const [funcName, fd] of nativeDependencyDeclarations(
    dependencyDeclarationSources,
    calledNames,
  )) {
    const candidateResolution = options.recoverySession?.candidates.resolve({
      name: funcName,
      declaration: {
        returnType: getTypeName(fd.type),
        parameters: Array.from(fd.parameters ?? []).map((p) => getTypeName(p.type)),
      },
    });
    if (candidateResolution?.status === 'AMBIGUOUS')
      conversionError(
        'AMBIGUOUS_FUNCTION_BINDING',
        'Native declaration matches multiple active GUI FunctionDefs',
        { name: funcName, candidates: candidateResolution.candidateKeys },
      );
    if (candidateResolution?.status === 'RESOLVED')
      funcNameToFuncDef.set(funcName, candidateResolution.definition);
    const loadedDefinition = funcNameToFuncDef.get(funcName);
    const legacyAccessor = bindLegacyLoopAccessor(
      options.recoverySession?.candidates,
      funcName,
      {
        returnType: getTypeName(fd.type),
        parameters: Array.from(fd.parameters ?? []).map((p) => getTypeName(p.type)),
      },
      loadedDefinition,
      functionsWithBodies.has(funcName),
    );
    if (legacyAccessor) {
      funcNameToFuncDef.set(funcName, legacyAccessor);
      continue;
    }
    // A pure #AUTOVAR accessor is only a valid representation while its named
    // GUI ancestor is active. Galaxy can also call the native bearing the same
    // spelling outside that ancestor (legacy loop-current APIs are common
    // examples). Preserve the declaration as a local FlagNative definition in
    // that case; otherwise the generic template fallback makes the editor emit
    // an undefined lf_* helper. The distinction is derived from TriggerLib and
    // Galaxy declarations, not from a list of API names.
    if (loadedDefinition && !contextualAutoAncestor(loadedDefinition)) continue;
    const parameters = [];
    const galaxyParams = Array.from(fd.parameters ?? []);
    for (let paramIndex = 0; paramIndex < galaxyParams.length; paramIndex++) {
      const parameter = galaxyParams[paramIndex];
      const parameterName = parameter.name?.name ?? `value${paramIndex + 1}`;
      const id = idFromKey(`${libId}|native-param|${funcName}|${paramIndex}|${parameterName}`);
      elements[id] = {
        type: 'ParamDef',
        id,
        library: libId,
        name: parameterName,
        paramType: triggerParamTypeFromGalaxyTypeName(getTypeName(parameter.type), headerCtx, true),
      };
      parameters.push({ type: 'ParamDef', id, library: libId });
    }
    const returnTypeName = getTypeName(fd.type) || 'void';
    const isVoid = returnTypeName === 'void';
    const id = idFromKey(`${libId}|native|${funcName}`);
    const definition = {
      type: 'FunctionDef',
      id,
      library: libId,
      name: funcName,
      flags: ['Native', 'NoScriptPrefix'],
      parameters,
      isFuncAction: isVoid,
      isFuncCall: !isVoid,
      returnType: isVoid
        ? undefined
        : triggerParamTypeFromGalaxyTypeName(returnTypeName, headerCtx),
    };
    elements[id] = definition;
    funcNameToFuncDef.set(funcName, definition);
    materializedNativeDefinitions.set(
      id,
      parameters.map((parameter) => parameter.id),
    );
  }
  // Map trigger handle galaxy name → TriggerJson for event injection in second pass
  applyLocalPresetParamInference(
    topLevelStatements,
    funcNameToFuncDef,
    elements,
    localPresetConstRefs,
  );
  applyGlobalVariableDomainInference(
    topLevelStatements,
    [...dependencyDeclarationSources, headerSource, galaxySource],
    headerCtx,
  );
  const dependencyTriggerRefs = declaredExternalTriggerReferences(
    dependencyDeclarationSources,
    options.dependencyLibraries?.values(),
    libId,
  );
  const triggerByHandleName = new Map();
  const buildTriggerByGalaxyName = () =>
    new Map([
      ...dependencyTriggerRefs,
      ...[...triggerByHandleName.entries()].map(([name, t]) => [
        name,
        { type: 'Trigger', library: libId, id: t.id },
      ]),
    ]);
  // The generator emits Global Functions before any trigger, and a trigger may
  // call one declared further down the file. Converting bodies in source order
  // leaves every such handle unresolved, and an unresolved handle becomes a
  // synthesized template that the editor re-emits as a call to a function it
  // never defines. Reserve each trigger's identity before any body is read.
  const triggerIdByFuncName = new Map();
  for (const stmt of galaxySource.statements) {
    if (stmt.kind !== 142 /* SyntaxKind.FunctionDeclaration */ || !stmt.body) continue;
    const funcName = stmt.name.name;
    if (!generatedBodies.has(funcName) || generatedBoilerplate(funcName) || generatedInit(funcName))
      continue;
    const triggerName = extractTriggerName(funcName, libId);
    if (!triggerName) continue;
    const id = generateId();
    triggerIdByFuncName.set(funcName, id);
    const handle = { type: 'Trigger', id, library: libId, name: triggerName };
    // Reserve the complete typed element, not only its id. Earlier trigger
    // bodies and Custom Script fallbacks may reference a trigger declared later
    // in source order; they need its name to emit the document's final Galaxy
    // namespace. The full body replaces this stub in pass 1.
    elements[id] = handle;
    triggerByHandleName.set(funcName.slice(0, -5), handle);
    triggerByHandleName.set(`${libraryPrefix(libId)}gt_${triggerName}`, handle);
    triggerByHandleName.set(`gt_${triggerName}`, handle);
  }
  // ---- Pass 1: trigger body functions ----
  const bodyDeclarations = [...galaxySource.statements].filter(
    (stmt) => stmt.kind === 142 /* SyntaxKind.FunctionDeclaration */,
  );
  const bodyProgressStride = Math.max(1, Math.floor(bodyDeclarations.length / 100));
  for (let bodyIndex = 0; bodyIndex < bodyDeclarations.length; bodyIndex++) {
    const stmt = bodyDeclarations[bodyIndex];
    if (bodyIndex % bodyProgressStride === 0)
      reportConversionProgress(options, 'bodies', bodyIndex, bodyDeclarations.length, elements);
    const fd = stmt;
    const funcName = fd.name.name;
    if (threadedCallbacks.has(funcName)) continue;
    if (generatedBoilerplate(funcName)) {
      continue;
    }
    if (generatedInit(funcName)) continue;
    if (generatedBodies.has(funcName)) {
      const triggerName = extractTriggerName(funcName, libId);
      if (triggerName && fd.body) {
        const trigger = convertTriggerBody(
          fd,
          triggerName,
          libId,
          elements,
          funcNameToFuncDef,
          roleToSubFuncType,
          globalVarByGalaxyName,
          galaxyConstToPreset,
          structureByGalaxyTypeName,
          structureMemberByKey,
          options.nativeLibrary,
          externalFuncParamTypes,
          options.crossLibFuncDefs,
          galaxySource.__sourceText,
          buildTriggerByGalaxyName(),
          options.dependencyLibraries,
          constants,
          triggerIdByFuncName.get(funcName),
        );
        elements[trigger.id] = trigger;
        triggerByHandleName.set(funcName.slice(0, -5), trigger);
        triggerByHandleName.set(`${libraryPrefix(libId)}gt_${triggerName}`, trigger);
        triggerByHandleName.set(`gt_${triggerName}`, trigger);
      }
      continue;
    }
    // User function body: lib{LIB}_gf_{Name} or gf_{Name}
    const displayName =
      generatedBoilerplate(funcName) || generatedInit(funcName) || generatedBodies.has(funcName)
        ? undefined
        : (extractUserFunctionName(funcName, libId) ?? funcName);
    if (displayName && fd.body) {
      const funcDef =
        funcNameToFuncDef.get(funcName) ??
        funcNameToFuncDef.get(`${libraryPrefix(libId)}gf_${displayName}`) ??
        funcNameToFuncDef.get(`gf_${displayName}`);
      if (funcDef) {
        const threaded = threadedPatterns.get(funcName);
        const sourceFunction = threaded?.authoredFunction ?? fd;
        const returnTypeName = getTypeName(sourceFunction.type);
        const isVoid = !returnTypeName || returnTypeName === 'void';
        funcDef.returnType = triggerParamTypeFromGalaxyTypeName(
          returnTypeName || 'void',
          headerCtx,
        );
        funcDef.isFuncAction = isVoid;
        funcDef.isFuncCall = !isVoid;
        if (threaded) funcDef.flags = [...new Set([...(funcDef.flags ?? []), 'CreateThread'])];
        const { actions, localVariables } = convertUserFunctionBody(
          sourceFunction,
          funcDef,
          libId,
          elements,
          funcNameToFuncDef,
          roleToSubFuncType,
          globalVarByGalaxyName,
          galaxyConstToPreset,
          structureByGalaxyTypeName,
          structureMemberByKey,
          options.nativeLibrary,
          externalFuncParamTypes,
          options.crossLibFuncDefs,
          galaxySource.__sourceText,
          buildTriggerByGalaxyName(),
          options.dependencyLibraries,
          constants,
        );
        funcDef.actions = actions;
        funcDef.localVariables = localVariables;
        funcDef.scriptCode = undefined;
      }
    }
  }
  reportConversionProgress(
    options,
    'bodies',
    bodyDeclarations.length,
    bodyDeclarations.length,
    elements,
  );
  reportConversionProgress(options, 'initialization', 0, 1, elements);
  for (const [name, value] of initialization?.initialValues ?? []) {
    const ref = globalVarByGalaxyName.get(name);
    const variable = ref?.library === libId ? elements[ref.id] : undefined;
    if (!variable || variable.type !== 'Variable')
      conversionError('INITIALIZATION_REFERENCE', 'Verified initialization target is unavailable', {
        name,
      });
    variable.initialValue =
      explicitIntegerZeroParam(value, variable, headerCtx, constants) ??
      structuredParam(value, headerCtx, undefined, variable.variableType?.type);
  }
  // A member default belongs to the structure, so two arrays of one structure
  // cannot carry different defaults for the same member; the model has nowhere
  // to put the second. Recovering the first and dropping the rest would lose
  // initialization silently, so the disagreement is reported instead.
  const structureDefaultSource = new Map();
  for (const entry of initialization?.structureValues ?? []) {
    const ref = globalVarByGalaxyName.get(entry.array);
    const variable = ref?.library === libId ? elements[ref.id] : undefined;
    if (!variable || variable.type !== 'Variable')
      conversionError('INITIALIZATION_REFERENCE', 'Verified initialization target is unavailable', {
        name: entry.array,
      });
    // The path walks structure by structure: each member names the next one.
    let owner = variable;
    let member;
    let memberRef;
    for (const name of entry.path) {
      const structureId = owner.variableType?.typeElement?.id;
      memberRef = structureId
        ? (structureMemberByKey.get(structureMemberKey(structureId, `lv_${name}`)) ??
          structureMemberByKey.get(structureMemberKey(structureId, name)))
        : undefined;
      if (!memberRef) break;
      member = elements[memberRef.id];
      owner = member;
    }
    if (!memberRef || !member) {
      conversionError('STRUCTURE_MEMBER', 'Initialized structure member cannot be resolved', {
        array: entry.array,
        path: entry.path.join('.'),
      });
    }
    const source = JSON.stringify(syntaxShape(entry.value));
    const seen = structureDefaultSource.get(memberRef.id);
    if (seen !== undefined && seen !== source) {
      conversionError(
        'STRUCTURE_DEFAULT_CONFLICT',
        'Arrays of one structure declare different defaults for a member',
        { path: entry.path.join('.') },
      );
    }
    structureDefaultSource.set(memberRef.id, source);
    member.initialValue =
      explicitIntegerZeroParam(entry.value, member, headerCtx, constants) ??
      structuredParam(entry.value, headerCtx, undefined, member.variableType?.type);
  }
  if (initialization?.customInitializerBody) {
    const occupied = new Set(topLevelStatements.map((node) => node.name?.name).filter(Boolean));
    const baseName = 'modkitRecoveredInitGlobals';
    let initFunc = baseName;
    for (let suffix = 1; occupied.has(initFunc); suffix += 1) initFunc = `${baseName}${suffix}`;
    const id = idFromKey(`${libId}|custom-initializer|${initFunc}`);
    elements[id] = {
      type: 'CustomScript',
      id,
      library: libId,
      name: 'Recovered Initialization',
      scriptCode: `void ${initFunc} () ${rewriteBoundInitializationBody(initialization.customInitializerBody, { ...headerCtx, sourceText: galaxySource.__sourceText })}`,
      initFunc,
    };
  }
  // Custom script no other element regenerates: the includes a CustomScript wrote, and
  // the initializers the startup's InitCustomScript calls. The editor writes that stage
  // for any document with custom script, one of comments only too (Cold expedition's
  // Starcode library), so a stage that calls nothing still keeps one CustomScript.
  const customScripts = [];
  const ownHeaderInclude = options.implicitLibrary === true ? undefined : `Lib${libId}_h`;
  const managedIncludePaths = [...(options.dependencyLibraries?.values() ?? [])]
    .flatMap((library) => [library.includePath, `Lib${library.id}`, `Lib${library.id}_h`])
    .filter(Boolean);
  const includes = retainPrimaryCustomIncludes(
    galaxySource,
    customScriptIncludes(galaxySource, ownHeaderInclude),
    ownHeaderInclude,
    options.primaryGalaxyIncludeFiles ?? [],
    managedIncludePaths,
  );
  if (includes.length)
    customScripts.push({
      type: 'CustomScript',
      id: idFromKey(`${libId}|custom-script|includes`),
      library: libId,
      name: 'Includes',
      displayName: 'Includes',
      scriptCode: includes.map((statement) => printNode(statement).trim()).join('\n'),
    });
  for (const [index, initFunc] of (initialization?.customScriptInitializers ?? []).entries())
    customScripts.push({
      type: 'CustomScript',
      id: idFromKey(`${libId}|custom-script|${index}|${initFunc}`),
      library: libId,
      name: initFunc,
      displayName: initFunc,
      initFunc,
    });
  // An empty generated InitCustomScript stage has no authored executable
  // body. Do not manufacture a blank GUI Custom Script item to keep that
  // boilerplate function. Real includes, initializer calls and residual
  // initialization bodies above remain represented and are never discarded.
  for (const custom of customScripts) elements[custom.id] = custom;
  reportConversionProgress(options, 'initialization', 1, 1, elements);
  // ---- Pass 2: trigger init functions → recover events ----
  const eventDeclarations = bodyDeclarations.filter((stmt) => generatedInit(stmt.name?.name ?? ''));
  const eventProgressStride = Math.max(1, Math.floor(eventDeclarations.length / 100));
  for (let eventIndex = 0; eventIndex < eventDeclarations.length; eventIndex++) {
    const stmt = eventDeclarations[eventIndex];
    if (eventIndex % eventProgressStride === 0)
      reportConversionProgress(options, 'events', eventIndex, eventDeclarations.length, elements);
    const fd = stmt;
    const funcName = fd.name.name;
    if (!generatedInit(funcName)) continue;
    const handleName = funcName.slice(0, -5);
    const triggerName = extractTriggerName(`${handleName}_Func`, libId);
    if (!triggerName) continue;
    const trigger = triggerByHandleName.get(handleName);
    if (!trigger) continue;
    const ctx = {
      libId,
      elements,
      nativeLibrary: options.nativeLibrary,
      dependencyLibraries: options.dependencyLibraries,
      funcNameToFuncDef,
      roleToSubFuncType,
      localVarByGalaxyName: new Map(),
      globalVarByGalaxyName,
      pendingAutoInits: new Map(),
      pendingAutoEnds: new Map(),
      pendingAutoIncrements: new Map(),
      galaxyConstToPreset,
      structureByGalaxyTypeName,
      structureMemberByKey,
      triggerByGalaxyName: buildTriggerByGalaxyName(),
      externalFuncParamTypes,
      crossLibFuncDefs: options.crossLibFuncDefs,
      sourceText: galaxySource.__sourceText,
    };
    for (const s of fd.body?.statements ?? []) {
      if (s.kind !== 138 /* SyntaxKind.ExpressionStatement */) continue;
      const expr = s.expression;
      if (!expr) continue;
      // Skip: triggerHandle = TriggerCreate("...")
      if (
        expr.kind === 124 /* SyntaxKind.BinaryExpression */ &&
        expr.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ &&
        expr.right?.kind === 121 /* SyntaxKind.CallExpression */ &&
        expr.right?.expression?.name === 'TriggerCreate'
      )
        continue;
      // Event registration: TriggerAdd*(handle, ...eventArgs) or TriggerRegister*(handle, ...eventArgs)
      if (expr.kind === 121 /* SyntaxKind.CallExpression */) {
        const calleeName = expr.expression?.name ?? '';
        const funcDef = funcNameToFuncDef.get(calleeName);
        if (calleeName === 'TriggerEnable') {
          const args = Array.from(expr.arguments ?? []);
          const targetName = getIdentifierName(args[0]);
          const enabled = readBoolLiteral(args[1]);
          if (targetName === handleName) {
            // Inside its own init function this call is the editor's "Initially
            // Off", not a disabled element: a disabled trigger has no init
            // function in editor output at all.
            if (enabled === false) trigger.initOff = true;
            if (enabled === true) trigger.initOff = undefined;
          }
          continue;
        }
        if (!funcDef?.flags?.includes('Event')) continue;
        // Drop first argument (trigger handle); remaining args are event params
        const args = Array.from(expr.arguments ?? []).slice(1);
        const parameters = args.map((arg, i) => {
          const paramDefRef = funcDef?.parameters?.[i];
          return structuredParam(arg, ctx, paramDefRef);
        });
        const id = generateId();
        const fcElement = {
          type: 'FunctionCall',
          id,
          library: libId,
          functionDef: funcDef
            ? fdRef(funcDef)
            : { type: 'FunctionDef', library: 'Ntve', id: calleeName },
          ...(parameters.length > 0 ? { parameters } : {}),
        };
        elements[id] = fcElement;
        trigger.events.push({ type: 'FunctionCall', library: libId, id });
      }
    }
  }
  reportConversionProgress(
    options,
    'events',
    eventDeclarations.length,
    eventDeclarations.length,
    elements,
  );
  // Declarations are indexed before body lowering so a genuinely retained raw
  // native call can be represented. Generated loop machinery and encoded
  // scalar constructors may disappear during structural lowering, however;
  // leaving their provisional FunctionDefs behind exposes phantom user
  // functions in the editor (and repeats them in every library). Keep only
  // definitions referenced by an actual reconstructed FunctionCall.
  const referencedLocalFunctionDefs = new Set(
    Object.values(elements)
      .filter((element) => element.type === 'FunctionCall')
      .map((call) => call.functionDef)
      .filter((ref) => (ref?.library ?? libId) === libId)
      .map((ref) => ref.id),
  );
  for (const [definitionId, parameterIds] of materializedNativeDefinitions) {
    if (referencedLocalFunctionDefs.has(definitionId)) continue;
    delete elements[definitionId];
    for (const parameterId of parameterIds) delete elements[parameterId];
  }
  // Drop speculative Param/FunctionCall elements no parent references —
  // serializing them produces editor 'Orphaned trigger parameter/function
  // call removed' warnings and cascading data loss on first save.
  // Authored raw global initializers stay in their existing CustomScript stage.
  retainInlineCustomGlobals({
    statements: topLevelStatements,
    elements,
    globalVars: globalVarByGalaxyName,
    libId,
    initialization,
    printNode,
    getTypeName,
    idFromKey,
  });
  normalizeTriggerValueParams(elements, libId, options.nativeLibrary, buildTriggerByGalaxyName());
  pruneUnreachableElements(elements, libId);
  const requiredInitPrototypes = ownedTriggerInitPrototypes(elements, libId, triggerInitFuncName);
  if (requiredInitPrototypes.names.length) {
    const id = generateId();
    elements[id] = {
      type: 'CustomScript',
      id,
      library: libId,
      name: 'Trigger Initializer Declarations',
      scriptCode: requiredInitPrototypes.scriptCode,
    };
  }
  // A variable is a library root when no element owns it. Collect the owned ids
  // in one pass: rescanning every element per variable is quadratic, and a large
  // library spends nearly all of its time here.
  const ownedVariableIds = new Set();
  for (const parent of Object.values(elements)) {
    for (const ref of parent.localVariables ?? parent.variables ?? []) ownedVariableIds.add(ref.id);
  }
  const result = {
    id: libId,
    name: options.libraryName ?? libId,
    // Synthesized templates stay in the tree: SC2 Editor saves only tree elements,
    // so a hidden holder and every call to it were dropped on the first save.
    items: Object.values(elements)
      .filter(
        (e) =>
          ['FunctionDef', 'Trigger', 'Category', 'Structure', 'Preset', 'CustomScript'].includes(
            e.type,
          ) ||
          (e.type === 'Variable' && !ownedVariableIds.has(e.id)),
      )
      .map((e) => ({ type: e.type, library: libId, id: e.id })),
    elements,
    elementsByType: {},
  };
  // Object key enumeration can sort numeric-looking IDs. Preserve declaration
  // order in the root references, which survive XML serialization unchanged.
  const rootVariableIds = new Set(
    result.items.filter((item) => item.type === 'Variable').map((item) => item.id),
  );
  const orderedVariableRefs = [...globalVarByGalaxyName.values()].filter(
    (ref) => ref.library === libId && rootVariableIds.has(ref.id),
  );
  let variableIndex = 0;
  result.items = result.items.map((item) =>
    item.type === 'Variable' && orderedVariableRefs[variableIndex]
      ? { ...item, ...orderedVariableRefs[variableIndex++] }
      : item,
  );
  const symbols = new Map();
  for (const [name, definition] of funcNameToFuncDef)
    if (definition.library === libId && elements[definition.id] === definition)
      symbols.set(name, fdRef(definition));
  for (const [name, variable] of globalVarByGalaxyName)
    if (variable.library === libId) symbols.set(name, { ...variable, type: 'Variable' });
  for (const [name, trigger] of triggerByHandleName)
    symbols.set(name + '_Func', { type: 'Trigger', library: libId, id: trigger.id });
  restoreEditorLayout(galaxySource, result, symbols);
  placeAdditionalScriptFolders(result, options.additionalScriptFolders, symbols);
  reportConversionProgress(options, 'finalize', 1, 1, elements);
  return result;
}
