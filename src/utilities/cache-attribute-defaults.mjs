/** Extract actual published custom default tokens. Array order is semantic:
 * default index 0 selects values[0], NEVER token 0001 by arithmetic. */
import {
  field,
  number,
  array,
  blob,
} from '../sdk/core/modules/game/battlenet/content-sources/cache-header.js';
export async function decodeAttributeDefaults(node, expectedNamespace, resolveText) {
  const namespace = number(field(field(node, 0), 0)),
    id = number(field(field(node, 0), 1));
  if (namespace !== expectedNamespace) throw Error('Attribute namespace differs');
  const values = [];
  for (const v of array(field(node, 1))) {
    const raw = blob(field(v, 0));
    if (raw.length !== 4) throw Error('Attribute token is not FourCC');
    const token = Buffer.from(raw).toString('ascii');
    values.push({
      token,
      hex: Buffer.from(raw).toString('hex'),
      name: await resolveText(field(field(v, 1), 0)),
    });
  }
  if (new Set(values.map((v) => v.hex)).size !== values.length)
    throw Error('Duplicate attribute tokens');
  const d = field(node, 8);
  if (d.kind !== 3 || ![0n, 1n].includes(d.index)) throw Error('Unsupported default choice');
  const type = d.index === 0n ? 'Global' : 'Player',
    slots = d.index === 0n ? [d.value] : array(d.value),
    defaults = slots.map((v, i) => {
      const index = number(field(v, 0));
      if (index >= values.length) throw Error('Default index is outside value array');
      return {
        slot: type === 'Global' ? 'Global' : String(i),
        index,
        token: values[index].token,
        unknownByteHex: Buffer.from(blob(field(v, 1))).toString('hex'),
      };
    });
  return {
    namespace,
    id,
    type,
    name: await resolveText(field(field(node, 2), 0)),
    values,
    defaults,
    arbitrationCode: number(field(node, 4)),
    visibilityCode: number(field(node, 5)),
    accessCode: number(field(node, 6)),
    optionsBits: number(field(node, 7)),
    sortOrder: number(field(node, 9)),
    requirementsPreservedInRawTree: true,
  };
}
