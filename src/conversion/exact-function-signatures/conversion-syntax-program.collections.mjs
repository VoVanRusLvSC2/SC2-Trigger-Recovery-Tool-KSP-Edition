import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { recoveryTextSha256 as sha } from '../../utilities/recovery-parse-scope.mjs';
import {
  parseImmutableGalaxySyntax,
  consumeGalaxySyntax,
  hasImmutableGalaxyOrigin,
} from './immutable-galaxy-syntax.collections.mjs';

// Only the current conversion is propagated across await boundaries. The store
// and its source views are discarded when that conversion finishes.
const activeProgram = new AsyncLocalStorage();
export function createConversionSyntaxProgram(
  sources = [],
  { maxSources = 1024, maxSourceBytes = 16 * 1024 ** 2 } = {},
) {
  assert(Number.isSafeInteger(maxSources) && maxSources >= 0);
  assert(Number.isSafeInteger(maxSourceBytes) && maxSourceBytes >= 0);
  const views = new Map(),
    records = new Map(),
    digests = new Map();
  const counts = { requests: 0, parsed: 0, reused: 0, seeded: 0, retired: 0, notRetained: 0 };
  let bytes = 0,
    disposed = false,
    peakSources = 0,
    peakSourceBytes = 0;
  const sourceDigest = (text) => digests.get(text)?.digest ?? sha(text);
  const identity = (fileName, digest) => JSON.stringify([fileName, digest]);
  const retain = (key, entry, digest) => {
    if (views.size >= maxSources || bytes + entry.text.length * 2 > maxSourceBytes) {
      counts.notRetained++;
      return;
    }
    views.set(key, entry);
    const previous = digests.get(entry.text);
    if (previous) previous.references++;
    else digests.set(entry.text, { digest, references: 1 });
    bytes += entry.text.length * 2;
    peakSources = Math.max(peakSources, views.size);
    peakSourceBytes = Math.max(peakSourceBytes, bytes);
  };
  for (const source of sources) {
    assert(
      hasImmutableGalaxyOrigin(source.ast, source.text, source.fileName),
      'UNTRUSTED_GALAXY_SYNTAX',
    );
    const digest = sourceDigest(source.text),
      key = identity(source.fileName, digest),
      previous = views.get(key);
    if (previous) {
      assert.equal(previous.text, source.text);
      continue;
    }
    retain(key, source, digest);
    counts.seeded++;
  }
  return Object.freeze({
    parse(text, fileName = 'Lib.galaxy') {
      assert(!disposed, 'DISPOSED_CONVERSION_SYNTAX_PROGRAM');
      assert.equal(typeof text, 'string');
      assert.equal(typeof fileName, 'string');
      counts.requests++;
      const digest = sourceDigest(text),
        key = identity(fileName, digest),
        previous = views.get(key);
      let record = records.get(key);
      if (!record) {
        record = { fileName, sourceSha256: digest, requests: 0, parsed: 0, reused: 0 };
        records.set(key, record);
      }
      record.requests++;
      if (previous) {
        assert.equal(previous.text, text, 'SYNTAX_IDENTITY_COLLISION');
        counts.reused++;
        record.reused++;
        return previous.ast;
      }
      const ast = parseImmutableGalaxySyntax(text, fileName);
      counts.parsed++;
      record.parsed++;
      retain(key, { text, fileName, ast }, digest);
      return ast;
    },
    release(ast) {
      for (const [key, entry] of views)
        if (entry.ast === ast) {
          views.delete(key);
          bytes -= entry.text.length * 2;
          const digest = digests.get(entry.text);
          if (--digest.references === 0) digests.delete(entry.text);
          counts.retired++;
        }
    },
    evidence() {
      return {
        ...counts,
        peakSources,
        peakSourceBytes,
        maxSources,
        maxSourceBytes,
        views: [...records.values()].map((record) => ({ ...record })),
        persistentCache: false,
        immutableSyntax: true,
      };
    },
    dispose() {
      views.clear();
      records.clear();
      digests.clear();
      bytes = 0;
      disposed = true;
    },
  });
}
export async function withConversionSyntaxProgram(token, operation, report) {
  const program = createConversionSyntaxProgram(consumeGalaxySyntax(token));
  try {
    return await activeProgram.run(program, operation);
  } finally {
    const evidence = program.evidence();
    program.dispose();
    report?.(evidence);
  }
}
export function parseConversionGalaxySyntax(text, fileName, legacyParse) {
  const program = activeProgram.getStore();
  return program ? program.parse(text, fileName) : legacyParse();
}
export function releaseConversionGalaxySyntax(ast) {
  activeProgram.getStore()?.release(ast);
}
