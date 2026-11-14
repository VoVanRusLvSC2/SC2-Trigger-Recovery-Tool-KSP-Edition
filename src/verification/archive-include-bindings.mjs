import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { parseImmutableGalaxySyntax } from '../model/immutable-galaxy-syntax.collections.mjs';
import { logicalSourcePath } from '../model/source-ownership.mjs';
import { readStringLiteralValue } from '../types/string-literal-value.mjs';
import { qualifyNativePrefixBeforeComposition } from './native-prefix-before-owned-composition.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const token = (p) => logicalSourcePath(p.replace(/\.galaxy$/iu, '') + '.galaxy');

/** Bind archive composition to explicit include edges and their selected layer.
 * A matching filename elsewhere in an archive is never resolution evidence.
 * Unsupported relative aliases and external shadowing fail closed. */
export async function verifyArchiveIncludeBindings({
  before,
  after,
  sourceArchive,
  candidateArchive,
  declarations = [],
  nativeProof,
  includeEvidence,
  archiveLayerId,
}) {
  assert(
    typeof archiveLayerId === 'string' && archiveLayerId,
    'ARCHIVE_INCLUDE_SOURCE_LAYER_REQUIRED',
  );
  assert(Array.isArray(includeEvidence), 'ARCHIVE_INCLUDE_EXPLICIT_EDGES_REQUIRED');
  const edges = new Map(),
    external = new Map();
  for (const e of includeEvidence) {
    const key = logicalSourcePath(e.from) + '\0' + token(e.include),
      prior = edges.get(key),
      target = logicalSourcePath(e.path);
    assert(typeof e.layerId === 'string' && e.layerId, 'ARCHIVE_INCLUDE_EDGE_LAYER_REQUIRED');
    assert(
      !prior || (prior.path === target && prior.layerId === e.layerId),
      'ARCHIVE_INCLUDE_AMBIGUOUS_EDGE',
    );
    edges.set(key, { path: target, layerId: e.layerId });
  }
  for (const file of declarations) {
    const key = logicalSourcePath(file.originalPath ?? file.fileName),
      prior = external.get(key),
      digest = sha(file.text);
    if (file.sha256 !== undefined)
      assert.equal(file.sha256, digest, 'ARCHIVE_INCLUDE_DECLARATION_SHA');
    assert(!prior || prior.sha256 === digest, 'ARCHIVE_INCLUDE_AMBIGUOUS_EXTERNAL_CONTENT');
    external.set(key, { ...file, sha256: digest });
  }
  const sides = [];
  for (const [text, pin] of [
    [before, sourceArchive],
    [after, candidateArchive],
  ]) {
    const bytes = await readFile(pin.path);
    assert.equal(sha(bytes), pin.sha256, 'ARCHIVE_INCLUDE_INPUT_SHA');
    const archive = await openMpqReader(bytes, {
      maxArchiveBytes: 1024 ** 3,
      maxEntries: 100000,
      maxEntryBytes: 256 * 1024 ** 2,
    });
    const records = [],
      visited = new Set();
    try {
      const root = qualifyNativePrefixBeforeComposition(text, { declarations, nativeProof });
      const visit = async (source, owner) => {
        if (visited.has(owner)) return;
        assert(visited.size < 4096, 'ARCHIVE_INCLUDE_FILE_LIMIT');
        visited.add(owner);
        const ast = parseImmutableGalaxySyntax(source, owner);
        assert.equal(ast.parseDiagnostics.length, 0, 'ARCHIVE_INCLUDE_SYNTAX');
        for (const node of ast.statements) {
          if (!node.path) continue;
          const literal = readStringLiteralValue(node.path.text);
          assert(literal && !literal.needsPreset, 'ARCHIVE_INCLUDE_LITERAL_REQUIRED');
          const key = token(literal.value),
            edge = edges.get(owner + '\0' + key);
          assert(edge, 'ARCHIVE_INCLUDE_ORIGINAL_EDGE_MISSING:' + owner + ':' + key);
          const own = edge.layerId === archiveLayerId;
          let body;
          if (own) {
            assert.equal(key, edge.path, 'ARCHIVE_INCLUDE_RELATIVE_ALIAS_NOT_SUPPORTED');
            const entry = archive.find(edge.path);
            assert(entry, 'ARCHIVE_INCLUDE_OWNED_BODY_MISSING:' + edge.path);
            body = Buffer.from(await archive.read(entry.id)).toString('utf8');
          } else {
            assert(!archive.find(key), 'ARCHIVE_INCLUDE_EXTERNAL_SHADOW_NOT_SUPPORTED');
            const file = external.get(edge.path);
            assert(file, 'ARCHIVE_INCLUDE_EXTERNAL_BODY_MISSING:' + edge.path);
            body = file.text;
          }
          records.push({
            from: owner,
            include: literal.value,
            path: edge.path,
            layerId: edge.layerId,
            owned: own,
            sha256: sha(body),
          });
          await visit(body, edge.path);
        }
      };
      await visit(root.text, 'mapscript.galaxy');
      sides.push({
        archive: pin,
        rootSha256: sha(text),
        records,
        visitedFiles: visited.size,
        ownedTargets: [...new Set(records.filter((r) => r.owned).map((r) => r.path))],
      });
    } finally {
      archive.dispose();
    }
  }
  return {
    kind: 'EXPLICIT_LAYER_BOUND_ARCHIVE_INCLUDE_CLOSURE',
    sides,
    archiveLayerId,
    complete: true,
    resolutionByBasename: false,
    sourceRelativeAliasesAccepted: false,
    externalArchiveShadowAccepted: false,
    sourceOrCandidateChanged: false,
    wholeMapAccepted: false,
  };
}
