import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';
import { logicalSourcePath, partitionDeclarationViews } from '../../model/source-ownership.mjs';
import { removeAlreadyLoadedOwnedIncludes } from './owned-include-closure.mjs';

const context = new AsyncLocalStorage();
const includePrefixes = new WeakMap();
export const sourceIncludePrefix = Symbol('verified owned source include prefix');
const require = createRequire(
  new URL(
    new URL(
      '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js',
      import.meta.url,
    ).href,
    import.meta.url,
  ),
);
const sax = require('sax');
const sourceKey = (value) => logicalSourcePath(value.replace(/\.galaxy$/iu, '') + '.galaxy');
function includes(text, only = false, fileName = 'source-include-proof.galaxy') {
  const ast = parseImmutableGalaxySyntax(text, fileName);
  assert.equal(
    ast.parseDiagnostics.length,
    0,
    'INVALID_GALAXY_REVISION: source-include-proof.galaxy',
  );
  if (only && ast.statements.some((n) => n.kind !== 136)) return undefined;
  return ast.statements
    .filter((n) => n.kind === 136)
    .map((n) => n.path.value ?? n.path.text.replace(/^"|"$/gu, ''));
}

function buildPlan(input, files) {
  const targets = new Map();
  for (const file of files)
    for (const path of [file.fileName, file.originalPath].filter(Boolean)) {
      const key = sourceKey(path);
      assert(!targets.has(key) || targets.get(key) === file.sha256, 'AMBIGUOUS_INCLUDED_SOURCE');
      targets.set(key, file.sha256);
    }
  // The proof belongs to these exact inputs, never a previous/nested call scope.
  // Resolved paths and layers are evidence; matching library basenames are not.
  const root = {
    fileName: 'MapScript.galaxy',
    text: [input.header, input.script].filter(Boolean).join('\n'),
  };
  let closure;
  if (input.includeEvidence) {
    const views = partitionDeclarationViews(files, input.galaxyDeclarations ?? []);
    assert(!views.conflicts.length, 'PRESERVED_INCLUDE_SOURCE_CONFLICT');
    closure = removeAlreadyLoadedOwnedIncludes({
      root,
      ownedSources: files,
      externalSources: views.external,
      includeEvidence: input.includeEvidence,
      includeRoot: false,
    }).proof;
  }
  if (closure?.completeReachableClosure) {
    const resolved = new Map(
      closure.resolvedFiles.map((file) => [logicalSourcePath(file.path), file]),
    );
    for (const edge of input.includeEvidence ?? []) {
      if (logicalSourcePath(edge.from) !== logicalSourcePath(root.fileName)) continue;
      const target = resolved.get(logicalSourcePath(edge.path));
      if (!target || target.layerId !== edge.layerId) continue;
      const key = sourceKey(edge.include);
      assert(!targets.has(key) || targets.get(key) === target.sha256, 'AMBIGUOUS_INCLUDED_SOURCE');
      targets.set(key, target.sha256);
    }
  }
  // With no header the root and the script are the same verified source view.
  const scriptFile = root.text === input.script ? root.fileName : undefined;
  return [...includes(input.header ?? ''), ...includes(input.script ?? '', false, scriptFile)]
    .filter((path) => targets.has(sourceKey(path)))
    .map((path) => ({ path, key: sourceKey(path), sha256: targets.get(sourceKey(path)) }));
}

export function withPreservedSourceIncludes(policy, input, files, callback) {
  const plan = policy.preserveAuthoredCode ? buildPlan(input, files) : [];
  const scope = { plan, active: true };
  return context.run(scope, async () => {
    try {
      return await callback(plan);
    } finally {
      scope.active = false;
    }
  });
}

