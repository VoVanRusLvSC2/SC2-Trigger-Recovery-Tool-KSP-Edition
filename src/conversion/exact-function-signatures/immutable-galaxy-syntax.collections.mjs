import assert from 'node:assert/strict';
import { Parser } from './index-alternate-3.js';
const origins = new WeakMap(),
  transfers = new WeakMap();

// Object.freeze alone does not protect Map/Set entries. Parser comment maps
// carry GUI section metadata, so their entries and values must be immutable too.
function freezeTree(root) {
  const wrapped = new Map(),
    seen = new Set(),
    pending = [root];
  const wrap = (value) => {
    if (!(value instanceof Map) && !(value instanceof Set)) return value;
    if (wrapped.has(value)) return wrapped.get(value);
    const mutators = new Set(
      value instanceof Map ? ['set', 'delete', 'clear'] : ['add', 'delete', 'clear'],
    );
    let proxy;
    proxy = new Proxy(value, {
      get(target, key) {
        if (mutators.has(key))
          return () => {
            throw Error('IMMUTABLE_SYNTAX_COLLECTION');
          };
        if (key === 'valueOf') return () => proxy;
        if (key === 'forEach')
          return (callback, thisArg) =>
            target.forEach((entry, index) => callback.call(thisArg, entry, index, proxy));
        const result = Reflect.get(target, key, target);
        return typeof result === 'function' && key !== 'constructor' ? result.bind(target) : result;
      },
      set() {
        throw Error('IMMUTABLE_SYNTAX_COLLECTION');
      },
      defineProperty() {
        throw Error('IMMUTABLE_SYNTAX_COLLECTION');
      },
      deleteProperty() {
        throw Error('IMMUTABLE_SYNTAX_COLLECTION');
      },
    });
    wrapped.set(value, proxy);
    pending.push(value);
    return proxy;
  };
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (value instanceof Map) {
      const entries = [...value];
      value.clear();
      for (const [key, item] of entries) {
        const k = wrap(key),
          v = wrap(item);
        value.set(k, v);
        pending.push(key, item);
      }
    } else if (value instanceof Set) {
      const entries = [...value];
      value.clear();
      for (const item of entries) {
        value.add(wrap(item));
        pending.push(item);
      }
    } else
      for (const [key, item] of Object.entries(value))
        if (key !== 'parent') {
          value[key] = wrap(item);
          pending.push(item);
        }
    Object.freeze(value);
  }
  return root;
}
export function parseImmutableGalaxySyntax(text, fileName = 'Lib.galaxy') {
  assert.equal(typeof text, 'string');
  assert.equal(typeof fileName, 'string');
  const ast = new Parser().parseFile(fileName, text);
  ast.__sourceText = text;
  freezeTree(ast);
  origins.set(ast, { text, fileName });
  return ast;
}
export function hasImmutableGalaxyOrigin(ast, text, fileName) {
  const origin = origins.get(ast);
  return origin !== undefined && origin.text === text && origin.fileName === fileName;
}
export function transferGalaxySyntax(sources) {
  for (const source of sources)
    assert(
      hasImmutableGalaxyOrigin(source.ast, source.text, source.fileName),
      'UNTRUSTED_GALAXY_SYNTAX',
    );
  const token = Object.freeze({});
  transfers.set(
    token,
    sources.map((source) => Object.freeze({ ...source })),
  );
  return token;
}
export function consumeGalaxySyntax(token) {
  if (token === undefined) return [];
  assert(transfers.has(token), 'INVALID_OR_CONSUMED_SYNTAX_TRANSFER');
  const sources = transfers.get(token);
  transfers.delete(token);
  return sources;
}
export function discardGalaxySyntax(token) {
  if (token) transfers.delete(token);
}
