import {
  lowerRetainedNominalRead,
  lowerRetainedNominalWrite,
  isRetainedNominalInterfaceElement,
} from '../source-nominal-return-roles/retained-nominal-gui-interfaces.replay.mjs';
import { isAuthoredSectionFunctionInterface as boundAuthoredCallInterface } from './authored-section-functions.mixed-atomic.mjs';
import { SyntaxKind as BoundCallSyntax } from '../exact-function-signatures/index-alternate-3.js';
import { templateCalleePresetBindings } from '../exact-function-signatures/template-callee-preset-domain.mjs';
import { qualifiedUnitSnapshot } from '../exact-function-signatures/gui-reference-snapshot.mjs';
import { unitReferenceCarrier as referenceOperandCarrier } from '../../bindings/gui-reference-carrier.qualified.mjs';
import { recoverySessionFor as snapshotRecoverySessionFor } from '../native-expression-identity/recovery-session.mjs';
import { refineBoundCallFormal } from '../exact-function-signatures/bound-source-access.formals.mjs';
import { mapParameterTypeToGalaxy as sourceAccessCarrier } from '../native-expression-identity/core-alternate.mjs';
import { markGeneratedStructuredTemplate } from '../../model/structured-template-liveness.orphan-calls.mjs';
import { buildPreservedSourceValueRead } from '../qualified-macro-binding/preserved-source-value-access.boolean-conditions.mjs';
import { refineBoundCallReturn } from '../exact-function-signatures/bound-source-access.formals.mjs';
import { deferLocalRetirement } from '../../model/deferred-local-retirement.linear.mjs';
import { recoveredEditorLocalIdentity } from '../../model/editor-local-symbols.mjs';
import { stringInitializerCarrier } from '../exact-function-signatures/string-initializer-carrier.canonical-scalar.mjs';
import { deferredScaffoldingCleanup } from '../../bindings/deferred-scaffolding-cleanup.graph-owned.linear.mjs';
import { explicitLegacyAccessor } from '../exact-native-export/explicit-legacy-accessor.mjs';
import { integerLoopEndIsSnapshot } from '../exact-native-export/integer-loop-contract-alternate.mjs';
import {
  externalPropertyPathType,
  externalStructureMemberType,
  importedRawPropertyPathType,
  declaredRawForeignTriggerHandle,
} from '../exact-native-export/external-structure-fields.mjs';
import { replaceStructuredMarkers } from '../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/structured-markers.js';
/** Syntax-directed lowering. Game operations are discovered from loaded ScriptCode definitions. */
import { getKindName } from '../exact-function-signatures/index-alternate.js';
import {
  claimAutoCallId,
  idFromKey,
  fdRef,
  functionSymbolIndex,
  generateId,
  mkFCRef,
  mkParamRef,
  getTypeName,
  unwrapArrayType,
  parseArraySizeExpr,
  unwrapParens,
  structureMemberKey,
  triggerParamTypeFromGalaxyTypeName,
  extractAutoVarName,
  extractLocalVarName,
  localizedTextParamId,
} from '../exact-native-export/g2t-core-alternate-3.mjs';
import {
  conversionError,
  firstPresetOrdinal,
  lookupElement,
  refKey,
} from '../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {
  coerceStringDomainType,
  resolvePresetValueForParamScalar,
  simpleCallArgToScalarToken,
  tryBuildEncodedScalarParamFromCall,
  unitFilterStringFromCall,
} from '../exact-native-export/g2t-params-alternate-3.mjs';
import {
  compileTemplateVariants,
  contextualAutoAncestor,
  matchTemplate,
  matchTemplatePrefix,
  templateMakesProgress,
  templateBindingMatches,
  templateMacros,
  autoVariableTypeSource,
  syntaxChildren,
  printNode,
  parseTemplateFragment,
} from '../exact-native-export/script-template-alternate-2.mjs';
import {
  buildIfThenElseFCRef,
  buildPickEachIntegerFCRef,
  commentActionsBetween,
  buildPickEachIntegerFromForStmt,
  isAssignableVarTarget,
  stmtToActionFCRef,
  tryBuildDeprecatedForEachPlayerFromStmtSequence,
  tryBuildLegacyPickEachPlayerFromStmtSequence,
  tryBuildLoadedAutoTemplateSequence,
  tryBuildPickEachUnitFromStmtSequence,
  tryBuildForEachIntegerFromStmtSequence,
  tryBuildSwitchFromStmtSequence,
  tryMatchForEachIntegerCondition,
} from '../qualified-macro-binding/g2t-actions-alternate-4.mjs';
import {
  binaryArithToFCRef,
  tryBinaryExpressionParamData,
} from '../qualified-macro-binding/g2t-call-alternate.mjs';
import {
  getAssignSides,
  getIdentifierName,
  lvalueKey,
} from '../exact-native-export/g2t-core-alternate-3.mjs';
import {
  localVarName,
  memberVarName,
  triggerInitFuncName,
} from '../exact-native-export/core-alternate-4.mjs';
/** The editor stores a unit filter as "<required>;<excluded>", each a list of
 *  filter names or "-" when empty. Galaxy spells the same thing as two pairs of
 *  bit fields, the second of each pair biased by 32 for the high word. Each bit
 *  names a loaded PresetValue; the name comes from that definition, never from
 *  the shape of the Galaxy constant. */
function unitFilterValue(call, ctx) {
  return unitFilterStringFromCall(call, (identifier) => {
    const preset = ctx.galaxyConstToPreset.get(identifier);
    const definition = preset && element(preset, ctx);
    return definition?.type === 'PresetValue'
      ? (definition.identifier ?? definition.name)
      : undefined;
  });
}
/** The editor keeps a displayed name in TriggerStrings and invents a random
 *  identifier for a definition that has none, so an unnamed template reads as
 *  noise in the trigger tree. Name it after what it actually holds. */
function templateDisplayName(node) {
  const operation = node.kind === 138 /* SyntaxKind.ExpressionStatement */ ? node.expression : node;
  const callee =
    operation?.kind === 121 /* SyntaxKind.CallExpression */
      ? unwrapParens(operation.expression)
      : undefined;
  if (callee?.kind === 113 /* SyntaxKind.Identifier */ && callee.name) return callee.name;
  if (operation?.kind === 113 /* SyntaxKind.Identifier */ && operation.name) return operation.name;
  // Otherwise the syntax itself is the only description available; space it so
  // it reads as a label rather than a parser token.
  return getKindName(node.kind).replace(/([a-z])([A-Z])/gu, '$1 $2');
}
export function contextLibraries(ctx) {
  const libraries = new Map(ctx.dependencyLibraries);
  if (ctx.nativeLibrary) libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
  libraries.set(ctx.libId, {
    id: ctx.libId,
    items: [],
    elements: ctx.elements,
    elementsByType: {},
  });
  return [...libraries.values()];
}
function element(ref, ctx) {
  return lookupElement(contextLibraries(ctx), ref, ctx.libId);
}
/** Resolve a named integer constant through the formal parameter's declared
 * preset.  SC2Lib may intentionally omit localized preset/value names while its
 * generated Galaxy header still declares the constants.  The formal supplies
 * the preset identity and PresetInteger defines the constant as an item index,
 * so no name- or content-specific inference is involved. */
