/** Focused restoration checks; these do not replace the external map benchmark. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Parser, SyntaxKind as K } from '../src/sdk/core/modules/galaxy/language-core/index.js';
import { xmlTree } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { normalizeVerifiedNativeIncludes } from '../src/utilities/native-include-proof.mjs';
import { nativeAttributeGuiSchema, restoreAttributeGui } from '../src/utilities/attribute-gui.mjs';
import { quoteAttributeLiterals } from '../src/utilities/attribute-literal-quotes.canonical-only.mjs';
import { policies, makeAttributes } from '../src/utilities/attributes-policy.mjs';
import { nondecimalLiteralParam } from '../src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/nondecimal-literal.js';
import { hasContinueTargetingBody } from '../src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/legacy-native-while-template.js';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const components = JSON.parse(
  await readFile(new URL('./recovered-components.json', import.meta.url)),
);
for (const row of components.files)
  assert.equal(
    sha(await readFile(new URL('../' + row.file, import.meta.url))),
    row.publishedSha256,
  );
const parse = (text, name = 'fixture.galaxy') => {
  const source = new Parser().parseFile(name, text);
  assert.equal(source.parseDiagnostics.length, 0, text);
  return source;
};
for (const token of ['0xFF', '0X3bd00', '-0X3bd00', '01777777', '-01777777', '00']) {
  const node = parse(`int x = ${token};`).statements[0].initializer;
  assert.deepEqual(nondecimalLiteralParam(node), { scriptCode: token, valueType: { type: 'int' } });
}
for (const token of ['0', '255', '-255', '1.0'])
  assert.equal(
    nondecimalLiteralParam(parse(`int x = ${token};`).statements[0].initializer),
    undefined,
  );

const body = (code) => parse(`void f() { ${code} }`).statements[0].body;
assert(hasContinueTargetingBody(body('if (true) { continue; }')));
assert(!hasContinueTargetingBody(body('while (true) { continue; }')));
assert(!hasContinueTargetingBody(body('for (;;) { continue; }')));
assert(hasContinueTargetingBody(body('while (true) { continue; } continue;')));

const nativeText = 'include "TriggerLibs/natives"; native void A();';
const declarations = [
  { fileName: 'TriggerLibs/NativeLib.galaxy', text: nativeText },
  { fileName: 'TriggerLibs/natives.galaxy', text: 'const int c = 2; native void B();' },
];
const nativeProof = { readLive: true, sha256: sha(nativeText) };
const input = parse(
  'include "TriggerLibs/natives"; include "TriggerLibs/NativeLib"; include "TriggerLibs/NativeLib"; include "TriggerLibs/natives"; include "Owned/Game"; void InitMap() { A(); }',
);
const originalStatements = input.statements.slice();
const before = JSON.stringify(input, (key, value) => (key === 'parent' ? undefined : value));
const normalized = normalizeVerifiedNativeIncludes(input, K, {
  declarations,
  nativeProof,
  parseGalaxy: parse,
});
assert.equal(normalized.notes.length, 3);
assert.equal(normalized.source.statements.length, input.statements.length - 3);
assert.equal(
  JSON.stringify(input, (key, value) => (key === 'parent' ? undefined : value)),
  before,
  'Normalization must not edit the source AST',
);
originalStatements.forEach((node, index) => assert.equal(input.statements[index], node));
assert.equal(normalized.source.statements.at(-1), input.statements.at(-1));
assert.equal(normalizeVerifiedNativeIncludes(input, K).source, input);
assert(
  normalizeVerifiedNativeIncludes(input, K, {
    declarations,
    nativeProof: { ...nativeProof, sha256: 'wrong' },
    parseGalaxy: parse,
  }).refused,
);
assert(
  normalizeVerifiedNativeIncludes(input, K, {
    declarations: [...declarations, { ...declarations[0], text: 'native void Other();' }],
    nativeProof,
    parseGalaxy: parse,
  }).refused,
);
const effectful = normalizeVerifiedNativeIncludes(input, K, {
  declarations: [declarations[0], { ...declarations[1], text: 'int c = B();' }],
  nativeProof,
  parseGalaxy: parse,
});
assert.equal(
  effectful.source.statements[0],
  input.statements[0],
  'An effectful leading include cannot be moved',
);

const nativeXml = `<TriggerData><Library Id="Ntve">
<Element Type="FunctionDef" Id="G"><Identifier>GameAttributeGameValue</Identifier><FlagNative/><Parameter Type="ParamDef" Id="GP"/></Element>
<Element Type="ParamDef" Id="GP"><ParameterType><Type Value="attributegame"/></ParameterType></Element>
<Element Type="FunctionDef" Id="P"><Identifier>GameAttributePlayerValue</Identifier><FlagNative/><Parameter Type="ParamDef" Id="PP"/></Element>
<Element Type="ParamDef" Id="PP"><ParameterType><Type Value="attributeplayer"/></ParameterType></Element>
<Element Type="FunctionDef" Id="C"><Identifier>Comparison</Identifier><FlagOperator/><Parameter Id="L"/><Parameter Id="O"/><Parameter Id="R"/></Element>
</Library></TriggerData>`;
const schema = nativeAttributeGuiSchema(nativeXml, xmlTree);
assert.throws(
  () => nativeAttributeGuiSchema(nativeXml.replace('<FlagNative/>', ''), xmlTree),
  /not native/,
);
const attributes = { attributes: [{ id: '1', type: 'Global', values: [{ id: '2' }] }] };
const triggerXml = `<TriggerData><Standard Id="Map"/><!-- keep authored layout -->
<Element Type="FunctionCall" Id="A"><FunctionDef Library="Ntve" Id="G"/><Parameter Type="Param" Id="AP"/></Element>
<Element Type="Param" Id="AP"><ParameterDef Library="Ntve" Id="GP"/><ValueType Type="string"/><Value>1</Value></Element>
<Element Type="FunctionCall" Id="CMP"><FunctionDef Library="Ntve" Id="C"/><Parameter Type="Param" Id="LP"/><Parameter Type="Param" Id="RP"/></Element>
<Element Type="Param" Id="LP"><ParameterDef Library="Ntve" Id="L"/><FunctionCall Type="FunctionCall" Id="A"/></Element>
<Element Type="Param" Id="RP"><ParameterDef Library="Ntve" Id="R"/><ValueType Type="string"/><Value>0002</Value></Element>
</TriggerData>`;
const restored = restoreAttributeGui({ triggerXml, attributes, schema, parseXml: xmlTree });
assert.equal(restored.attributeParameters, 1);
assert.equal(restored.valueParameters, 1);
assert(restored.triggerXml.includes('<!-- keep authored layout -->'));
assert(restored.triggerXml.includes('<Value>1|0002</Value>'));
assert.equal(
  restoreAttributeGui({ triggerXml: restored.triggerXml, attributes, schema, parseXml: xmlTree })
    .changes.length,
  0,
);
assert.throws(
  () =>
    restoreAttributeGui({
      triggerXml: triggerXml.replace(
        '</TriggerData>',
        '<Element Type="FunctionCall" Id="OTHER"><Parameter Type="Param" Id="AP"/></Element></TriggerData>',
      ),
      attributes,
      schema,
      parseXml: xmlTree,
    }),
  /Shared parameter/,
);
const foreign = triggerXml.replace('<Value>1</Value>', '<Value>[bnet:Other]1</Value>');
assert.equal(
  restoreAttributeGui({ triggerXml: foreign, attributes, schema, parseXml: xmlTree }).triggerXml,
  foreign,
);
const quoted = quoteAttributeLiterals({
  triggerXml: restored.triggerXml,
  attributes,
  parseXml: xmlTree,
});
assert.equal(quoted.changes.length, 2);
assert(quoted.triggerXml.includes('&quot;1|0002&quot;'));
assert.equal(
  quoteAttributeLiterals({ triggerXml: quoted.triggerXml, attributes, parseXml: xmlTree })
    .triggerXml,
  quoted.triggerXml,
);
const existingForeign =
  '<TriggerData><Element Type="Param" Id="Q"><ValueType Type="attributeplayer"/><Value>&quot;1&quot;</Value></Element></TriggerData>';
assert.equal(
  quoteAttributeLiterals({ triggerXml: existingForeign, attributes, parseXml: xmlTree }).triggerXml,
  existingForeign,
);
assert.throws(
  () =>
    quoteAttributeLiterals({
      triggerXml: restored.triggerXml.replace('1|0002', '1|0003'),
      attributes,
      parseXml: xmlTree,
    }),
  /Unknown attribute value/,
);

// Only the original explicit historical alias remains enabled; labels alone
// must never grant another input permission to synthesize test defaults.
assert.deepEqual(
  policies.flatMap((p) => (p.archivedAliases ?? []).map((alias) => [alias, p.id])),
  [['previous13-0001', '0001']],
);
for (const policy of policies) {
  const labels = [
    {
      values: policy.attributes.flatMap((a) => [
        `Attribute${a.id.padStart(3, '0')}/Name=Label`,
        `Attribute${a.id.padStart(3, '0')}/Value00${a.defaultId}/Name=Choice`,
      ]),
    },
  ];
  const model = makeAttributes(policy, labels);
  assert.equal(model.attributes.length, policy.attributes.length);
  model.attributes.forEach((a, i) =>
    assert.equal(a.defaults.length, policy.attributes[i].slots.length),
  );
  assert.throws(() => makeAttributes(policy, []), /Missing name/);
}
console.log(
  'Restored helper checks passed: literals, loop targeting, native include proofs, scoped attribute GUI/quoting and explicit test-policy scope.',
);
console.log(
  'Full converter execution, live game-data schema and map equivalence remain separate gates.',
);
