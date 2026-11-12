import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isPreservedSourceIncludeXml} from '../bindings/preserved-source-includes.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const identity = (library, type, id) => JSON.stringify([library, type, id]);
const descendants = function* (node) { yield node; for (const child of node.children ?? []) yield* descendants(child); };

// Read the lossless XML, including typed identities and incoming ownership edges.
// Finding the same raw text elsewhere is deliberately insufficient provenance.
export function observeAuthoredCode(xml, xmlTree, implicitLibrary = 'Map') {
  assert.equal(typeof xml, 'string', 'TRIGGER_XML_REQUIRED');
  const elements = new Map(), edges = new Map();
  if (!xml.trim()) return {elements, edges, counts: {customScriptElements: 0, scriptCodeFields: 0, nativeElements: 0}};
  const tree = xmlTree(xml);
  const addEdges = (node, library, owner) => {
    for (const child of node.children ?? []) {
      if (child.tag === 'Element' || child.tag === 'Library') continue;
      const a = child.attributes ?? {};
      if (a.Type && a.Id) {
        const target = identity(a.Library ?? library, a.Type, a.Id);
        const edge = JSON.stringify([owner, child.tag, target]);
        if (!edges.has(target)) edges.set(target, new Map());
        const incoming = edges.get(target); incoming.set(edge, (incoming.get(edge) ?? 0) + 1);
      }
      addEdges(child, library, owner);
    }
  };
  function visit(node, library) {
    if (node.tag === 'Library') library = node.attributes.Id;
    if (node.tag === 'Element') {
      const a = node.attributes, key = identity(library, a.Type, a.Id);
      assert(!elements.has(key), 'DUPLICATE_TYPED_TRIGGER_IDENTITY: ' + key);
      const fields = [...descendants(node)];
      const scriptCodeFields = fields.filter(n => n.tag === 'ScriptCode').length;
      const native = fields.some(n => n.tag === 'FlagNative');
      const custom = a.Type === 'CustomScript';
      elements.set(key, {key, library, type: a.Type, id: a.Id, scriptCodeFields, native, custom,
        protected: custom || native || scriptCodeFields > 0,
        sha256: sha(xml.slice(node.start, node.end)),
        sourceInclude: custom && scriptCodeFields === 1 && !native && isPreservedSourceIncludeXml(xml.slice(node.start, node.end))});
      addEdges(node, library, key);
      return;
    }
    if (node.tag === 'Root') addEdges(node, library, identity(library, 'Root', ''));
    for (const child of node.children ?? []) visit(child, library);
  }
  visit(tree, implicitLibrary);
  const values = [...elements.values()];
  return {elements, edges, counts: {
    customScriptElements: values.filter(e => e.custom).length,
    scriptCodeFields: values.reduce((n, e) => n + e.scriptCodeFields, 0),
    nativeElements: values.filter(e => e.native).length,
  }};
}

export function verifyAuthoredCodePolicy({before = '', after, policy, xmlTree, libraryId = 'Map'}) {
  const original = observeAuthoredCode(before, xmlTree, libraryId);
  const output = observeAuthoredCode(after, xmlTree, libraryId);
  const protectedOriginal = [...original.elements.values()].filter(e => e.protected);
  const protectedOutput = [...output.elements.values()].filter(e => e.protected);
  const sourceIncludes = [];
  if (!policy.preserveAuthoredCode) {
    assert.equal(protectedOutput.length, 0, 'FULL_GUI_CONTAINS_NATIVE_OR_CUSTOM_CODE');
  } else {
    for (const element of protectedOutput) {
      const prior = original.elements.get(element.key);
      if (!prior && element.sourceInclude) { sourceIncludes.push(element); continue; }
      assert(prior?.protected, 'NEW_NATIVE_OR_CUSTOM_CODE: ' + element.key);
      assert.equal(element.sha256, prior.sha256, 'AUTHORED_CODE_CHANGED: ' + element.key);
    }
    for (const element of protectedOriginal) {
      assert.equal(output.elements.get(element.key)?.sha256, element.sha256,
        'AUTHORED_CODE_REMOVED_OR_CHANGED: ' + element.key);
      for (const [edge, count] of original.edges.get(element.key) ?? [])
        assert((output.edges.get(element.key)?.get(edge) ?? 0) >= count,
          'AUTHORED_CODE_REFERENCE_REMOVED: ' + element.key);
    }
  }
  return {kind: 'SOURCE_BOUND_GUI_CODE_PROVENANCE', mode: policy.mode,
    input: original.counts, output: output.counts,
    preservedElements: policy.preserveAuthoredCode ? protectedOriginal.map(({library, type, id, sha256}) => ({library, type, id, sha256})) : [],
    newNative: 0, newCustomScript: sourceIncludes.length, newScriptCode: sourceIncludes.length,
    newFallbackCustomScript: 0, newRuntimeCode: 0,
    sourceIncludeElements: sourceIncludes.map(({library, type, id, sha256}) => ({library, type, id, sha256})),
    sourceCodeByteExact: policy.preserveAuthoredCode,
    benchmarkVerdictChanged: false, semanticEquivalenceProved: false, actualEditor: false};
}
