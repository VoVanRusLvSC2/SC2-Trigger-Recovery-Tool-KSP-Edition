import { readLocalizedOwnedGuiLibraries } from '../../gui/localized-owned-libraries.mjs';
import { adoptVerifiedPartitionProvenance } from './partition-authored-provenance.mjs';
import { readOwnedGuiLibraries } from '../standard-gui-resources/read-owned-gui-libraries.mjs';
import {
  planPreservedIncludeStorageOrder,
  orderPreservedIncludeStorage,
} from '../retained-nominal-storage/preserved-include-storage-order.prototypes.mjs';
import { isPreservedSourceIncludeElement } from '../exact-function-signatures/preserved-source-includes.exact-inputs.mjs';
import { appendRetainedPrimaryStorage } from '../retained-nominal-storage/retained-primary-storage.mjs';
import { sourceInlineRoleFlags } from '../../bindings/source-inline-role-flags.mjs';
import {
  canDeferAuthoredGuiComponent,
  verifyAuthoredGuiFrontier,
} from '../retained-nominal-storage/authored-gui-frontier.mjs';
import {
  withAuthoredStorageInterfaces,
  registerAuthoredStorageInterfaces,
  isAuthoredStorageInterfaceElement,
  isAuthoredStorageInterfaceXml,
  authoredStorageInterfaceProof,
} from '../qualified-macro-binding/authored-storage-interfaces.diagnostics.mjs';
import { mapParameterTypeToGalaxy as authoredStorageCarrier } from '../native-expression-identity/core-alternate.mjs';
import { orderGuiAuthoredSourceSections } from '../../model/gui-authored-source-order.mjs';
import { planAuthoredInitializerMetadata } from '../nominal-passive-initializer-classification/authored-initializer-phase-plan.mjs';
import { verifyGuiAuthoredInitializerMetadata } from '../../model/gui-authored-initializer-metadata.mjs';
import { publicAuthoredFunctionBodies } from '../exact-function-signatures/source-function-declarations.complete.mjs';
import { analyzeClosedAuthoredUnits } from '../native-expression-identity/closed-authored-units.qualified.mjs';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { indexAuthoredScriptSections } from '../exact-function-signatures/authored-script-sections.typedef-initializer-anchors.mjs';
import { createGalaxyDocument } from '../exact-function-signatures/galaxy-document.collections.mjs';
import { SyntaxKind as K, Printer } from '../exact-function-signatures/index-alternate-3.js';
import {
  scriptCodeFromBlock,
  parseTriggerXmlSync,
} from '../implicit-gui-localization/sax-reader-alternate-3.js';

const scope = new AsyncLocalStorage();
const sha = (s) => createHash('sha256').update(s).digest('hex');
const getTypeName = (n) => new Printer().printNode(n);
const xmlCode = (s) => s.replace(/\r\n?/gu, '\n');
const key = (e) => JSON.stringify([e.library, e.type, e.id]);
const require = createRequire(
  new URL(
    new URL(
      '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js',
      import.meta.url,
    ).href,
    import.meta.url,
  ),
);
const sax = require('sax');

