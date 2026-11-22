import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { xmlTree } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { xmlTree as otherXmlTree } from '../src/sdk/core/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseImmutableGalaxySyntax } from '../src/conversion/exact-function-signatures/immutable-galaxy-syntax.collections.mjs';
import { parseImmutableGalaxySyntax as parseModelGalaxy } from '../src/model/immutable-galaxy-syntax.collections.mjs';
import { withConversionSyntaxProgram } from '../src/conversion/exact-function-signatures/conversion-syntax-program.collections.mjs';
import { validateGalaxyPair } from '../src/conversion/native-expression-identity/validation.mjs';
import { createGuiCapabilityCatalog } from '../src/bindings/gui-capability-catalog.mjs';
import { createVerifiedConversionProgram } from '../src/conversion/exact-function-signatures/verified-conversion-program.mjs';
import { validateComposedGuiExpressionMarkers } from '../src/conversion/qualified-gui-game-link-calls/composed-expression-contract.scalar-calls.mjs';
import { reifyTypedRemainderTemplates } from '../src/conversion/qualified-gui-game-link-calls/numeric-remainder-templates.scalar-calls.mjs';
import { auditGuiValueReachability } from '../src/verification/gui-value-reachability.mjs';
import { applyTriggerStringsByType } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/trigger-strings.js';
import { bindNativeLibraryDeclaration } from '../src/conversion/shared-native-formal-abi/native-library-declaration-binding.mjs';
import {
  convertGalaxyToTriggers,
  createTriggerConversionContext,
} from '../src/conversion/template-formal-domain/candidate-alternate-2.mjs';
import {
  beginRecoveryParseScope,
  decodeRecoveryBzip2,
  readRecoveryModel,
  readTemplateReplay,
  recoveryTextSha256,
} from '../src/utilities/recovery-parse-scope.mjs';
import {
  createDependencyXmlHandoff,
  parseTriggerXmlSync,
  takePreparedDependencyXml,
} from '../src/conversion/implicit-gui-localization/sax-reader.mjs';
import {
  parseTriggerXmlSync as parseRoleXml,
  readTriggerTreeAndModel,
} from '../src/conversion/implicit-gui-localization/sax-reader-alternate-3.js';
import {
  hasInitializerAdapterCandidate,
  readOnlyOwnedGuiLibraries,
} from '../src/conversion/implicit-gui-localization/read-owned-gui-libraries-alternate.mjs';
import { verifySourceInitializerGuiOwnership } from '../src/conversion/native-expression-identity/source-initializer-gui-ownership.native-action-role.mjs';
import { parseTriggerXmlSync as parseAuthoredXml } from '../src/ast/authored-xml-parser.mjs';
import { parseTriggerXmlSync as parseSdkXml } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/sax-reader.js';
import { parseTriggerXmlSync as parseScopedXml } from '../src/conversion/implicit-gui-localization/sax-reader.js';
import { parseTriggerXmlSync as parsePresetXml } from '../src/conversion/implicit-gui-localization/sax-reader-alternate.js';
import { parseTriggerXmlSync as parseCatalogXml } from '../src/conversion/implicit-gui-localization/sax-reader-alternate-5.js';
import {
  rememberRoleDependency,
  roleDependency,
  withRoleDependencyScope,
} from '../src/conversion/implicit-gui-localization/role-dependency-scope.mjs';

const xml =
  '<TriggerData><Root/><Remark>' + 'Test &amp; '.repeat(25_000) + '</Remark></TriggerData>';
