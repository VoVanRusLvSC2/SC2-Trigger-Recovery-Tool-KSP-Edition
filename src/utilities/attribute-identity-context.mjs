import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import {
  decodeCacheHeader,
  field,
  number,
  reference,
  blob,
} from '../sdk/core/modules/game/battlenet/content-sources/cache-header.js';
import { readOptionalS2mh } from './s2mh-source.mjs';
import { attributeDomains, attributeIdentityCatalog } from './attribute-identity.mjs';

export const documentAttributeContext = Symbol('verified document attribute identity');
const contexts = new WeakMap(),
  scope = new AsyncLocalStorage();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function createVerifiedDocumentAttributeContext({
  source,
  sourceArchiveSha256,
  model,
}) {
  assert(
    source?.used && source.proof?.exactArchiveMatch === true,
    'EXACT_ATTRIBUTE_SOURCE_REQUIRED',
  );
  const p = source.proof;
  assert(
    /^[a-f0-9]{64}$/u.test(sourceArchiveSha256) && p.sourceArchiveSha256 === sourceArchiveSha256,
    'ATTRIBUTE_CONTEXT_ARCHIVE_MISMATCH',
  );
  assert(
    Number.isSafeInteger(source.namespace) &&
      source.namespace > 0 &&
      source.namespace === p.namespace,
    'ATTRIBUTE_CONTEXT_NAMESPACE_INVALID',
  );
  const bytes = await readFile(p.header);
  assert(bytes.length <= 8 * 1024 ** 2, 'ATTRIBUTE_CONTEXT_HEADER_TOO_LARGE');
  assert.equal(sha(bytes), p.headerSha256, 'ATTRIBUTE_CONTEXT_HEADER_CHANGED');
  const header = field(decodeCacheHeader(bytes), 0);
  assert.equal(
    number(field(header, 3)),
    source.namespace,
    'ATTRIBUTE_CONTEXT_HEADER_NAMESPACE_MISMATCH',
  );
  assert.equal(
    reference(blob(field(header, 2)))?.sha256,
    sourceArchiveSha256,
    'ATTRIBUTE_CONTEXT_HEADER_ARCHIVE_MISMATCH',
  );
  const decoded = await readOptionalS2mh({ s2mh: p.header, namespace: source.namespace });
  const expected = attributeIdentityCatalog({
    attributes: decoded.attributes.map((d) => ({
      id: d.id,
      type: d.type,
      values: d.values.map((v) => ({ id: v.token })),
    })),
  });
  // Header values are four-byte tokens; XML decimal IDs encode the same tokens.
  const actual = attributeIdentityCatalog(model);
  assert(isDeepStrictEqual(actual, expected), 'ATTRIBUTE_CONTEXT_CATALOG_MISMATCH');
  const catalogSha256 = sha(JSON.stringify(actual));
  const proof = Object.freeze({
    kind: 'EXACT_HEADER_DOCUMENT_ATTRIBUTE_IDENTITY',
    sourceArchiveSha256,
    header: p.header,
    headerSha256: p.headerSha256,
    namespace: source.namespace,
    catalogSha256,
    definitions: actual.length,
    archiveBytesVerifiedByCaller: true,
    defaultsOrLobbyEquivalenceProved: false,
  });
  const token = Object.freeze({ proof });
  contexts.set(token, {
    proof,
    catalog: new Map(actual.map((d) => [d.id, d])),
    owner: `bnet:local/0.0/${source.namespace}`,
  });
  return token;
}
export function assertDocumentAttributeModel(token, model) {
  const data = contexts.get(token);
  assert(data, 'UNTRUSTED_DOCUMENT_ATTRIBUTE_CONTEXT');
  assert.equal(
    sha(JSON.stringify(attributeIdentityCatalog(model))),
    data.proof.catalogSha256,
    'PACKED_ATTRIBUTE_CONTEXT_CATALOG_CHANGED',
  );
}
export function withDocumentAttributeContext(token, operation) {
  if (token === undefined) return scope.run(undefined, () => operation(undefined));
  const data = contexts.get(token);
  assert(data, 'UNTRUSTED_DOCUMENT_ATTRIBUTE_CONTEXT');
  const active = { data, active: true, decisions: [] };
  return scope.run(active, async () => {
    try {
      return await operation({ context: data.proof, decisions: active.decisions });
    } finally {
      active.active = false;
    }
  });
}
export function qualifyDocumentAttributeSelector(type, value, parameter) {
  const active = scope.getStore(),
    domain = attributeDomains[type];
  if (!active?.active || !domain || typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/u.test(value))
    return value;
  const definition = active.data.catalog.get(value);
  if (!definition || definition.domain !== domain) return value;
  const qualified = `[${active.data.owner}]${value}`;
  active.decisions.push({
    parameter,
    domain,
    id: value,
    before: value,
    after: qualified,
    evidence: 'EXACT_ARCHIVE_HEADER_AND_MATCHING_TYPED_DOCUMENT_DEFINITION',
  });
  return qualified;
}