export function isPreservedSourceIncludeElement(element) {
  const scope = context.getStore(),
    plan = scope?.active ? scope.plan : undefined;
  if (
    !plan?.length ||
    element.type !== 'CustomScript' ||
    element.flags?.includes('Native') ||
    typeof element.scriptCode !== 'string' ||
    element.expressionCode !== undefined
  )
    return false;
  let paths;
  try {
    paths = includes(element.scriptCode, true);
  } catch {
    return false;
  }
  if (!paths?.length) return false;
  let cursor = 0;
  try {
    for (const path of paths) {
      const key = sourceKey(path);
      const next = plan.findIndex((entry, i) => i >= cursor && entry.key === key);
      if (next < 0) return false;
      cursor = next + 1;
    }
  } catch {
    return false;
  }
  return true;
}

function includeOnlyGuiCode(fragment) {
  let code = '',
    fields = 0,
    depth = 0,
    capture = false,
    type,
    native = false;
  const parser = sax.parser(true, { trim: false, normalize: false });
  parser.onopentag = (n) => {
    if (depth++ === 0) type = n.name === 'Element' ? n.attributes.Type : undefined;
    if (n.name === 'FlagNative') native = true;
    if (n.name === 'ScriptCode') {
      fields++;
      capture = true;
    }
  };
  parser.onclosetag = (name) => {
    if (name === 'ScriptCode') capture = false;
    depth--;
  };
  parser.ontext = parser.oncdata = (text) => {
    if (capture) code += text;
  };
  parser.write(fragment).close();
  if (fields === 1 && !native && type === 'CustomScript') return code;
}

export function isPreservedSourceIncludeXml(fragment) {
  const scope = context.getStore();
  if (!scope?.active || !scope.plan.length) return false;
  return isPreservedSourceIncludeElement({
    type: 'CustomScript',
    scriptCode: includeOnlyGuiCode(fragment),
  });
}

export function verifyPreservedSourceIncludes(plan, emitted) {
  if (!plan.length) return { required: [], preserved: true };
  const paths = includes(emitted).map(sourceKey),
    required = plan.map((entry) => entry.key);
  // Compare all occurrences of these source references, not just a set. Missing,
  // duplicate and reordered includes can change compilation or initialization.
  assert.deepEqual(
    paths.filter((path) => required.includes(path)),
    required,
    'PRESERVED_SOURCE_INCLUDE_SEQUENCE_CHANGED',
  );
  return { required: plan.map((entry) => ({ ...entry })), preserved: true };
}

const sameSequence = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/** Recover an owned include block in the source preamble when the regenerated
 * program has preserved the rest of the verified include sequence. */