const unshared = xmlTree(xml);
const galaxy = 'void InitMap() {}';
let decodes = 0;
const decode = (bytes, { maxOutputBytes }) => {
  decodes++;
  assert(bytes.length <= maxOutputBytes);
  return new Uint8Array(bytes);
};
const finish = beginRecoveryParseScope();
try {
  const root = xmlTree(xml);
  assert.deepEqual(root, unshared);
  assert.equal(otherXmlTree(xml), root);
  assert.throws(() => root.children.push({}), TypeError);
  assert.throws(() => (root.attributes.new = 'value'), TypeError);
  assert.throws(() => xmlTree(xml.slice(0, -1)));

  const ast = parseImmutableGalaxySyntax(galaxy, 'MapScript.galaxy');
  assert.equal(parseImmutableGalaxySyntax(galaxy, 'MapScript.galaxy'), ast);
  assert.equal(parseModelGalaxy(galaxy, 'MapScript.galaxy'), ast);
  assert.notEqual(parseImmutableGalaxySyntax(galaxy, 'Other.galaxy'), ast);
  assert.notEqual(parseImmutableGalaxySyntax(galaxy + '\n', 'MapScript.galaxy'), ast);
  const replay = (source, expression) => ({ source, expression });
  const replayed = readTemplateReplay('x', true, replay);
  assert.equal(readTemplateReplay('x', true, replay), replayed);
  assert.notEqual(readTemplateReplay('x', false, replay), replayed);
  assert.notEqual(readTemplateReplay('x ', true, replay), replayed);
  assert.notEqual(
    readTemplateReplay('x', true, () => ({})),
    replayed,
  );
  for (const text of [xml, xml + '\r\n', '', 'Сюни 📍', '\ud800']) {
    const expected = createHash('sha256').update(text).digest('hex');
    assert.equal(recoveryTextSha256(text), expected);
    assert.equal(recoveryTextSha256(text), expected);
  }

  const original = Buffer.from([0, 1, 2, 3]);
  const clone = decodeRecoveryBzip2(original.subarray(1), 6, undefined, decode);
  clone[0] = 99;
  assert.deepEqual(
    decodeRecoveryBzip2(new Uint8Array([1, 2, 3]), 6, undefined, decode),
    new Uint8Array([1, 2, 3]),
  );
  assert.equal(decodes, 1);
  assert.throws(() => decodeRecoveryBzip2(original.subarray(1), 2, undefined, decode));
  assert.throws(() => decodeRecoveryBzip2(original.subarray(1), 6, AbortSignal.abort(), decode));
  assert.deepEqual(
    decodeRecoveryBzip2(original.subarray(0, 3), 6, undefined, decode),
    new Uint8Array([0, 1, 2]),
  );
  assert.equal(decodes, 3);

  const parse = (text) => ({ text });
  assert.equal(readRecoveryModel(xml, parse), readRecoveryModel(xml, parse));
  assert.notEqual(readRecoveryModel(xml, parse, 'Map'), readRecoveryModel(xml, parse, 'Other'));
  assert.notEqual(readRecoveryModel(xml, parse), readRecoveryModel(xml + '\n', parse));
  assert.notEqual(
    readRecoveryModel(xml, parse),
    readRecoveryModel(xml, (text) => ({ text })),
  );
  const large = 'x'.repeat(13 * 1024 ** 2);
  const smallModel = readRecoveryModel(xml, parse);
  const largeModel = readRecoveryModel(large, parse, 'Map');
  assert.equal(readRecoveryModel(large, parse, 'Map'), largeModel);
  assert.notEqual(readRecoveryModel(large, parse, 'Other'), largeModel);
  assert.notEqual(readRecoveryModel(large, parse, 'Map'), largeModel);
  assert.equal(readRecoveryModel(xml, parse), smallModel);
  const largeXml = '<TriggerData><!--' + large + '--><Root/></TriggerData>';
  const largeRoot = xmlTree(largeXml);
  assert.equal(xmlTree(xml), root);
  assert.equal(xmlTree(largeXml), largeRoot);
  assert(Object.isFrozen(largeRoot));

  const largeGalaxy = '//' + 'a'.repeat(600_000) + '\n' + galaxy;
  const largeAst = parseImmutableGalaxySyntax(largeGalaxy, 'MapScript.galaxy');
  assert.equal(parseImmutableGalaxySyntax(largeGalaxy, 'MapScript.galaxy'), largeAst);
  const alias = parseImmutableGalaxySyntax(largeGalaxy, 'Other.galaxy');
  assert.notEqual(alias, largeAst);
  assert.equal(alias.fileName, 'Other.galaxy');
  assert.notEqual(parseImmutableGalaxySyntax(largeGalaxy + '\n', 'MapScript.galaxy'), largeAst);
} finally {
  finish();
}
assert.notEqual(xmlTree(xml), xmlTree(xml));
assert.equal(Object.isFrozen(xmlTree(xml)), false);
assert.notEqual(parseImmutableGalaxySyntax(galaxy), parseImmutableGalaxySyntax(galaxy));
decodeRecoveryBzip2(new Uint8Array([1, 2, 3]), 6, undefined, decode);
assert.equal(decodes, 4);

