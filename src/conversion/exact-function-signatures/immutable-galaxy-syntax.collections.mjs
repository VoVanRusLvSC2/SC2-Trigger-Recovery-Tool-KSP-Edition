import assert from 'node:assert/strict';
import { parseImmutableGalaxySyntax as readSyntax } from '../../model/read-immutable-galaxy-syntax.mjs';

const origins = new WeakMap(),
  transfers = new WeakMap();

export function parseImmutableGalaxySyntax(text, fileName = 'Lib.galaxy') {
  const ast = readSyntax(text, fileName);
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