export function restoreOwnedSourceIncludePrefix({ input, files, plan, xml, emitted, xmlTree }) {
  if (!files.length || input.documentKind !== 'map' || !input.existingTriggerData?.trim()) return;
  const rootSource = [input.header, input.script].filter(Boolean).join('\n');
  const tree = parseImmutableGalaxySyntax(rootSource, 'MapScript.galaxy');
  const owned = new Map(
    files.map((file) => [sourceKey(file.originalPath ?? file.fileName), file.sha256]),
  );
  const blocks = [];
  let block;
  for (const [index, node] of tree.statements.entries()) {
    if (node.kind !== 136) break;
    const path = node.path.value ?? node.path.text.replace(/^"|"$/gu, '');
    if (!/^[A-Za-z0-9_./ -]+$/u.test(path)) break;
    const entry = plan[index];
    if (!entry || entry.key !== sourceKey(path)) break;
    if (owned.get(entry.key) !== entry.sha256) {
      block = undefined;
      continue;
    }
    if (!block) {
      block = { start: index, entries: [] };
      blocks.push(block);
    }
    block.entries.push(entry);
  }
  if (!blocks.length) return;
  const actual = includes(emitted).map(sourceKey);
  const required = plan.map((entry) => entry.key);
  const requiredKeys = new Set(required);
  const observed = actual.filter((key) => requiredKeys.has(key));
  if (sameSequence(observed, required)) return;
  const eligible = blocks.filter(({ start, entries }) => {
    const expected = entries.map((entry) => entry.key);
    const keys = new Set(expected);
    const remaining = [...required.slice(0, start), ...required.slice(start + entries.length)];
    if (keys.size !== expected.length || remaining.some((key) => keys.has(key))) return false;
    const restored = observed.filter((key) => keys.has(key));
    return (
      (!restored.length || sameSequence(restored, expected)) &&
      sameSequence(
        observed.filter((key) => !keys.has(key)),
        remaining,
      )
    );
  });
  if (eligible.length !== 1) return;
  const [{ start, entries: prefix }] = eligible;
  const after = plan[start - 1]?.key;
  const existing = observed.includes(prefix[0].key);

  const document = xmlTree(xml);
  if (document.tag !== 'TriggerData') return;
  const roots = document.children.filter((node) => node.tag === 'Root');
  if (roots.length !== 1 || roots[0].selfClosing) return;
  const root = roots[0];
  const paths = prefix.map(({ path }) => path);
  let id;
  if (existing) {
    const itemIds = new Set(
      root.children
        .filter((node) => node.tag === 'Item' && node.attributes.Type === 'CustomScript')
        .map((node) => node.attributes.Id),
    );
    const matching = document.children.filter((node) => {
      if (
        node.tag !== 'Element' ||
        node.attributes.Type !== 'CustomScript' ||
        !itemIds.has(node.attributes.Id)
      )
        return false;
      const code = includeOnlyGuiCode(xml.slice(node.start, node.end));
      if (!code) return false;
      const written = includes(code, true);
      return written?.length === paths.length && written.every((path, i) => path === paths[i]);
    });
    if (matching.length !== 1) return;
    id = matching[0].attributes.Id;
  } else {
    const taken = new Set(document.children.map((node) => node.attributes.Id));
    id = prefix[0].sha256.slice(0, 8).toUpperCase();
    while (taken.has(id))
      id = ((Number.parseInt(id, 16) + 1) >>> 0).toString(16).padStart(8, '0').toUpperCase();
    const code = paths.map((path) => `include &quot;${path}&quot;`).join('\n');
    xml =
      xml.slice(0, root.openEnd) +
      `\n<Item Type="CustomScript" Id="${id}"/>` +
      xml.slice(root.openEnd, root.end) +
      `\n<Element Type="CustomScript" Id="${id}"><ScriptCode>${code}</ScriptCode></Element>` +
      xml.slice(root.end);
  }
  const token = Object.freeze({
    kind: 'VERIFIED_OWNED_SOURCE_INCLUDE_PREFIX',
    entries: prefix.map((entry) => ({ ...entry })),
    id,
    ...(after ? { after } : {}),
  });
  includePrefixes.set(token, {
    library: input.libraryId ?? 'Map',
    id,
    paths,
    after,
  });
  return {
    xml,
    token,
  };
}

export function verifiedIncludePrefixForLibrary(token, library, customScripts) {
  if (!token) return;
  const prefix = includePrefixes.get(token);
  assert(prefix, 'UNTRUSTED_SOURCE_INCLUDE_PREFIX');
  if (prefix.library !== library.id || !library.implicit) return;
  const entry = customScripts.find((script) => script.id === prefix.id);
  assert(
    entry && !entry.initFunc && !entry.flags?.length && entry.expressionCode === undefined,
    'SOURCE_INCLUDE_PREFIX_GUI_ITEM_CHANGED',
  );
  assert.deepEqual(includes(entry.scriptCode, true), prefix.paths, 'SOURCE_INCLUDE_PREFIX_CHANGED');
  return prefix;
}

export function sourceIncludePrefixIndex(prefix, statements) {
  if (!prefix.after) return 0;
  const anchors = statements.flatMap((node, index) =>
    node.kind === 136 && sourceKey(node.path.value) === prefix.after ? [index] : [],
  );
  assert.equal(anchors.length, 1, 'SOURCE_INCLUDE_PREFIX_ANCHOR_NOT_UNIQUE');
  return anchors[0] + 1;
}