const library = '<TriggerData><Library Id="Library"><Root/></Library></TriggerData>';
for (const parse of [
  parseTriggerXmlSync,
  parseRoleXml,
  parseAuthoredXml,
  parseSdkXml,
  parseScopedXml,
  parsePresetXml,
  parseCatalogXml,
]) {
  const withSource = parse(library);
  assert.equal(withSource.get('Library').xmlSource.raw, library);
  delete withSource.get('Library').xmlSource;
  assert.deepEqual(parse(library, { retainSource: false }), withSource);
  assert.throws(
    () => parse(library.replace('Id="Library"', 'Id="Bad-Id"'), { retainSource: false }),
    /ASCII identifier/,
  );
  assert.throws(() => parse(library.replace('</Library>', ''), { retainSource: false }));

  const standard =
    '<TriggerData><Standard Id="Map"/><Root/><Element Type="FunctionDef" Id="AAAAAAAA">' +
    '<Identifier>Text &amp; Label</Identifier><ScriptCode><![CDATA[return;]]></ScriptCode>' +
    '</Element></TriggerData>';
  const mixed = standard.replace(
    '</TriggerData>',
    '<Library Id="Other"><Root/></Library></TriggerData>',
  );
  for (const document of [standard, mixed]) {
    const model = parse(document);
    for (const value of model.values()) delete value.xmlSource;
    assert.deepEqual(parse(document, { retainSource: false }), model);
  }
  assert.throws(() => parse(standard.replace(']]>', ']>'), { retainSource: false }));
  assert.throws(() => parse(standard + '<TriggerData/>', { retainSource: false }));
}
const rootLabel = '<Element Type="Label" Id="A"><Identifier>A &amp; B</Identifier></Element>';
const nestedLibrary = '<Library Id="Nested"><Root/>' + rootLabel + '</Library>';
const crossLibraryCall =
  '<Element Type="FunctionCall" Id="Call"><FunctionDef Type="FunctionDef" Library="Nested" Id="C"/>' +
  '<Remark><![CDATA[first <]]><!-- join -->&amp; last</Remark></Element>';
for (const body of [
  '<Root/>' + rootLabel + crossLibraryCall,
  nestedLibrary + '<Root/>' + rootLabel + crossLibraryCall,
  '<Root/>' + rootLabel + nestedLibrary + crossLibraryCall,
  nestedLibrary,
]) {
  const document = '<TriggerData>' + body + '</TriggerData>';
  const input =
    body === nestedLibrary
      ? document
      : document.replace('<TriggerData>', '<TriggerData><Standard Id="Main"/>');
  const { root, libraries } = readTriggerTreeAndModel(document, 'Main');
  assert.deepEqual(root, xmlTree(document));
  assert.deepEqual(libraries, parseRoleXml(input, { retainSource: false }));
  assert.throws(() => readTriggerTreeAndModel(document.slice(0, -5), 'Main'));
}
for (const body of ['<Root/>' + rootLabel, nestedLibrary + '<Root/>' + rootLabel]) {
  assert.deepEqual(
    readOnlyOwnedGuiLibraries('<TriggerData>' + body + '</TriggerData>', 'Main'),
    parseRoleXml('<TriggerData><Standard Id="Main"/>' + body + '</TriggerData>', {
      retainSource: false,
    }),
  );
}
assert.throws(
  () => readOnlyOwnedGuiLibraries('<TriggerData>' + rootLabel.repeat(2) + '</TriggerData>'),
  /GUI_TYPED_ELEMENT_DUPLICATED/,
);
const verifyAdapter = (after, before = '') =>
  verifySourceInitializerGuiOwnership({ input: { script: galaxy }, after, before });
const functionXml = (fields) =>
  '<TriggerData><Root/><Element Type="FunctionDef" Id="constructor">' +
  fields +
  '</Element></TriggerData>';