// Only a completely supported unit of explicitly delimited, function-only authored sections qualifies. No
// inferred missing binding, map name, native API list or fallback is accepted.
function makeLegacyPlan(input, policy) {
  if (!policy.preserveAuthoredCode || input.existingTriggerData?.trim()) return [];
  const result = [];
  for (const [fileName, text] of [
    ['primary.galaxy', input.script ?? ''],
    ['header.galaxy', input.header ?? ''],
  ]) {
    if (!text.trim() || !/^\/\/ Custom Script: \S/mu.test(text)) continue;
    const index = indexAuthoredScriptSections({ fileName, text, expectedSha256: sha(text) });
    if (index.rejected.length) return [];
    const document = createGalaxyDocument({ fileName, text });
    try {
      for (const section of index.sections) {
        if (!section.declarations.length) continue;
        // A mixed authored unit needs a complete global/structure ownership
        // contract. Partial function preservation can change call binding.
        if (
          section.library !== (input.libraryId ?? 'Map') ||
          section.declarations.some((d) => d.kind !== K.FunctionDeclaration)
        )
          return [];
        const functions = section.declarations.map((d) => {
          const found = document.ast.statements.filter(
            (n) => n.kind === K.FunctionDeclaration && n.name.name === d.name,
          );
          if (found.length !== 1 || !found[0].body || found[0].pos !== d.start) return undefined;
          const fn = found[0],
            parameters = fn.parameters.map((p) => ({
              name: p.name.name,
              type: getTypeName(p.type),
            }));
          // Ref/array/generic signatures need a separate ABI contract. A simple
          // identifier type can be checked directly against the GUI formal.
          if (
            parameters.some((p) => !/^[A-Za-z_]\w*$/u.test(p.type)) ||
            !/^[A-Za-z_]\w*$/u.test(getTypeName(fn.type))
          )
            return undefined;
          return {
            name: d.name,
            declarationSha256: d.sha256,
            parameters,
            returnType: getTypeName(fn.type),
          };
        });
        if (functions.some((f) => !f)) return [];
        result.push({
          ...section,
          fileName,
          sourceSha256: sha(text),
          code: text.slice(section.start, section.end),
          functions,
        });
      }
    } finally {
      document.dispose();
    }
  }
  const names = result.flatMap((s) => s.functions.map((f) => f.name));
  assert.equal(new Set(names).size, names.length, 'AMBIGUOUS_AUTHORED_SECTION_FUNCTION');
  return result;
}

function makeAuthoredPlan(input, policy) {
  const legacy = makeLegacyPlan(input, policy);
  if (legacy.length || !policy.preserveAuthoredCode || input.existingTriggerData?.trim())
    return legacy;
  const sources = [
    ['primary.galaxy', input.script ?? ''],
    ['header.galaxy', input.header ?? ''],
  ]
    .filter(([, text]) => text.trim())
    .map(([fileName, text]) => ({ fileName, text }));
  if (!sources.some((s) => /^\/\/ Custom Script: \S/mu.test(s.text))) return [];
  const closure = analyzeClosedAuthoredUnits({
    sources,
    declarationSources: input.galaxyDeclarations ?? [],
    libraryId: input.libraryId ?? 'Map',
  });
  const prepared = new Map(),
    plan = [];
  for (const unit of closure.units) {
    const names = new Set(unit.publicCalls.map((c) => c.name));
    const functions = publicAuthoredFunctionBodies(unit);
    if (
      functions.some(
        (f) =>
          !f.hasBody ||
          !/^[_A-Za-z]\w*$/u.test(f.returnType) ||
          f.parameters.some((p) => !/^[_A-Za-z]\w*$/u.test(p.type)),
      )
    )
      continue;
    const privateDeclarations = unit.declarations
      .filter((d) => d.kind !== K.FunctionDeclaration || !names.has(d.name))
      .map((d) => ({ name: d.name, kind: d.kind }));
    prepared.set(unit.id, {
      ...unit,
      code: unit.sourceCode,
      sha256: unit.sectionSha256,
      functions: functions.map((f) => ({ ...f, declarationSha256: f.sourceSha256 })),
      privateDeclarations,
      allFunctionNames: unit.declarations
        .filter((d) => d.kind === K.FunctionDeclaration)
        .map((d) => d.name),
      closedMixedUnit: true,
    });
  }
  // A connected source component is indivisible: an unsupported public ABI in
  // any member cannot leave a dependent half preserved and another half rebuilt.
  for (const component of closure.components)
    if (
      (component.closurePassed || canDeferAuthoredGuiComponent(component)) &&
      component.units.every((id) => prepared.has(id))
    )
      plan.push(...component.units.map((id) => prepared.get(id)));
  Object.defineProperty(plan, 'closure', {
    value: {
      kind: closure.kind,
      bindingOnly: true,
      components: closure.components,
      units: closure.units.map(({ sourceCode, ...unit }) => unit),
      guiEmissionAuthorized: false,
      semanticEquivalenceProved: false,
    },
  });
  return plan;
}

