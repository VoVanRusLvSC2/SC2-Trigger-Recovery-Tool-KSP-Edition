/** Exercise the relocated authored parser, CST and scoped document together. */
import assert from 'node:assert/strict';
import { arrayValuesSdkRoot, isLocalTriggerSdk, loadAuthoredSdk } from '../src/sdk/runtime.mjs';
import {
  readAuthoredTriggerDocument,
  validateAuthoredReferences,
} from '../src/ast/read-authored.scope.mjs';
import { readAuthoredTriggerDocument as readGeneric } from '../src/utilities/read-authored-trigger-document.mjs';

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
console.log(
  'Authored runtime passed: implicit/explicit scope, SubFunction ownership, colliding library IDs, complete reference inventory and surgical byte preservation.',
);