const noAdapter = functionXml('<ScriptCode>return;</ScriptCode>');
assert.deepEqual(verifyAdapter(noAdapter).records, []);
for (const fields of [
  '<ScriptCode><![CDATA[#SUBFUNCS(actions)]]></ScriptCode>',
  '<FlagEvent/><ScriptCode>return;</ScriptCode>',
  '<FlagSubFunctions/><ScriptCode>return;</ScriptCode>',
]) {
  const after = functionXml(fields);
  const end = beginRecoveryParseScope();
  try {
    const view = readOnlyOwnedGuiLibraries(after, 'Map');
    view.clear();
    assert.equal(hasInitializerAdapterCandidate(after, 'Map'), true);
    assert.throws(() => verifyAdapter(after), /INITIALIZER_GUI_ADAPTER_FLAGS/);
  } finally {
    end();
  }
}
assert.throws(
  () => verifyAdapter('<TriggerData>' + rootLabel.repeat(2) + '</TriggerData>'),
  /GUI_TYPED_ELEMENT_DUPLICATED/,
);
const handoff = createDependencyXmlHandoff();
assert.deepEqual([...handoff.libraryIds(library)], ['Library']);
assert.equal(takePreparedDependencyXml({}, library), undefined);
assert.equal(takePreparedDependencyXml(handoff.token, library + '\n'), undefined);
assert.deepEqual(
  takePreparedDependencyXml(handoff.token, library),
  parseTriggerXmlSync(library, { retainSource: false }),
);
assert.equal(takePreparedDependencyXml(handoff.token, library), undefined);

const roleXml =
  '<TriggerData><Library Id="Library"><Root/><Element Type="FunctionDef" Id="AAAAAAAA">' +
  '<SubFunctionType Type="SubFuncType" Library="Library" Id="BBBBBBBB"/>' +
  '</Element></Library></TriggerData>';
withRoleDependencyScope(() => {
  const semantic = parseTriggerXmlSync(roleXml, { retainSource: false });
  rememberRoleDependency(roleXml, semantic);
  assert.deepEqual(roleDependency(roleXml), parseRoleXml(roleXml, { retainSource: false }));

  const missingOwner = roleXml.replace(' Library="Library"', '');
  rememberRoleDependency(missingOwner, parseTriggerXmlSync(missingOwner, { retainSource: false }));
  assert.equal(roleDependency(missingOwner), undefined);
});
assert.equal(roleDependency(roleXml), undefined);
await withConversionSyntaxProgram(undefined, () => {
  for (const text of [
    'void InitMap() {}',
    'void InitMap( {',
    'Value g; void InitMap() { g = 1; }',
  ]) {
    const primary = [{ fileName: 'MapScript.galaxy', text }];
    for (const declarations of [[], [{ fileName: 'Types.galaxy', text: 'typedef int Value;' }]]) {
      assert.deepEqual(
        validateGalaxyPair(primary, declarations, true, true),
        validateGalaxyPair(primary, declarations, true),
      );
    }
  }
});
const firstDef = { type: 'FunctionDef', id: 'AAAA', library: 'Lib' };
const secondDef = { ...firstDef };
const catalog = createGuiCapabilityCatalog([
  [
    'Lib',
    {
      elements: { firstDef, secondDef },
      elementsByType: { FunctionDef: { firstDef, secondDef } },
    },
  ],
]);
assert.deepEqual(catalog.issues, [
  { kind: 'AMBIGUOUS_TYPED_GUI_ELEMENT', owner: 'Lib', type: 'FunctionDef', id: 'AAAA' },
]);
assert.equal(catalog.resolve(firstDef), undefined);
const structure = { type: 'Structure', id: 'Storage', library: 'Lib' };
const structParam = {
  type: 'ParamDef',
  id: 'Formal',
  paramType: { type: 'struct', typeElement: structure },
};
const eventRole = { type: 'SubFuncType', id: 'Role', isEvent: true };
const container = {
  type: 'FunctionDef',
  id: 'Container',
  flags: ['Action', 'SubFunctions'],
  subFunctionTypes: [eventRole],
};
const capabilities = createGuiCapabilityCatalog([
  ['Lib', { elements: { structure, structParam, eventRole, container } }],
]);
assert.equal(capabilities.implicitEventContainer('Lib').definition, container);
assert.equal(capabilities.structureFormals[0].structure, structure);
const stockOwner = { id: 'Ntve' };
const valueOwner = { id: 'Lib' };
const native = (library, role, returnType = 'int') => ({
  library,
  key: library.id,
  symbol: 'RuntimeNative',
  origin: 'emitted',
  definition: {
    name: 'RuntimeNative',
    flags: ['Native', role],
    parameters: [],
    returnType,
  },
});
const nativeQuery = {
  name: 'RuntimeNative',
  guiUse: 'value',
  declaration: { parameters: [], returnType: 'int' },
};
const resolveNativeRole = (entries, query = nativeQuery) =>
  bindNativeLibraryDeclaration(
    {
      libraries: new Map([['Ntve', stockOwner]]),
      bySymbol: new Map([['RuntimeNative', entries]]),
      carrier: (type) => type,
    },
    query,
    { status: 'AMBIGUOUS', candidateKeys: entries.map((entry) => entry.key) },
    'Ntve',
  );
