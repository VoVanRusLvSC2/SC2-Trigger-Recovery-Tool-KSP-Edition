/** Check recovered default-token semantics without opening or modifying a map. */
import assert from 'node:assert/strict';
import { decodeAttributeDefaults } from '../src/utilities/cache-attribute-defaults.mjs';
import { attributesFromS2mh, readOptionalS2mh } from '../src/utilities/s2mh-source.mjs';
import { Parser } from '../src/conversion/exact-function-signatures/index-alternate-3.js';
import { recoverObservedAttributes } from '../src/conversion/observed-attribute-recovery.mjs';
import { rebindAttributeGalaxy } from '../src/conversion/observed-attribute-binding.mjs';
import { compareAttributeDocuments } from '../src/conversion/exact-function-signatures/attribute-contract.mjs';

const observe = (source, options) =>
  recoverObservedAttributes(
    new Parser().parseFile('ObservedAttributes.galaxy', source),
    [{ gameStrings: 'Attribute001/Name=Mode\r\nAttribute001/Value001/Name=First choice' }],
    options,
  );
const observed = observe(`
  bool Modes() {
    return GameAttributeGameValue("[bnet:local/0.0/12]1") == "0001"
      && ("0002" != (GameAttributePlayerValue("[bnet:local/0.0/12]2", 1)));
  }
`);
assert.equal(observed.proof.referencedDefinitionsCovered, true);
assert.equal(observed.proof.callsCovered, 2);
const localSelector = '[bnet:local/0.0/12]1';
const foreignSelector = '[bnet:local/0.0/34]1';
const galaxy = `void Check() {
  string a = GameAttributeGameValue( "${localSelector}" );
  string b = GameAttributeGameValue("${foreignSelector}");
  string c = GameAttributePlayerValue("${localSelector}", 1);
  string unrelated = "${localSelector}";
}`;
const rebound = rebindAttributeGalaxy(
  galaxy,
  new Map([[localSelector, { id: '1', type: 'Global' }]]),
  (text, file) => new Parser().parseFile(file, text),
);
assert.equal(rebound.text, galaxy.replace(`( "${localSelector}" )`, '( "1" )'));
assert.equal(rebound.proof.edits.length, 1);
assert.equal(rebound.proof.byteInverseVerified, true);
assert.deepEqual(observed.model.attributes[1], {
  id: '2',
  type: 'Player',
  name: undefined,
  defaults: [],
  values: [{ id: '2' }],
});
assert.deepEqual(observed.model.variants, []);
const draft = compareAttributeDocuments(observed.model, observed.xml, {
  referenceOrigin: 'SOURCE_OBSERVED',
});
assert.equal(draft.matchesInferredDocument, true);
assert.equal(draft.passed, false);
assert.equal(
  observe(`
  bool Foreign() {
    return GameAttributeGameValue("[bnet:local/0.0/12]1") == "0001"
      && GameAttributeGameValue("[bnet:local/0.0/34]1") == "0002";
  }
`),
  undefined,
);
const incomplete = observe(`
  bool Dynamic(string selector) {
    return GameAttributeGameValue("1") == GameAttributeGameValue(selector);
  }
`);
assert.equal(incomplete.proof.referencedDefinitionsCovered, false);
assert.equal(incomplete.proof.unresolved[0].reason, 'UNSUPPORTED_ATTRIBUTE_SELECTOR');
const first = observe('bool Default(){return GameAttributeGameValue("1") == "0001";}', {
  firstDefaults: true,
});
assert.deepEqual(first.proof.inferredDefaults, [{ id: '1', valueId: '1' }]);
assert.deepEqual(
  first.model.attributes[0].defaults[0].children.map(({ name, attributes }) => [
    name,
    attributes.Id,
  ]),
  [
    ['Slot', 'Global'],
    ['Value', '1'],
  ],
);

const record = (fields) => ({
  kind: 5,
  value: new Map(Object.entries(fields).map(([key, value]) => [BigInt(key), value])),
});
const integer = (value) => ({ kind: 9, value: BigInt(value) });
const bytes = (value) => ({ kind: 2, value: Buffer.from(value) });
const array = (value) => ({ kind: 0, value });
const absent = { kind: 4, value: undefined };
function definition({ index = 0, tokens = ['0004', '0001'], namespace = 100 } = {}) {
  return record({
    0: record({ 0: integer(namespace), 1: integer(300) }),
    1: array(tokens.map((token) => record({ 0: bytes(token), 1: record({ 0: absent }) }))),
    2: record({ 0: absent }),
    4: integer(0),
    5: integer(3),
    6: integer(3),
    7: integer(6),
    8: { kind: 3, index: 0n, value: record({ 0: integer(index), 1: bytes('') }) },
    9: integer(0),
  });
}

const decoded = await decodeAttributeDefaults(definition(), 100, async () => null);
assert.equal(
  decoded.defaults[0].token,
  '0004',
  'Default index must select the stored token, not an inferred ordinal',
);
const labels = [
  {
    locale: 'enUS',
    values: ['Attribute300/Name=Difficulty', 'Attribute300/Value004/Name=First choice'],
  },
];
const model = attributesFromS2mh({ used: true, attributes: [decoded], overrides: [] }, labels);
assert.equal(model.attributes[0].defaults[0].children[1].attributes.Id, '4');
assert.equal(model.attributes[0].values[0].name, 'Attribute300/Value004/Name');
assert.equal(model.attributes[0].publicLocked, true);
assert(model.attributes[0].unknown.some((node) => node.name === 'Hidden'));
const overridden = attributesFromS2mh(
  {
    used: true,
    attributes: [decoded],
    overrides: [{ id: 300, defaults: [{ slot: 'Global', token: '0001' }] }],
  },
  labels,
);
assert.equal(
  overridden.attributes[0].defaults[0].children[1].attributes.Id,
  '1',
  'Selected-variant override must win',
);
await assert.rejects(
  decodeAttributeDefaults(definition({ index: 2 }), 100, async () => null),
  /outside value array/,
);
await assert.rejects(
  decodeAttributeDefaults(definition({ namespace: 101 }), 100, async () => null),
  /namespace differs/,
);
await assert.rejects(
  decodeAttributeDefaults(definition({ tokens: ['0004', '0004'] }), 100, async () => null),
  /Duplicate attribute tokens/,
);
assert.throws(
  () => attributesFromS2mh({ used: true, attributes: [decoded], overrides: [] }, []),
  /No original localization key/,
);
assert.equal((await readOptionalS2mh()).used, false);
console.log(
  'Verified stored default tokens, selected-variant overrides, localization keys, flags and invalid-source rejection.',
);
console.log('This is attribute-source verification, not complete lobby or map equivalence.');
