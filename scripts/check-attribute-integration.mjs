/** Qualify the three attribute contracts with real NativeLib and the pinned
 * independent oracle. These small fixtures do not certify a complete map. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { nativeAttributeGuiSchema, restoreAttributeGui } from '../src/utilities/attribute-gui.mjs';
import { quoteAttributeLiterals } from '../src/utilities/attribute-literal-quotes.canonical-only.mjs';
import { restoreAttributeDisplayText } from '../src/recovery/repairs/attribute-display-fixed.mjs';
import { xmlTree } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import {
  readAttributes,
  writeAttributes,
} from '../src/sdk/array-values/modules/map/shared/format/formats/attributes.js';
import { auditAttributeRecovery } from '../src/conversion/exact-function-signatures/attribute-recovery-gate.indexed.mjs';
const option = (name, fallback) => {
  const at = process.argv.indexOf(name),
    value = at < 0 ? fallback : process.argv[at + 1];
  assert(typeof value === 'string' && value && !value.startsWith('--'), name + ' is required');
  return value;
};
const nativeRoot = option('--native-root', process.env.SC2_TRIGGER_NATIVE_ROOT);
const benchmarkRoot = option('--benchmark-root', process.env.SC2_TRIGGER_BENCHMARK_ROOT);
const nativeXml = await readFile(path.join(nativeRoot, 'NativeLib.TriggerLib'), 'utf8');
const schema = nativeAttributeGuiSchema(nativeXml, xmlTree);
const binding = schema.bindings.find((b) => b.attributeType === 'Global');
assert(binding);
const originalXml = `<Attributes><Attribute><Id Value="1"/><Type Value="Global"/><Name Value="Attribute001/Name"/><Availability Value="All"/><Visibility Value="All"/><Access Value="Host"/>
<Value><Id Value="2"/><Name Value="Attribute001/Value002/Name"/></Value><Value><Id Value="4"/><Name Value="Attribute001/Value004/Name"/></Value>
<Default><Slot Id="Global"/><Value Id="4"/></Default><PreserveUnknown Value="yes"/></Attribute></Attributes>`;
const model = readAttributes(originalXml);
assert.equal(model.attributes[0].defaults[0].children[1].attributes.Id, '4');
const candidateXml = writeAttributes(model);
const gui = `<TriggerData><Standard Id="Map"/><Element Type="FunctionCall" Id="A"><FunctionDef Library="${binding.libraryId}" Id="${binding.functionDefId}"/><Parameter Type="Param" Id="P"/></Element>
<Element Type="Param" Id="P"><ParameterDef Library="${binding.libraryId}" Id="${binding.firstParamId}"/><ValueType Type="string"/><Value>1</Value></Element></TriggerData>`;
const typed = restoreAttributeGui({
  triggerXml: gui,
  attributes: model,
  schema,
  parseXml: xmlTree,
});
const quoted = quoteAttributeLiterals({
  triggerXml: typed.triggerXml,
  attributes: model,
  parseXml: xmlTree,
});
const display = restoreAttributeDisplayText({
  triggerXml: quoted.triggerXml,
  attributes: model,
  schema,
  parseXml: xmlTree,
  localizedStrings: [
    {
      path: 'enUS.SC2Data/LocalizedData/GameStrings.txt',
      values: [
        'Attribute001/Name=Difficulty',
        'Attribute001/Value002/Name=Easy',
        'Attribute001/Value004/Name=Hard',
      ],
    },
  ],
});
const scripts = [
  {
    fileName: 'MapScript.galaxy',
    text: 'string gf_Difficulty() { return GameAttributeGameValue("1"); }',
  },
];
const input = {
  referenceModel: model,
  referenceOrigin: 'ORIGINAL',
  candidateXml,
  triggerXml: display.triggerXml,
  parseXml: xmlTree,
  schema,
  originalScripts: scripts,
  candidateScripts: scripts,
  sourceDocumentInfo: '<DocInfo/>',
  candidateDocumentInfo: '<DocInfo/>',
  benchmarkRoot,
};
const positive = await auditAttributeRecovery(input);
assert(positive.passed, JSON.stringify(positive.issues));
assert(positive.documents.originalLobbyPreserved);
assert(positive.runtime.applicable && positive.runtime.passed);
assert.equal(positive.gui.ownedCalls, 1);
assert.equal(positive.wholeMapAccepted, false);
const defaultChanged = await auditAttributeRecovery({
  ...input,
  candidateXml: candidateXml.replace('<Value Id="4"/>', '<Value Id="2"/>'),
});
assert(
  !defaultChanged.passed,
  'A changed lobby default must fail independently of unchanged Galaxy',
);
const codeChanged = await auditAttributeRecovery({
  ...input,
  candidateScripts: [
    { fileName: scripts[0].fileName, text: scripts[0].text.replace('("1")', '("2")') },
  ],
});
assert(!codeChanged.passed && !codeChanged.runtime.passed, 'Changed runtime selectors must fail');
const typeLost = await auditAttributeRecovery({
  ...input,
  triggerXml: display.triggerXml.replace('Type="attributegame"', 'Type="string"'),
});
assert(!typeLost.passed && !typeLost.gui.passed, 'Lost GUI selector types must fail');
const foreign = await auditAttributeRecovery({
  ...input,
  triggerXml: display.triggerXml.replace('&quot;1&quot;', '&quot;[bnet:local/0.0/999]1&quot;'),
});
assert(
  !foreign.passed && !foreign.externalOwnersVerified,
  'Unproven external owners must stay REVIEW',
);
assert(candidateXml.includes('PreserveUnknown'));
console.log(
  JSON.stringify({
    passed: true,
    cases: 5,
    defaultToken: '0004',
    originalUnknownFieldsPreserved: true,
    benchmark: positive.benchmark,
    wholeMapAccepted: false,
    editorVerified: false,
  }),
);
