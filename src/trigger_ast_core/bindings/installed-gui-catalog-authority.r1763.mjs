import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {removeEmptyDependencyDocuments} from '../../map_production_preparation_v94_2026-10-04/empty_dependency_documents.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const canonical = value => {
  assert.equal(typeof value, 'string', 'GUI_CATALOG_PATH_REQUIRED');
  const result = value.replaceAll('\\', '/');
  assert(result && !/[:\x00-\x1f]/u.test(result) && !result.startsWith('/') &&
    result.split('/').every(part => part && part !== '.' && part !== '..'), 'GUI_CATALOG_PATH_UNSAFE');
  return result.toLowerCase();
};
const buildIdentity = text => {
  const [header, ...lines] = text.replace(/^\uFEFF/u, '').trim().split(/\r?\n/u);
  const keys = header.split('|').map(key => key.split('!')[0]);
  assert(keys.includes('Active') && keys.includes('Build Key'), 'GUI_CATALOG_BUILD_INFO_HEADER');
  const active = lines.filter(Boolean).map(line => Object.fromEntries(line.split('|').map((value, i) => [keys[i], value])))
    .filter(row => row.Active === '1');
  assert.equal(active.length, 1, 'GUI_CATALOG_BUILD_AMBIGUOUS');
  const row = active[0];
  assert(/^[a-f0-9]{32}$/iu.test(row['Build Key']), 'GUI_CATALOG_BUILD_KEY');
  return {version: row.Version ?? 'unknown', buildKey: row['Build Key'].toLowerCase(),
    cdnKey: row['CDN Key'] ?? '', buildInfoSha256: sha(text)};
};

/** The caller supplies its live, trusted MapSession context, never prepared
 * receipts as a substitute for installed reads. Enumerate before reading:
 * missing optional files are allowed, failed reads of listed files are not.
 * No disk cache, native declaration or serialized source is created here. */
