import { isPreservedSourceCallInterfaceXml } from '../qualified-macro-binding/preserved-source-aggregate-interfaces.dependency-functions.mjs';
import { isAuthoredSectionXml } from './authored-section-functions.mixed-atomic.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isPreservedSourceIncludeXml } from '../exact-function-signatures/preserved-source-includes.exact-inputs.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const identity = (library, type, id) => JSON.stringify([library, type, id]);
const descendants = function* (node) {
  yield node;
  for (const child of node.children ?? []) yield* descendants(child);
};

// Read the lossless XML, including typed identities and incoming ownership edges.
// Finding the same raw text elsewhere is deliberately insufficient provenance.
export function observeAuthoredCode(xml, xmlTree, implicitLibrary = 'Map') {
  assert.equal(typeof xml, 'string', 'TRIGGER_XML_REQUIRED');
  const elements = new Map(),
    edges = new Map();
  if (!xml.trim())
    return {
      elements,
      edges,
      counts: { customScriptElements: 0, scriptCodeFields: 0, nativeElements: 0 },
    };
  const tree = xmlTree(xml);
  const addEdges = (node, library, owner) => {
    for (const child of node.children ?? []) {
      if (child.tag === 'Element' || child.tag === 'Library') continue;
      const a = child.attributes ?? {};
      if (a.Type && a.Id) {
        const target = identity(a.Library ?? library, a.Type, a.Id);
        const edge = JSON.stringify([owner, child.tag, target]);
        if (!edges.has(target)) edges.set(target, new Map());
        const incoming = edges.get(target);
        incoming.set(edge, (incoming.get(edge) ?? 0) + 1);
      }
      addEdges(child, library, owner);
    }
  };
  function visit(node, library) {
    if (node.tag === 'Library') library = node.attributes.Id;
    if (node.tag === 'Element') {
      const a = node.attributes,
        key = identity(library, a.Type, a.Id);
      assert(!elements.has(key), 'DUPLICATE_TYPED_TRIGGER_IDENTITY: ' + key);
      const fields = [...descendants(node)];
      const scriptCodeFields = fields.filter((n) => n.tag === 'ScriptCode').length;
      const native = fields.some((n) => n.tag === 'FlagNative');
      const custom = a.Type === 'CustomScript';
      elements.set(key, {
        key,
        library,
        type: a.Type,
        id: a.Id,
        scriptCodeFields,
        native,
        custom,
        protected: custom || native || scriptCodeFields > 0,
        sha256: sha(xml.slice(node.start, node.end)),
        sourceSection: isAuthoredSectionXml(xml.slice(node.start, node.end), library),
        sourceCallInterface: isPreservedSourceCallInterfaceXml(
          xml.slice(node.start, node.end),
          library,
        ),
        sourceInclude:
          custom &&
          scriptCodeFields === 1 &&
          !native &&
          isPreservedSourceIncludeXml(xml.slice(node.start, node.end)),
      });
      addEdges(node, library, key);
      return;
    }
    if (node.tag === 'Root') addEdges(node, library, identity(library, 'Root', ''));
    for (const child of node.children ?? []) visit(child, library);
  }
  visit(tree, implicitLibrary);
  const values = [...elements.values()];
  return {
    elements,
    edges,
    counts: {
      customScriptElements: values.filter((e) => e.custom).length,
      scriptCodeFields: values.reduce((n, e) => n + e.scriptCodeFields, 0),
      nativeElements: values.filter((e) => e.native).length,
    },
  };
}