function makePlan(input, policy) {
  return appendRetainedPrimaryStorage(input, policy, makeAuthoredPlan(input, policy));
}

export function shouldSkipAuthoredSectionDeclaration(node, libId) {
  const context = scope.getStore();
  if (!context?.active) return false;
  if (
    node.kind === K.FunctionDeclaration &&
    context.plan.some(
      (s) => s.library === libId && s.functions.some((f) => f.name === node.name?.name),
    )
  )
    return false;
  return context.plan.some(
    (s) =>
      s.library === libId &&
      s.privateDeclarations?.some((d) => d.kind === node.kind && d.name === node.name?.name),
  );
}
export function isPreservedAuthoredSectionFunction(node, libId) {
  const context = scope.getStore();
  return (
    !!context?.active &&
    context.plan.some(
      (s) =>
        s.library === libId &&
        (s.allFunctionNames ?? s.functions.map((f) => f.name)).includes(node.name?.name),
    )
  );
}

export async function withAuthoredSectionFunctions(input, policy, callback) {
  const plan = makePlan(input, policy);
  const context = {
    input,
    includeStoragePlan: undefined,
    includeStorageProof: undefined,
    plan,
    emittedLibraries: new Map(),
    dependencyLibraries: new Map(),
    frontierProof: undefined,
    initializers: planAuthoredInitializerMetadata(input, plan),
    records: new Map(),
    active: true,
  };
  return scope.run(context, async () => {
    try {
      return await withAuthoredStorageInterfaces(input, plan, async () => {
        const result = await callback(context.plan);
        if (context.adoptedPartitionRecords && result?.output?.triggerData) {
          for (const [id, library] of await readLocalizedOwnedGuiLibraries(
            result.output.triggerData,
            result.output.triggerStrings,
            input.libraryId ?? 'Map',
          ))
            context.emittedLibraries.set(id, library);
        }
        if (plan.length && result?.output?.triggerData)
          assert(context.emittedLibraries.size, 'AUTHORED_GUI_OUTPUT_NOT_OBSERVED');
        if (plan.length && context.emittedLibraries.size) {
          const libraries = new Map([...context.dependencyLibraries, ...context.emittedLibraries]);
          context.frontierProof = verifyAuthoredGuiFrontier({
            input,
            sections: plan,
            libraries,
            carrier: (type, owner) => {
              try {
                return authoredStorageCarrier(
                  type,
                  libraries.get(owner),
                  libraries.get('Ntve'),
                  libraries,
                );
              } catch {
                return undefined;
              }
            },
          });
        }
        return result;
      });
    } finally {
      context.active = false;
    }
  });
}

function templateFor(fn, names) {
  return `${fn.name}(${names.map((n) => `#PARAM(${n})`).join(', ')})${fn.returnType === 'void' ? ';' : ''}`;
}
function checkedInterface(definition, fn, elements, library) {
  assert.equal(definition.library, library, 'AUTHORED_INTERFACE_LIBRARY');
  const formals = (definition.parameters ?? []).map((r) => {
    assert.equal(r.library ?? library, library, 'AUTHORED_FORMAL_LIBRARY');
    assert(r.type === undefined || r.type === 'ParamDef', 'AUTHORED_FORMAL_REFERENCE_TYPE');
    const found = [...new Set([elements[r.id], elements[`ParamDef:${r.id}`]].filter(Boolean))];
    assert.equal(found.length, 1, 'AUTHORED_FORMAL_MISSING_OR_AMBIGUOUS');
    const p = found[0];
    assert(p?.type === 'ParamDef' && p.library === library, 'AUTHORED_FORMAL_TYPED_IDENTITY');
    assert(/^[A-Za-z_]\w*$/u.test(p.name), 'AUTHORED_FORMAL_IDENTIFIER');
    return p;
  });
  assert.equal(formals.length, fn.parameters.length, 'AUTHORED_INTERFACE_ARITY');
  for (let i = 0; i < formals.length; i++) {
    assert.equal(
      formals[i].paramType?.type,
      fn.parameters[i].type,
      'AUTHORED_INTERFACE_FORMAL_TYPE',
    );
    assert(!formals[i].isReference, 'AUTHORED_INTERFACE_REFERENCE_FORMAL');
  }
  assert.equal(definition.returnType?.type, fn.returnType, 'AUTHORED_INTERFACE_RETURN_TYPE');
  assert.equal(
    new Set(formals.map((p) => p.name)).size,
    formals.length,
    'AUTHORED_INTERFACE_FORMAL_COLLISION',
  );
  return templateFor(
    fn,
    formals.map((p) => p.name),
  );
}

