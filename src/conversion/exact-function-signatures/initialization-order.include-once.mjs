// Build the initialization sequence from explicit, already SHA-checked include
// resolution evidence. Unreachable declaration views are not runtime roots.
// An entered resolved file is included once, including active mutual references.
// Reentry is recorded; every remaining statement and include edge is still checked.
// This model does not classify native effects or authorize a relocation alone.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SyntaxKind as K } from './index-alternate-3.js';
import {
  parseImmutableGalaxySyntax,
  hasImmutableGalaxyOrigin,
} from './immutable-galaxy-syntax.collections.mjs';
import { logicalSourcePath } from '../../model/source-ownership.mjs';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const contexts = new WeakMap();
const token = (text) => logicalSourcePath(text.replace(/\.galaxy$/iu, ''));
const stamp = (files) =>
  files.map((f) => ({ name: logicalSourcePath(f.fileName), sha256: sha(f.text) }));
const parse = (text, name) => {
  const ast = parseImmutableGalaxySyntax(text, name);
  assert.equal(ast.parseDiagnostics.length, 0, 'INITIALIZATION_ORDER_SYNTAX');
  return ast;
};

export function createInitializationOrder(
  source,
  externalSources,
  includeEvidence,
  { rootAliases = [], parseGalaxy = parse } = {},
) {
  assert.equal(typeof source, 'string');
  assert(Array.isArray(externalSources) && Array.isArray(includeEvidence));
  const root = 'mapscript.galaxy',
    aliases = new Set([root, ...rootAliases.map(logicalSourcePath)]);
  const files = new Map([[root, { fileName: root, text: source, sha256: sha(source) }]]);
  for (const f of externalSources) {
    assert.equal(typeof f.fileName, 'string', 'INITIALIZATION_ORDER_SOURCE_LABEL_REQUIRED');
    const key = logicalSourcePath(f.fileName),
      digest = sha(f.text);
    assert(!aliases.has(key), 'INITIALIZATION_ORDER_OWN_ROOT_VIEW_MUST_BE_EXCLUDED');
    const previous = files.get(key);
    assert(!previous || previous.sha256 === digest, 'INITIALIZATION_ORDER_AMBIGUOUS_SOURCE');
    files.set(key, { ...f, sha256: digest });
  }
  const edges = new Map();
  for (const e of includeEvidence) {
    const from = logicalSourcePath(e.from),
      key = from + '\0' + token(e.include),
      to = logicalSourcePath(e.path);
    const target = { path: to, layerId: e.layerId },
      previous = edges.get(key);
    assert(
      !previous || (previous.path === to && previous.layerId === e.layerId),
      'INITIALIZATION_ORDER_AMBIGUOUS_RESOLUTION',
    );
    edges.set(key, target);
  }
  const visited = new Set(),
    active = new Set(),
    ordered = [],
    usedEdges = [],
    usedFiles = [],
    includeReentries = [];
  const visit = (name) => {
    if (visited.has(name)) {
      includeReentries.push({
        path: name,
        active: active.has(name),
        operation: 'SKIP_ALREADY_ENTERED_RESOLVED_FILE',
      });
      return;
    }
    assert(!active.has(name), 'INITIALIZATION_ORDER_INVALID_ACTIVE_STATE');
    assert(visited.size < 4096, 'INITIALIZATION_ORDER_FILE_BOUND');
    const file = files.get(name);
    assert(file, 'INITIALIZATION_ORDER_SOURCE_MISSING:' + name);
    visited.add(name);
    active.add(name);
    usedFiles.push({ path: name, sha256: file.sha256 });
    const ast = parseGalaxy(file.text, name);
    assert(hasImmutableGalaxyOrigin(ast, file.text, name), 'INITIALIZATION_ORDER_UNTRUSTED_SYNTAX');
    assert.equal(ast.parseDiagnostics.length, 0, 'INITIALIZATION_ORDER_SYNTAX');
    for (const n of ast.statements) {
      if (n.path) {
        const include = n.path.value;
        assert.equal(typeof include, 'string', 'INITIALIZATION_ORDER_INCLUDE_LITERAL');
        const origins = name === root ? [...aliases] : [name],
          bindings = origins.map((from) => edges.get(from + '\0' + token(include))).filter(Boolean);
        assert(
          bindings.length,
          'INITIALIZATION_ORDER_INCLUDE_NOT_RESOLVED:' + name + ':' + include,
        );
        assert(
          bindings.every((e) => e.path === bindings[0].path && e.layerId === bindings[0].layerId),
          'INITIALIZATION_ORDER_ROOT_ALIAS_AMBIGUITY',
        );
        const binding = bindings[0];
        usedEdges.push({ from: name, include, ...binding });
        visit(binding.path);
      } else if (n.kind === K.VariableDeclaration && n.initializer) {
        ordered.push({
          fileName: name,
          name: n.name.name,
          node: n,
          index: ordered.length,
          sourceSha256: file.sha256,
        });
      }
    }
    active.delete(name);
  };
  visit(root);
  const capability = Object.freeze({
    kind: 'EXPLICIT_INCLUDE_INITIALIZATION_ORDER',
    sourceSha256: sha(source),
    files: Object.freeze(usedFiles.map(Object.freeze)),
    edges: Object.freeze(usedEdges.map(Object.freeze)),
    initializers: Object.freeze(
      ordered.map(({ node, ...record }) =>
        Object.freeze({ ...record, start: node.pos, end: node.end }),
      ),
    ),
    includeOnceByResolvedPath: true,
    includeReentries: Object.freeze(includeReentries.map(Object.freeze)),
    unresolvedIncludes: 0,
    externalViewsAreRuntimeRoots: false,
  });
  contexts.set(capability, {
    sourceSha256: sha(source),
    externalStamp: JSON.stringify(stamp(externalSources)),
    ordered,
    root,
  });
  return capability;
}