const nativeAction = native(stockOwner, 'Action');
const nativeValue = native(valueOwner, 'Call');
assert.equal(resolveNativeRole([nativeAction, nativeValue]).definition, nativeValue.definition);
assert.equal(
  resolveNativeRole([nativeAction, nativeValue], { ...nativeQuery, guiUse: 'action' }).definition,
  nativeAction.definition,
);
assert.equal(
  resolveNativeRole([nativeAction, native(valueOwner, 'Call', 'bool')]).status,
  'AMBIGUOUS',
);
assert.equal(
  resolveNativeRole([nativeAction, nativeValue, native({ id: 'Other' }, 'Call')]).status,
  'AMBIGUOUS',
);
const localizedParam = { name: 'GalaxyName', grammar: '#preserved' };
const rootParam = {};
applyTriggerStringsByType(
  'Lib',
  { Param: { Local: localizedParam, RootOnly: rootParam } },
  new Map([
    ['ParamValue:Lib_Local', ''],
    ['ParamValue:Root:Local', 'root value'],
    ['Param:Lib_Local', 'Localized'],
    ['Param:Root:Local', 'root display'],
    ['Grammar:Param:Lib_Local', '#ignored'],
    ['ParamValue:Root:RootOnly', ' '],
    ['Grammar:Param:Root:RootOnly', '#root'],
    ['Param:Root:RootOnly', 'Root label'],
  ]),
);
assert.deepEqual(localizedParam, {
  name: 'GalaxyName',
  grammar: '#preserved',
  localizedValue: '',
  displayName: 'Localized',
});
assert.deepEqual(rootParam, {
  localizedValue: ' ',
  grammar: '#root',
  grammarSource: 'strings',
  displayName: 'Root label',
  name: 'Root label',
});
const numericMarker = (id, expressionCode) => ({
  type: 'Param',
  id,
  expressionCode,
  valueType: { type: 'int' },
  value: '5',
});
const left = numericMarker('Left', 'left');
const right = numericMarker('Right', 'right');
const operandRef = (id) => ({ type: 'Param', id });
const parentExpression = {
  type: 'Param',
  id: 'Expression',
  expressionType: 'int',
  expressionText: '(~left~ % ~right~)',
  expressionParams: [operandRef(left.id), operandRef(right.id)],
};
const validateMarkers = (elements, dependencies) =>
  validateComposedGuiExpressionMarkers(new Map([['Map', { elements }]]), dependencies);
