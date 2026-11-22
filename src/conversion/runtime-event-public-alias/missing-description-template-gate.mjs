import { isBoundSourceInitializerMacro } from '../retained-startup-interfaces/source-initializer-gui-weave.final-roles.mjs';
import {
  registerAuthoredStorageInterfaces,
  authoredStorageInterfaceProof,
} from '../qualified-macro-binding/authored-storage-interfaces.diagnostics.mjs';
import {
  inspectProvisionalGuiDeclarations,
  finishProvisionalGuiDeclarationGate,
} from '../../verification/provisional-gui-declarations.array-abi.mjs';
import { authorizedMissingNativeGuiDescription } from './missing-native-gui-description.guarded.mjs';
import { pruneUnusedGeneratedStructuredTemplates } from '../../model/structured-template-liveness.orphan-calls.mjs';
import { mapParameterTypeToGalaxy as preservedInterfaceCarrier } from '../native-expression-identity/core-alternate.mjs';
import {
  reifyPreservedSourceDependencyCalls,
  registerPreservedSourceCallInterfaces,
  isPreservedSourceCallInterfaceElement,
  preservedSourceCallInterfaceProof,
} from '../qualified-macro-binding/preserved-source-aggregate-interfaces.dependency-functions.mjs';
import {
  reifyExplicitNullArrayInitializers,
  validateExplicitNullArrayInitializers,
} from '../../gui/explicit-null-array-initializer.canonical.mjs';
import {
  isAuthoredSectionElement,
  finalizeAuthoredInitializerMetadata,
  captureAuthoredGuiDeclarations,
} from '../partition-declaration-identity/authored-section-functions.mixed-atomic.mjs';
import { isPreservedSourceIncludeElement } from '../exact-function-signatures/preserved-source-includes.exact-inputs.mjs';
import { createDocumentEnvironment } from '../../model/document-environment.mjs';
import { indexOwnedFunctionCalls } from '../../analysis/owned-function-call-index.mjs';
import {
  reifyStringLiteralParameters,
  validateStringLiteralBindings,
} from '../exact-function-signatures/string-literal-presets.frontend-scope.mjs';
import { reifyExternalIntConstants } from '../exact-function-signatures/external-int-constants.bound-writes.mjs';
import { bindingIssueContext } from '../../libraries/gui/binding-issue-context.mjs';
import { typedRemainderRefusals } from '../qualified-gui-game-link-calls/numeric-remainder-builder.scalar-calls.mjs';
import {
  validateComposedGuiExpressionMarkers as validateGuiExpressionMarkers,
  guiExpressionElementKey,
} from '../qualified-gui-game-link-calls/composed-expression-contract.scalar-calls.mjs';
import { nonemptyLocalizedTextKeys } from '../../libraries/gui/cross-locale-text-key-evidence.mjs';
import { localizedTokenCodeBindings } from '../attribute-scalar-codec/localized-token-code.mjs';

// Bind converter-created statement templates to actual loaded GUI definitions.

// Macro formal names may differ; their order and syntax must match exactly.

// This runs before pruning/serialization. No Native or new script template is

// produced by this linker, and all remaining raw/unbound nodes are rejected.

import { Parser } from '../exact-function-signatures/index-alternate-3.js';

import {
  syntaxShape,
  templateMacros,
} from '../native-expression-identity/balanced-script-template-alternate.mjs';

import { isDeepStrictEqual } from 'node:util';

import { generateId } from '../native-expression-identity/g2t-core.generated-call-provenance.mjs';

function formal(ref, library, libraries, environment) {
  return (environment ?? createDocumentEnvironment(libraries)).resolve(ref, library.id, 'ParamDef');
}