function integerPresetConstant(node, formal, ctx) {
  if (!formal || node?.kind !== 113 /* SyntaxKind.Identifier */) return undefined;
  const paramDef = element(formal, ctx);
  const presetRef = paramDef?.type === 'ParamDef' ? paramDef.paramType?.typeElement : undefined;
  const preset = element(presetRef, ctx);
  if (preset?.type !== 'Preset' || !preset.integer) return undefined;
  const ordinal = ctx.constants?.evaluate(node);
  if (ordinal === undefined) return undefined;
  const index = ordinal - firstPresetOrdinal(preset);
  if (index < 0 || index >= preset.values.length) return undefined;
  const value = preset.values[index];
  return value
    ? {
        type: 'PresetValue',
        library: value.library ?? preset.library ?? presetRef.library ?? ctx.libId,
        id: value.id,
      }
    : undefined;
}
function structureMember(type, name, ctx) {
  const structure = type?.typeElement;
  if (!structure) return undefined;
  const local =
    (structure.library ?? ctx.libId) === ctx.libId &&
    ctx.structureMemberByKey?.get(structureMemberKey(structure.id, name));
  if (local) return local;
  const declaration = element(structure, ctx);
  return declaration?.type === 'Structure'
    ? declaration.variables.find((ref) => {
        const variable = element(ref, ctx);
        return (
          variable?.name === name ||
          variable?.name === extractLocalVarName(name) ||
          (variable?.type === 'Variable' &&
            [localVarName(variable), memberVarName(variable, ctx.libId)].includes(name))
        );
      })
    : undefined;
}
/** Preserve the complete declared type, including structure/preset identity. */
export function expressionParameterType(node, ctx) {
  node = unwrapParens(node);
  if (!node) return undefined;
  if (node.kind === 3 /* SyntaxKind.StringLiteral */) return { type: 'string' };
  if (node.kind === 2 /* SyntaxKind.NumericLiteral */)
    return {
      type:
        !/^0x/iu.test(node.text ?? node.value ?? '') && /[.eE]/u.test(node.text ?? node.value ?? '')
          ? 'fixed'
          : 'int',
    };
  if ([67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */].includes(node.kind))
    return { type: 'bool' };
  if (node.kind === 113 /* SyntaxKind.Identifier */) {
    const accessor = ctx.structuredAutoAccessors?.get(node.name);
    if (accessor) return accessor.returnType;
    const local = ctx.localVarByGalaxyName.get(node.name);
    const global = ctx.globalVarByGalaxyName.get(node.name);
    const ref = local
      ? { type: 'Variable', library: ctx.libId, id: local }
      : (ctx.paramRefByGalaxyName?.get(node.name) ??
        (global ? { ...global, type: 'Variable' } : undefined));
    const value = element(ref, ctx);
    return value?.variableType ?? value?.paramType;
  }
  if (node.kind === 121 /* SyntaxKind.CallExpression */) {
    const definition = ctx.funcNameToFuncDef.get(node.expression?.name);
    return refineBoundCallReturn(
      node,
      definition?.flags?.includes('Operator') && !definition.scriptCode
        ? undefined
        : definition?.returnType,
      (type) => triggerParamTypeFromGalaxyTypeName(type, ctx),
    );
  }
  if (node.kind === 124 /* SyntaxKind.BinaryExpression */) {
    const kind = node.operatorToken?.kind;
    if (
      [
        17 /* SyntaxKind.EqualsEqualsToken */, 18 /* SyntaxKind.ExclamationEqualsToken */,
        14 /* SyntaxKind.GreaterThanToken */, 13 /* SyntaxKind.LessThanToken */,
        16 /* SyntaxKind.GreaterThanEqualsToken */, 15 /* SyntaxKind.LessThanEqualsToken */,
        34 /* SyntaxKind.AmpersandAmpersandToken */, 35 /* SyntaxKind.BarBarToken */,
      ].includes(kind)
    )
      return { type: 'bool' };
    const left = expressionParameterType(node.left, ctx),
      right = expressionParameterType(node.right, ctx);
    return left?.type === 'fixed' || right?.type === 'fixed' ? { type: 'fixed' } : (left ?? right);
  }
  if (node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */)
    return node.operator?.kind === 32 /* SyntaxKind.ExclamationToken */
      ? { type: 'bool' }
      : expressionParameterType(node.operand, ctx);
  if (node.kind === 123 /* SyntaxKind.PostfixUnaryExpression */)
    return expressionParameterType(node.operand, ctx);
  if (node.kind === 119 /* SyntaxKind.ElementAccessExpression */)
    return expressionParameterType(node.expression, ctx);
  if (node.kind === 120 /* SyntaxKind.PropertyAccessExpression */)
    return element(
      structureMember(expressionParameterType(node.expression, ctx), node.name.name, ctx),
      ctx,
    )?.variableType;
  if (node.kind === 125 /* SyntaxKind.TypeAssertionExpression */)
    return triggerParamTypeFromGalaxyTypeName(getTypeName(node.type), ctx);
  return undefined;
}
export function expressionType(node, ctx) {
  return expressionParameterType(node, ctx)?.type;
}
/** The editor's parameter pseudo-types: "any variable", "any comparable value",
 *  and "the same type as another parameter". They are wildcards at match time.
 *  Compared as ordinary type names they never equal a concrete type, so every
 *  native definition that uses one — Set Variable and Comparison among them —
 *  is rejected, and ordinary assignments end up as synthesized templates. */
const WILDCARD_PARAM_TYPES = new Set(['anyvariable', 'anycompare', 'sameas']);
function compatibleType(actual, expected, ctx) {
  if (!expected || expected.type === 'any' || !actual || actual.type === 'any') return true;
  if (WILDCARD_PARAM_TYPES.has(expected.type)) return true;
  if (expected.type !== actual.type && !(expected.type === 'fixed' && actual.type === 'int'))
    return false;
  if (expected.gameType && actual.gameType !== expected.gameType) return false;
  return (
    !expected.typeElement ||
    (!!actual.typeElement &&
      refKey(expected.typeElement, ctx.libId) === refKey(actual.typeElement, ctx.libId))
  );
}
const dependencyTemplateCaches = new WeakMap();
// Dependency models are immutable during lowering. Index declarations once,
// rather than scanning every Param/FunctionCall again for each function body.
const templateDefinitionIndexes = new WeakMap();
function indexedDefinitions(elements) {
  let definitions = templateDefinitionIndexes.get(elements);
  if (!definitions) {
    definitions = Object.values(elements).filter(
      (element) =>
        element.type === 'FunctionDef' &&
        (!!element.scriptCode || !!element.flags?.includes('Operator')),
    );
    templateDefinitionIndexes.set(elements, definitions);
  }
  return definitions;
}
/** The compiled templates are already cached; assembling them into one list is
 *  not, and that assembly runs for every node being matched. The list changes
 *  only when a synthesised template joins the scope, so it is kept until then. */
const assembledCandidates = new WeakMap();
function candidates(ctx) {
  const assembledFor = ctx.templateDefinitions;
  const scopeSize = ctx.structuredTemplates?.size ?? 0;
  if (assembledFor) {
    const entry = assembledCandidates.get(assembledFor);
    if (entry && entry.scope === ctx.structuredTemplates && entry.size === scopeSize) {
      ctx.templateCandidates = entry.list;
      return entry.list;
    }
  }
  const result = [];
  let libraries;
  const loaded = () => (libraries ??= contextLibraries(ctx));
  const cache = (ctx.compiledTemplates ??= new Map());
  let dependencyCache;
  if (ctx.dependencyLibraries) {
    dependencyCache = dependencyTemplateCaches.get(ctx.dependencyLibraries);
    if (!dependencyCache)
      dependencyTemplateCaches.set(ctx.dependencyLibraries, (dependencyCache = new Map()));
  }
  const definitions = (ctx.templateDefinitions ??= loaded().flatMap((library) =>
    indexedDefinitions(library.elements),
  ));
  for (const definition of [...definitions, ...(ctx.structuredTemplates?.values() ?? [])]) {
    const target = definition.library !== ctx.libId && dependencyCache ? dependencyCache : cache;
    if (!target.has(definition))
      target.set(
        definition,
        compileTemplateVariants(definition, loaded()).filter((template) => {
          // A template consisting solely of a parameter cannot restore syntax.
          // templateMakesProgress would reject every match, after serializing the
          // entire input expression. Exclude it once when building the index.
          const root = template.nodes.length === 1 ? unwrapParens(template.nodes[0]) : undefined;
          return !(
            template.expression &&
            root?.kind === 113 /* SyntaxKind.Identifier */ &&
            template.holes.get(root.name)?.kind === 'parameter'
          );
        }),
      );
    result.push(...target.get(definition));
  }
  if (ctx.templateDefinitions) {
    assembledCandidates.set(ctx.templateDefinitions, {
      scope: ctx.structuredTemplates,
      size: ctx.structuredTemplates?.size ?? 0,
      list: result,
    });
  }
  ctx.templateCandidates = result;
  return result;
}
/** Resolve TriggerData relational pseudo-types from the syntax bound to the
 * same template invocation. `sameas` points at another ParamDef, while
 * `return` points at the enclosing authored function's declared result. */
function templateParameterExpectedType(template, bindings, ref, ctx) {
  const formal = element(ref, ctx);
  const relation = formal?.paramType;
  const kind = relation?.type?.toLowerCase();
  if (kind === 'return') return ctx.returnType;
  if ((kind === 'sameas' || kind === 'sameasparent') && relation?.typeElement) {
    const ownerId = formal?.library ?? template.definition.library ?? ctx.libId;
    for (const [name, candidate] of template.parameters) {
      if (
        candidate.id !== relation.typeElement.id ||
        (candidate.library ?? template.definition.library ?? ctx.libId) !==
          (relation.typeElement.library ?? ownerId)
      )
        continue;
      return expressionParameterType(bindings.parameters.get(name), ctx)?.type;
    }
  }
  return undefined;
}
function instantiate(template, bindings, ctx, role) {
  const claimedId = claimAutoCallId(bindings.autos);
  if (bindings.autos.size)
    ctx = {
      ...ctx,
      structuredActiveAutoNames: new Set([
        ...(ctx.structuredActiveAutoNames ?? []),
        ...bindings.autos.keys(),
      ]),
    };
  ctx = {
    ...ctx,
    structuredAncestorDefinitions: [
      ...(ctx.structuredAncestorDefinitions ?? []),
      template.definition.name ?? '',
    ],
  };
  const parameters = [...template.parameters].map(([name, ref]) =>
    template.fixedParameters?.has(name)
      ? mkParamRef({ parameterDef: ref, preset: template.fixedParameters.get(name) }, ctx)
      : structuredParam(
          bindings.parameters.get(name),
          ctx,
          ref,
          templateParameterExpectedType(template, bindings, ref, ctx),
        ),
  );
  const subFunctions = [...template.roles].flatMap(([name, ref]) => {
    const nodes = bindings.blocks.get(name) ?? [];
    const expression = [...template.holes.values()].some(
      (hole) => hole.kind === 'block' && hole.name === name && hole.separator !== undefined,
    );
    return expression
      ? nodes.map((node) => structuredNode(node, true, ctx, ref))
      : structuredStatements(nodes, ctx, ref);
  });
  return mkFCRef(
    {
      functionDef: fdRef(template.definition),
      parameters,
      subFunctions,
      ...(role ? { subFunctionType: role } : {}),
    },
    ctx,
    claimedId,
  );
}
/** A historical ScriptCode body can still describe the same editor action as
 * a newer definition.  The explicit ancestor link on an accessor is stronger
 * semantic evidence than the implementation-shaped template that happened to
 * match the old Galaxy text. */
