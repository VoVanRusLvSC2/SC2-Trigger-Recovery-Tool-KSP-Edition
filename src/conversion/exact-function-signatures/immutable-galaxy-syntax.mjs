import assert from 'node:assert/strict';
import {Parser} from "./index-alternate-3.js";

// Provenance follows the lifetime of the tree/token. These weak registries do
// not provide a lookup by source and cannot cache results between conversions.
const origins = new WeakMap(), transfers = new WeakMap();
function freezeTree(root) {
  const seen = new Set(), pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) if (key !== 'parent') pending.push(child);
    Object.freeze(value);
  }
  return root;
}
export function parseImmutableGalaxySyntax(text, fileName = 'Lib.galaxy') {
  assert.equal(typeof text, 'string');assert.equal(typeof fileName, 'string');
  const ast = new Parser().parseFile(fileName, text);
  ast.__sourceText = text;
  freezeTree(ast);
  origins.set(ast, {text, fileName});
  return ast;
}
export function hasImmutableGalaxyOrigin(ast, text, fileName) {
  const origin = origins.get(ast);
  return origin !== undefined && origin.text === text && origin.fileName === fileName;
}
export function transferGalaxySyntax(sources) {
  for (const source of sources)
    assert(hasImmutableGalaxyOrigin(source.ast, source.text, source.fileName), 'UNTRUSTED_GALAXY_SYNTAX');
  const token = Object.freeze({});
  transfers.set(token, sources.map(source => Object.freeze({...source})));
  return token;
}
export function consumeGalaxySyntax(token) {
  if (token === undefined) return [];
  assert(transfers.has(token), 'INVALID_OR_CONSUMED_SYNTAX_TRANSFER');
  const sources = transfers.get(token);transfers.delete(token);return sources;
}
export function discardGalaxySyntax(token) { if (token) transfers.delete(token); }