function canonical(def, library, libraries, environment = createDocumentEnvironment(libraries)) {
  if (
    !def.scriptCode ||
    def.flags?.includes('Native') ||
    !(def.isFuncAction || def.flags?.includes('Action')) ||
    def.isFuncCall ||
    def.flags?.includes('Call') ||
    def.isSubFunction ||
    def.subFunctionTypes?.length
  )
    return;

  const parameters = def.parameters ?? [],
    names = parameters.map((r) => {
      const p = formal(r, library, libraries, environment);
      return p?.identifier ?? p?.name;
    });

  if (names.some((n) => !n) || new Set(names).size !== names.length) return;

  const macros = templateMacros(def.scriptCode);
  if (macros.some((m) => m.name !== 'PARAM' || m.args.length !== 1 || !names.includes(m.args[0])))
    return;

  if (/\bmodkitTemplateFormal\d+\b/u.test(def.scriptCode)) return;

  let source = def.scriptCode;

  for (const m of macros.sort((a, b) => b.start - a.start))
    source =
      source.slice(0, m.start) +
      'modkitTemplateFormal' +
      names.indexOf(m.args[0]) +
      source.slice(m.end);

  const parsed = new Parser().parseFile(
    'gui-template.galaxy',
    'void gf_template(){' + source + '}',
  );
  if (parsed.parseDiagnostics.length) return;

  return {
    shape: syntaxShape(parsed.statements[0].body),
    parameterTypes: parameters.map(
      (r) => formal(r, library, libraries, environment)?.paramType?.type,
    ),
    returnType: def.returnType?.type ?? 'void',
  };
}

export { canonical as templateSignature };

export function bindLocalizedTextParameters(
  elements,
  libId,
  nativeLibrary,
  dependencies,
  localizedTables = [],
  implicit = false,
) {
  const externalKeys = [];
  for (const p of Object.values(elements)) {
    if (
      p.type !== 'Param' ||
      p.valueType?.type !== 'text' ||
      !p.scriptCode ||
      p.functionCall ||
      p.variable ||
      p.preset ||
      p.valueElement ||
      p.expressionCode
    )
      continue;
    const m = /^StringExternal\(\s*("(?:[^"\\]|\\.)*")\s*\)$/u.exec(p.scriptCode.trim());
    if (!m) continue;
    try {
      externalKeys.push({ p, key: JSON.parse(m[1]) });
    } catch {
      // A malformed key still belongs to the ordinary unresolved-code audit.
    }
  }
  if (!externalKeys.length) return;
  const libraries = new Map(dependencies ?? []);
  if (nativeLibrary) libraries.set(nativeLibrary.id, nativeLibrary);

  const candidates = [],
    environment = createDocumentEnvironment(libraries);

  for (const l of libraries.values())
    for (const f of Object.values(l.elements ?? {}))
      if (
        f.type === 'FunctionDef' &&
        (f.identifier ?? f.name) === 'StringExternal' &&
        f.flags?.includes('Native') &&
        f.flags.includes('Call') &&
        !f.scriptCode &&
        !f.disabled &&
        f.returnType?.type === 'text' &&
        f.parameters?.length === 1
      ) {
        const p = formal(f.parameters[0], l, libraries, environment);
        if (p?.paramType?.type === 'string' && !p.isMultiple && !p.isReference)
          candidates.push({ f, l });
      }

  const knownKeys = nonemptyLocalizedTextKeys(localizedTables);
  const tables = localizedTables
    .filter((t) => /^[a-z]{2}[A-Z]{2}$/u.test(t.locale ?? ''))
    .map((t) => {
      const values = new Map(),
        conflicts = new Set();
      for (const line of (t.gameStrings ?? '').split(/\r?\n/u)) {
        const text = line.replace(/^\uFEFF/u, ''),
          at = text.indexOf('=');
        if (at < 0) continue;
        const key = text.slice(0, at),
          value = text.slice(at + 1);
        if (values.has(key) && values.get(key) !== value) conflicts.add(key);
        values.set(key, value);
      }
      return { values, conflicts };
    });

  for (const { p, key } of externalKeys) {
    const own = implicit ? `Param/Value/${p.id}` : `Param/Value/lib_${libId}_${p.id}`;

    if (key === own && knownKeys.has(key)) {
      // Reserve the two identities the former native-call path consumed. They
      // create no elements; unrelated recovered categories and references retain
      // their deterministic IDs when this parameter becomes a genuine GUI value.
      if (
        candidates.length === 1 &&
        !(
          tables.length &&
          tables.every(
            (t) => !t.conflicts.has(key) && t.values.has(key) && t.values.get(key) !== '',
          )
        )
      ) {
        generateId();
        generateId();
      }
      delete p.scriptCode;
      continue;
    }

    // Exact external/missing/empty key semantics: use the actual shipped GUI

    // function. No new Native definition, new resource key or empty text fallback.

    if (candidates.length !== 1) continue;

    const { f, l } = candidates[0],
      argument = generateId(),
      call = generateId();

    elements[argument] = {
      type: 'Param',
      library: libId,
      id: argument,
      parameterDef: f.parameters[0],
      valueType: { type: 'string' },
      value: key,
    };

    elements[call] = {
      type: 'FunctionCall',
      library: libId,
      id: call,
      functionDef: { type: 'FunctionDef', library: l.id, id: f.id },
      parameters: [{ type: 'Param', library: libId, id: argument }],
    };

    p.functionCall = { type: 'FunctionCall', library: libId, id: call };
    delete p.scriptCode;
  }
}

