import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readOwnedGuiLibraries} from './read-owned-gui-libraries.mjs';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {indexSourceFunctionDeclarations, canonicalSourceFunctionDeclaration} from '../model/source-function-declarations.mjs';
import {proveSourceInitializerWeaveLifetimes} from '../model/source-initializer-weave-lifetimes.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {triggerInitFuncName, triggerFuncName, triggerHandleName, toGalaxyFunctionName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {SyntaxKind as K, Printer, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha = text => createHash('sha256').update(text).digest('hex');
const printer = new Printer();
const ref = (library, type, id) => ({library, type, id});
const key = r => JSON.stringify([r.library, r.type, r.id]);
const same = (a, b) => key(a) === key(b);
const empty = value => !value || value.length === 0;
const voidZero = n => n?.kind === K.FunctionDeclaration && n.body && n.type.kind === K.VoidKeyword && !n.parameters.length && !n.modifiers?.length;
const directNames = fn => {
  if (!voidZero(fn)) return;
  const names = [];
  for (const s of fn.body.statements) {
    const c = s.kind === K.ExpressionStatement && s.expression;
    if (c?.kind !== K.CallExpression || c.expression.kind !== K.Identifier || c.arguments.length) return;
    names.push(c.expression.name);
  }
  return names;
};
function sourceFiles(input) {
  const rows = [{fileName:'__primary__.galaxy', text:input.script ?? '', owned:true},
    {fileName:'__header__.galaxy', text:input.header ?? '', owned:true},
    ...(input.additionalScripts ?? []).map(f => ({...f, owned:true})),
    ...(input.galaxyDeclarations ?? []).map(f => ({...f, owned:false}))];
  const files = new Map();
  for (const row of rows) {
    assert(typeof row.text === 'string', 'INITIALIZER_GUI_SOURCE_TEXT_REQUIRED');
    if (!row.text.trim()) continue;
    assert(typeof (row.originalPath ?? row.fileName) === 'string', 'INITIALIZER_GUI_SOURCE_NAME_REQUIRED');
    const fileName = logicalSourcePath(row.originalPath ?? row.fileName), previous = files.get(fileName);
    if (previous) {
      assert.equal(previous.text, row.text, 'INITIALIZER_GUI_SOURCE_ALIAS_CONFLICT');
      previous.owned ||= row.owned;
    } else files.set(fileName, {fileName, text:row.text, owned:row.owned, sourceId:'source-initializer-gui:' + fileName, contentSha256:sha(row.text)});
  }
  return [...files.values()];
}
function references(libraries) {
  const rows = [];
  const visit = (node, scope, owner, path) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, scope, owner, path + '[' + i + ']'));
    if (node.id && (node.type || (path === 'subFunctionType' || path.endsWith('.subFunctionType'))) && Object.keys(node).every(k => ['library','type','id'].includes(k))) {
      rows.push({owner, path, target:ref(node.library || scope, node.type ?? 'SubFuncType', node.id)}); return;
    }
    for (const [name, child] of Object.entries(node)) if (name !== 'unknownXml') visit(child, scope, owner, path + '.' + name);
  };
  for (const [library, lib] of libraries) {
    for (const e of Object.values(lib.elements)) for (const [name, value] of Object.entries(e)) if (name !== 'unknownXml')
      visit(value, library, ref(library, e.type, e.id), name);
    for (const [i, r] of (lib.rootRefs ?? []).entries()) visit(r, library, ref(library, 'Root', ''), 'rootRefs[' + i + ']');
  }
  return rows;
}
function activeTriggers(library) {
  const result = [], seen = new Set();
  const walk = r => {
    const owner = r.library || library.id;
    assert.equal(owner, library.id, 'INITIALIZER_GUI_FOREIGN_TREE_ITEM');
    const e = library.elementsByType?.[r.type]?.[r.id];
    assert(e, 'INITIALIZER_GUI_STALE_TREE_REFERENCE');
    if (!['Category','Trigger'].includes(e.type) || e.disabled) return;
    const id = key(ref(owner, e.type, e.id));
    assert(!seen.has(id), 'INITIALIZER_GUI_TREE_OWNER_AMBIGUOUS'); seen.add(id);
    if (e.type === 'Trigger') result.push(e); else for (const child of e.items ?? []) walk(child);
  };
  for (const r of library.rootRefs ?? []) walk(r);
  return result;
}
function cleanNode(e) {
  assert(!e.disabled && !e.expressionCode && !e.expressionText && empty(e.unknownXml), 'INITIALIZER_GUI_OPAQUE_OR_DISABLED_NODE');
  if (['FunctionCall','SubFuncType'].includes(e.type)) assert(empty(e.flags) && !e.scriptCode, 'INITIALIZER_GUI_UNEXPECTED_CALL_OR_TYPE_CODE');
}