// The FunctionDef is the interface of an ORIGINAL source function. Inline
// substitution emits one call to it, never another runtime function or Native.
export function preserveAuthoredSectionFunction({ sourceFunction, funcDef, elements, libId }) {
  const context = scope.getStore();
  if (!context?.active) return false;
  const matches = context.plan.filter(
    (s) => s.library === libId && s.functions.some((f) => f.name === sourceFunction.name.name),
  );
  if (!matches.length) return false;
  assert.equal(matches.length, 1, 'AMBIGUOUS_AUTHORED_FUNCTION_OWNER');
  const section = matches[0],
    fn = section.functions.find((f) => f.name === sourceFunction.name.name);
  const code = checkedInterface(funcDef, fn, elements, libId);
  assert(!funcDef.flags?.includes('CreateThread'), 'AUTHORED_INTERFACE_THREADED');
  funcDef.flags = ['Operator', 'NoScriptPrefix'];
  delete funcDef.actions;
  delete funcDef.localVariables;
  funcDef.scriptCode = code;
  context.records.set(key(funcDef), {
    type: funcDef.type,
    id: funcDef.id,
    library: libId,
    code,
    kind: 'SOURCE_FUNCTION_CALL_INTERFACE',
    sourceFunction: fn.name,
  });
  return true;
}

export function materializeAuthoredSections({ elements, libId, idFromKey }) {
  const context = scope.getStore();
  if (!context?.active) return;
  for (const section of context.plan.filter((s) => s.library === libId)) {
    for (const fn of section.functions)
      assert(
        [...context.records.values()].some((r) => r.sourceFunction === fn.name),
        'AUTHORED_SECTION_PARTIALLY_LOWERED',
      );
    const id = idFromKey(`${libId}|authored-section|${section.fileName}|${section.sha256}`);
    assert(!elements[id], 'AUTHORED_SECTION_ID_COLLISION');
    // The XML reader's ScriptCode DTO uses LF. Match that transport BEFORE
    // the existing exact semantic reparse check; never relax that check.
    const code = xmlCode(section.code);
    const element = {
      type: 'CustomScript',
      id,
      library: libId,
      name: section.label,
      displayName: section.label,
      scriptCode: code,
    };
    elements[id] = element;
    context.records.set(key(element), {
      type: element.type,
      id,
      library: libId,
      code,
      kind: 'ORIGINAL_AUTHORED_SECTION',
      sourceSha256: section.sourceSha256,
      sectionSha256: section.sha256,
    });
  }
}

// Only actual completed GUI objects enter this scope. Final source/GUI
// closure is checked after all nested conversions return, before API success.
export function captureAuthoredGuiDeclarations({
  elements,
  libId,
  rootRefs,
  nativeLibrary,
  dependencies,
}) {
  const context = scope.getStore();
  if (!context?.active || !context.plan.length) return;
  for (const [id, library] of new Map(dependencies ?? []))
    if (id !== libId) context.dependencyLibraries.set(id, library);
  if (nativeLibrary) context.dependencyLibraries.set(nativeLibrary.id, nativeLibrary);
  context.emittedLibraries.set(libId, { id: libId, elements, rootRefs, elementsByType: {} });
}

