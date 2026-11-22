import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

const scope = new AsyncLocalStorage();
const MAX_READ_ONLY_MODEL_CHARS = 24 * 1024 ** 2;

function boundedCache(maxChars, maxEntries) {
  const entries = new Map();
  let retained = 0;
  return (key, size, parse) => {
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      entries.set(key, hit);
      return hit.value;
    }
    const value = parse();
    if (size > maxChars) return value;
    while (entries.size >= maxEntries || retained + size > maxChars) {
      const oldest = entries.keys().next().value;
      retained -= entries.get(oldest).size;
      entries.delete(oldest);
    }
    entries.set(key, { size, value });
    retained += size;
    return value;
  };
}

/** Enable reuse in a dedicated recovery worker until its job ends. */
export function beginRecoveryParseScope() {
  const state = {
    xml: boundedCache(16 * 1024 ** 2, 24),
    largeXml: boundedCache(MAX_READ_ONLY_MODEL_CHARS, 1),
    syntax: boundedCache(4 * 1024 ** 2, 160),
    largeSyntax: boundedCache(6 * 1024 ** 2, 3),
    templateReplay: boundedCache(512 * 1024, 256),
    bzip2: boundedCache(24 * 1024 ** 2, 8192),
    readOnlyModels: boundedCache(12 * 1024 ** 2, 16),
    largeReadOnlyModel: boundedCache(MAX_READ_ONLY_MODEL_CHARS, 1),
    textDigests: boundedCache(16 * 1024 ** 2, 96),
    largeTextDigest: boundedCache(MAX_READ_ONLY_MODEL_CHARS, 1),
    parsers: new Map(),
  };
  scope.enterWith(state);
  return () => {
    state.xml = undefined;
    state.largeXml = undefined;
    state.syntax = undefined;
    state.largeSyntax = undefined;
    state.templateReplay = undefined;
    state.bzip2 = undefined;
    state.readOnlyModels = undefined;
    state.largeReadOnlyModel = undefined;
    state.textDigests = undefined;
    state.largeTextDigest = undefined;
    state.parsers.clear();
  };
}

/** The key is the entire immutable string read by the caller. Every claimed
 * digest still has to match the SHA-256 of those exact UTF-8 bytes. */
export function recoveryTextSha256(text) {
  const state = scope.getStore();
  const hash = () => createHash('sha256').update(text).digest('hex');
  if (!state?.textDigests || typeof text !== 'string') return hash();
  const cache = text.length > 12 * 1024 ** 2 ? state.largeTextDigest : state.textDigests;
  return cache(text, text.length, hash);
}

/** Reuse successful decompression only for identical, freshly read sector bytes.
 * Archive tables, bounds and payload hashes still have to pass on every read. */
export function decodeRecoveryBzip2(bytes, limit, signal, decode) {
  signal?.throwIfAborted();
  const state = scope.getStore();
  const decodeFresh = () => decode(bytes, { maxOutputBytes: limit, ...(signal ? { signal } : {}) });
  if (
    !state?.bzip2 ||
    !Number.isSafeInteger(limit) ||
    limit < 0 ||
    limit > 256 * 1024 ||
    bytes.length > 256 * 1024
  )
    return decodeFresh();
  if (!state.parsers.has(decode)) state.parsers.set(decode, state.parsers.size);
  const encoded = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  const key = state.parsers.get(decode) + ':' + limit + ':' + encoded;
  const value = state.bzip2(key, key.length + limit, () => Uint8Array.from(decodeFresh()));
  return value.slice();
}

/** The reader and its callers must treat the parsed dependency model as read-only. */
export function readRecoveryModel(text, parse, variant = '') {
  const state = scope.getStore();
  if (!state?.readOnlyModels || typeof text !== 'string' || text.length > MAX_READ_ONLY_MODEL_CHARS)
    return parse(text, variant);
  if (!state.parsers.has(parse)) state.parsers.set(parse, state.parsers.size);
  const key = JSON.stringify([state.parsers.get(parse), variant]) + text;
  // Large output maps are independently inspected by several consecutive gates.
  // Keep one such view without evicting the small dependency models.
  const cache = key.length > 12 * 1024 ** 2 ? state.largeReadOnlyModel : state.readOnlyModels;
  return cache(key, key.length, () => parse(text, variant));
}

export function parseLosslessXml(text, parse) {
  const state = scope.getStore();
  if (
    !state?.xml ||
    typeof text !== 'string' ||
    text.length < 256 * 1024 ||
    text.length > MAX_READ_ONLY_MODEL_CHARS
  )
    return parse(text);
  const cache = text.length > 12 * 1024 ** 2 ? state.largeXml : state.xml;
  return cache(text, text.length, () => {
    const root = parse(text);
    const pending = [root];
    while (pending.length) {
      const node = pending.pop();
      for (const child of node.children) pending.push(child);
      Object.freeze(node.children);
      Object.freeze(node.attributes);
      Object.freeze(node);
    }
    return root;
  });
}

export function parseImmutableSyntax(text, fileName, parse) {
  const state = scope.getStore();
  if (!state?.syntax || typeof text !== 'string' || typeof fileName !== 'string' || !text)
    return parse(text, fileName);
  if (text.length > 3 * 1024 ** 2) return parse(text, fileName);
  if (!state.parsers.has(parse)) state.parsers.set(parse, state.parsers.size);
  const key = JSON.stringify([state.parsers.get(parse), fileName]) + text;
  const cache = text.length > 512 * 1024 ? state.largeSyntax : state.syntax;
  return cache(key, key.length, () => parse(text, fileName));
}

/** Exact source and parser mode for transient ScriptCode replay evidence. */
export function readTemplateReplay(source, expression, parse) {
  const state = scope.getStore();
  const cache = state?.templateReplay;
  if (!cache || source.length > 16 * 1024) return parse(source, expression);
  if (!state.parsers.has(parse)) state.parsers.set(parse, state.parsers.size);
  const key = state.parsers.get(parse) + (expression ? ':e:' : ':s:') + source;
  return cache(key, key.length + source.length * 3, () => parse(source, expression));
}
