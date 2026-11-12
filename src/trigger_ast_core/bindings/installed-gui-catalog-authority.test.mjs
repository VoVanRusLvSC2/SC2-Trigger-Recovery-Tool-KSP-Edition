import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {authenticateInstalledGuiCatalogs} from './installed-gui-catalog-authority.r1763.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const build = 'Active!DEC:1|Build Key!HEX:16|Version!STRING:0\n1|' + 'a'.repeat(32) + '|5.0.17.98310\n';
const catalogPath = 'Base.SC2Data/TriggerLibs/NativeLib.TriggerLib';
const catalog = '<TriggerData><Library Id="Ntve"><Root><Item Type="FunctionDef" Id="12345678"/></Root>' +
  '<Element Type="FunctionDef" Id="12345678"><Identifier>TestAction</Identifier><FlagNative/><FlagAction/>' +
  '<ReturnType><Type Value="void"/></ReturnType></Element></Library></TriggerData>';

function input(attributes, {liveCatalog = catalog, filesMissing = false, preparedCatalog = catalog} = {}) {
  const dependency = {id: 'core', sourceId: 'local:casc', sourcePath: 'Mods/Core.SC2Mod',
    role: 'dependency', provenance: 'implicit', kind: 'package'};
  const primary = {id: 'map', sourceId: 'host', sourcePath: 'Original.SC2Map', role: 'primary'};
  const documents = new Map([
    ['Base.SC2Data/TriggerLibs/LibraryList.xml', '<TriggerData><Library ' + attributes + '/></TriggerData>'],
    ...filesMissing ? [] : [[catalogPath, liveCatalog]],
  ]);
  const context = {layers: [dependency, primary], unresolved: [],
    files: async (layer, {prefix}) => ({items: layer === 'core'
      ? [...documents.keys()].filter(name => name.toLowerCase().startsWith(prefix.toLowerCase())) : []}),
    read: async (layer, name) => {
      assert.equal(layer, 'core');
      assert(documents.has(name), 'Only enumerated files may be read');
      return Buffer.from(documents.get(name));
    }};
  return {context, dependencyLibraries: [{sourcePath: catalogPath, triggerData: preparedCatalog}],
    omittedEmptyDependencyDocuments: [], expectedDependencyLayers: [dependency],
    expectedBuildInfoSha256: digest(build), readBuildInfo: async () => build};
}

for (const key of ['external', 'External', 'EXTERNAL']) {
  test('authenticates the complete live catalog closure with ' + key, async () => {
    const result = await authenticateInstalledGuiCatalogs(input(key + '="TriggerLibs/NativeLib"'));
    assert.equal(result.verifiedCASCCatalogAuthority.files.length, 1);
    assert.equal(result.verifiedCASCCatalogAuthority.files[0].libraryId, 'Ntve');
    assert.equal(result.verifiedCASCCatalogAuthority.files[0].sha256, digest(catalog));
    assert.equal(result.verifiedCASCCatalogAuthority.provenance.completeRawClosureChecked, true);
  });
}

test('rejects multiple spellings of the same External attribute', async () => {
  await assert.rejects(authenticateInstalledGuiCatalogs(input(
    'external="TriggerLibs/NativeLib" External="TriggerLibs/Other"')),
  /GUI_CATALOG_EXTERNAL_ATTRIBUTE_AMBIGUOUS/);
});

test('uppercase External cannot hide a missing listed library', async () => {
  await assert.rejects(authenticateInstalledGuiCatalogs(input('External="TriggerLibs/NativeLib"',
    {filesMissing: true})), /GUI_CATALOG_LISTED_SOURCE_MISSING/);
});

test('uppercase External still checks the exact live catalog bytes', async () => {
  await assert.rejects(authenticateInstalledGuiCatalogs(input('External="TriggerLibs/NativeLib"',
    {liveCatalog: catalog.replace('TestAction', 'ChangedAction')})), /GUI_CATALOG_PREPARED_CLOSURE_CHANGED/);
});

test('does not accept an extra prepared catalog outside the live closure', async () => {
  const request = input('External="TriggerLibs/NativeLib"');
  request.dependencyLibraries.push({...request.dependencyLibraries[0]});
  await assert.rejects(authenticateInstalledGuiCatalogs(request), /GUI_CATALOG_PREPARED_CLOSURE_LENGTH/);
});
