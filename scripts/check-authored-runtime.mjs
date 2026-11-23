/** Exercise the relocated authored parser, CST and scoped document together. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { arrayValuesSdkRoot, isLocalTriggerSdk, loadAuthoredSdk } from '../src/sdk/runtime.mjs';
import {
  readAuthoredTriggerDocument,
  validateAuthoredReferences,
} from '../src/ast/read-authored.scope.mjs';
import { readAuthoredTriggerDocument as readGeneric } from '../src/utilities/read-authored-trigger-document.mjs';
import { parseGalaxySource } from '../src/conversion/runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
import { syntaxShape } from '../src/conversion/native-expression-identity/balanced-script-template-alternate.mjs';
import * as model from '../src/ast/explicit-numeric-global-model.mjs';
import {
  assertRuntimeIdentifiersEmitted,
  prepareRuntimeIdentifierProbe,
  reconcileAuthoredRuntimeIdentifiers,
} from '../src/conversion/exact-function-signatures/authored-runtime-identifiers.mjs';
import {
  restoreOwnedSourceIncludePrefix,
  sourceIncludePrefixIndex,
  verifiedIncludePrefixForLibrary,
  verifyPreservedSourceIncludes,
} from '../src/conversion/exact-function-signatures/preserved-source-includes.exact-inputs.mjs';
import { xmlTree } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { transferOwnedTriggerStorage } from '../src/conversion/native-expression-identity/owned-trigger-storage-transfer.transaction-alternate.mjs';
import { verifyOwnedTriggerStorageTransfer } from '../src/conversion/native-expression-identity/owned-trigger-storage-transfer.transaction.mjs';
import { createNativeGuiSourceInterfaces } from '../src/conversion/dependency-document-root/native-gui-source-interfaces.naming-index.r1820.mjs';

const xml = `<?xml version="1.0"?>
<TriggerData Version="2"><!-- authored bytes stay intact -->
<Root><Item Type="Category" Id="C"/></Root>
<Element Type="Category" Id="C"><Identifier>Original folder</Identifier><Item Type="Variable" Id="V"/><Item Type="FunctionDef" Id="F"/></Element>
<Element Type="Variable" Id="V" Extra="keep"><Identifier>Counter</Identifier><VariableType><Type Value="int"/></VariableType><Value Type="Param" Id="PV"/></Element>
<Element Type="Param" Id="PV"><ValueType Type="int"/><Value>7</Value></Element>
<Element Type="FunctionDef" Id="F"><Identifier>Branch</Identifier><FlagAction/><FlagSubFunctions/><Parameter Type="ParamDef" Id="P"/><SubFunctionType Type="SubFuncType" Id="S"/></Element>
<Element Type="SubFuncType" Id="S"><Identifier>Actions</Identifier><Action/><FunctionDef Type="FunctionDef" Id="F"/></Element>
<Element Type="ParamDef" Id="P"><Identifier>Value</Identifier><ParameterType><Type Value="int"/></ParameterType></Element>
<Library Id="OTHER"><Root><Item Type="Variable" Id="V"/></Root><Element Type="Variable" Id="V"><Identifier>Foreign</Identifier><VariableType><Type Value="int"/></VariableType></Element></Library>
</TriggerData>`;
const runtime = await loadAuthoredSdk();
assert.equal(runtime, await loadAuthoredSdk(arrayValuesSdkRoot));
assert(isLocalTriggerSdk(arrayValuesSdkRoot));
assert(!isLocalTriggerSdk('relative/sdk'));
await assert.rejects(loadAuthoredSdk('relative/sdk'), /absolute directory/);
const scoped = await readAuthoredTriggerDocument(xml);
const generic = await readGeneric(xml, arrayValuesSdkRoot);
for (const result of [scoped, generic]) {
  assert.equal(result.document.raw, xml);
  assert.deepEqual(result.scopeProof, {
    implicitMapRootSupplied: true,
    originalBytesPreserved: true,
    xmlElements: 7,
    parsedElements: 7,
  });
  assert.equal(result.document.libraries.size, 2);
  const map = result.document.libraries.get('Map');
  assert.equal(map.elementsByType.Variable.V.name, 'Counter');
  assert.equal(result.document.libraries.get('OTHER').elementsByType.Variable.V.name, 'Foreign');
  assert.deepEqual(map.elementsByType.FunctionDef.F.subFunctionTypes, [
    { id: 'S', library: undefined, type: 'SubFuncType' },
  ]);
  assert.equal(map.elementsByType.SubFuncType.S.functionDef.id, 'F');
  assert.equal(map.elementsByType.FunctionDef.F.parameters[0].id, 'P');
  assert(validateAuthoredReferences(result.document).valid);
  const edited = result.document.editLeaf('Map', 'Variable', 'V', 'Identifier', 'Updated & local');
  assert.equal(
    edited.text,
    xml.replace('<Identifier>Counter</Identifier>', '<Identifier>Updated &amp; local</Identifier>'),
  );
  assert.equal(result.document.raw, xml, 'A surgical edit must not mutate the authored document');
}
const explicit = xml.replace('<Root>', '<Standard Id="Map"/><Root>');
assert.equal(
  (await readAuthoredTriggerDocument(explicit)).scopeProof.implicitMapRootSupplied,
  false,
);
await assert.rejects(
  readAuthoredTriggerDocument(
    explicit.replace('<Standard Id="Map"/>', '<Standard Id="Map"/><Standard Id="Other"/>'),
  ),
);
await assert.rejects(
  readAuthoredTriggerDocument(xml.replace('<Library Id="OTHER">', '<Library Id="Map">')),
);
const broken = await readAuthoredTriggerDocument(
  xml.replace('<Parameter Type="ParamDef" Id="P"/>', '<Parameter Type="ParamDef" Id="MISSING"/>'),
);
assert(
  !validateAuthoredReferences(broken.document).valid,
  'SubFunction parameter arrays must be validated',
);

const anonymousMarkup = `<TriggerData><Root><Item Type="Variable" Id="00000001"/><Item Type="FunctionDef" Id="00000002"/></Root>
<Element Type="Variable" Id="00000001"><VariableType><Type Value="string"/><Constant/></VariableType></Element>
<Element Type="FunctionDef" Id="00000002"><FlagEvent/><Parameter Type="ParamDef" Id="00000003"/></Element>
<Element Type="ParamDef" Id="00000003"><ParameterType><Type Value="string"/></ParameterType></Element></TriggerData>`;
const parse = (text) => {
  const ast = parseGalaxySource(text, 'runtime-identity.galaxy');
  assert.equal(ast.parseDiagnostics.length, 0);
  return ast;
};
const { document: anonymousDocument } = await readAuthoredTriggerDocument(anonymousMarkup);
const source =
  'const string gv_channel = "scene"; void gf_register(trigger t, string lp_suffix) { TriggerAddEventGeneric(t, gv_channel + lp_suffix); }';
const sourceAst = parse(source);
const emittedAst = parse('');
const probe = prepareRuntimeIdentifierProbe({
  xml: anonymousMarkup,
  sourceAst,
  emittedAst,
  library: anonymousDocument.libraries.get('Map'),
  model,
});
assert.equal(probe.records.length, 2);
const probeAst = parse(
  'const string gv_RecoveryProbe_00000001 = "scene"; void gf_RecoveryProbe_00000002(trigger target, string lp_RecoveryProbe_00000003) { TriggerAddEventGeneric(target, gv_RecoveryProbe_00000001 + lp_RecoveryProbe_00000003); }',
);
const match = (ast) =>
  reconcileAuthoredRuntimeIdentifiers({
    xml: anonymousMarkup,
    sourceAst: ast,
    emittedAst,
    probe,
    probeAst,
    syntaxShape,
  });
const restored = match(sourceAst);
assert.deepEqual(
  restored.proof.records.map(({ type, id, identifier }) => [type, id, identifier]),
  [
    ['Variable', '00000001', 'channel'],
    ['FunctionDef', '00000002', 'register'],
  ],
);
assertRuntimeIdentifiersEmitted(restored.proof, sourceAst, sourceAst, syntaxShape);
assert.deepEqual(restored.proof.records[1].parameters, [
  { id: '00000003', index: 1, identifier: 'lp_suffix' },
]);
assert(!restored.xml.includes('RecoveryProbe'));
const ambiguous = match(
  parse(
    source +
      ' void gf_other(trigger t, string lp_suffix) { TriggerAddEventGeneric(t, gv_channel + lp_suffix); }',
  ),
);
assert.equal(ambiguous.xml, anonymousMarkup, 'Two equal bodies must refuse an ambiguous name');

const include = 'include "scripts/decor.galaxy"';
const native = 'include "TriggerLibs/NativeLib"';
const file = { fileName: 'scripts/decor.galaxy', sha256: 'a'.repeat(64) };
const includePlan = [
  { path: file.fileName, key: file.fileName, sha256: file.sha256 },
  { path: 'TriggerLibs/NativeLib', key: 'triggerlibs/nativelib.galaxy', sha256: 'b'.repeat(64) },
];
const includeInput = {
  input: {
    documentKind: 'map',
    existingTriggerData: anonymousMarkup,
    script: include + '\n' + native,
  },
  files: [file],
  plan: includePlan,
  xml: anonymousMarkup,
  emitted: native,
  xmlTree,
};
const prefix = restoreOwnedSourceIncludePrefix(includeInput);
const { document: includeDocument } = await readAuthoredTriggerDocument(prefix.xml);
const includeLibrary = includeDocument.libraries.get('Map');
const scripts = Object.values(includeLibrary.elements).filter((e) => e.type === 'CustomScript');
assert.deepEqual(verifiedIncludePrefixForLibrary(prefix.token, includeLibrary, scripts).paths, [
  file.fileName,
]);
assert.equal(restoreOwnedSourceIncludePrefix({ ...includeInput, files: [] }), undefined);
assert.equal(
  restoreOwnedSourceIncludePrefix({ ...includeInput, emitted: native + '\n' + include }),
  undefined,
);
const reopened = restoreOwnedSourceIncludePrefix({
  ...includeInput,
  xml: prefix.xml,
  emitted: native + '\n' + include,
});
assert.equal(reopened.xml, prefix.xml);
assert.equal(reopened.token.id, prefix.token.id);
const afterNative = restoreOwnedSourceIncludePrefix({
  ...includeInput,
  input: { ...includeInput.input, script: native + '\n' + include },
  plan: includePlan.toReversed(),
});
assert.equal(afterNative.token.after, 'triggerlibs/nativelib.galaxy');
assert.equal(sourceIncludePrefixIndex(afterNative.token, parse(native).statements), 1);
assert.throws(
  () => sourceIncludePrefixIndex(afterNative.token, parse(native + '\n' + native).statements),
  /SOURCE_INCLUDE_PREFIX_ANCHOR_NOT_UNIQUE/u,
);
assert.throws(() => verifyPreservedSourceIncludes(includePlan, native + '\n' + include));
assert(verifyPreservedSourceIncludes(includePlan, include + '\n' + native).preserved);

const storageFile = { fileName: 'scripts/decor.galaxy', text: 'trigger gt_shared;' };
const storageRoot = { fileName: 'MapScript.galaxy', text: include + '\ntrigger gt_other;' };
const storageInput = {
  root: storageRoot,
  generatedRoot: storageRoot.text,
  guiLibraries: new Map([['Map', { elements: { one: { type: 'Trigger', id: '00000004' } } }]]),
  implicitLibraryId: 'Map',
  ownedSources: [storageFile],
  includeEvidence: [
    {
      from: storageRoot.fileName,
      include: storageFile.fileName,
      path: storageFile.fileName,
      layerId: 'map',
    },
  ],
};
const transfer = transferOwnedTriggerStorage(storageInput);
assert.equal(transfer.proof.records.length, 0);
const verifyStorage = (generatedRoot) =>
  verifyOwnedTriggerStorageTransfer({
    ...storageInput,
    generatedRoot,
    beforeFiles: [storageFile],
    afterFiles: transfer.files,
    candidateRoot: transfer.root,
  });
assert(verifyStorage(storageRoot.text).passed);
const duplicateStorage = storageRoot.text + '\ntrigger gt_shared;';
assert.throws(
  () => transferOwnedTriggerStorage({ ...storageInput, generatedRoot: duplicateStorage }),
  /GUI_TRIGGER_SCRIPT_NAME_REQUIRES_LOCALIZATION/u,
);
assert.throws(() => verifyStorage(duplicateStorage), /CANDIDATE_GLOBAL_STORAGE_CONFLICT/u);

const catalogOwners = ['TEST', 'TST2'];
const dependencyLibraries = catalogOwners.map((id) => ({
  sourcePath: 'Triggers',
  triggerData: `<TriggerData><Library Id="${id}"><Root><Item Type="FunctionDef" Id="00000001"/></Root>
<Element Type="FunctionDef" Id="00000001"><Identifier>Original</Identifier><FlagAction/></Element>
</Library></TriggerData>`,
}));
const pins = dependencyLibraries.map(({ sourcePath, triggerData }, index) => ({
  libraryId: catalogOwners[index],
  path: sourcePath,
  sha256: createHash('sha256').update(triggerData).digest('hex'),
}));
const checkCatalog = (files) =>
  createNativeGuiSourceInterfaces({
    dependencyLibraries,
    sourceDocuments: [{ fileName: 'empty.galaxy', text: '' }],
    verifiedCASCCatalogAuthority: {
      kind: 'VERIFIED_CASC_CATALOG_AUTHORITY',
      files,
      buildIdentity: { buildKey: 'test' },
      provenance: { kind: 'LOADED_DEPENDENCY_CASC_CONTENT_PINS' },
    },
  });
assert.equal(checkCatalog(pins).records.length, 0);
assert.throws(
  () => checkCatalog([{ ...pins[0], sha256: '0'.repeat(64) }, pins[1]]),
  /NATIVE_GUI_CATALOG_PIN_MISMATCH/u,
);
assert.throws(
  () => checkCatalog([{ ...pins[0], sha256: pins[1].sha256 }]),
  /NATIVE_GUI_PIN_LIBRARY_MISSING/u,
);

console.log(
  'Authored runtime passed: implicit/explicit scope, SubFunction ownership, colliding library IDs, complete reference inventory and surgical byte preservation.',
);