function ancestorDefinitionRequiredByChildren(bindings, ctx) {
  const required = new Set();
  const pending = [...bindings.blocks.values()].flat();
  while (pending.length) {
    const node = pending.pop();
    if (!node) continue;
    if (
      node.kind === 121 /* SyntaxKind.CallExpression */ &&
      node.expression?.kind === 113 /* SyntaxKind.Identifier */
    ) {
      const definition = ctx.funcNameToFuncDef.get(node.expression.name);
      for (const macro of templateMacros(definition?.scriptCode ?? '')) {
        const scope = macro.name === 'AUTOVAR' ? macro.args[1] : undefined;
        if (scope?.startsWith('ancestor:')) required.add(scope.slice('ancestor:'.length));
      }
    }
    pending.push(...syntaxChildren(node));
  }
  return required.size === 1 ? [...required][0] : undefined;
}
function semanticAncestorTemplate(template, bindings, ctx) {
  const required = ancestorDefinitionRequiredByChildren(bindings, ctx);
  // Current TriggerLib keeps historical loop actions as separate
  // *Deprecated templates.  Their Galaxy body still calls the old native
  // "current item" accessor, while the modern accessor names its modern
  // ancestor through #AUTOVAR.  Do not silently replace an explicitly matched
  // historical expansion with the modern counter-based action merely because
  // its body contains that source spelling.
  if (
    !required ||
    template.definition.name === required ||
    template.definition.name === `${required}Deprecated`
  )
    return template;
  return (
    candidates(ctx).find(
      (candidate) =>
        candidate.definition.name === required &&
        candidate.parameters.size === template.parameters.size &&
        candidate.roles.size === template.roles.size &&
        [...candidate.parameters.keys()].every(
          (name) => bindings.parameters.has(name) || candidate.fixedParameters?.has(name),
        ) &&
        [...candidate.roles.keys()].every((name) => bindings.blocks.has(name)),
    ) ?? template
  );
}
function isContextualAutoAccessor(definition, ctx) {
  const ancestor = contextualAutoAncestor(definition);
  return ancestor !== undefined && ctx.structuredAncestorDefinitions?.includes(ancestor) === true;
}
/** Resolve the loaded native companion used by a historical loop template.
 * The relationship is proven entirely by TriggerLib metadata:
 *   X is a pure #AUTOVAR accessor for ancestor Y;
 *   the active action is YDeprecated; and
 *   XDeprecated is a native with the same signature.
 * This covers integer, player-group and unit-group legacy loops without
 * naming any operation or element ID in converter code. */