export function bindLoadedStatementTemplates(elements, libId, nativeLibrary, dependencies) {
  const values = Object.values(elements),
    ownedTemplates = values.filter(
      (d) =>
        d.type === 'FunctionDef' &&
        d.flags?.includes('Operator') &&
        !d.actions?.length &&
        !d.localVariables?.length &&
        !d.unresolvedGuiBinding &&
        d.scriptCode,
    );

  if (!ownedTemplates.length) return [];

  const params = new Map(values.filter((e) => e.type === 'Param').map((e) => [e.id, e])),
    calls = new Map();

  for (const e of values)
    if (e.type === 'FunctionCall' && (e.functionDef?.library ?? libId) === libId) {
      const key = e.functionDef?.id,
        list = calls.get(key) ?? [];
      list.push(e);
      calls.set(key, list);
    }

  const libraries = new Map(dependencies ?? []);
  if (nativeLibrary) libraries.set(nativeLibrary.id, nativeLibrary);

  const owned = { id: libId, elements, elementsByType: {} };
  libraries.set(libId, owned);

  const external = [],
    environment = createDocumentEnvironment(libraries);

  for (const l of libraries.values())
    if (l.id !== libId)
      for (const d of Object.values(l.elements ?? {}))
        if (d.type === 'FunctionDef') {
          const normalized = canonical(d, l, libraries, environment);
          if (normalized) external.push({ definition: d, library: l, normalized });
        }

  const proof = [];

  for (const d of ownedTemplates) {
    if (
      d.type !== 'FunctionDef' ||
      !d.flags?.includes('Operator') ||
      d.actions?.length ||
      d.localVariables?.length ||
      d.unresolvedGuiBinding
    )
      continue;

    const own = canonical(d, owned, libraries, environment);
    if (!own) continue;

    const matches = external.filter(
      (e) =>
        e.normalized.returnType === own.returnType &&
        isDeepStrictEqual(e.normalized.shape, own.shape) &&
        e.normalized.parameterTypes.length === own.parameterTypes.length &&
        e.normalized.parameterTypes.every(
          (type, i) => type === own.parameterTypes[i] || type === 'return',
        ),
    );

    if (matches.length !== 1) continue;

    const target = matches[0].definition,
      rewritten = [];

    for (const call of calls.get(d.id) ?? []) {
      if ((call.parameters ?? []).length !== (target.parameters ?? []).length)
        throw Error('Loaded GUI template arity mismatch');

      for (let i = 0; i < (call.parameters ?? []).length; i++) {
        const r = call.parameters[i],
          p = params.get(r.id);

        if (!p || (r.library ?? libId) !== libId)
          throw Error('Shared/external actual parameter requires explicit ownership proof');

        p.parameterDef = target.parameters[i];
      }

      call.functionDef = {
        type: 'FunctionDef',
        id: target.id,
        library: target.library ?? matches[0].library.id,
      };
      rewritten.push(call.id);
    }

    if (rewritten.length) {
      // All references to this converter-created operator have been redirected.

      // FunctionDef roots are retained by the ordinary ownership pruner, so it

      // cannot remove this now-unused template on its own.

      for (const [key, value] of Object.entries(elements)) if (value === d) delete elements[key];

      proof.push({
        oldDefinition: d.id,
        loadedLibrary: matches[0].library.id,
        loadedDefinition: target.id,
        formalNamesAlphaEquivalent: true,
        rewrittenCalls: rewritten,
        unusedSyntheticDefinitionRemoved: true,
      });
    }
  }

  return proof;
}