export function initializersAfterMovedHeader(capability, source, externalSources, names) {
  const context = contexts.get(capability);
  assert(context, 'INITIALIZATION_ORDER_CAPABILITY_NOT_OWNED');
  assert.equal(sha(source), context.sourceSha256, 'INITIALIZATION_ORDER_SOURCE_CHANGED');
  assert.equal(
    JSON.stringify(stamp(externalSources)),
    context.externalStamp,
    'INITIALIZATION_ORDER_EXTERNAL_CHANGED',
  );
  assert(names instanceof Set && names.size, 'INITIALIZATION_ORDER_MOVED_NAMES_REQUIRED');
  const moved = [...names].map((name) => {
    const found = context.ordered.filter((d) => d.name === name);
    assert.equal(found.length, 1, 'INITIALIZATION_ORDER_MOVED_DECLARATION_NOT_UNIQUE');
    assert.equal(
      found[0].fileName,
      context.root,
      'INITIALIZATION_ORDER_MOVED_DECLARATION_NOT_OWNED',
    );
    return found[0];
  });
  const cut = Math.min(...moved.map((d) => d.index));
  // Everything before this cut executes in the same state on both sides. After
  // the cut, the caller must still prove no reads/writes/callbacks/yields until
  // the GUI stage has assigned every moved variable in the original order.
  return {
    initializers: context.ordered
      .filter((d) => d.index >= cut && !names.has(d.name))
      .map((d) => d.node.initializer),
    proof: {
      kind: capability.kind,
      sourceSha256: capability.sourceSha256,
      files: capability.files,
      edges: capability.edges,
      firstMovedInitializer: cut,
      moved: moved.map(({ node, ...record }) => record),
      identicalPrefixInitializers: cut,
      checkedLaterInitializers: context.ordered
        .filter((d) => d.index >= cut && !names.has(d.name))
        .map(({ node, ...record }) => record),
      externalViewsAreRuntimeRoots: false,
      relocationOrWholeProgramEquivalenceProved: false,
    },
  };
}