export function finalizeAuthoredInitializerMetadata({
  elements,
  libId,
  rootRefs,
  repairOrder = false,
}) {
  const context = scope.getStore();
  if (!context?.active) return;
  orderGuiAuthoredSourceSections({
    elements,
    library: libId,
    rootRefs,
    sections: context.plan,
    records: [...context.records.values()],
    repairOrder,
  });
  if (context.plan.some((s) => s.library === libId && s.passiveDeclarationOnly)) {
    context.includeStoragePlan ??= planPreservedIncludeStorageOrder(context.input, context.plan);
    context.includeStorageProof = orderPreservedIncludeStorage({
      elements,
      library: libId,
      rootRefs,
      sections: context.plan,
      records: [...context.records.values()],
      plan: context.includeStoragePlan,
      isPreservedInclude: isPreservedSourceIncludeElement,
      repairOrder,
    });
  }
  for (const phase of context.initializers.filter((p) => p.library === libId)) {
    for (const call of phase.calls)
      assert(
        [...context.records.values()].some(
          (r) =>
            r.kind === 'ORIGINAL_AUTHORED_SECTION' &&
            r.library === libId &&
            r.sectionSha256 === call.sectionSha256,
        ),
        'AUTHORED_METADATA_ORIGINAL_SOURCE_NOT_MATERIALIZED',
      );
    const proof = verifyGuiAuthoredInitializerMetadata({
      elements,
      library: libId,
      rootRefs,
      schedule: phase,
    });
    for (const record of proof.records) context.records.set(key(record), record);
  }
}

export async function withPartitionAuthoredSectionFunctions(input, policy, callback) {
  const parent = scope.getStore();
  let child;
  const result = await withAuthoredSectionFunctions(input, policy, async () => {
    child = scope.getStore();
    return callback();
  });
  if (parent?.active && child?.plan.length) adoptVerifiedPartitionProvenance(parent, child);
  return result;
}

// Independently replay storage interface checks against the complete parent
// source and actual final GUI, after a partition proof has been adopted.
export async function replayPartitionAuthoredStorage(xml, triggerStrings) {
  const context = scope.getStore();
  if (!context?.active || !context.adoptedPartitionRecords) return;
  const libraries = new Map([
    ...context.dependencyLibraries,
    ...(await readLocalizedOwnedGuiLibraries(
      xml,
      triggerStrings,
      context.input.libraryId ?? 'Map',
    )),
  ]);
  for (const id of new Set(context.plan.map((s) => s.library))) {
    const library = libraries.get(id);
    assert(library, 'PARTITION_FINAL_GUI_LIBRARY_REQUIRED');
    registerAuthoredStorageInterfaces(library.elements, id, (type) => {
      try {
        return authoredStorageCarrier(type, library, libraries.get('Ntve'), libraries);
      } catch {
        return undefined;
      }
    });
  }
}

export function isAuthoredSectionElement(element) {
  if (isAuthoredStorageInterfaceElement(element)) return true;
  const context = scope.getStore(),
    record = context?.active && context.records.get(key(element));
  if (record?.kind === 'ORIGINAL_INITIALIZER_METADATA')
    return (
      element.type === 'CustomScript' &&
      element.library === record.library &&
      element.initFunc === record.initFunc &&
      !element.disabled &&
      (element.scriptCode ?? '') === '' &&
      element.expressionCode === undefined &&
      !element.flags?.length
    );
  if (
    !record ||
    typeof element.scriptCode !== 'string' ||
    xmlCode(element.scriptCode) !== xmlCode(record.code) ||
    element.expressionCode !== undefined ||
    element.flags?.includes('Native')
  )
    return false;
  if (record.type === 'FunctionDef') {
    if (element.flags?.includes('Condition')) {
      if (element.flags.filter((f) => f === 'Condition').length !== 1) return false;
      // Use the established exact boolean Call role guard. A GUI placement
      // condition is not another runtime body or permission for a Native.
      try {
        sourceInlineRoleFlags(element);
      } catch {
        return false;
      }
    }
    const flags = element.flags?.filter((f) => f !== 'Action' && f !== 'Call' && f !== 'Condition');
    return (
      flags?.length === 2 &&
      ['Operator', 'NoScriptPrefix'].every((f) => flags.includes(f)) &&
      element.actions === undefined &&
      !element.localVariables?.length
    );
  }
  return element.type === 'CustomScript' && !element.flags?.length && !element.initFunc;
}