export function verifyAuthoredCodePolicy({
  before = '',
  after,
  policy,
  xmlTree,
  libraryId = 'Map',
  nativeDescriptions,
  sourceInitializerWeave,
}) {
  const original = observeAuthoredCode(before, xmlTree, libraryId);
  const output = observeAuthoredCode(after, xmlTree, libraryId);
  const protectedOriginal = [...original.elements.values()].filter((e) => e.protected);
  const protectedOutput = [...output.elements.values()].filter((e) => e.protected);
  const sourceIncludes = [],
    sourceSections = [],
    sourceCallInterfaces = [];
  const approved = new Set();
  if (nativeDescriptions?.records?.length) {
    assert(
      nativeDescriptions.passed &&
        nativeDescriptions.reconstructedFromSource === true &&
        nativeDescriptions.converterReceiptsUsed === false,
      'NATIVE_DESCRIPTION_SOURCE_PROOF_REQUIRED',
    );
    assert.equal(
      nativeDescriptions.outputXmlSha256,
      sha(after),
      'NATIVE_DESCRIPTION_OUTPUT_SHA_MISMATCH',
    );
    assert.equal(nativeDescriptions.newRuntimeFunctions, 0);
    assert.equal(nativeDescriptions.newCustomScript, 0);
    for (const r of nativeDescriptions.records)
      approved.add(identity(r.definition.library, r.definition.type, r.definition.id));
  }
  const sourceMacros = new Set();
  if (sourceInitializerWeave?.records?.length) {
    assert(
      sourceInitializerWeave.passed &&
        sourceInitializerWeave.reconstructedFromSource === true &&
        sourceInitializerWeave.converterReceiptsUsed === false,
      'SOURCE_INITIALIZER_INDEPENDENT_GUI_PROOF_REQUIRED',
    );
    assert.equal(
      sourceInitializerWeave.outputXmlSha256,
      sha(after),
      'SOURCE_INITIALIZER_OUTPUT_SHA_MISMATCH',
    );
    assert.equal(sourceInitializerWeave.newRuntimeFunctions, 0);
    assert.equal(sourceInitializerWeave.newCustomScript, 0);
    for (const row of sourceInitializerWeave.records) {
      assert.equal(row.definition.type, 'FunctionDef');
      const key = identity(row.definition.library, row.definition.type, row.definition.id);
      assert(!sourceMacros.has(key), 'SOURCE_INITIALIZER_DUPLICATE_PROOF');
      sourceMacros.add(key);
    }
  }
  const authorizedNative = (e) =>
    approved.has(e.key) && e.native && !e.custom && e.scriptCodeFields === 0;
  const authorizedMacro = (e) =>
    sourceMacros.has(e.key) &&
    e.type === 'FunctionDef' &&
    !e.native &&
    !e.custom &&
    e.scriptCodeFields === 1;
  assert.equal(
    protectedOutput.filter(authorizedMacro).length,
    sourceMacros.size,
    'SOURCE_INITIALIZER_MACRO_COVERAGE_MISMATCH',
  );
  const authorized = (e) => authorizedNative(e) || authorizedMacro(e);
  assert.equal(
    protectedOutput.filter(authorizedNative).length,
    approved.size,
    'NATIVE_DESCRIPTION_COVERAGE_MISMATCH',
  );
  if (!policy.preserveAuthoredCode) {
    assert.equal(
      protectedOutput.filter((e) => !authorized(e)).length,
      0,
      'FULL_GUI_CONTAINS_NATIVE_OR_CUSTOM_CODE',
    );
  } else {
    for (const element of protectedOutput) {
      if (authorized(element)) continue;
      const prior = original.elements.get(element.key);
      if (!prior && element.sourceCallInterface) {
        sourceCallInterfaces.push(element);
        continue;
      }
      if (!prior && element.sourceSection) {
        sourceSections.push(element);
        continue;
      }
      if (!prior && element.sourceInclude) {
        sourceIncludes.push(element);
        continue;
      }
      assert(prior?.protected, 'NEW_NATIVE_OR_CUSTOM_CODE: ' + element.key);
      assert.equal(element.sha256, prior.sha256, 'AUTHORED_CODE_CHANGED: ' + element.key);
    }
    for (const element of protectedOriginal) {
      assert.equal(
        output.elements.get(element.key)?.sha256,
        element.sha256,
        'AUTHORED_CODE_REMOVED_OR_CHANGED: ' + element.key,
      );
      for (const [edge, count] of original.edges.get(element.key) ?? [])
        assert(
          (output.edges.get(element.key)?.get(edge) ?? 0) >= count,
          'AUTHORED_CODE_REFERENCE_REMOVED: ' + element.key,
        );
    }
  }
  return {
    kind: 'SOURCE_BOUND_GUI_CODE_PROVENANCE',
    mode: policy.mode,
    input: original.counts,
    output: output.counts,
    preservedElements: policy.preserveAuthoredCode
      ? protectedOriginal.map(({ library, type, id, sha256 }) => ({ library, type, id, sha256 }))
      : [],
    newDeclarativeMacros: sourceMacros.size,
    sourceInitializerWeave,
    newNative: approved.size,
    authorizedNativeDescriptions: nativeDescriptions,
    newCustomScript: sourceIncludes.length + sourceSections.filter((e) => e.custom).length,
    newScriptCode:
      sourceIncludes.length +
      sourceSections.length +
      sourceCallInterfaces.length +
      sourceMacros.size,
    newFallbackCustomScript: 0,
    newRuntimeCode: 0,
    sourceCallInterfaceElements: sourceCallInterfaces.map(({ library, type, id, sha256 }) => ({
      library,
      type,
      id,
      sha256,
    })),
    sourceSectionElements: sourceSections.map(({ library, type, id, sha256 }) => ({
      library,
      type,
      id,
      sha256,
    })),
    sourceIncludeElements: sourceIncludes.map(({ library, type, id, sha256 }) => ({
      library,
      type,
      id,
      sha256,
    })),
    sourceCodeByteExact: policy.preserveAuthoredCode,
    benchmarkVerdictChanged: false,
    semanticEquivalenceProved: false,
    actualEditor: false,
  };
}
