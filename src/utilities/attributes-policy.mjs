/** Explicit historical test profiles; never evidence of recovered original defaults. */
import policies from '../../config/approved-test-attribute-policies.json' with { type: 'json' };
export { policies };
const element = (name, attributes = {}, children = []) => ({
  name,
  attributes,
  children,
  text: '',
});
export function makeAttributes(policy, labels) {
  const table = new Map();
  for (const locale of labels)
    for (const line of locale.values) {
      const eq = line.indexOf('=');
      if (eq > 0) table.set(line.slice(0, eq), line.slice(eq + 1));
    }
  const attributes = policy.attributes.map((a) => {
    const prefix = 'Attribute' + a.id.padStart(3, '0'),
      name = prefix + '/Name';
    if (!table.has(name) || !['Global', 'Player'].includes(a.type))
      throw Error('Missing name/type');
    const values = [...table.keys()]
      .flatMap((k) => {
        const m = k.match(new RegExp('^' + prefix + '/Value(\\d+)/Name$'));
        return m ? [{ id: String(Number(m[1])), name: k }] : [];
      })
      .sort((x, y) => Number(x.id) - Number(y.id));
    if (!values.length || !values.some((v) => v.id === a.defaultId))
      throw Error('Default has no recovered value');
    for (const v of values) {
      const desc = v.name.replace(/Name$/, 'Desc');
      if (table.has(desc)) v.description = desc;
    }
    if (
      !a.slots.length ||
      new Set(a.slots).size !== a.slots.length ||
      a.slots.some((s) =>
        a.type === 'Global' ? s !== 'Global' : !/^\d+$/.test(s) || Number(s) > 15,
      )
    )
      throw Error('Invalid test slots');
    const def = {
      id: a.id,
      type: a.type,
      name,
      availability: 'All',
      visibility: 'All',
      access: a.type === 'Player' ? 'Self' : 'Host',
      values,
      defaults: a.slots.map((s) =>
        element('Default', {}, [element('Slot', { Id: s }), element('Value', { Id: a.defaultId })]),
      ),
    };
    if (table.has(prefix + '/Desc'))
      def.unknown = [{ ...element('Description', { Value: prefix + '/Desc' }), index: 3 }];
    return def;
  });
  return { attributes, defaultVariants: 1, variants: [] };
}