// Rebuild provenance from a separately read output graph and the sealed source.
// A serialized converter receipt is never permission for a raw field.
export function withVerifiedAuthoredSectionOutput(input, policy, libraries, callback) {
  return withAuthoredSectionFunctions(input, policy, () => {
    const context = scope.getStore();
    for (const section of context.plan) {
      const library = libraries.get(section.library);
      assert(library, 'AUTHORED_OUTPUT_LIBRARY_MISSING');
      const values = Object.values(library.elements);
      for (const fn of section.functions) {
        const refused = [];
        const interfaces = values
          .filter((e) => e.type === 'FunctionDef' && typeof e.scriptCode === 'string')
          .filter((e) => {
            try {
              return e.scriptCode === checkedInterface(e, fn, library.elements, library.id);
            } catch (error) {
              refused.push({ id: e.id, error: String(error.message) });
              return false;
            }
          });
        assert.equal(
          interfaces.length,
          1,
          'AUTHORED_OUTPUT_INTERFACE_MISSING_OR_AMBIGUOUS: ' + JSON.stringify(refused),
        );
        const e = interfaces[0];
        context.records.set(key(e), {
          type: e.type,
          id: e.id,
          library: library.id,
          code: e.scriptCode,
          kind: 'SOURCE_FUNCTION_CALL_INTERFACE',
          sourceFunction: fn.name,
        });
        assert(isAuthoredSectionElement(e), 'AUTHORED_OUTPUT_INTERFACE_FLAGS');
      }
      const raw = values.filter(
        (e) =>
          e.type === 'CustomScript' &&
          typeof e.scriptCode === 'string' &&
          xmlCode(e.scriptCode) === xmlCode(section.code),
      );
      assert.equal(raw.length, 1, 'AUTHORED_OUTPUT_RAW_SECTION_MISSING_OR_CHANGED');
      const e = raw[0];
      context.records.set(key(e), {
        type: e.type,
        id: e.id,
        library: library.id,
        code: section.code,
        kind: 'ORIGINAL_AUTHORED_SECTION',
        sourceSha256: section.sourceSha256,
        sectionSha256: section.sha256,
      });
      assert(isAuthoredSectionElement(e), 'AUTHORED_OUTPUT_RAW_FLAGS_OR_INITIALIZER');
    }
    for (const library of libraries.values())
      finalizeAuthoredInitializerMetadata({
        elements: library.elements,
        libId: library.id,
        rootRefs: library.rootRefs,
      });
    for (const id of new Set(context.plan.map((s) => s.library))) {
      const library = libraries.get(id);
      registerAuthoredStorageInterfaces(library.elements, id, (type) => {
        try {
          return authoredStorageCarrier(type, library, libraries.get('Ntve'), libraries);
        } catch {
          return undefined;
        }
      });
    }
    context.frontierProof = verifyAuthoredGuiFrontier({
      input,
      sections: context.plan,
      libraries,
      carrier: (type, owner) => {
        try {
          return authoredStorageCarrier(
            type,
            libraries.get(owner),
            libraries.get('Ntve'),
            libraries,
          );
        } catch {
          return undefined;
        }
      },
    });
    return callback(authoredSectionProof());
  });
}

