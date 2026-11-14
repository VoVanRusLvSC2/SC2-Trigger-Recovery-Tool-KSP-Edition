// A duplicate directive is redundant only in the complete resolved include
// traversal of this root. A library's basename or known SDK name is not proof.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';
import { logicalSourcePath } from '../../model/source-ownership.mjs';
import { SyntaxKind as K } from './index-alternate-3.js';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const token = (p) => logicalSourcePath(p.replace(/\.galaxy$/iu, ''));
const omitted = new Set(['parent', 'pos', 'end', 'line', 'char', 'syntaxTokens', 'comments']);
const shape = (v) =>
  !v || typeof v !== 'object'
    ? v
    : Array.isArray(v)
      ? v.map(shape)
      : Object.fromEntries(
          Object.entries(v)
            .filter(([k]) => !omitted.has(k))
            .map(([k, x]) => [k, shape(x)]),
        );
const plans = new WeakMap();
class Refusal extends Error {}
const requireProof = (ok, reason) => {
  if (!ok) throw new Refusal(reason);
};

export function removeAlreadyLoadedOwnedIncludes({
  root,
  ownedSources = [],
  externalSources = [],
  includeEvidence,
  includeRoot = true,
}) {
  const unchanged = (reason) => ({
    root,
    files: ownedSources,
    proof: {
      kind: 'RESOLVED_OWNED_INCLUDE_ONCE',
      status: 'NOT_APPLIED',
      reason,
      records: [],
      originalInputsChanged: false,
      persistentCache: false,
    },
  });
  if (!Array.isArray(includeEvidence)) return unchanged('EXPLICIT_RESOLUTION_EVIDENCE_REQUIRED');
  assert(
    root && typeof root.text === 'string' && typeof root.fileName === 'string',
    'INCLUDE_ROOT_REQUIRED',
  );
  const files = new Map(),
    edges = new Map(),
    layers = new Map(),
    owned = new Set(),
    parsed = new Map(),
    visited = new Set(),
    active = new Set(),
    edits = new Map(),
    records = [];
  const parse = (file) => {
    const key = logicalSourcePath(file.originalPath ?? file.fileName);
    if (!parsed.has(key)) {
      const ast = parseImmutableGalaxySyntax(file.text, file.fileName);
      requireProof(!ast.parseDiagnostics.length, 'INCLUDE_SOURCE_SYNTAX:' + key);
      parsed.set(key, ast);
    }
    return parsed.get(key);
  };
  try {
    for (const file of [root, ...ownedSources, ...externalSources]) {
      assert(typeof file.text === 'string', 'INCLUDE_FILE_TEXT_REQUIRED');
      const key = logicalSourcePath(file.originalPath ?? file.fileName),
        previous = files.get(key);
      requireProof(
        !previous || sha(previous.text) === sha(file.text),
        'AMBIGUOUS_INCLUDE_SOURCE:' + key,
      );
      if (!previous) files.set(key, file);
    }
    for (const file of [...(includeRoot ? [root] : []), ...ownedSources])
      owned.add(logicalSourcePath(file.originalPath ?? file.fileName));
    for (const edge of includeEvidence) {
      const from = logicalSourcePath(edge.from),
        to = logicalSourcePath(edge.path),
        key = from + '\0' + token(edge.include),
        previous = edges.get(key);
      requireProof(typeof edge.layerId === 'string' && edge.layerId, 'INCLUDE_LAYER_ID_REQUIRED');
      requireProof(
        !previous || (previous.path === to && previous.layerId === edge.layerId),
        'AMBIGUOUS_INCLUDE_EDGE:' + key,
      );
      requireProof(
        !layers.has(to) || layers.get(to) === edge.layerId,
        'AMBIGUOUS_INCLUDE_LAYER:' + to,
      );
      edges.set(key, { path: to, layerId: edge.layerId });
      layers.set(to, edge.layerId);
    }
    const walk = (key) => {
      requireProof(files.has(key), 'INCLUDE_TARGET_CONTENT_MISSING:' + key);
      requireProof(visited.size < 4096, 'INCLUDE_FILE_LIMIT');
      if (visited.has(key)) return;
      visited.add(key);
      active.add(key);
      const file = files.get(key);
      let ordinal = 0;
      for (const node of parse(file).statements)
        if (node.kind === K.IncludeStatement) {
          const index = ordinal++;
          const include = node.path?.value;
          requireProof(typeof include === 'string', 'INCLUDE_LITERAL_REQUIRED');
          const target = edges.get(key + '\0' + token(include));
          requireProof(target, 'INCLUDE_RESOLUTION_MISSING:' + key + ':' + include);
          // Complete closure is mandatory even if this directive is a duplicate.
          requireProof(files.has(target.path), 'INCLUDE_TARGET_CONTENT_MISSING:' + target.path);
          if (visited.has(target.path) && owned.has(key)) {
            const list = edits.get(key) ?? [];
            list.push({ start: node.pos, end: node.end, node, ordinal: index });
            edits.set(key, list);
            records.push({
              owner: key,
              include,
              target: target.path,
              layerId: target.layerId,
              targetSha256: sha(files.get(target.path).text),
              activeReentry: active.has(target.path),
              rule: 'EXACT_RESOLVED_FILE_ALREADY_ENTERED_BEFORE_THIS_DIRECTIVE',
            });
          }
          walk(target.path);
        }
      active.delete(key);
    };
    walk(logicalSourcePath(root.originalPath ?? root.fileName));
    const derive = (file) => {
      const key = logicalSourcePath(file.originalPath ?? file.fileName),
        list = edits.get(key);
      if (!list?.length) return file;
      let text = file.text,
        end = Infinity;
      for (const e of list.toSorted((a, b) => b.start - a.start)) {
        assert(e.end <= end, 'OVERLAPPING_INCLUDE_EDITS');
        text = text.slice(0, e.start) + text.slice(e.end);
        end = e.start;
      }
      const ast = parseImmutableGalaxySyntax(text, file.fileName);
      assert.equal(ast.parseDiagnostics.length, 0, 'INCLUDE_VIEW_SYNTAX');
      const removed = new Set(list.map((e) => e.node));
      assert(
        isDeepStrictEqual(
          shape(ast.statements),
          shape(parse(file).statements.filter((n) => !removed.has(n))),
        ),
        'INCLUDE_VIEW_CHANGED_OTHER_AST',
      );
      return { ...file, text };
    };
    const plan = Object.freeze({});
    plans.set(
      plan,
      new Map(
        [...edits].map(([key, list]) => [
          key,
          {
            ordinals: new Set(list.map((e) => e.ordinal)),
            signature: parse(files.get(key))
              .statements.filter((n) => n.kind === K.IncludeStatement)
              .map((n) => token(n.path.value)),
          },
        ]),
      ),
    );
    return {
      root: derive(root),
      files: ownedSources.map(derive),
      plan,
      proof: {
        kind: 'RESOLVED_OWNED_INCLUDE_ONCE',
        status: records.length ? 'APPLIED' : 'UNCHANGED',
        records,
        root: { fileName: root.fileName, sha256: sha(root.text) },
        resolvedFiles: [...visited].map((key) => ({
          path: key,
          sha256: sha(files.get(key).text),
          layerId: layers.get(key) ?? null,
        })),
        includeOnceByResolvedPathAndLayer: true,
        completeReachableClosure: true,
        allOtherOwnedStatementsExact: true,
        originalInputsChanged: false,
        persistentCache: false,
      },
    };
  } catch (error) {
    if (error instanceof Refusal) return unchanged(error.message);
    throw error;
  }
}

