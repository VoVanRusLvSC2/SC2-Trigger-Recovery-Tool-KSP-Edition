import assert from 'node:assert/strict';
import { parseImmutableSyntax } from '../utilities/recovery-parse-scope.mjs';
import { Parser } from '../sdk/array-values/modules/galaxy/language-core/index.js';
// Object.freeze alone does not protect Map/Set entries. Parser comment maps
// carry GUI section metadata, so their entries and values must be immutable too.
function freezeTree(root) {
  const wrapped = new Map(),
    pending = [root];
  const wrap = (value) => {
    if (!value || typeof value !== 'object') return value;
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === Array.prototype) return value;
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
    // The parser creates a fresh, mutable syntax graph for this call. Once
    // frozen, a node's outgoing edges have already been queued here.
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) continue;
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
    } else if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const item = value[index];
        if (!item || typeof item !== 'object') continue;
        const wrappedItem = wrap(item);
        if (wrappedItem !== item) value[index] = wrappedItem;
        pending.push(item);
      }
    } else
      for (const key of Object.keys(value)) {
        if (key === 'parent') continue;
        const item = value[key];
        if (!item || typeof item !== 'object') continue;
        const wrappedItem = wrap(item);
        if (wrappedItem !== item) value[key] = wrappedItem;
        pending.push(item);
      }
    Object.freeze(value);
  }
  return root;
}
export function parseImmutableGalaxySyntax(text, fileName = 'Lib.galaxy') {
  return parseImmutableSyntax(text, fileName, readImmutableGalaxySyntax);
}

function readImmutableGalaxySyntax(text, fileName) {
  assert.equal(typeof text, 'string');
  assert.equal(typeof fileName, 'string');
  const ast = new Parser().parseFile(fileName, text);
  ast.__sourceText = text;
  freezeTree(ast);
  return ast;
}