// Diagnostics retain the offending syntax and actual call sites. The strict

// acceptance condition is unchanged: evidence is for repair, never a fallback.

export function assertGuiBindingsComplete(
  elements,
  libId,
  fail,
  nativeLibrary,
  dependencies,
  rootRefs,
  reificationDiagnostics,
  allocateId,
) {
  finalizeAuthoredInitializerMetadata({ elements, libId, rootRefs, repairOrder: true });
  const templateLiveness = pruneUnusedGeneratedStructuredTemplates(elements, libId, rootRefs);
  if (reificationDiagnostics) reificationDiagnostics.structuredTemplateLiveness = templateLiveness;
  const external = new Map(dependencies ?? []);
  if (nativeLibrary) external.set(nativeLibrary.id, nativeLibrary);
  reifyPreservedSourceDependencyCalls(
    elements,
    libId,
    nativeLibrary,
    dependencies,
    rootRefs,
    allocateId,
  );
  const nullRecords = reifyExplicitNullArrayInitializers(elements, libId, rootRefs, allocateId);
  validateExplicitNullArrayInitializers(elements, libId, nullRecords);
  if (reificationDiagnostics) reificationDiagnostics.explicitNullArrayInitializers = nullRecords;
  const stringRecords = reifyStringLiteralParameters(elements, libId, rootRefs, allocateId);
  const stringAudit = validateStringLiteralBindings(
    new Map([[libId, { elements }]]),
    stringRecords,
  );
  if (!stringAudit.valid)
    fail('INVALID_PRIMITIVE_STRING_GUI', 'Primitive string GUI binding changed bytes', stringAudit);
  reifyExternalIntConstants(elements, libId, rootRefs);
  const numericGui = validateGuiExpressionMarkers(
    new Map([[libId, { id: libId, elements, rootRefs }]]),
    external,
  );

  const preservedOwner = { id: libId, elements, elementsByType: {} };
  const preservedLibraries = new Map(external);
  preservedLibraries.set(libId, preservedOwner);
  registerPreservedSourceCallInterfaces(elements, libId, (type) => {
    try {
      return preservedInterfaceCarrier(type, preservedOwner, nativeLibrary, preservedLibraries);
    } catch {
      return undefined;
    }
  });
  registerAuthoredStorageInterfaces(elements, libId, (type) => {
    try {
      return preservedInterfaceCarrier(type, preservedOwner, nativeLibrary, preservedLibraries);
    } catch {
      return undefined;
    }
  });
  if (reificationDiagnostics)
    reificationDiagnostics.authoredStorageInterfaces = authoredStorageInterfaceProof();
  if (reificationDiagnostics)
    reificationDiagnostics.preservedSourceMembers = preservedSourceCallInterfaceProof();
  const unresolved = [],
    raw = [],
    values = Object.values(elements),
    ownedCalls = indexOwnedFunctionCalls(values, libId);

  const tokenCodes = localizedTokenCodeBindings(elements, libId);

  const summary = (e) => ({
    id: e.id,
    type: e.type,
    name: e.identifier ?? e.name,
    flags: e.flags,

    valueType: e.valueType,
    parameterDef: e.parameterDef,
    value: e.value,

    parameters: e.parameters,
    paramType: e.paramType,
    isReference: e.isReference,
    library: e.library,
    parameterDefinitions: (e.parameters ?? []).map((r) => {
      const p = elements[r.id] ?? elements['ParamDef:' + r.id];
      return (
        p && {
          type: p.type,
          id: p.id,
          library: p.library,
          name: p.name,
          paramType: p.paramType,
          isReference: p.isReference,
        }
      );
    }),
    returnType: e.returnType,
    scriptSample: e.scriptCode?.slice(0, 1200),
  });

  for (const e of values) {
    const sourceInclude =
      isPreservedSourceIncludeElement(e) ||
      isAuthoredSectionElement(e) ||
      isPreservedSourceCallInterfaceElement(e);

    if (
      e.type === 'FunctionDef' &&
      (e.unresolvedGuiBinding || e.flags?.includes('Native')) &&
      !authorizedMissingNativeGuiDescription(elements, e)
    ) {
      const calls = ownedCalls.get(e.id) ?? [];

      unresolved.push({
        ...summary(e),
        kind: 'MISSING_LOADED_GUI_BINDING',
        calls: calls.slice(0, 8).map((c) => ({
          ...summary(c),
          arguments: (c.parameters ?? []).map((r) => summary(elements[r.id] ?? {})),
        })),
        callCount: calls.length,
      });
    }

    for (const field of ['scriptCode', 'expressionCode'])
      if (
        !sourceInclude &&
        typeof e[field] === 'string' &&
        e[field].trim() &&
        !(field === 'scriptCode' && isBoundSourceInitializerMacro(e, elements, libId)) &&
        !(
          field === 'expressionCode' &&
          (tokenCodes.has(e.id) || numericGui.validMarkers.has(guiExpressionElementKey(e, libId)))
        )
      )
        raw.push({
          ...summary(e),
          field,
          codeSample: e[field].slice(0, 1200),
          ...(e.type === 'FunctionDef'
            ? {
                calls: (ownedCalls.get(e.id) ?? []).slice(0, 12).map((c) => ({
                  ...summary(c),
                  arguments: (c.parameters ?? []).map((r) => {
                    const p = elements[r.id];
                    return {
                      ...summary(p ?? {}),
                      variable: p?.variable && summary(elements[p.variable.id] ?? {}),
                      paramRef: p?.paramRef && summary(elements[p.paramRef.id] ?? {}),
                      functionCall: p?.functionCall && summary(elements[p.functionCall.id] ?? {}),
                    };
                  }),
                })),
              }
            : {}),
        });

    if (e.type === 'CustomScript' && !sourceInclude && !raw.some((r) => r.id === e.id))
      raw.push(summary(e));
  }

  captureAuthoredGuiDeclarations({ elements, libId, rootRefs, nativeLibrary, dependencies });
  inspectProvisionalGuiDeclarations(
    elements,
    libId,
    { unresolved: unresolved.length, raw: raw.length, expressionIssues: numericGui.issues.length },
    rootRefs,
  );
  if (unresolved.length || raw.length || numericGui.issues.length)
    fail(
      'GUI_BINDING_INCOMPLETE',
      'No generated Native or raw fallback may enter the recovered GUI; resolve actual library/template/scope bindings first',
      {
        libraryId: libId,
        unresolved,
        raw,
        guiExpressionIssues: numericGui.issues,
        bindingIssueContext: bindingIssueContext(elements, libId, numericGui.issues, external),
        validatedGuiExpressions: numericGui.expressions,
        typedRemainderRefusals: typedRemainderRefusals(elements),
        typedTemplateReification: reificationDiagnostics,
      },
    );
  finishProvisionalGuiDeclarationGate();
}

export function pruneUnboundDeclarations(elements, libId) {
  // Encoded constructors may have a declaration but no surviving GUI call.

  // Their symbol record is useful to the parser, not a standalone GUI function.

  const candidates = Object.entries(elements).filter(
    ([, e]) => e.type === 'FunctionDef' && e.unresolvedGuiBinding,
  );
  if (!candidates.length) return false;
  let changed = false;
  const referenced = new Set();

  function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;

    if (v.type === 'FunctionDef' && v.id && (v.library ?? libId) === libId) {
      referenced.add(v.id);
      return;
    }

    Object.values(v).forEach(walk);
  }

  for (const e of Object.values(elements)) Object.values(e).forEach(walk);

  for (const [id, e] of candidates)
    if (!referenced.has(e.id)) {
      changed = true;
      delete elements[id];

      // Parameter definitions may be shared. Leave them to the ownership pruner.
    }
  return changed;
}
