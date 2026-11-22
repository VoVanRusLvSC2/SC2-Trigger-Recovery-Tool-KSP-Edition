import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';
import { logicalSourcePath, partitionDeclarationViews } from '../../model/source-ownership.mjs';
import { removeAlreadyLoadedOwnedIncludes } from './owned-include-closure.mjs';

const context = new AsyncLocalStorage();
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

export function isPreservedSourceIncludeXml(fragment) {
  const scope = context.getStore();
  if (!scope?.active || !scope.plan.length) return false;
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
  return fields === 1 && !native && isPreservedSourceIncludeElement({ type, scriptCode: code });
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