/** Independent source/GUI provenance only. No converter receipts, live lowering
 * capabilities, SDK forward emission, or native readiness are used as authority.
 * Other authored scripts and native descriptors remain under their own policies. */
export function verifySourceInitializerGuiOwnership({input, after, before = input.existingTriggerData ?? ''}) {
  assert(input && typeof after === 'string', 'INITIALIZER_GUI_INPUT_REQUIRED');
  const implicitOwner = input.libraryId ?? 'Map';
  const output = readOwnedGuiLibraries(after, implicitOwner);
  const previous = before ? readOwnedGuiLibraries(before, implicitOwner) : new Map();
  const base = {kind:'SOURCE_INITIALIZER_GUI_OWNERSHIP', passed:true, outputXmlSha256:sha(after), records:[],
    reconstructedFromSource:true, converterReceiptsUsed:false, newRuntimeFunctions:0, newCustomScript:0,
    wholePhaseAccepted:false, wholeMapAccepted:false};
  const fresh = [];
  for (const [library, lib] of output) for (const e of Object.values(lib.elements)) {
    if (e.type !== 'FunctionDef' || !e.scriptCode) continue;
    const old = previous.get(library)?.elementsByType?.FunctionDef?.[e.id];
    if (old?.scriptCode === e.scriptCode) continue;
    // Non-adapter authored FunctionDefs are not authorized by this proof.
    // Their existing authored-code policy remains responsible for them.
    if (!e.scriptCode.includes('#SUBFUNCS') && !e.flags?.includes('Event') && !e.flags?.includes('SubFunctions')) continue;
    assert(!old, 'INITIALIZER_GUI_STALE_DEFINITION_ID');
    fresh.push({library, definition:e});
  }
  if (!fresh.length) return base;
  const dependencies = new Map();
  for (const dep of input.dependencyLibraries ?? []) for (const [library, lib] of readOwnedGuiLibraries(dep.triggerData ?? '', implicitOwner)) {
    assert(!dependencies.has(library), 'INITIALIZER_GUI_DEPENDENCY_OWNER_AMBIGUOUS'); dependencies.set(library, lib);
  }
  for (const [library] of output) assert(!dependencies.has(library), 'INITIALIZER_GUI_OUTPUT_SHADOWS_DEPENDENCY');
  // Invocation-local typed index; retain every candidate to preserve ambiguity checks.
  // No converter receipts, cross-call cache or source/ABI evidence is reused.
  const dependencyFunctions = new Map();
  for (const library of dependencies.values()) for (const element of Object.values(library.elements)) {
    if (element.type !== 'FunctionDef') continue;
    const identifier = element.identifier ?? element.name;
    const candidates = dependencyFunctions.get(identifier) ?? [];
    candidates.push(element); dependencyFunctions.set(identifier, candidates);
  }
  const all = new Map([...dependencies, ...output]), refs = references(output);
  const resolve = (r, scope, type) => {
    assert(r && r.id && (!r.type || r.type === type), 'INITIALIZER_GUI_TYPED_REFERENCE_REQUIRED');
    const library = r.library || scope, e = all.get(library)?.elementsByType?.[type]?.[r.id];
    assert(e && e.type === type && e.library === library, 'INITIALIZER_GUI_REFERENCE_OWNER_OR_ID_INVALID');
    return e;
  };
  const files = sourceFiles(input);
  const program = new GalaxyProgramContext(files, {files}, sha, {checks:'binding'});
  try {
    for (const ast of program.documents.values()) { assert.equal(ast.parseDiagnostics.length, 0, 'INITIALIZER_GUI_SOURCE_SYNTAX'); program.attachOriginal(ast); }
    const groups = indexSourceFunctionDeclarations(program.documents);
    const sourceBody = name => {
      const group = groups.get(name);
      assert.equal(group?.status, 'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES', 'INITIALIZER_GUI_SOURCE_BODY_NOT_UNIQUE:' + name);
      const node = group.body.node, location = program.location(node);
      assert(program.verifiedInputIdentity(location.sourceFile)?.owned === true, 'INITIALIZER_GUI_SOURCE_TARGET_NOT_OWNED');
      return node;
    };
    const naming = run => withImplicitLibrary(input.documentKind === 'library' ? undefined : implicitOwner, run);
    const functionNameGroups = new Map();
    const runtimeName = e => naming(() => toGalaxyFunctionName({...e, name:e.identifier ?? e.name}, {
      libId:e.library, library:all.get(e.library), allLibraries:all, functionNameGroups, nativeLibrary:[...dependencies.values()].find(l => l.id === 'Ntve'),
    }));
    const correspondences = new Map();
    const correspondence = library => {
      if (correspondences.has(library)) return correspondences.get(library);
      const triggers = activeTriggers(output.get(library)), names = new Set(), rows = [];
      assert(triggers.length, 'INITIALIZER_GUI_EXISTING_TRIGGER_REQUIRED');
      const stock = (dependencyFunctions.get('TriggerCreate') ?? []).filter(e => e.flags?.includes('Native') && e.flags?.includes('Call') && !e.flags.includes('Event'));
      for (const trigger of triggers) {
        cleanNode(trigger);
        if (before) assert(previous.get(library)?.elementsByType?.Trigger?.[trigger.id], 'INITIALIZER_GUI_NEW_ANCHOR');
        const name = naming(() => triggerInitFuncName(library, trigger)), callbackName = naming(() => triggerFuncName(library, trigger)), handleName = naming(() => triggerHandleName(library, trigger));
        assert(!names.has(name), 'INITIALIZER_GUI_RUNTIME_TRIGGER_NAME_AMBIGUOUS'); names.add(name);
        const ctor = sourceBody(name), callback = sourceBody(callbackName);
        assert(voidZero(ctor), 'INITIALIZER_GUI_CONSTRUCTOR_ABI');
        assert(callback.type.kind === K.BoolKeyword && callback.parameters.length === 2 && callback.parameters.every(p => p.type.kind === K.BoolKeyword && !p.isReference) && !callback.modifiers?.length, 'INITIALIZER_GUI_CALLBACK_ABI');
        const creates = [];
        const walk = n => { if (n.kind === K.CallExpression && n.expression.kind === K.Identifier && n.expression.name === 'TriggerCreate') creates.push(n); forEachChild(n, walk); }; walk(ctor.body);
        assert.equal(creates.length, 1, 'INITIALIZER_GUI_UNIQUE_ORIGINAL_TRIGGER_CREATE');
        const create = creates[0], assignment = create.parent, statement = assignment?.parent;
        assert(assignment?.kind === K.BinaryExpression && assignment.operatorToken.kind === K.EqualsToken && assignment.right === create && assignment.left.kind === K.Identifier && assignment.left.name === handleName && statement?.kind === K.ExpressionStatement && statement.parent === ctor.body, 'INITIALIZER_GUI_DIRECT_ORIGINAL_TRIGGER_CREATE');
        assert.equal(create.arguments.length, 1, 'INITIALIZER_GUI_TRIGGER_CREATE_ABI');
        assert(create.arguments[0].kind === K.StringLiteral && readStringLiteralValue(create.arguments[0].text)?.value === callbackName, 'INITIALIZER_GUI_ORIGINAL_CALLBACK_STRING');
        assert.equal(program.getBinding(create.expression).status, 'BOUND', 'INITIALIZER_GUI_TRIGGER_CREATE_UNBOUND');
        const api = program.declarationAt(create.expression);
        assert(api?.kind === K.FunctionDeclaration && api.modifiers?.some(m => m.kind === K.NativeKeyword) && printer.printNode(api.type) === 'trigger' && api.parameters.length === 1 && printer.printNode(api.parameters[0].type) === 'string' && !api.parameters[0].isReference, 'INITIALIZER_GUI_TRIGGER_CREATE_NATIVE_ABI');
        const apiDeclarations = groups.get(create.expression.name)?.declarations;
        assert(apiDeclarations?.length && apiDeclarations.every(({node:n}) => n.kind === K.FunctionDeclaration && !n.body && n.modifiers?.some(m => m.kind === K.NativeKeyword) && printer.printNode(n.type) === 'trigger' && n.parameters.length === 1 && printer.printNode(n.parameters[0].type) === 'string' && !n.parameters[0].isReference), 'INITIALIZER_GUI_TRIGGER_CREATE_NATIVE_DECLARATIONS_ONLY');
        assert.equal(stock.length, 1, 'INITIALIZER_GUI_TRIGGER_CREATE_STOCK_AMBIGUOUS');
        assert.equal(stock[0].parameters?.length, 1, 'INITIALIZER_GUI_TRIGGER_CREATE_STOCK_ABI');
        assert.equal(stock[0].returnType?.type, 'trigger', 'INITIALIZER_GUI_TRIGGER_CREATE_STOCK_ABI');
        const stockFormal = resolve(stock[0].parameters[0], stock[0].library, 'ParamDef');
        assert(stockFormal.paramType?.type === 'string' && !stockFormal.isReference && !stockFormal.isMultiple && !stock[0].scriptCode && !stock[0].expressionCode && empty(stock[0].actions), 'INITIALIZER_GUI_TRIGGER_CREATE_STOCK_ABI');
        const handle = program.declarationAt(assignment.left);
        assert(program.getBinding(assignment.left).status === 'BOUND' && handle?.kind === K.VariableDeclaration && handle.parent?.kind === K.SourceFile && printer.printNode(handle.type) === 'trigger', 'INITIALIZER_GUI_ORIGINAL_TRIGGER_STORAGE');
        assert(program.verifiedInputIdentity(program.location(handle).sourceFile)?.owned === true, 'INITIALIZER_GUI_TRIGGER_STORAGE_NOT_OWNED');
        rows.push({trigger, name, ctor, callback, callbackName, handleName, stockCreate:ref(stock[0].library, 'FunctionDef', stock[0].id)});
      }
      // An ordinary serialized definition must not introduce a second runtime owner.
      const ordinaryRuntimeNames = new Set();
      for (const e of Object.values(output.get(library).elements)) if (e.type === 'FunctionDef' && !e.disabled && !e.scriptCode)
        ordinaryRuntimeNames.add(runtimeName(e));
      for (const row of rows)
        assert(!ordinaryRuntimeNames.has(row.name) && !ordinaryRuntimeNames.has(row.callbackName), 'INITIALIZER_GUI_AUTOMATIC_RUNTIME_OWNER_DUPLICATED');
      correspondences.set(library, rows); return rows;
    };
    for (const {library, definition} of fresh) {
      cleanNode(definition);
      assert.deepEqual([...(definition.flags ?? [])].sort(), ['Action','Event','SubFunctions'], 'INITIALIZER_GUI_ADAPTER_FLAGS');
      assert.equal(definition.scriptCode, '#SUBFUNCS(actions)', 'INITIALIZER_GUI_ADAPTER_CODE');
      assert.deepEqual(Object.fromEntries(Object.entries(definition.returnType ?? {}).filter(([, v]) => v !== undefined)), {type:'void'}, 'INITIALIZER_GUI_ADAPTER_RETURN_TYPE');
      assert(empty(definition.parameters) && empty(definition.actions) && empty(definition.localVariables) && empty(definition.subFunctions), 'INITIALIZER_GUI_ADAPTER_RUNTIME_BODY');
      assert.equal(definition.subFunctionTypes?.length, 1, 'INITIALIZER_GUI_ACTIONS_TYPE_CARDINALITY');
      const type = resolve(definition.subFunctionTypes[0], library, 'SubFuncType'); cleanNode(type);
      assert(type.library === library && (type.identifier ?? type.name) === 'actions' && type.isAction === true, 'INITIALIZER_GUI_ACTIONS_TYPE');
      assert(!previous.get(library)?.elementsByType?.SubFuncType?.[type.id], 'INITIALIZER_GUI_STALE_ACTIONS_TYPE_ID');
      const users = Object.values(output.get(library).elements).filter(e => e.type === 'FunctionCall' && e.functionDef && same(ref(e.functionDef.library || library, e.functionDef.type, e.functionDef.id), ref(library, 'FunctionDef', definition.id)));
      assert.equal(users.length, 1, 'INITIALIZER_GUI_ADAPTER_USE_NOT_UNIQUE');
      const call = users[0]; cleanNode(call);
      const definitionUses = refs.filter(r => same(r.target, ref(library, 'FunctionDef', definition.id)) && !['Category','Root'].includes(r.owner.type));
      assert(definitionUses.length === 1 && same(definitionUses[0].owner, ref(library, 'FunctionCall', call.id)) && definitionUses[0].path === 'functionDef', 'INITIALIZER_GUI_ADAPTER_DEFINITION_OBSERVER');
      assert(empty(call.parameters) && !call.subFunctionType && call.subFunctions?.length, 'INITIALIZER_GUI_ADAPTER_CALL_SHAPE');
      const incoming = refs.filter(r => same(r.target, ref(library, 'FunctionCall', call.id)));
      assert.equal(incoming.length, 1, 'INITIALIZER_GUI_ADAPTER_OWNER_NOT_UNIQUE');
      const owner = incoming[0].owner;
      assert(owner.library === library && owner.type === 'Trigger', 'INITIALIZER_GUI_ADAPTER_NOT_TRIGGER_EVENT');
      const rows = correspondence(library), anchor = rows.find(r => r.trigger.id === owner.id);
      assert(anchor, 'INITIALIZER_GUI_ADAPTER_ANCHOR_NOT_ACTIVE');
      assert.equal(incoming[0].path, 'events[' + (anchor.trigger.events.length - 1) + ']', 'INITIALIZER_GUI_ADAPTER_NOT_LAST_EVENT');
      const targets = call.subFunctions.map((r, i) => {
        const child = resolve(r, library, 'FunctionCall'); cleanNode(child);
        assert.equal(child.library, library, 'INITIALIZER_GUI_CHILD_CALL_SCOPE');
        const childRefs = refs.filter(x => same(x.target, ref(library, 'FunctionCall', child.id)));
        assert(childRefs.length === 1 && same(childRefs[0].owner, ref(library, 'FunctionCall', call.id)) && childRefs[0].path === 'subFunctions[' + i + ']', 'INITIALIZER_GUI_CHILD_OWNER_OR_ORDER');
        assert(empty(child.parameters) && empty(child.subFunctions) && child.subFunctionType, 'INITIALIZER_GUI_CHILD_CALL_ABI');
        assert.equal(resolve(child.subFunctionType, library, 'SubFuncType'), type, 'INITIALIZER_GUI_CHILD_ACTION_TYPE');
        const target = resolve(child.functionDef, library, 'FunctionDef'); cleanNode(target);
        assert(target.flags?.includes('NoScriptPrefix') && target.flags.includes('Action') && !target.flags.some(f => ['Native','Event','Operator','CreateThread','SubFunctions','Template','Inline'].includes(f)) && !target.scriptCode && empty(target.parameters) && (target.returnType?.type ?? 'void') === 'void', 'INITIALIZER_GUI_TARGET_NOT_ORDINARY_VOID_ZERO');
        const name = runtimeName(target), source = sourceBody(name); assert(voidZero(source), 'INITIALIZER_GUI_TARGET_SOURCE_ABI');
        const collisions = [...all.values()].flatMap(l => Object.values(l.elements)).filter(e => e.type === 'FunctionDef' && !e.disabled && !e.scriptCode && runtimeName(e) === name);
        assert.equal(collisions.length, 1, 'INITIALIZER_GUI_TARGET_RUNTIME_NAME_AMBIGUOUS');
        return {definition:ref(target.library, 'FunctionDef', target.id), name, source:program.location(source), sourceBodySha256:sha(printer.printNode(source))};
      });
      const typeUses = refs.filter(r => same(r.target, ref(library, 'SubFuncType', type.id)));
      const expectedTypeUses = new Set([key(ref(library, 'FunctionDef', definition.id)) + ':subFunctionTypes[0]', ...call.subFunctions.map(r => key(ref(library, 'FunctionCall', r.id)) + ':subFunctionType')]);
      assert(typeUses.length === expectedTypeUses.size && typeUses.every(r => expectedTypeUses.has(key(r.owner) + ':' + r.path)), 'INITIALIZER_GUI_ACTIONS_TYPE_OBSERVER');
      assert(new Set(call.subFunctions.map(r => key(ref(r.library || library, 'FunctionCall', r.id)))).size === call.subFunctions.length, 'INITIALIZER_GUI_CHILD_ID_REUSED');
      const automaticNames = rows.map(r => r.name), automatic = new Set(automaticNames), phases = [];
      for (const [fileName, ast] of program.documents) if (program.verifiedInputIdentity(fileName)?.owned) for (const phase of ast.statements) {
        const names = directNames(phase);
        if (!names || names.length <= automaticNames.length || JSON.stringify(names.filter(n => automatic.has(n))) !== JSON.stringify(automaticNames)) continue;
        // This proves prefix emptiness and rejects additional incoming callers,
        // escaped references and string observers from every supplied source file.
        const lifetime = proveSourceInitializerWeaveLifetimes({program, fileName, phaseName:phase.name.name, automaticNames}).proof;
        const slot = lifetime.changedConstructors.find(c => c.name === anchor.name);
        if (slot && JSON.stringify(slot.manualCalls.map(c => c.name)) === JSON.stringify(targets.map(t => t.name))) phases.push({phase, fileName, lifetime, slot});
      }
      assert.equal(phases.length, 1, 'INITIALIZER_GUI_SOURCE_PHASE_OR_CALL_ORDER_AMBIGUOUS');
      const phase = phases[0];
      base.records.push({definition:ref(library, 'FunctionDef', definition.id), definitionSha256:sha(JSON.stringify(definition)),
        call:ref(library, 'FunctionCall', call.id), anchor:ref(library, 'Trigger', anchor.trigger.id), automaticConstructor:anchor.name,
        originalConstructor:program.location(anchor.ctor), originalCallback:program.location(anchor.callback), originalHandle:anchor.handleName,
        originalTriggerCreate:anchor.stockCreate, phase:program.location(phase.phase), phaseName:phase.phase.name.name,
        automaticNames, targets, lifetime:phase.lifetime, sourceCallOrder:phase.slot.manualCalls.map(c => c.name),
        declarativeMacroTemplates:1, wholePhaseAccepted:false});
    }
    return {...base, newDeclarativeMacros:base.records.length, sourceInputs:files.map(({text, ...f}) => f)};
  } finally { program.dispose(); }
}