assert.deepEqual(
  validateMarkers({ left }).issues.map(({ code }) => code),
  ['UNPROVEN_GUI_EXPRESSION_MARKER'],
);
assert.deepEqual(
  validateMarkers({}, new Map([['Lib', { elements: { firstDef, secondDef } }]])).issues.map(
    ({ code }) => code,
  ),
  ['DUPLICATE_ELEMENT_IDENTITY'],
);
assert.equal(validateMarkers({ left, right, parentExpression }).valid, true);
assert(
  validateMarkers({
    left,
    right,
    parentExpression,
    alias: { type: 'Variable', id: 'Alias', initialValue: operandRef(left.id) },
  }).issues.some(({ code }) => code === 'GUI_EXPRESSION_SLOT_NOT_EXCLUSIVE'),
);
const expressionElements = { left, right, parentExpression };
const rootAlias = validateComposedGuiExpressionMarkers(
  new Map([['Map', { elements: expressionElements, rootRefs: [operandRef(left.id)] }]]),
);
assert(rootAlias.issues.some(({ code }) => code === 'GUI_EXPRESSION_SLOT_NOT_EXCLUSIVE'));
const foreignAlias = validateComposedGuiExpressionMarkers(
  new Map([
    ['Map', { elements: expressionElements }],
    [
      'Other',
      {
        elements: {
          alias: {
            type: 'Variable',
            id: 'Alias',
            initialValue: { ...operandRef(left.id), library: 'Map' },
          },
        },
      },
    ],
  ]),
);
assert(foreignAlias.issues.some(({ code }) => code === 'GUI_EXPRESSION_SLOT_NOT_EXCLUSIVE'));
assert.deepEqual(reifyTypedRemainderTemplates({ left }, 'Map', []), {
  changed: false,
  roots: [],
  changes: [],
  trace: [],
});
const formals = ['left', 'right'].map((name) => ({
  type: 'ParamDef',
  id: 'Formal_' + name,
  name,
  paramType: { type: 'int' },
}));
const typedRef = ({ type, id }) => ({ type, id });
const remainder = {
  type: 'FunctionDef',
  id: 'Remainder',
  flags: ['Call', 'Operator'],
  returnType: { type: 'int' },
  parameters: formals.map(typedRef),
  scriptCode: '#PARAM(left) % #PARAM(right)',
};
const argumentsGui = formals.map((formal) => ({
  type: 'Param',
  id: 'Argument_' + formal.name,
  parameterDef: typedRef(formal),
  valueType: { type: 'int' },
  value: '5',
}));
const call = {
  type: 'FunctionCall',
  id: 'RemainderCall',
  functionDef: typedRef(remainder),
  parameters: argumentsGui.map(typedRef),
};
const owner = {
  type: 'Param',
  id: 'Owner',
  valueType: { type: 'int' },
  functionCall: typedRef(call),
};
const complete = Object.fromEntries(
  [remainder, ...formals, ...argumentsGui, call, owner].map((element) => [element.id, element]),
);
assert.equal(reifyTypedRemainderTemplates(complete, 'Map', [typedRef(remainder)]).changed, true);
assert.equal(validateMarkers(complete).valid, true);
const referenceProgram = createVerifiedConversionProgram([
  {
    fileName: 'Reference.galaxy',
    text: 'struct Point { int x; }; void Read(structref<Point> p) {} void Init() { Read(1); }',
    owned: true,
  },
]);
try {
  assert(referenceProgram.report().diagnostics.some((d) => d.code === 'REFERENCE_REQUIRES_LVALUE'));
} finally {
  referenceProgram.dispose();
}
const detached =
  '<TriggerData><Root/><Element Type="Param" Id="AAAA"><Value>5</Value></Element></TriggerData>';
const preserved = auditGuiValueReachability({ xml: detached, existingXml: detached });
assert.equal(preserved.passed, true);
assert.equal(preserved.preservedOrphans.length, 1);
const introduced = auditGuiValueReachability({ xml: detached });
assert.equal(introduced.passed, false);
assert.deepEqual(introduced.issues, [
  { ...preserved.preservedOrphans[0], reason: 'NEW_UNREACHABLE_GUI_VALUE' },
]);
const modified = auditGuiValueReachability({
  xml: detached.replace('>5<', '>6<'),
  existingXml: detached,
});
assert.equal(modified.passed, false);
assert.notEqual(modified.issues[0].sourceSha256, introduced.issues[0].sourceSha256);
const dependency = (id) => ({
  triggerData:
    `<TriggerData><Library Id="${id}"><Root/>` +
    '<Element Type="Label" Id="AAAA"><Identifier>Имя 📍</Identifier></Element>' +
    '</Library></TriggerData>',
});
const boundedInput = {
  documentKind: 'map',
  libraryId: 'Map',
  script: galaxy,
  header: '',
  dependencyLibraries: [dependency('First'), dependency('Second')],
};
await assert.rejects(
  convertGalaxyToTriggers({ ...boundedInput, limits: { maxTotalElements: 1 } }),
  /Trigger semantic model exceeds maxTotalElements \(2 > 1\)/u,
);
const firstDocument = boundedInput.dependencyLibraries[0].triggerData;
await assert.rejects(
  convertGalaxyToTriggers({
    ...boundedInput,
    limits: { maxDependencyBytes: Buffer.byteLength(firstDocument, 'utf8') - 1 },
  }),
  /dependencyLibraries\[0\]\.triggerData.*UTF-8 bytes/u,
);
const context = createTriggerConversionContext({ maxDependencyCacheEntries: 4 });
try {
  for (const value of ['\ufffd', '\ud800', '\ufffd', '\ud800', '\udbff']) {
    await convertGalaxyToTriggers({
      ...boundedInput,
      conversionContext: context,
      dependencyLibraries: [
        { ...dependency('First'), triggerStrings: 'Label/Name/lib_First_AAAA=' + value },
      ],
    });
  }
  const { hits, misses, entries } = context.stats();
  assert.deepEqual({ hits, misses, entries }, { hits: 2, misses: 3, entries: 3 });
} finally {
  context.clear();
}
console.log('Recovery parse reuse passed: cache lifetime, source identity and immutable results.');
