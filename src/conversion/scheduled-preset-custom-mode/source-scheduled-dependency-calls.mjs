import { auditGuiDependencyReferenceRemap } from '../../verification/gui-dependency-reference-remap.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readSourceLibraryInitialization } from '../../model/source-library-initialization-schedule.paths.mjs';
import { indexSourceFunctionDeclarations } from '../../model/source-function-declarations.mjs';
import { logicalSourcePath } from '../../model/source-ownership.mjs';
import { parseImmutableGalaxySyntax } from '../../model/immutable-galaxy-syntax.mjs';
import { createDocumentEnvironment } from '../../model/document-environment.mjs';
import { checkPreservedSourceFunctionInterface } from '../../bindings/preserved-source-member-contract.boolean-conditions.mjs';
import {
  SyntaxKind as K,
  Printer,
} from '../../sdk/array-values/modules/galaxy/language-core/index.js';
import {
  mapParameterTypeToGalaxy,
  toGalaxyFunctionName,
  presetValueConstantName,
} from '../native-expression-identity/ttg-core.js';
const printer = new Printer(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const refKey = (ref, owner) => JSON.stringify([ref.library ?? owner, ref.type, ref.id]);
const reference = (v) =>
  v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  v.type &&
  v.id &&
  Object.keys(v).every((k) => ['type', 'id', 'library'].includes(k));
const bookkeeping = new Set(['parent', 'xmlSource', 'rawXml']);

/** Local inline call metadata avoids Editor auto-starting a dependency that the
 * source starts later. Every body and constant still comes from unchanged,
 * bound input. Plan first; commit only after all ABI/domain checks succeed. */
export function reifySourceScheduledDependencyCalls({
  program,
  scheduleCapability,
  elements,
  libraryId,
  nativeLibrary,
  dependencies,
  rootRefs,
  allocateId,
}) {
  const schedule = readSourceLibraryInitialization(scheduleCapability, program);
  const early = new Set(schedule.early.map((r) => r.libraryId)),
    late = new Set(schedule.deferred.map((r) => r.libraryId).filter((id) => !early.has(id)));
  const proof = {
    kind: 'SOURCE_SCHEDULED_DEPENDENCY_INLINE_INTERFACES',
    deferredLibraryIds: [...late],
    calls: [],
    interfaces: [],
    presets: [],
    newNative: 0,
    newRuntimeFunctions: 0,
    newOpaqueCustomScript: 0,
    sourceChanged: false,
    guiStructureRebuilt: false,
    actualNativeExportStillRequired: true,
    wholeMapAccepted: false,
  };
  if (!late.size) return proof;
  const libraries = new Map(dependencies ?? []);
  if (nativeLibrary) libraries.set(nativeLibrary.id, nativeLibrary);
  libraries.set(libraryId, { id: libraryId, elements, elementsByType: {} });
  const env = createDocumentEnvironment(libraries);
  assert.equal(env.issues.length, 0, 'SCHEDULED_GUI_DUPLICATE_TYPED_ID');
  const functions = indexSourceFunctionDeclarations(program.documents),
    pending = {},
    copies = new Map(),
    sourceFunctions = new Map(),
    presetOwners = new Map();
  const occupied = new Set(Object.values(elements).map((e) => e.id)),
    view = { ...elements },
    own = { id: libraryId, elements: view, elementsByType: {} },
    all = new Map([...libraries, [libraryId, own]]),
    originals = new Map();
  const carrier = (type, owner) =>
    mapParameterTypeToGalaxy(
      type,
      owner === libraryId ? own : libraries.get(owner),
      nativeLibrary,
      all,
    );
  const get = (ref, owner) => {
    const e = env.resolve(ref, owner, ref.type);
    assert(
      e &&
        e.type === ref.type &&
        e.id === ref.id &&
        (e.library ?? owner) === (ref.library ?? owner),
      'SCHEDULED_GUI_TYPED_REFERENCE',
    );
    return e;
  };
  const allocate = (source) => {
    const id = allocateId(
      JSON.stringify([
        'source-scheduled-dependency',
        libraryId,
        source.library,
        source.type,
        source.id,
      ]),
    );
    assert(typeof id === 'string' && id && !occupied.has(id), 'SCHEDULED_GUI_FRESH_ID');
    occupied.add(id);
    return id;
  };
  const remember = (e) => {
    const r = { type: e.type, id: allocate(e), library: libraryId };
    copies.set(refKey(e, e.library), r);
    pending[r.id] = { ...r };
    view[r.id] = pending[r.id];
    return r;
  };
  const unchanged = (file, node) => {
    if (!originals.has(file)) {
      const ast = parseImmutableGalaxySyntax(program.documents.get(file).text, file);
      assert.equal(ast.parseDiagnostics.length, 0);
      originals.set(file, ast);
    }
    const matches = originals
      .get(file)
      .statements.filter((n) => n.pos === node.pos && n.end === node.end);
    assert(
      matches.length === 1 && printer.printNode(matches[0]) === printer.printNode(node),
      'SCHEDULED_SOURCE_AST_CHANGED',
    );
  };
  const sourceFor = (name) => {
    const group = functions.get(name),
      node = group?.body?.node;
    assert(
      group?.status === 'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES',
      'SCHEDULED_SOURCE_UNIQUE_ORDINARY_BODY',
    );
    const location = program.location(node),
      identity = program.verifiedInputIdentity(location.sourceFile);
    assert(
      identity?.owned === false && identity.contentSha256 === location.contentSha256,
      'SCHEDULED_SOURCE_DEPENDENCY_IDENTITY',
    );
    unchanged(location.sourceFile, node);
    const source = {
      name,
      owner: logicalSourcePath(location.sourceFile),
      sourceSha256: identity.contentSha256,
      declarationSha256: sha(
        program.documents.get(location.sourceFile).text.slice(node.pos, node.end),
      ),
      returnType: printer.printNode(node.type),
      parameters: node.parameters.map((p) => ({
        name: p.name.name,
        type: printer.printNode(p.type),
        isReference: !!p.isReference,
      })),
    };
    assert(
      /^[A-Za-z_]\w*$/u.test(source.returnType) &&
        source.parameters.every((p) => !p.isReference && /^[A-Za-z_]\w*$/u.test(p.type)),
      'SCHEDULED_SOURCE_SIMPLE_ABI',
    );
    sourceFunctions.set(name, source);
    return source;
  };
  const constant = (name) => {
    const rows = [];
    for (const [file, ast] of program.documents)
      for (const n of ast.statements) if (n.name?.name === name) rows.push({ file, n });
    assert.equal(rows.length, 1, 'SCHEDULED_PRESET_UNIQUE_SOURCE_CONSTANT');
    const { file, n } = rows[0],
      identity = program.verifiedInputIdentity(file);
    assert(
      identity?.owned === false &&
        n.kind === K.VariableDeclaration &&
        n.modifiers?.some((m) => m.kind === K.ConstKeyword) &&
        n.initializer,
      'SCHEDULED_PRESET_ORIGINAL_CONSTANT_REQUIRED',
    );
    unchanged(file, n);
    return {
      name,
      sourceFile: file,
      sourceSha256: identity.contentSha256,
      declarationSha256: sha(program.documents.get(file).text.slice(n.pos, n.end)),
    };
  };
  for (const id of late)
    for (const e of env.elements(id, 'Preset'))
      for (const ref of e.values ?? []) {
        const key = refKey(ref, id);
        assert(!presetOwners.has(key), 'SCHEDULED_PRESET_MULTIPLE_OWNERS');
        presetOwners.set(key, e);
      }
  const cloneData = (value, owner) => {
    if (Array.isArray(value)) return value.map((v) => cloneData(v, owner));
    if (!value || typeof value !== 'object') return value;
    if (reference(value))
      return late.has(value.library ?? owner)
        ? copyRef(value, owner)
        : { ...value, library: value.library ?? owner };
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !bookkeeping.has(k))
        .map(([k, v]) => [k, cloneData(v, owner)]),
    );
  };
  function copyFunction(original) {
    assert(
      original.flags?.includes('Native') &&
        !original.flags.some(
          (f) => !['Native', 'Action', 'Call', 'Condition', 'NoScriptPrefix'].includes(f),
        ) &&
        !original.disabled &&
        !original.scriptCode &&
        !original.expressionCode &&
        !original.actions?.length &&
        !original.localVariables?.length &&
        !original.subFunctionTypes?.length,
      'SCHEDULED_GUI_PLAIN_CALL_REQUIRED',
    );
    const owner = original.library,
      name =
        typeof original.identifier === 'string' && /^[A-Za-z_]\w*$/u.test(original.identifier)
          ? original.identifier
          : toGalaxyFunctionName(original, {
              libId: owner,
              library: libraries.get(owner),
              nativeLibrary,
              allLibraries: libraries,
            }),
      source = sourceFor(name);
    const action = original.isFuncAction === true || original.flags.includes('Action'),
      call = original.isFuncCall === true || original.flags.includes('Call');
    assert(action !== call, 'SCHEDULED_GUI_SINGLE_CALL_ROLE');
    const originalReturn = original.returnType ?? { type: 'void' };
    assert(
      action
        ? carrier(originalReturn, owner) === 'void'
        : carrier(originalReturn, owner) === source.returnType,
      'SCHEDULED_GUI_RESULT_ABI',
    );
    const formals = (original.parameters ?? []).map((ref) => get(ref, owner));
    assert.equal(formals.length, source.parameters.length, 'SCHEDULED_GUI_FORMAL_ARITY');
    const ref = remember(original),
      parameters = [];
    for (let i = 0; i < formals.length; i++) {
      const p = formals[i],
        abi = source.parameters[i];
      assert(
        !p.isReference && carrier(p.paramType, owner) === abi.type,
        'SCHEDULED_GUI_FORMAL_ABI',
      );
      assert(!copies.has(refKey(p, owner)), 'SCHEDULED_GUI_SHARED_FORMAL_REQUIRES_PROOF');
      const r = remember(p);
      parameters.push(r);
      const local = cloneData(p, owner);
      Object.assign(pending[r.id], local, r, { name: abi.name, identifier: abi.name });
    }
    const params = parameters.map((r) => pending[r.id]);
    assert(
      params.every((p) => /^[A-Za-z_]\w*$/u.test(p.name)) &&
        new Set(params.map((p) => p.name)).size === params.length,
      'SCHEDULED_GUI_FORMAL_NAMES',
    );
    Object.assign(pending[ref.id], {
      name: original.name ?? name,
      identifier: original.identifier ?? name,
      displayName: original.displayName,
      hint: original.hint,
      returnType: cloneData(originalReturn, owner),
      parameters,
      flags: ['Operator', 'NoScriptPrefix', action ? 'Action' : 'Call'],
      ...(action ? { isFuncAction: true } : { isFuncCall: true }),
      scriptCode: `${name}(${params.map((p) => `#PARAM(${p.name})`).join(', ')})${action ? ';' : ''}`,
    });
    return ref;
  }
  function copyRef(ref, owner) {
    const key = refKey(ref, owner),
      prior = copies.get(key);
    if (prior) return { ...prior };
    const e = get(ref, owner);
    if (e.type === 'FunctionDef') return copyFunction(e);
    if (e.type === 'PresetValue') {
      const parent = presetOwners.get(key);
      assert(parent, 'SCHEDULED_PRESET_VALUE_OWNER_REQUIRED');
      copyRef({ type: 'Preset', id: parent.id, library: parent.library }, parent.library);
      return { ...copies.get(key) };
    }
    assert(
      ['Param', 'FunctionCall', 'Preset'].includes(e.type),
      'SCHEDULED_GUI_UNSUPPORTED_DEPENDENCY_ELEMENT:' + e.type,
    );
    const r = remember(e);
    if (e.type === 'Preset') {
      assert(
        !e.disabled && !e.extends && typeof e.baseType === 'string',
        'SCHEDULED_PRESET_DOMAIN_REQUIRED',
      );
      const values = (e.values ?? []).map((v) => get(v, e.library));
      assert(
        values.length && new Set(values.map((v) => v.id)).size === values.length,
        'SCHEDULED_PRESET_DOMAIN_VALUES',
      );
      const constants = [];
      for (const value of values) {
        const vr = remember(value),
          code = e.generateConstants || e.integer ? presetValueConstantName(e, value) : value.value;
        assert(typeof code === 'string' && code.trim(), 'SCHEDULED_PRESET_EXPLICIT_VALUE_REQUIRED');
        if (e.generateConstants || e.integer) constants.push(constant(code));
        Object.assign(pending[vr.id], cloneData(value, e.library), vr, { value: code });
      }
      const copied = cloneData(e, e.library);
      // Explicit script-valued domains need PresetCustom in the actual XML.
      // Removing PresetInteger alone makes Editor use implicit ordinal constants.
      Object.assign(pending[r.id], copied, r, {
        generateConstants: false,
        integer: false,
        generateIdentifier: false,
        asBits: false,
        unknownXml: [
          ...(copied.unknownXml ?? []).filter((n) => n.tag !== 'PresetCustom'),
          { tag: 'PresetCustom', position: 0 },
        ],
      });
      proof.presets.push({
        original: { library: e.library, type: e.type, id: e.id },
        local: r,
        constants,
        newRuntimeConstants: 0,
      });
    } else Object.assign(pending[r.id], cloneData(e, e.library), r);
    return { ...r };
  }
  const calls = [...new Set(Object.values(elements))].filter(
    (e) =>
      e.type === 'FunctionCall' && e.functionDef && late.has(e.functionDef.library ?? libraryId),
  );
  for (const call of calls) {
    const original = get(call.functionDef, libraryId),
      local = copyRef(call.functionDef, libraryId);
    const expected = new Set((original.parameters ?? []).map((r) => refKey(r, original.library))),
      seen = new Set();
    for (const ref of call.parameters ?? []) {
      const p = get(ref, libraryId),
        key = refKey(p.parameterDef, libraryId);
      assert(expected.has(key) && !seen.has(key), 'SCHEDULED_GUI_ACTUAL_FORMAL_OWNER');
      seen.add(key);
    }
    assert.equal(seen.size, expected.size, 'SCHEDULED_GUI_COMPLETE_ACTUALS_REQUIRED');
    proof.calls.push({
      call: { library: libraryId, type: call.type, id: call.id },
      original: call.functionDef,
      local,
    });
  }
  if (!calls.length) return proof;
  const sourceIndex = {
    resolve(name) {
      const definition = sourceFunctions.get(name);
      return definition ? { status: 'UNIQUE_SIMPLE_ABI', definition } : { status: 'MISSING' };
    },
  };
  for (const e of Object.values(pending).filter((e) => e.type === 'FunctionDef'))
    proof.interfaces.push(
      checkPreservedSourceFunctionInterface(sourceIndex, e, view, libraryId, (type) =>
        carrier(type, libraryId),
      ),
    );
  const rewritten = (value) => {
    if (Array.isArray(value)) {
      const next = value.map(rewritten);
      return next.every((v, i) => v === value[i]) ? value : next;
    }
    if (!value || typeof value !== 'object') return value;
    if (reference(value)) return copies.get(refKey(value, libraryId)) ?? value;
    const next = Object.entries(value).map(([key, v]) => [
      key,
      bookkeeping.has(key) ? v : rewritten(v),
    ]);
    return next.every(([key, v]) => v === value[key]) ? value : Object.fromEntries(next);
  };
  const edits = [];
  for (const e of new Set(Object.values(elements)))
    for (const [key, value] of Object.entries(e))
      if (!bookkeeping.has(key) && typeof value === 'object' && value !== null) {
        const next = rewritten(value);
        if (next !== value) edits.push({ e, key, value: next });
      }
  // Existing category and root ordering is retained. New interface metadata is
  // placed before trigger roots; it never acquires an executable body.
  const categories = new Map(
    Object.values(elements)
      .filter((e) => e.type === 'Category')
      .map((e) => [e.id, e]),
  );
  const hasTrigger = (ref, seen = new Set()) => {
    if (ref.type === 'Trigger') return true;
    if (ref.type !== 'Category' || seen.has(ref.id)) return false;
    seen.add(ref.id);
    return (categories.get(ref.id)?.items ?? []).some((r) => hasTrigger(r, seen));
  };
  const offset = rootRefs.findIndex((r) => hasTrigger(r)),
    roots = Object.values(pending)
      .filter((e) => ['FunctionDef', 'Preset'].includes(e.type))
      .map((e) => ({ type: e.type, id: e.id, library: libraryId }));
  const projected = { ...elements, ...pending },
    revisions = new Map();
  for (const edit of edits) {
    let revision = revisions.get(edit.e);
    if (!revision) {
      revision = { ...edit.e };
      revisions.set(edit.e, revision);
      projected[revision.id] = revision;
    }
    revision[edit.key] = edit.value;
  }
  const projectedRoots = [...rootRefs];
  projectedRoots.splice(offset < 0 ? projectedRoots.length : offset, 0, ...roots);
  proof.guiPreservation = auditGuiDependencyReferenceRemap({
    before: { elements, items: rootRefs },
    after: { elements: projected, items: projectedRoots },
    libraryId,
  });
  Object.assign(elements, pending);
  for (const edit of edits) edit.e[edit.key] = edit.value;
  rootRefs.splice(offset < 0 ? rootRefs.length : offset, 0, ...roots);
  proof.addedElements = Object.keys(pending).length;
  proof.rewrittenFields = edits.length;
  return proof;
}
