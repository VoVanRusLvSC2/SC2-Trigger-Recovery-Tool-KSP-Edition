/** Check recovered default-token semantics without opening or modifying a map. */
import assert from 'node:assert/strict';
import { decodeAttributeDefaults } from '../src/utilities/cache-attribute-defaults.mjs';
import { attributesFromS2mh, readOptionalS2mh } from '../src/utilities/s2mh-source.mjs';

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