export async function authenticateInstalledGuiCatalogs({context, dependencyLibraries,
  omittedEmptyDependencyDocuments = [], expectedDependencyLayers, expectedBuildInfoSha256, readBuildInfo}) {
  assert(Array.isArray(dependencyLibraries) && dependencyLibraries.length <= 2048, 'GUI_CATALOG_DOCUMENT_BOUND');
  // Capture the caller's receipts before the first asynchronous operation.
  // Later mutation of a prepared object cannot change the checked closure.
  dependencyLibraries = Object.freeze(dependencyLibraries.map(dep => {
    canonical(dep.sourcePath); assert.equal(typeof dep.triggerData, 'string', 'GUI_CATALOG_SOURCE_TEXT_REQUIRED');
    return Object.freeze({sourcePath: dep.sourcePath, triggerData: dep.triggerData});
  }));
  omittedEmptyDependencyDocuments = structuredClone(omittedEmptyDependencyDocuments);
  expectedDependencyLayers = structuredClone(expectedDependencyLayers);
  assert(!context.unresolved?.length, 'GUI_CATALOG_DEPENDENCY_CLOSURE_UNRESOLVED');
  const layers = context.layers.map(layer => ({...layer}));
  const beforeText = await readBuildInfo(), build = buildIdentity(beforeText);
  assert.equal(build.buildInfoSha256, expectedBuildInfoSha256, 'GUI_CATALOG_PREPARATION_BUILD_CHANGED');
  assert(!context.unresolved?.length, 'GUI_CATALOG_DEPENDENCY_CLOSURE_UNRESOLVED');
  assert(Array.isArray(context.layers) && context.layers.length && context.layers.length <= 2048, 'GUI_CATALOG_LAYER_BOUND');
  assert(new Set(context.layers.map(layer => layer.id)).size === context.layers.length, 'GUI_CATALOG_LAYER_ID_AMBIGUOUS');
  const layerKey = layer => [layer.id, layer.sourceId, layer.sourcePath, layer.role, layer.provenance, layer.kind];
  assert(Array.isArray(expectedDependencyLayers), 'GUI_CATALOG_EXPECTED_LAYERS_REQUIRED');
  assert.deepEqual(layers.filter(layer => layer.role !== 'primary').map(layerKey),
    expectedDependencyLayers.map(layerKey), 'GUI_CATALOG_DEPENDENCY_LAYERS_CHANGED');
  const actual = [], reads = [];
  const listed = async (layer, prefix) => {
    const files = []; let cursor;
    const cursors = new Set();
    do {
      const page = await context.files(layer.id, {prefix, limit: 10000, ...(cursor === undefined ? {} : {cursor})});
      assert(Array.isArray(page.items), 'GUI_CATALOG_LIST_RESULT');
      files.push(...page.items);
      assert(files.length <= 100000, 'GUI_CATALOG_FILE_BOUND');
      cursor = page.nextCursor;
      if (cursor !== undefined) {
        assert(!cursors.has(cursor), 'GUI_CATALOG_LIST_CURSOR_CYCLE'); cursors.add(cursor);
      }
    } while (cursor !== undefined);
    files.forEach(canonical);
    assert(new Set(files.map(canonical)).size === files.length, 'GUI_CATALOG_FILE_CASE_AMBIGUOUS');
    return files;
  };
  const text = async (layer, file) => {
    const bytes = Buffer.from(await context.read(layer.id, file, 64 * 1024 ** 2));
    assert(bytes.length <= 64 * 1024 ** 2, 'GUI_CATALOG_READ_BOUND');
    reads.push({layerId: layer.id, sourceId: layer.sourceId, role: layer.role, packagePath: layer.sourcePath,
      ...(layer.sourceId === 'local:casc' ? {installedPath: canonical(layer.sourcePath + '/' + file)} : {}),
      path: file, sha256: sha(bytes), bytes: bytes.length});
    // Preserve BOM and line endings; a prepared normalized text is not an
    // exact-byte witness to a differently encoded installed document.
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  };
  const add = async (layer, file) => actual.push({sourcePath: file, triggerData: await text(layer, file), layer});
  for (const layer of layers) {
    const own = (await listed(layer, 'Triggers')).filter(file => canonical(file) === 'triggers');
    if (layer.role !== 'primary' && own.length) await add(layer, own[0]);
    const listPath = 'Base.SC2Data/TriggerLibs/LibraryList.xml';
    const lists = (await listed(layer, listPath)).filter(file => canonical(file) === canonical(listPath));
    if (!lists.length) continue;
    const tree = xmlTree(await text(layer, lists[0]));
    assert.equal(tree.tag, 'TriggerData', 'GUI_CATALOG_LIBRARY_LIST_ROOT');
    const externals = [];
    const visit = node => {
      if (node.tag.toLowerCase() === 'library') {
        const external = Object.entries(node.attributes).filter(([key]) => key.toLowerCase() === 'external');
        assert(external.length <= 1, 'GUI_CATALOG_EXTERNAL_ATTRIBUTE_AMBIGUOUS');
        if (external.length) externals.push(external[0][1]);
      }
      node.children.forEach(visit);
    };
    visit(tree);
    assert(new Set(externals.map(canonical)).size === externals.length, 'GUI_CATALOG_LIST_ENTRY_AMBIGUOUS');
    for (const external of externals) {
      const base = 'Base.SC2Data/' + external.replaceAll('\\', '/'); canonical(base);
      const files = await listed(layer, base);
      // Same explicit extension precedence as the existing dependency loader.
      const file = ['.SC2Lib', '.TriggerLib'].map(ext => files.find(file => canonical(file) === canonical(base + ext))).find(Boolean);
      assert(file, 'GUI_CATALOG_LISTED_SOURCE_MISSING:' + base);
      await add(layer, file);
    }
  }
  const filtered = removeEmptyDependencyDocuments(actual, xmlTree);
  const emptyKey = row => [row.index, canonical(row.sourcePath), row.sha256, row.bytes];
  assert.deepEqual(filtered.omitted.map(emptyKey), omittedEmptyDependencyDocuments.map(emptyKey), 'GUI_CATALOG_EMPTY_CLOSURE_CHANGED');
  assert.equal(filtered.retained.length, dependencyLibraries.length, 'GUI_CATALOG_PREPARED_CLOSURE_LENGTH');
  const files = [];
  for (let i = 0; i < filtered.retained.length; i++) {
    const installed = filtered.retained[i], prepared = dependencyLibraries[i];
    assert.deepEqual([canonical(installed.sourcePath), sha(installed.triggerData)],
      [canonical(prepared.sourcePath), sha(prepared.triggerData)], 'GUI_CATALOG_PREPARED_CLOSURE_CHANGED');
    if (installed.layer.sourceId !== 'local:casc' || installed.layer.role !== 'dependency') continue;
    for (const libraryId of readOwnedGuiLibraries(installed.triggerData).keys()) {
      if (libraryId === 'Map') continue;
      files.push({libraryId, path: prepared.sourcePath, sha256: sha(installed.triggerData)});
    }
  }
  assert.equal(sha(await readBuildInfo()), build.buildInfoSha256, 'GUI_CATALOG_BUILD_CHANGED_DURING_READ');
  assert.deepEqual(context.layers.map(layerKey), layers.map(layerKey), 'GUI_CATALOG_LAYERS_CHANGED_DURING_READ');
  assert(!context.unresolved?.length, 'GUI_CATALOG_DEPENDENCY_CLOSURE_UNRESOLVED');
  return {dependencyLibraries, verifiedCASCCatalogAuthority: {
    kind: 'VERIFIED_CASC_CATALOG_AUTHORITY', files, buildIdentity: build,
    provenance: {kind: 'LOADED_DEPENDENCY_CASC_CONTENT_PINS', reads,
      completeRawClosureChecked: true, localizedDocumentsUsedAsAuthority: false}
  }};
}