function contextualAccessorDefinition(definition, ctx) {
  const ancestor = contextualAutoAncestor(definition);
  return ancestor && ctx.structuredAncestorDefinitions?.includes(ancestor) ? definition : undefined;
}
function supportedTemplate(template, allowAuto = false) {
  return ![...template.holes.values()].some(
    (hole) => (hole.kind === 'auto' && !allowAuto) || (hole.separator !== undefined && !hole.join),
  );
}
function mentionsIdentifier(nodes, names, excluded = new Set()) {
  const pending = [...nodes];
  while (pending.length) {
    const node = pending.pop();
    if (!node || excluded.has(node)) continue;
    if (node.kind === 113 /* SyntaxKind.Identifier */ && names.has(node.name)) return true;
    pending.push(...syntaxChildren(node));
  }
  return false;
}
/** Only discard a local when the entire enclosing body proves it private to this action. */
function privateAutoVariables(template, nodes, bindings, ctx) {
  if (!bindings.autos.size) return [];
  const statements = ctx.structuredFunctionStatements;
  if (!statements || !ctx.structuredLocals) return undefined;
  const names = new Set(),
    declarations = [],
    ids = [];
  const code = template.definition.scriptCode ?? '';
  const macros = templateMacros(code);
  for (const [name, identifier] of bindings.autos) {
    // An inferred declaration may inherit an enclosing macro variable when
    // emitted. Keep nested collisions as ordinary structured statements.
    if (ctx.structuredActiveAutoNames?.has(name)) return undefined;
    const id = ctx.localVarByGalaxyName.get(identifier.name);
    const variable = id ? ctx.elements[id] : undefined;
    if (!id || variable?.type !== 'Variable' || variable.isArray || names.has(identifier.name))
      return undefined;
    const declaration = statements.find(
      (node) =>
        node.kind === 141 /* SyntaxKind.VariableDeclaration */ &&
        node.name.name === identifier.name,
    );
    if (!declaration || declaration.initializer) return undefined;
    let type;
    for (const macro of macros.filter(
      (macro) => macro.name === 'AUTOVAR' && macro.args[0] === name,
    )) {
      const source = autoVariableTypeSource(macro, code);
      if (source?.type) {
        type = triggerParamTypeFromGalaxyTypeName(source.type, ctx);
        // Literal type text in a macro does not follow a renamed Structure ref.
        if (type.typeElement) return undefined;
      } else if (!type && source?.parameter)
        type = element(template.parameters.get(source.parameter), ctx)?.paramType;
    }
    if (
      !type ||
      type.type === 'any' ||
      !variable.variableType ||
      variable.variableType.type === 'any' ||
      !compatibleType(variable.variableType, type, ctx) ||
      !compatibleType(type, variable.variableType, ctx)
    )
      return undefined;
    names.add(identifier.name);
    declarations.push(declaration);
    ids.push(id);
  }
  // Captured operands/children need explicit macro-scope references before
  // they can safely refer to a removed local. Retain their syntax for now.
  if (
    mentionsIdentifier(
      [...bindings.parameters.values(), ...[...bindings.blocks.values()].flat()],
      names,
    )
  )
    return undefined;
  if (mentionsIdentifier(statements, names, new Set([...nodes, ...declarations]))) return undefined;
  return ids;
}
function compatibleBindings(template, nodes, bindings, ctx) {
  if (
    !templateCalleePresetBindings(template, bindings, {
      resolve: (ref, owner, type) => {
        const e = element({ ...ref, library: ref.library ?? owner, type }, ctx);
        return e?.type === type && (e.library ?? owner) === (ref.library ?? owner) ? e : undefined;
      },
      isShadowed: (name) =>
        [
          ctx.localVarByGalaxyName,
          ctx.globalVarByGalaxyName,
          ctx.paramRefByGalaxyName,
          ctx.structuredAutoAccessors,
        ].some((scope) => scope?.has(name)),
    })
  )
    return false;

  if (
    !templateMakesProgress(nodes, bindings) ||
    [...template.parameters.keys()].some(
      (name) => !bindings.parameters.has(name) && !template.fixedParameters?.has(name),
    )
  )
    return false;
  const compatible = [...template.parameters].every(([name, ref]) => {
    if (template.fixedParameters?.has(name)) return true;
    const formal = element(ref, ctx);
    const value = unwrapParens(bindings.parameters.get(name));
    if (formal?.paramType?.type === 'anyvariable' && !isAssignableVarTarget(value, ctx))
      return false;
    if (
      formal?.isReference &&
      ![
        113 /* SyntaxKind.Identifier */, 119 /* SyntaxKind.ElementAccessExpression */,
        120 /* SyntaxKind.PropertyAccessExpression */,
      ].includes(value?.kind)
    )
      return false;
    return compatibleType(expressionParameterType(value, ctx), formal?.paramType, ctx);
  });
  return (
    compatible &&
    templateBindingMatches(
      template,
      nodes,
      bindings,
      contextLibraries(ctx),
      ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined,
    )
  );
}
function tryTemplate(node, expression, ctx, role, expectedType) {
  let actualType;
  let typeResolved = false;
  let parameterFallback;
  // A value being written into a Param must prefer an operator whose operand is
  // itself a Param. NativeLib can expose the same Galaxy spelling both as a
  // condition-list operator (#SUBFUNCS) and as a scalar operator (#PARAM). The
  // former is valid in a Conditions role, but selecting it for a Set Variable
  // value makes the editor display only "(Not)" instead of the referenced
  // variable. Keep the first ordinary match as a fallback and continue looking
  // for the editor's parameter-shaped definition.
  const parameterContext = expression && role === undefined && expectedType !== undefined;
  for (const template of candidates(ctx)) {
    if (
      template.expression !== expression ||
      template.nodes.length !== 1 ||
      !supportedTemplate(template)
    )
      continue;
    if (expression) {
      // Candidate matching does not mutate bindings; infer the input type once,
      // and only if an expression candidate actually needs it.
      if (!typeResolved) {
        actualType = expressionParameterType(node, ctx) ?? expectedType;
        typeResolved = true;
      }
      if (!compatibleType(actualType, template.definition.returnType, ctx)) continue;
    }
    const bindings = matchTemplate(
      template,
      [node],
      ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined,
    );
    if (!bindings || !compatibleBindings(template, [node], bindings, ctx)) continue;
    if (!parameterContext || (template.roles.size === 0 && template.parameters.size > 0)) {
      return instantiate(semanticAncestorTemplate(template, bindings, ctx), bindings, ctx, role);
    }
    parameterFallback ??= { template, bindings };
  }
  return parameterFallback
    ? instantiate(
        semanticAncestorTemplate(parameterFallback.template, parameterFallback.bindings, ctx),
        parameterFallback.bindings,
        ctx,
        role,
      )
    : undefined;
}
function tryTemplateSequence(nodes, ctx, role) {
  for (const template of candidates(ctx)) {
    if (template.expression || template.nodes.length < 2 || !supportedTemplate(template, true))
      continue;
    const matched = matchTemplatePrefix(
      template,
      nodes,
      ctx.returnType === 'bool' ? { kind: 67 /* SyntaxKind.TrueKeyword */ } : undefined,
    );
    if (
      !matched ||
      !matched.consumed ||
      !compatibleBindings(template, nodes.slice(0, matched.consumed), matched.bindings, ctx)
    )
      continue;
    if (
      nodes
        .slice(0, matched.consumed)
        .some((node) => node.kind === 141 /* SyntaxKind.VariableDeclaration */)
    )
      continue;
    const privateLocals = privateAutoVariables(
      template,
      nodes.slice(0, matched.consumed),
      matched.bindings,
      ctx,
    );
    if (!privateLocals) continue;
    for (const id of privateLocals) {
      deferLocalRetirement(id, ctx);
      const index = ctx.structuredLocals?.findIndex((ref) => ref.id === id) ?? -1;
      /* Lexical ownership stays until the final pruned graph proves retirement. */
      for (const [name, localId] of ctx.localVarByGalaxyName)
        if (localId === id) ctx.localVarByGalaxyName.delete(name);
    }
    return {
      ref: instantiate(
        semanticAncestorTemplate(template, matched.bindings, ctx),
        matched.bindings,
        ctx,
        role,
      ),
      consumed: matched.consumed,
    };
  }
  return undefined;
}
export function structuredParam(node, ctx, formal, expectedType) {
  const retainedValue = lowerRetainedNominalRead(node, ctx, formal, {
    idFromKey,
    mkFCRef,
    mkParamRef,
    exprToParamRef: (value, scope, pd, type) => structuredParam(value, scope, pd, type),
  });
  if (retainedValue) return retainedValue;
  // A parameter can be converted before any statement of this context was, and a
  // call inside it may have no loaded definition (a COOP map whose commander mod
  // is missing). Without the fallback installed here such a call would name a
  // FunctionDef that exists in no loaded library.
  ctx.externalPropertyParamData ??= (node, scope) => {
    const type = externalPropertyPathType(
      node,
      scope,
      (ref) => element(ref, scope),
      (owner, name) => structureMember(owner, name, scope),
    );
    return type ? { scriptCode: printNode(node), valueType: type } : undefined;
  };
  ctx.structuredExpression ??= (expression, role, scope, type) =>
    structuredNode(expression, true, scope, role, type ? { type } : undefined);
  node = unwrapParens(node);
  if (!node)
    return conversionError('MISSING_EXPRESSION', 'Cannot convert an absent Galaxy expression');
  const data = formal ? { parameterDef: formal } : {};
  const literalLegacy = explicitLegacyAccessor(node, ctx);
  if (literalLegacy) return mkParamRef({ ...data, ...literalLegacy }, ctx);
  // Resolve the complete imported accessor before recursively creating base Params.
  // The source path and each index expression are emitted exactly once.
  const externalPathType = externalPropertyPathType(
    node,
    ctx,
    (ref) => element(ref, ctx),
    (type, name) => structureMember(type, name, ctx),
  );
  if (externalPathType)
    return mkParamRef({ ...data, scriptCode: printNode(node), valueType: externalPathType }, ctx);

  const textKey = localizedTextParamId(node, ctx);
  if (textKey !== undefined) {
    data.valueType = { type: 'text' };
    // Keep the exact authored key; neither locale fallback nor a preset may erase it.
    data.scriptCode =
      'StringExternal(' + JSON.stringify(String(unwrapParens(node.arguments[0]).value)) + ')';
    return mkParamRef(data, ctx, textKey);
  }
  // Native Galaxy represents an editor reference parameter as
  // UnitRefFromVariable("<l-value>"). The TriggerData contract is not a
  // unitref string: its ParamDef is Type=unit + ParamFlagReference and the Param
  // contains the ordinary Variable/Array/StructMember path. Decode only a
  // syntactically complete, resolved unit l-value; otherwise retain the scalar
  // fallback so arbitrary authored code is never guessed from text.
  const formalDefinition = element(formal, ctx);
  if (
    formalDefinition?.type === 'ParamDef' &&
    formalDefinition.isReference === true &&
    formalDefinition.paramType?.type === 'unit' &&
    node.kind === 121 /* SyntaxKind.CallExpression */ &&
    unwrapParens(node.expression)?.kind === 113 /* SyntaxKind.Identifier */ &&
    unwrapParens(node.expression).name === 'UnitRefFromVariable' &&
    node.arguments?.length === 1
  ) {
    const argument = unwrapParens(node.arguments[0]);
    const parsed =
      argument?.kind === 3 /* SyntaxKind.StringLiteral */
        ? parseTemplateFragment(String(argument.value ?? ''), true)
        : undefined;
    const path = parsed?.length === 1 ? unwrapParens(parsed[0]) : undefined;
    let root = path;
    while (
      root &&
      [
        119 /* SyntaxKind.ElementAccessExpression */, 120 /* SyntaxKind.PropertyAccessExpression */,
      ].includes(root.kind)
    )
      root = unwrapParens(root.expression);
    const resolvedRoot =
      root?.kind === 113 /* SyntaxKind.Identifier */ &&
      (ctx.localVarByGalaxyName.has(root.name) ||
        ctx.paramRefByGalaxyName?.has(root.name) ||
        ctx.globalVarByGalaxyName.has(root.name));
    if (resolvedRoot && expressionParameterType(path, ctx)?.type === 'unit')
      return structuredParam(path, ctx, formal);
  }
  // A snapshot of a variable/formal must remain a snapshot. A bare GUI
  // variable would emit a live reference, and a bare formal emits no ref at
  // all. Reuse the qualified stock unit projection instead of inventing a cast.
  const snapshot = qualifiedUnitSnapshot(
    node,
    ctx,
    formalDefinition,
    snapshotRecoverySessionFor(ctx.elements),
  );
  if (snapshot && expressionParameterType(snapshot.value, ctx)?.type === 'unit') {
    const projectionFormal = {
      type: 'ParamDef',
      library: snapshot.formal.library,
      id: snapshot.formal.id,
    };
    const valueRef = structuredParam(snapshot.value, ctx, projectionFormal);
    const value = element(valueRef, ctx);
    if (referenceOperandCarrier(value).kind === 'SNAPSHOT_VALUE') {
      value.parameterDef = formal;
      return valueRef;
    }
    return mkParamRef(
      {
        ...data,
        functionCall: mkFCRef(
          { functionDef: fdRef(snapshot.definition), parameters: [valueRef] },
          ctx,
        ),
      },
      ctx,
    );
  }
  if (
    node.kind === 120 /* SyntaxKind.PropertyAccessExpression */ ||
    node.kind === 119 /* SyntaxKind.ElementAccessExpression */
  ) {
    const rawImportedType = importedRawPropertyPathType(
      node,
      ctx,
      (ref) => element(ref, ctx),
      (type, name) => structureMember(type, name, ctx),
    );
    if (rawImportedType)
      return mkParamRef({ ...data, scriptCode: printNode(node), valueType: rawImportedType }, ctx);
    const baseRef = structuredParam(node.expression, ctx);
    const base = element(baseRef, ctx);
    if (base.variable || base.paramRef) {
      let cursor = base;
      while (cursor.structMember) cursor = element(cursor.structMember, ctx);
      if (node.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
        const index = structuredParam(node.argumentExpression, ctx);
        cursor.array = [
          ...(Array.isArray(cursor.array) ? cursor.array : cursor.array ? [cursor.array] : []),
          index,
        ];
      } else {
        const owner = element(cursor.variable ?? cursor.paramRef, ctx);
        const member = structureMember(
          owner?.variableType ?? owner?.paramType,
          node.name.name,
          ctx,
        );
        if (!member) {
          const externalType = externalStructureMemberType(
            ctx.structureByGalaxyTypeName,
            owner?.variableType ?? owner?.paramType,
            node.name.name,
          );
          if (!externalType)
            return conversionError('STRUCT_MEMBER', 'Structure member cannot be resolved', {
              member: node.name.name,
            });
          // Keep the whole path and every index evaluation exactly once.
          // Speculative base Params are pruned normally.
          return mkParamRef({ ...data, scriptCode: printNode(node), valueType: externalType }, ctx);
        }
        cursor.structMember = mkParamRef({ variable: member }, ctx);
      }
      if (formal) base.parameterDef = formal;
      return baseRef;
    }
  }
  const accessor =
    node.kind === 113 /* SyntaxKind.Identifier */
      ? ctx.structuredAutoAccessors?.get(node.name)
      : undefined;
  if (accessor)
    return mkParamRef(
      { ...data, functionCall: mkFCRef({ functionDef: fdRef(accessor) }, ctx) },
      ctx,
    );
  if (node.kind === 113 /* SyntaxKind.Identifier */) {
    const local = ctx.localVarByGalaxyName.get(node.name);
    const global = ctx.globalVarByGalaxyName.get(node.name);
    const parameter = ctx.paramRefByGalaxyName?.get(node.name);
    // A formal parameter identifies the owning Preset and therefore wins over
    // the global scalar index when multiple presets share one Galaxy constant.
    const preset =
      (formal ? resolvePresetValueForParamScalar(formal, node.name, ctx) : undefined) ??
      ctx.galaxyConstToPreset.get(node.name) ??
      integerPresetConstant(node, formal, ctx);
    // A trigger handle is a value with a structural form of its own; without
    // this the name falls through to a synthesized template definition, which
    // the editor does not accept from a user library.
    if (declaredRawForeignTriggerHandle(node.name, ctx))
      return mkParamRef({ ...data, scriptCode: node.name, valueType: { type: 'trigger' } }, ctx);
    const trigger = ctx.triggerByGalaxyName?.get(node.name);
    if (parameter) data.paramRef = parameter;
    else if (local || global)
      data.variable = { type: 'Variable', ...(local ? { library: ctx.libId, id: local } : global) };
    else if (preset) data.preset = preset;
    else if (trigger) {
      data.valueType = { type: 'trigger' };
      data.valueElement = {
        type: 'Trigger',
        library: trigger.library ?? ctx.libId,
        id: trigger.id,
      };
    }
  }
  // Binary syntax is only a parser shape.  Prefer the loaded editor contract
  // (Comparison/Arithmetic or an as-bits Preset) before the generic template
  // path; synthetic Binary Expression definitions are emitted by the editor as
  // undefined lf_BinaryExpression calls.
  if (node.kind === 124 /* SyntaxKind.BinaryExpression */) {
    const operatorData = tryBinaryExpressionParamData(node, ctx, formal, expectedType);
    if (operatorData) Object.assign(data, operatorData);
  }
  // A negated numeric literal is a scalar value, not an operation: the editor
  // writes <Value>-257</Value>. Left as an expression it becomes a synthesized
  // template that the editor re-emits as a call to a helper it never defines.
  if (
    node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
    node.operator?.kind === 21 /* SyntaxKind.MinusToken */
  ) {
    const scalar = simpleCallArgToScalarToken(node);
    if (scalar !== undefined) {
      data.value = scalar;
      // Typed by the literal, as a positive one is: `-1` is an int value in a fixed slot too.
      data.valueType = {
        type:
          expressionType(node.operand, ctx) ??
          expectedType ??
          element(formal, ctx)?.paramType?.type,
      };
    } else {
      const real = expressionParameterType(node.operand, ctx)?.type?.toLowerCase() === 'fixed';
      const arithmetic = binaryArithToFCRef(
        {
          kind: 124 /* SyntaxKind.BinaryExpression */,
          left: { kind: 2 /* SyntaxKind.NumericLiteral */, text: real ? '0.0' : '0', value: '0' },
          operatorToken: { kind: 21 /* SyntaxKind.MinusToken */ },
          right: node.operand,
        },
        ctx,
      );
      if (arithmetic) data.functionCall = arithmetic;
    }
  }
  if (
    data.value === undefined &&
    [
      2 /* SyntaxKind.NumericLiteral */, 3 /* SyntaxKind.StringLiteral */,
      67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */,
      69 /* SyntaxKind.NullKeyword */,
    ].includes(node.kind)
  ) {
    data.value =
      node.kind === 3 /* SyntaxKind.StringLiteral */ ? String(node.value ?? '') : printNode(node);
    if (node.kind !== 69 /* SyntaxKind.NullKeyword */)
      data.valueType = {
        type: expressionType(node, ctx) ?? expectedType ?? element(formal, ctx)?.paramType?.type,
      };
  }
  // A scalar standing for a preset value is stored as that value, not as the
  // raw literal: PortraitSetVisible(..., false, false) reads "Hide" and "Do Not
  // force visible" in the editor. Left as a literal it shows the Galaxy scalar.
  if (
    formal &&
    data.preset === undefined &&
    data.variable === undefined &&
    data.paramRef === undefined &&
    typeof data.value === 'string'
  ) {
    const presetRef = resolvePresetValueForParamScalar(formal, data.value, ctx);
    if (presetRef) {
      delete data.value;
      delete data.valueType;
      data.preset = presetRef;
    }
  }
  if (
    formal &&
    data.preset === undefined &&
    data.variable === undefined &&
    data.paramRef === undefined &&
    data.valueType
  ) {
    const formalType = element(formal, ctx)?.paramType;
    coerceStringDomainType(data, formalType?.type?.toLowerCase());
    if (
      formalType?.gameType &&
      /^(?:any)?gamelink$/u.test(data.valueType?.type?.toLowerCase() ?? '')
    ) {
      data.valueType = { ...data.valueType, gameType: formalType.gameType };
    }
  }
  // An editor object reference or sound link is a scalar parameter value, not a
  // call: RegionFromId(4) is <ValueType region> with <ValueId 4>. Falling
  // through to the template path instead produces a definition that the editor
  // re-emits as a call to a helper it never defines.
  if (
    !data.variable &&
    !data.paramRef &&
    !data.preset &&
    !data.valueElement &&
    !data.functionCall &&
    data.value === undefined
  ) {
    const encoded = tryBuildEncodedScalarParamFromCall(
      node,
      (expectedType ?? element(formal, ctx)?.paramType?.type)?.toLowerCase(),
    );
    if (encoded) Object.assign(data, encoded);
    else if (
      node.kind === 121 /* SyntaxKind.CallExpression */ &&
      unwrapParens(node.expression)?.name === 'UnitFilter'
    ) {
      const filter = unitFilterValue(node, ctx);
      if (filter !== undefined) {
        data.value = filter;
        data.valueType = { type: 'unitfilter' };
      }
    }
  }
  if (
    !data.variable &&
    !data.paramRef &&
    !data.preset &&
    !data.valueElement &&
    !data.functionCall &&
    data.value === undefined &&
    data.valueId === undefined
  ) {
    data.functionCall = structuredNode(node, true, ctx, undefined, element(formal, ctx)?.paramType);
  }
  return mkParamRef(data, ctx);
}
const expressionFields = new Set([
  'expression',
  'left',
  'right',
  'operand',
  'argumentExpression',
  'condition',
  'incrementor',
  'initializer',
]);
const blockFields = new Set(['thenStatement', 'elseStatement', 'statement', 'body']);
const expressionKinds = new Set([
  113 /* SyntaxKind.Identifier */, 121 /* SyntaxKind.CallExpression */,
  124 /* SyntaxKind.BinaryExpression */, 122 /* SyntaxKind.PrefixUnaryExpression */,
  123 /* SyntaxKind.PostfixUnaryExpression */, 119 /* SyntaxKind.ElementAccessExpression */,
  120 /* SyntaxKind.PropertyAccessExpression */, 125 /* SyntaxKind.TypeAssertionExpression */,
  2 /* SyntaxKind.NumericLiteral */, 3 /* SyntaxKind.StringLiteral */,
  67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */,
  69 /* SyntaxKind.NullKeyword */,
]);
const statementKinds = new Set([
  138 /* SyntaxKind.ExpressionStatement */, 137 /* SyntaxKind.ReturnStatement */,
  129 /* SyntaxKind.IfStatement */, 130 /* SyntaxKind.DoStatement */,
  131 /* SyntaxKind.WhileStatement */, 132 /* SyntaxKind.ForStatement */,
  133 /* SyntaxKind.BreakStatement */, 134 /* SyntaxKind.ContinueStatement */,
  135 /* SyntaxKind.BreakpointStatement */, 128 /* SyntaxKind.Block */,
  139 /* SyntaxKind.EmptyStatement */,
]);
const assignmentOperators = new Set([
  39 /* SyntaxKind.EqualsToken */, 40 /* SyntaxKind.PlusEqualsToken */,
  41 /* SyntaxKind.MinusEqualsToken */, 42 /* SyntaxKind.AsteriskEqualsToken */,
  43 /* SyntaxKind.SlashEqualsToken */, 44 /* SyntaxKind.PercentEqualsToken */,
  47 /* SyntaxKind.AmpersandEqualsToken */, 48 /* SyntaxKind.BarEqualsToken */,
  49 /* SyntaxKind.CaretEqualsToken */, 45 /* SyntaxKind.LessThanLessThanEqualsToken */,
  46 /* SyntaxKind.GreaterThanGreaterThanEqualsToken */,
]);
/** A SubFuncType condition cannot directly own a Param. Editor-authored XML
 * wraps a boolean l-value in the native Comparison operator; synthesizing an
 * identity FunctionDef instead makes the editor emit an undefined lf_* helper. */
