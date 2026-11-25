import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { forEachChild, SyntaxKind as K } from './exact-function-signatures/index-alternate-3.js';
import { readStringLiteralValue } from './exact-function-signatures/string-literal-value.mjs';
import { applyReversibleSourceEdits } from './linear-reversible-edits/reversible-source-edits.mjs';
import { restoreQualifiedAttributeGui } from '../utilities/qualified-attribute-gui.mjs';

const capabilities = new WeakMap();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const api = { Global: 'GameAttributeGameValue', Player: 'GameAttributePlayerValue' };
const attributeCalls = new Set(Object.values(api));

function census(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/** Rebind native attribute call operands, preserving every other source byte. */
export function rebindAttributeGalaxy(source, bindings, parse, fileName = 'MapScript.galaxy') {
  const ast = parse(source, fileName);
  assert.equal(ast.parseDiagnostics.length, 0, 'INVALID_ATTRIBUTE_BINDING_INPUT');
  const edits = [];
  function visit(node) {
    if (
      node.kind === K.CallExpression &&
      node.expression?.kind === K.Identifier &&
      attributeCalls.has(node.expression.name)
    ) {
      const first = node.arguments?.[0];
      if (first?.kind === K.StringLiteral) {
        const selector = readStringLiteralValue(first.text)?.value;
        const binding = bindings.get(selector);
        if (binding && node.expression.name === api[binding.type]) {
          const start = first.end - first.text.length;
          edits.push({
            start,
            end: first.end,
            before: first.text,
            replacement: JSON.stringify(binding.id),
            selector,
          });
        }
      }
    }
    forEachChild(node, visit);
  }
  visit(ast);
  return applyReversibleSourceEdits(source, edits);
}

/** Mint an archive capability only when the source and typed GUI independently
 * account for every recovered reference to the selected owner. */
export function prepareObservedAttributeBinding({
  source,
  observed,
  triggerXml,
  schema,
  localizedStrings,
  parseXml,
  parseGalaxy,
}) {
  const namespace = observed.proof.localNamespace;
  if (!namespace || !Number.isSafeInteger(Number(namespace)) || Number(namespace) > 4294967295)
    return { reason: 'NO_UNAMBIGUOUS_ATTRIBUTE_OWNER' };
  const prefix = `[bnet:local/0.0/${namespace}]`;
  const bindings = new Map();
  const expected = new Map();
  for (const { id, type, selectors } of observed.proof.definitions) {
    const selector = prefix + id;
    const record = selectors.find((entry) => entry.selector === selector);
    if (!record) continue;
    bindings.set(selector, { id, type });
    expected.set(selector, record.count);
  }
  if (!expected.size) return { reason: 'NO_QUALIFIED_OWN_SELECTORS' };
  const localized = rebindAttributeGalaxy(source, bindings, parseGalaxy);
  if (!sameCounts(expected, census(localized.proof.edits.map((edit) => edit.selector))))
    return { reason: 'ATTRIBUTE_REFERENCES_SPAN_OTHER_SOURCE_COMPONENTS' };
  const gui = restoreQualifiedAttributeGui({
    triggerXml,
    attributes: observed.model,
    schema,
    localizedStrings,
    parseXml,
    namespace: Number(namespace),
    rebindToMap: true,
  });
  if (!sameCounts(expected, census(gui.qualifiedRuntimeValues.map(({ value }) => value))))
    return { reason: 'ATTRIBUTE_REFERENCES_NOT_FULLY_REPRESENTED_BY_TYPED_GUI' };
  const proof = {
    kind: 'OBSERVED_ATTRIBUTE_REFERENCES_REBOUND_TO_MAP',
    previousOwner: `bnet:local/0.0/${namespace}`,
    selectorCounts: Object.fromEntries(expected),
    originalLobbyVerified: false,
    source: localized.proof,
  };
  const token = Object.freeze({});
  capabilities.set(token, {
    sourceSha256: digest(source),
    candidateSha256: digest(localized.text),
    triggerSha256: digest(gui.triggerXml),
    attributeSha256: digest(observed.xml),
  });
  return { text: localized.text, gui, proof, token, bindings };
}

function sameCounts(left, right) {
  return left.size === right.size && [...left].every(([key, count]) => right.get(key) === count);
}

export function verifyObservedAttributeBinding(token, source, staged, components) {
  const binding = capabilities.get(token);
  assert(binding, 'VERIFIED_ATTRIBUTE_BINDING_REQUIRED_FOR_MAPSCRIPT');
  assert.equal(digest(source), binding.sourceSha256, 'ATTRIBUTE_BINDING_ORIGINAL_SOURCE_CHANGED');
  assert.equal(digest(staged), binding.candidateSha256, 'ATTRIBUTE_BINDING_STAGED_SOURCE_CHANGED');
  const hashes = new Map(components.map((row) => [row.path.toLowerCase(), row.sha256]));
  assert.equal(hashes.get('triggers'), binding.triggerSha256, 'ATTRIBUTE_BINDING_GUI_CHANGED');
  assert.equal(
    hashes.get('attributes'),
    binding.attributeSha256,
    'ATTRIBUTE_BINDING_MODEL_CHANGED',
  );
}