// Earlier AST passes may have changed body spans. Rebind only an unchanged
// include sequence in the current owned revision; never reuse stale offsets.
export function applyOwnedIncludePlan(file, plan, view) {
  if (!plan) return { ...file, proof: { applied: false } };
  assert(plans.has(plan), 'UNOWNED_INCLUDE_PLAN');
  const key = logicalSourcePath(file.originalPath ?? file.fileName),
    entry = plans.get(plan).get(key);
  if (!entry) return { ...file, proof: { applied: false } };
  const ast = view ? view.input(file.text) : parseImmutableGalaxySyntax(file.text, file.fileName);
  assert.equal(ast.parseDiagnostics.length, 0, 'INCLUDE_REVISION_SYNTAX');
  const includes = ast.statements.filter((n) => n.kind === K.IncludeStatement);
  assert.deepEqual(
    includes.map((n) => token(n.path.value)),
    entry.signature,
    'INCLUDE_SEQUENCE_CHANGED_SINCE_PROOF',
  );
  const removed = new Set(includes.filter((_, i) => entry.ordinals.has(i)));
  let text = file.text;
  for (const n of [...removed].toSorted((a, b) => b.pos - a.pos))
    text = text.slice(0, n.pos) + text.slice(n.end);
  const after = view ? view.output(text) : parseImmutableGalaxySyntax(text, file.fileName);
  assert.equal(after.parseDiagnostics.length, 0, 'INCLUDE_REVISION_OUTPUT_SYNTAX');
  assert(
    isDeepStrictEqual(
      shape(after.statements),
      shape(ast.statements.filter((n) => !removed.has(n))),
    ),
    'INCLUDE_REVISION_CHANGED_OTHER_AST',
  );
  return {
    ...file,
    text,
    proof: {
      applied: true,
      owner: key,
      removedDirectives: removed.size,
      currentSourceSha256: sha(file.text),
      derivedSourceSha256: sha(text),
      allOtherCurrentStatementsExact: true,
    },
  };
}