function booleanReferenceCondition(node, ctx, role) {
  if (!role || expressionParameterType(node, ctx)?.type !== 'bool') return undefined;
  let root = unwrapParens(node);
  if (
    ![
      113 /* SyntaxKind.Identifier */, 119 /* SyntaxKind.ElementAccessExpression */,
      120 /* SyntaxKind.PropertyAccessExpression */,
    ].includes(root?.kind)
  )
    return undefined;
  while (
    [
      119 /* SyntaxKind.ElementAccessExpression */, 120 /* SyntaxKind.PropertyAccessExpression */,
    ].includes(root.kind)
  )
    root = root.expression;
  if (
    root.kind !== 113 /* SyntaxKind.Identifier */ ||
    (!ctx.localVarByGalaxyName.has(root.name) &&
      !ctx.paramRefByGalaxyName?.has(root.name) &&
      !ctx.globalVarByGalaxyName.has(root.name))
  )
    return undefined;
  const comparison = ctx.funcNameToFuncDef.get('Comparison');
  if (!comparison || comparison.parameters.length !== 3) return undefined;
  const operator = resolvePresetValueForParamScalar(comparison.parameters[1], '==', ctx);
  if (!operator) return undefined;
  return mkFCRef(
    {
      functionDef: fdRef(comparison),
      parameters: [
        structuredParam(node, ctx, comparison.parameters[0]),
        mkParamRef({ parameterDef: comparison.parameters[1], preset: operator }, ctx),
        structuredParam({ kind: 67 /* SyntaxKind.TrueKeyword */ }, ctx, comparison.parameters[2]),
      ],
      subFunctionType: role,
    },
    ctx,
  );
}
/** Create an ordinary editable FunctionDef with explicit typed parameters and subfunction roles. */
export function structuredNode(node, expression, ctx, role, expectedType) {
  const retainedWrite =
    !expression &&
    lowerRetainedNominalWrite(node, ctx, role, {
      idFromKey,
      mkFCRef,
      mkParamRef,
      exprToParamRef: (value, scope, pd, type) => structuredParam(value, scope, pd, type),
    });
  if (retainedWrite) return retainedWrite;
  const preservedValue = buildPreservedSourceValueRead(
    node,
    expression,
    ctx,
    role,
    {
      generateId,
      fdRef,
      mkFCRef,
      structuredParam,
      triggerType: triggerParamTypeFromGalaxyTypeName,
      mapType: sourceAccessCarrier,
      valueType: expressionParameterType,
    },
    expectedType,
  );
  if (preservedValue) return preservedValue;
  node = unwrapParens(node);
  if (expression) {
    const condition = booleanReferenceCondition(node, ctx, role);
    if (condition) return condition;
  }
  // A call whose exact definition comes from a loaded dependency is already a
  // complete structural representation.  Generic NativeLib templates (notably
  // the catch-all function-call template) must not capture it first: doing so
  // replaces the dependency's formal parameter types with the template's `any`
  // or `int` slots and synthesizes lf_* wrappers on the next forward pass.
  if (
    node.kind === 121 /* SyntaxKind.CallExpression */ ||
    (node.kind === 138 /* SyntaxKind.ExpressionStatement */ &&
      node.expression?.kind === 121) /* SyntaxKind.CallExpression */
  ) {
    const call = expression ? node : node.expression;
    const definition = ctx.funcNameToFuncDef.get(call.expression?.name);
    const definitionLibrary = definition?.library ?? ctx.nativeLibrary?.id ?? 'Ntve';
    const nativeLibrary = ctx.nativeLibrary?.id ?? 'Ntve';
    const directDependency =
      definition &&
      definitionLibrary !== nativeLibrary &&
      definitionLibrary !== ctx.libId &&
      call.arguments.length === definition.parameters.length &&
      !definition.flags?.includes('Operator') &&
      !definition.scriptCode?.includes('#');
    if (directDependency) {
      return mkFCRef(
        {
          functionDef: fdRef(definition),
          parameters: [...call.arguments].map((arg, i) =>
            structuredParam(arg, ctx, definition.parameters[i]),
          ),
          ...(role ? { subFunctionType: role } : {}),
        },
        ctx,
      );
    }
  }
  // Keep the proved callee identity even if an earlier template snapshot
  // predates materialization of this source function's inline GUI interface.
  const authoredCall = expression
    ? node
    : node.kind === BoundCallSyntax.ExpressionStatement
      ? node.expression
      : undefined;
  if (
    authoredCall?.kind === BoundCallSyntax.CallExpression &&
    authoredCall.expression?.kind === BoundCallSyntax.Identifier
  ) {
    const authoredDefinition = ctx.funcNameToFuncDef.get(authoredCall.expression.name);
    if (
      authoredDefinition &&
      authoredCall.arguments.length === authoredDefinition.parameters.length &&
      (boundAuthoredCallInterface(authoredDefinition, {
        elements: ctx.elements,
        library: ctx.libId,
        expression,
      }) ||
        ((authoredDefinition.library ?? ctx.libId) === ctx.libId &&
          authoredDefinition.flags?.includes(expression ? 'Call' : 'Action') &&
          isRetainedNominalInterfaceElement(authoredDefinition)))
    ) {
      return mkFCRef(
        {
          functionDef: fdRef(authoredDefinition),
          parameters: [...authoredCall.arguments].map((arg, i) =>
            structuredParam(arg, ctx, authoredDefinition.parameters[i]),
          ),
          ...(role ? { subFunctionType: role } : {}),
        },
        ctx,
      );
    }
  }
  const matched = tryTemplate(node, expression, ctx, role, expectedType);
  if (matched) return matched;
  if ((expression ? expressionKinds : statementKinds).has(node.kind) === false) {
    return conversionError(
      'UNSUPPORTED_SYNTAX',
      'Galaxy syntax has no structured Trigger lowering',
      { kind: getKindName(node.kind), source: printNode(node) },
    );
  }
  if (
    node.kind === 121 /* SyntaxKind.CallExpression */ ||
    (node.kind === 138 /* SyntaxKind.ExpressionStatement */ &&
      node.expression?.kind === 121) /* SyntaxKind.CallExpression */
  ) {
    const call = expression ? node : node.expression;
    const definition = ctx.funcNameToFuncDef.get(call.expression?.name);
    const contextualDefinition = definition && contextualAccessorDefinition(definition, ctx);
    const selectedDefinition = contextualDefinition ?? definition;
    const directDefinition =
      selectedDefinition &&
      call.arguments.length === selectedDefinition.parameters.length &&
      ((!selectedDefinition.flags?.includes('Operator') &&
        !selectedDefinition.scriptCode?.includes('#')) ||
        contextualDefinition !== undefined ||
        isContextualAutoAccessor(selectedDefinition, ctx));
    if (directDefinition) {
      return mkFCRef(
        {
          functionDef: fdRef(selectedDefinition),
          parameters: [...call.arguments].map((arg, i) =>
            structuredParam(arg, ctx, selectedDefinition.parameters[i]),
          ),
          ...(role ? { subFunctionType: role } : {}),
        },
        ctx,
      );
    }
  }
  const slots = [];
  const blocks = [];
  const replacements = new Map();
  const slot = (value, name, reference = false) => {
    const marker = `__mk_slot_${slots.length}`;
    const type =
      refineBoundCallFormal(
        operation,
        operation.arguments?.indexOf(value) ?? -1,
        expressionParameterType(value, ctx),
        (type) => triggerParamTypeFromGalaxyTypeName(type, ctx),
      ) ??
      expectedType ??
      (node.kind === 137 /* SyntaxKind.ReturnStatement */ && ctx.returnType
        ? triggerParamTypeFromGalaxyTypeName(ctx.returnType, ctx)
        : { type: 'any' });
    slots.push({ name, node: value, type, reference });
    replacements.set(marker, `#PARAM(${name})`);
    return { kind: 113 /* SyntaxKind.Identifier */, name: marker };
  };
  const block = (value, name) => {
    const marker = `__mk_block_${blocks.length}`;
    blocks.push({
      name,
      nodes: value.kind === 128 /* SyntaxKind.Block */ ? [...value.statements] : [value],
    });
    replacements.set(`${marker}();`, `#SUBFUNCS(${name})`);
    return {
      kind: 128 /* SyntaxKind.Block */,
      statements: [
        {
          kind: 138 /* SyntaxKind.ExpressionStatement */,
          expression: {
            kind: 121 /* SyntaxKind.CallExpression */,
            expression: { kind: 113 /* SyntaxKind.Identifier */, name: marker },
            arguments: [],
          },
        },
      ],
    };
  };
  const operation = node.kind === 138 /* SyntaxKind.ExpressionStatement */ ? node.expression : node;
  let skeleton = { ...operation };
  // Trigger init functions are generated from Trigger elements and therefore
  // have no FunctionDef for ordinary call resolution. An authored library may
  // use an unqualified gt_X_Init spelling; once reconstructed as TriggerData,
  // the editor emits the library-qualified name. Preserve the call
  // as a transparent template but bind its callee to that proven Trigger.
  if (
    operation.kind === 121 /* SyntaxKind.CallExpression */ &&
    operation.arguments?.length === 0 &&
    operation.expression?.kind === 113 /* SyntaxKind.Identifier */ &&
    operation.expression.name.endsWith('_Init')
  ) {
    const handle = operation.expression.name.slice(0, -5);
    const triggerRef = ctx.triggerByGalaxyName?.get(handle);
    const trigger = triggerRef && element(triggerRef, ctx);
    if (trigger?.type === 'Trigger') {
      skeleton.expression = {
        ...operation.expression,
        name: triggerInitFuncName(triggerRef.library ?? ctx.libId, trigger),
      };
    }
  }
  let referenceBase = operation;
  while (
    [
      120 /* SyntaxKind.PropertyAccessExpression */, 119 /* SyntaxKind.ElementAccessExpression */,
    ].includes(referenceBase.kind)
  )
    referenceBase = referenceBase.expression;
  // A trigger handle is as much a bound value as a variable or a preset.
  // Omitting it here sends the bare name into a template whose whole body is
  // that identifier, so the tree shows a definition named after its node kind.
  const boundReference =
    referenceBase.kind === 113 /* SyntaxKind.Identifier */ &&
    (ctx.localVarByGalaxyName.has(referenceBase.name) ||
      ctx.paramRefByGalaxyName?.has(referenceBase.name) ||
      ctx.globalVarByGalaxyName.has(referenceBase.name) ||
      ctx.galaxyConstToPreset.has(referenceBase.name) ||
      !!ctx.triggerByGalaxyName?.has(referenceBase.name));
  // Each direct operand remains editable. The operator, callee and member name
  // come from the parsed input, never a native-function name table.
  if (
    boundReference ||
    [
      2 /* SyntaxKind.NumericLiteral */, 3 /* SyntaxKind.StringLiteral */,
      67 /* SyntaxKind.TrueKeyword */, 68 /* SyntaxKind.FalseKeyword */,
      69 /* SyntaxKind.NullKeyword */,
    ].includes(operation.kind)
  )
    skeleton = slot(operation, 'value');
  else if (operation.kind === 128 /* SyntaxKind.Block */)
    skeleton.statements = block(operation, 'statements').statements;
  else
    for (const [key, value] of Object.entries(operation)) {
      if (!value || key === 'parent') continue;
      if (blockFields.has(key)) skeleton[key] = block(value, key);
      else if (key === 'arguments' && Array.isArray(value))
        skeleton[key] = value.map((arg, i) => slot(arg, `argument${i + 1}`));
      else if (expressionFields.has(key) && typeof value === 'object') {
        if (operation.kind === 121 /* SyntaxKind.CallExpression */ && key === 'expression')
          continue;
        if (value.kind === 141 /* SyntaxKind.VariableDeclaration */)
          return conversionError(
            'UNSUPPORTED_DECLARATION',
            'Declaration in a loop initializer requires scope lowering',
          );
        const assignment = key === 'left' && assignmentOperators.has(operation.operatorToken?.kind);
        const update =
          key === 'operand' &&
          [25 /* SyntaxKind.PlusPlusToken */, 26 /* SyntaxKind.MinusMinusToken */].includes(
            operation.operator?.kind,
          );
        skeleton[key] = slot(value, key, assignment || update);
      }
    }
  let scriptCode = printNode(
    node.kind === 138 /* SyntaxKind.ExpressionStatement */
      ? { ...node, expression: skeleton }
      : skeleton,
  );
  scriptCode = replaceStructuredMarkers(scriptCode, replacements);
  const returnType = expression
    ? (expressionParameterType(node, ctx) ?? expectedType ?? { type: 'any' })
    : { type: 'void' };
  const key = JSON.stringify([scriptCode, returnType, slots.map((s) => [s.type, s.reference])]);
  const cache = (ctx.structuredTemplates ??= new Map());
  let definition = cache.get(key);
  if (!definition) {
    const id = generateId();
    const parameters = slots.map((s) => {
      const id = generateId();
      ctx.elements[id] = {
        type: 'ParamDef',
        id,
        library: ctx.libId,
        name: s.name,
        paramType: s.type,
        isReference: s.reference || undefined,
      };
      return { type: 'ParamDef', library: ctx.libId, id };
    });
    const subFunctionTypes = blocks.map((b) => {
      const id = generateId();
      ctx.elements[id] = {
        type: 'SubFuncType',
        id,
        library: ctx.libId,
        name: b.name,
        isAction: true,
      };
      // Named type included: a <SubFunctionType> reference without it does not
      // resolve in the editor, which then discards the calls in that slot.
      return { type: 'SubFuncType', library: ctx.libId, id };
    });
    const label = templateDisplayName(node);
    // SC2 Editor expands a definition's ScriptCode in place only for Operator or
    // SubFunctions definitions (every ScriptCode definition in NativeLib and in the
    // editor-authored corpus has one of them). <Template/> marks an ordinary
    // action-body definition, so a Template holder compiled to an undefined
    // lf_<Name>(...) call: lf_ExpressionStatement, lf_BinaryExpression and
    // lf_TriggerAddEventUnitRegion were all this one defect.
    definition = {
      type: 'FunctionDef',
      id,
      library: ctx.libId,
      name: label,
      displayName: label,
      scriptCode,
      parameters,
      subFunctionTypes,
      isFuncAction: !expression,
      isFuncCall: expression,
      isSubFunction: blocks.length > 0,
      flags: [expression ? 'Call' : 'Action', blocks.length ? 'SubFunctions' : 'Operator'],
      returnType,
    };
    ctx.elements[id] = definition;
    markGeneratedStructuredTemplate(definition);
    // Newly synthesized declarations remain visible to subsequent functions.
    // Existing scopes keep their snapshot and use structuredTemplates locally.
    templateDefinitionIndexes.get(ctx.elements)?.push(definition);
    cache.set(key, definition);
  }
  return mkFCRef(
    {
      functionDef: fdRef(definition),
      parameters: slots.map((s, i) => structuredParam(s.node, ctx, definition.parameters[i])),
      subFunctions: blocks.flatMap((b, i) =>
        structuredStatements(b.nodes, ctx, definition.subFunctionTypes[i]),
      ),
      ...(role ? { subFunctionType: role } : {}),
    },
    ctx,
  );
}
function inferredLocalHandleType(galaxyName, ctx) {
  const roots = ctx.structuredFunctionStatements;
  if (!roots) return undefined;
  const inferred = new Map();
  const pending = [...roots];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    if (
      current.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      current.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ &&
      getIdentifierName(current.left) === galaxyName
    ) {
      const right = unwrapParens(current.right);
      if (right?.kind === 121 /* SyntaxKind.CallExpression */) {
        const definition = ctx.funcNameToFuncDef.get(getIdentifierName(right.expression) ?? '');
        const type = definition?.returnType;
        if (type?.type && !['int', 'fixed', 'bool', 'string', 'void'].includes(type.type)) {
          inferred.set(
            `${type.type}:${type.typeElement?.library ?? ''}:${type.typeElement?.id ?? ''}:${type.gameType ?? ''}`,
            type,
          );
        }
      }
    }
    for (const child of syntaxChildren(current)) {
      if (Array.isArray(child)) pending.push(...child);
      else pending.push(child);
    }
  }
  return inferred.size === 1 ? [...inferred.values()][0] : undefined;
}
export function declareStructuredLocal(node, ctx) {
  const id = generateId(),
    galaxyName = node.name.name;
  const { name, identifier: recoveredName } = recoveredEditorLocalIdentity(galaxyName);
  const { baseType, sizes } = unwrapArrayType(node.type);
  const sizeVariables = new Map(ctx.globalVarByGalaxyName);
  for (const [name, id] of ctx.localVarByGalaxyName)
    sizeVariables.set(name, { id, library: ctx.libId });
  // The element id is already the stable identity.  Appending it to the
  // authored lexical name leaks an implementation detail into the editor and
  // makes a second Galaxy pass invent `lv_..._A...` symbols.  Lexical scopes
  // are represented by their containing FunctionDef/SubFunction tree.
  const declaredType = triggerParamTypeFromGalaxyTypeName(getTypeName(baseType), ctx);
  const inferredType =
    declaredType.type === 'int' ? inferredLocalHandleType(galaxyName, ctx) : undefined;
  const variable = {
    type: 'Variable',
    id,
    library: ctx.libId,
    name,
    ...(recoveredName !== undefined ? { identifier: recoveredName } : {}),
    variableType: inferredType ?? declaredType,
    ...(extractAutoVarName(galaxyName) ? { flags: ['NoScriptPrefix'] } : {}),
    isConstant:
      node.modifiers?.some((modifier) => modifier.kind === 53 /* SyntaxKind.ConstKeyword */) ||
      undefined,
    ...(sizes.length
      ? {
          isArray: true,
          arraySizes: sizes.map((s, dim) => ({
            dim,
            ...parseArraySizeExpr(s, sizeVariables, ctx.constants),
          })),
        }
      : {}),
  };
  ctx.elements[id] = variable;
  ctx.localVarByGalaxyName.set(galaxyName, id);
  if (!ctx.structuredLocals)
    conversionError('LOCAL_SCOPE', 'Local declaration has no enclosing function');
  ctx.structuredLocals.push({ type: 'Variable', library: ctx.libId, id });
  return variable;
}
export function tryCapturedIntegerLoop(nodes, index, ctx, role) {
  let loopOffset = 0;
  for (let offset = 1; offset <= 3; offset++) {
    if (nodes[index + offset]?.kind === 132 /* SyntaxKind.ForStatement */) {
      loopOffset = offset;
      break;
    }
    if (!getAssignSides(nodes[index + offset])) return undefined;
  }
  if (!loopOffset) return undefined;
  const loop = nodes[index + loopOffset];
  const start = getAssignSides(nodes[index + loopOffset - 1]);
  if (!start || loop.initializer) return undefined;
  // Record fields and array elements are valid For Each Integer variables too.
  const iterator = lvalueKey(start.left);
  if (!iterator) return undefined;
  const symbols = functionSymbolIndex(ctx.structuredFunctionStatements ?? nodes);
  // PickEachInteger's editor-generated Galaxy stores its start assignment
  // immediately before a simple inclusive unit-step loop.  In a structured
  // user function that assignment used to be converted independently, so the
  // following ForStatement had no captured start and became a synthesized
  // `For Statement` template.  Recover the pair only for an editor auto
  // counter and only when every use is contained in this pair; otherwise its
  // value after the loop could be observable and the replacement would change
  // semantics.
  const condition = unwrapParens(loop.condition);
  const increment = unwrapParens(loop.incrementor);
  const iteratorAuto = extractAutoVarName(iterator);
  // This pair has no captured statements, so it must start at `index`: with a
  // later start the match also consumed the unrelated statement before it (a
  // Wait, a call or an if/else vanished before each such loop of Star Party v).
  if (
    loopOffset === 1 &&
    iteratorAuto?.suffix === 'var' &&
    condition?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
    condition.operatorToken?.kind === 15 /* SyntaxKind.LessThanEqualsToken */ &&
    getIdentifierName(condition.left) === iterator &&
    increment?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
    increment.operatorToken?.kind === 40 /* SyntaxKind.PlusEqualsToken */ &&
    getIdentifierName(increment.left) === iterator &&
    Number(increment.right?.value ?? increment.right?.text) === 1
  ) {
    const pairSymbols = functionSymbolIndex([start, loop]);
    let bodyWritesIterator = false;
    const pending = [loop.statement];
    const seen = new Set();
    while (pending.length && !bodyWritesIterator) {
      const current = pending.pop();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);
      if (
        current.kind === 124 /* SyntaxKind.BinaryExpression */ &&
        assignmentOperators.has(current.operatorToken?.kind) &&
        getIdentifierName(current.left) === iterator
      )
        bodyWritesIterator = true;
      if (
        [
          122 /* SyntaxKind.PrefixUnaryExpression */, 123 /* SyntaxKind.PostfixUnaryExpression */,
        ].includes(current.kind) &&
        [25 /* SyntaxKind.PlusPlusToken */, 26 /* SyntaxKind.MinusMinusToken */].includes(
          current.operator?.kind,
        ) &&
        getIdentifierName(current.operand) === iterator
      )
        bodyWritesIterator = true;
      for (const child of syntaxChildren(current)) {
        if (Array.isArray(child)) pending.push(...child);
        else pending.push(child);
      }
    }
    if (
      !bodyWritesIterator &&
      integerLoopEndIsSnapshot(condition.right, ctx) &&
      symbols.uses.get(iterator) === pairSymbols.uses.get(iterator) &&
      symbols.assignments.get(iterator) === 1
    ) {
      const endName = getIdentifierName(condition.right);
      const endDeclaration = endName ? symbols.declarations.get(endName) : undefined;
      const endAuto = endName ? extractAutoVarName(endName) : undefined;
      const removableEnd =
        endName &&
        endAuto?.suffix === 'ae' &&
        endDeclaration?.initializer &&
        endDeclaration.modifiers?.some(
          (modifier) => modifier.kind === 53 /* SyntaxKind.ConstKeyword */,
        ) &&
        symbols.uses.get(endName) === pairSymbols.uses.get(endName);
      const endExpression = removableEnd
        ? unwrapParens(endDeclaration.initializer)
        : condition.right;
      const ref = buildPickEachIntegerFCRef(
        loop,
        start.right,
        endExpression,
        role,
        ctx,
        iterator,
        endName,
      );
      if (ref) {
        return {
          ref,
          consumed: loopOffset + 1,
          scaffoldingVariables: [iterator, ...(removableEnd ? [endName] : [])],
        };
      }
    }
  }
  const match = tryMatchForEachIntegerCondition(loop.condition, iterator);
  if (!match || new Set([iterator, match.endName, match.incName]).size !== 3) return undefined;
  const endDeclaration = symbols.declarations.get(match.endName);
  const incrementDeclaration = symbols.declarations.get(match.incName);
  const captures = new Map();
  const captureOrder = [];
  for (let offset = 0; offset < loopOffset - 1; offset++) {
    const assignment = getAssignSides(nodes[index + offset]);
    const name = assignment && getIdentifierName(assignment.left);
    if (
      !assignment ||
      !name ||
      ![match.endName, match.incName].includes(name) ||
      captures.has(name)
    )
      return undefined;
    captures.set(name, unwrapParens(assignment.right));
    captureOrder.push(name);
  }
  if (
    captureOrder.length === 2 &&
    (captureOrder[0] !== match.endName || captureOrder[1] !== match.incName)
  )
    return undefined;
  const endExpression = captures.get(match.endName) ?? unwrapParens(endDeclaration?.initializer);
  const step = captures.get(match.incName) ?? unwrapParens(incrementDeclaration?.initializer);
  if (!endExpression || !step) return undefined;
  if (
    !captures.has(match.endName) &&
    !endDeclaration?.modifiers?.some((m) => m.kind === 53 /* SyntaxKind.ConstKeyword */)
  )
    return undefined;
  if (
    !captures.has(match.incName) &&
    !incrementDeclaration?.modifiers?.some((m) => m.kind === 53 /* SyntaxKind.ConstKeyword */)
  )
    return undefined;
  const literal =
    step.kind === 2 /* SyntaxKind.NumericLiteral */ ||
    (step.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
      [21 /* SyntaxKind.MinusToken */, 20 /* SyntaxKind.PlusToken */].includes(
        step.operator?.kind,
      ) &&
      step.operand?.kind === 2); /* SyntaxKind.NumericLiteral */
  if (!literal) return undefined;
  const expectedEndUses = captures.has(match.endName) ? 3 : 2;
  const expectedIncrementUses = captures.has(match.incName) ? 4 : 3;
  // Extra uses preclude removing either captured local.
  if (
    symbols.uses.get(match.endName) !== expectedEndUses ||
    symbols.uses.get(match.incName) !== expectedIncrementUses
  )
    return undefined;
  // The ae/ai helpers are private locals replaced by the recovered call; the
  // iterator only has to be a known variable path (local, global, parameter,
  // record field or array element), exactly what #PARAM(var) accepts.
  if (![match.endName, match.incName].every((name) => ctx.localVarByGalaxyName.has(name)))
    return undefined;
  if (!isAssignableVarTarget(start.left, ctx)) return undefined;
  const scoped = {
    ...ctx,
    pendingAutoEnds: new Map(ctx.pendingAutoEnds),
    pendingAutoIncrements: new Map(ctx.pendingAutoIncrements),
  };
  scoped.pendingAutoEnds.set(match.endName, endExpression);
  scoped.pendingAutoIncrements.set(match.incName, step);
  const startIndex = index + loopOffset - 1;
  const result = tryBuildForEachIntegerFromStmtSequence(
    nodes,
    startIndex,
    role,
    scoped,
    expressionType(start.left, scoped),
  );
  return (
    result && {
      ref: result.ref,
      consumed: loopOffset + 1,
      scaffoldingVariables: [match.endName, match.incName],
    }
  );
}
export function structuredStatements(nodes, ctx, role) {
  ctx.structuredFunctionStatements ??= nodes;
  ctx.structuredTemplates ??= new Map();
  ctx.compiledTemplates ??= new Map();
  ctx.externalPropertyParamData ??= (node, scope) => {
    const type = externalPropertyPathType(
      node,
      scope,
      (ref) => element(ref, scope),
      (owner, name) => structureMember(owner, name, scope),
    );
    return type ? { scriptCode: printNode(node), valueType: type } : undefined;
  };
  ctx.structuredExpression ??= (expression, role, scope, expectedType) =>
    structuredNode(
      expression,
      true,
      scope,
      role,
      expectedType ? { type: expectedType } : undefined,
    );
  candidates(ctx); // Share the immutable dependency-template index with nested scopes.
  const scoped = { ...ctx, localVarByGalaxyName: new Map(ctx.localVarByGalaxyName) };
  const pendingScaffolding = deferredScaffoldingCleanup(nodes, ctx, scoped, functionSymbolIndex);
  const result = [];
  // Comments among the statements are the editor's Comment actions (see commentActionsBetween).
  const comments = commentActionsBetween(nodes, ctx, role);
  let nextComment = 0;
  const emitCommentsUpTo = (limit) => {
    while (nextComment < comments.length && comments[nextComment].before <= limit) {
      const ref = comments[nextComment++].take();
      if (ref) result.push(ref);
    }
  };
  for (let index = 0; index < nodes.length; index++) {
    emitCommentsUpTo(index);
    const node = nodes[index];
    const deprecatedForEachPlayer = tryBuildDeprecatedForEachPlayerFromStmtSequence(
      nodes,
      index,
      role,
      scoped,
    );
    if (deprecatedForEachPlayer) {
      result.push(deprecatedForEachPlayer.ref);
      index += deprecatedForEachPlayer.consumed - 1;
      continue;
    }
    // This editor expansion spans three top-level statements. It must be
    // recognized before matching each statement against an individual loaded
    // template, otherwise Begin/for/End become three unrelated GUI actions.
    const legacyPickEachPlayer = tryBuildLegacyPickEachPlayerFromStmtSequence(
      nodes,
      index,
      role,
      scoped,
    );
    if (legacyPickEachPlayer) {
      result.push(legacyPickEachPlayer.ref);
      index += legacyPickEachPlayer.consumed - 1;
      continue;
    }
    const loadedAutoTemplate = tryBuildLoadedAutoTemplateSequence(nodes, index, role, scoped);
    if (loadedAutoTemplate) {
      result.push(loadedAutoTemplate.ref);
      index += loadedAutoTemplate.consumed - 1;
      continue;
    }
    // Switch was recognized only in the action and trigger-body pipelines; here its
    // `autoX_val` assignment became Set Variable and the cases an If chain.
    const switchStatement = tryBuildSwitchFromStmtSequence(nodes, index, role, scoped);
    if (switchStatement) {
      result.push(switchStatement.ref);
      index += switchStatement.consumed - 1;
      continue;
    }
    const pickEachUnit =
      tryCapturedIntegerLoop(nodes, index, scoped, role) ??
      tryBuildPickEachUnitFromStmtSequence(nodes, index, role, scoped);
    if (pickEachUnit) {
      result.push(pickEachUnit.ref);
      pendingScaffolding.stage(pickEachUnit.scaffoldingVariables);
      index += pickEachUnit.consumed - 1;
      continue;
    }
    if (node.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      const variable = declareStructuredLocal(node, scoped);
      if (node.initializer) {
        if (variable.isConstant) {
          variable.initialValue = structuredParam(
            stringInitializerCarrier(node.initializer, variable),
            scoped,
            undefined,
            variable.variableType?.type,
          );
          continue;
        }
        // Keep evaluation at the declaration's original position, including inside loops.
        result.push(
          structuredNode(
            {
              kind: 138 /* SyntaxKind.ExpressionStatement */,
              expression: {
                kind: 124 /* SyntaxKind.BinaryExpression */,
                left: node.name,
                operatorToken: { kind: 39 /* SyntaxKind.EqualsToken */ },
                right: node.initializer,
              },
            },
            false,
            scoped,
            role,
          ),
        );
      }
    } else if (node.kind !== 139 /* SyntaxKind.EmptyStatement */) {
      // Prefer the editor's native control-flow elements when they can express
      // the complete statement.  Generic templates remain the structural
      // fallback for authored constructs that introduce lexical declarations.
      const containsDeclaration = (value, depth = 0) => {
        if (!value || typeof value !== 'object' || depth > 64) return false;
        if (value.kind === 141 /* SyntaxKind.VariableDeclaration */) return true;
        for (const [key, child] of Object.entries(value)) {
          if (key === 'parent' || key === 'pos' || key === 'end') continue;
          if (Array.isArray(child)) {
            if (child.some((item) => containsDeclaration(item, depth + 1))) return true;
          } else if (containsDeclaration(child, depth + 1)) return true;
        }
        return false;
      };
      let native;
      // All native builders receive the same scoped ReverseCtx used by this
      // structural pass. Property/element paths therefore retain their symbol
      // bindings; excluding them here converted whole if/for statements into
      // anonymous syntax templates. It also made the ForStatement branch below
      // unreachable because every for matched the exclusion itself.
      if (!containsDeclaration(node)) {
        if (node.kind === 129 /* SyntaxKind.IfStatement */)
          native = buildIfThenElseFCRef(node, role, scoped);
        else if (node.kind === 132 /* SyntaxKind.ForStatement */)
          native = buildPickEachIntegerFromForStmt(node, role, scoped);
        else if (node.kind === 137 /* SyntaxKind.ReturnStatement */) {
          native = stmtToActionFCRef(node, role, scoped);
        }
      }
      if (native) {
        result.push(native);
        continue;
      }
      const sequence = tryTemplateSequence(nodes.slice(index), scoped, role);
      if (sequence) {
        result.push(sequence.ref);
        index += sequence.consumed - 1;
      } else {
        const operation =
          node.kind === 138 /* SyntaxKind.ExpressionStatement */ ? node.expression : undefined;
        const compound =
          operation?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
          operation.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */ &&
          assignmentOperators.has(operation.operatorToken?.kind);
        // A compound assignment has an exact native Increment contract even
        // when an index or operand contains a resolved call.  Rejecting every
        // call here sent `array[Native()] += value` to a synthetic
        // ExpressionStatement template, which the editor emitted as an
        // undefined lf_ExpressionStatement helper.  stmtToActionFCRef already
        // distinguishes resolved calls from the Custom Script fallback.
        const assignment = compound ? stmtToActionFCRef(node, role, scoped) : undefined;
        result.push(assignment ?? structuredNode(node, false, scoped, role));
      }
    }
  }
  emitCommentsUpTo(nodes.length);
  pendingScaffolding.finish();
  return result;
}
//# sourceMappingURL=g2t-structured.js.map