export function isAuthoredSectionXml(fragment, library) {
  if (isAuthoredStorageInterfaceXml(fragment, library)) return true;
  const context = scope.getStore();
  if (!context?.active) return false;
  let type,
    id,
    code = '',
    fields = 0,
    depth = 0,
    capture = false,
    initFunc = '',
    initFields = 0,
    captureInit = false,
    disabled = false,
    expression = false;
  const flags = [];
  const parser = sax.parser(true, { trim: false, normalize: false });
  parser.onopentag = (n) => {
    if (depth++ === 0) {
      type = n.attributes.Type;
      id = n.attributes.Id;
    }
    if (n.name === 'ScriptCode') {
      fields++;
      capture = true;
    }
    if (n.name === 'InitFunc') {
      initFields++;
      captureInit = true;
    }
    if (n.name === 'Disabled') disabled = true;
    if (n.name === 'ExpressionCode') expression = true;
    if (n.name.startsWith('Flag')) flags.push(n.name.slice(4));
  };
  parser.onclosetag = (n) => {
    if (n === 'ScriptCode') capture = false;
    if (n === 'InitFunc') captureInit = false;
    depth--;
  };
  parser.ontext = parser.oncdata = (s) => {
    if (capture) code += s;
    if (captureInit) initFunc += s;
  };
  parser.write(fragment).close();
  // Use the established reversible XML block transport, never Galaxy-token or
  // whitespace normalization of executable code. Action/Call are serialized
  // from the definition's role booleans, not its flags array.
  const roleFlags = flags.filter((f) => f === 'Action' || f === 'Call');
  if (roleFlags.length > 1) return false;
  if (type === 'FunctionDef' && flags.includes('Condition')) {
    if (initFields !== 0 || fields !== 1 || expression || disabled) return false;
    // Read the actual ReturnType/Call flags from this exact XML fragment;
    // never substitute the source signature for altered serialized metadata.
    try {
      const parsed = parseTriggerXmlSync(
        `<TriggerData><Library Id="${library}">${fragment}</Library></TriggerData>`,
      ).get(library);
      return (
        !!parsed &&
        Object.values(parsed.elements).some(
          (e) => e.type === type && e.id === id && isAuthoredSectionElement(e),
        )
      );
    } catch {
      return false;
    }
  }
  return (
    initFields <= 1 &&
    (fields === 1 || (type === 'CustomScript' && fields === 0 && initFields === 1)) &&
    isAuthoredSectionElement({
      type,
      id,
      library,
      scriptCode: fields ? scriptCodeFromBlock(code) : undefined,
      initFunc: initFields ? initFunc : undefined,
      disabled,
      expressionCode: expression ? 'PRESENT' : undefined,
      flags: flags.filter((f) => f !== 'Action' && f !== 'Call'),
    })
  );
}

export function authoredSectionProof() {
  const context = scope.getStore();
  assert(context?.active, 'AUTHORED_SECTION_SCOPE_REQUIRED');
  return {
    includeStorageOrder: context.includeStorageProof,
    finalGuiFrontier: context.frontierProof,
    storageInterfaces: authoredStorageInterfaceProof(),
    closure: context.plan.closure,
    sections: context.plan.map((s) => ({
      kind: s.kind,
      library: s.library,
      fileName: s.fileName,
      label: s.label,
      sourceSha256: s.sourceSha256,
      sectionSha256: s.sha256,
      functions: s.functions,
      privateDeclarations: s.privateDeclarations,
      closedMixedUnit: s.closedMixedUnit,
    })),
    records: [...context.records.values()].map(({ code, ...r }) => ({
      ...r,
      scriptCodeSha256: sha(code),
    })),
    newNative: 0,
    newRuntimeFunctions: 0,
    sourceBodyChanged: false,
    sourceCodeTransport: 'EXACT_EXCEPT_XML_LINE_END_TRANSPORT',
    semanticEquivalenceProved: false,
    actualEditor: false,
  };
}

// A live, exact source binding takes precedence over template snapshots.
// Recheck ABI and role; a name, stale record or copied receipt is insufficient.
export function isAuthoredSectionFunctionInterface(element, { elements, library, expression }) {
  const context = scope.getStore(),
    record = context?.active && context.records.get(key(element));
  if (
    record?.kind !== 'SOURCE_FUNCTION_CALL_INTERFACE' ||
    element.library !== library ||
    !isAuthoredSectionElement(element)
  )
    return false;
  const matches = context.plan
    .filter((s) => s.library === library)
    .flatMap((s) => s.functions.filter((f) => f.name === record.sourceFunction));
  if (matches.length !== 1) return false;
  try {
    const flags = sourceInlineRoleFlags(element);
    return (
      flags.has(expression ? 'Call' : 'Action') &&
      element.scriptCode === checkedInterface(element, matches[0], elements, library)
    );
  } catch {
    return false;
  }
}
