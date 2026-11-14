import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const child = (n, t) => n?.children.find((c) => c.tag === t);
const body = (xml, n) => n && xml.slice(n.openEnd, n.closeStart);
const groups = (root) => [root, ...root.children.filter((n) => n.tag === 'Library')];
const owner = (g, implicit) => g.attributes.Id ?? child(g, 'Standard')?.attributes.Id ?? implicit;
const literal = (xml, e) =>
  child(e, 'ValueType')?.attributes.Type === 'fixed' ? body(xml, child(e, 'Value')) : undefined;

/** Literal Value fields are rounded to four decimals by the original Editor.
 * Ordinary fixed-base preset values retain the exact decimal token. This adds
 * no runtime declaration, function, Native or Custom Script. Per-call maps only.
 */
export function preserveGeneratedFixedLiterals({
  xml,
  existingXml = '',
  implicitLibraryId = 'Map',
}) {
  const root = xmlTree(xml),
    prior = new Map(),
    used = new Set(),
    edits = [],
    records = [],
    presets = [];
  if (existingXml)
    for (const g of groups(xmlTree(existingXml)))
      for (const e of g.children.filter((n) => n.tag === 'Element'))
        prior.set(
          JSON.stringify([owner(g, implicitLibraryId), e.attributes.Type, e.attributes.Id]),
          e,
        );
  for (const g of groups(root)) {
    const keys = new Set();
    for (const e of g.children.filter((n) => n.tag === 'Element')) {
      const key = JSON.stringify([e.attributes.Type, e.attributes.Id]);
      assert(!keys.has(key), 'EXACT_FIXED_DUPLICATE_TYPED_ID');
      keys.add(key);
      used.add(e.attributes.Id);
    }
  }
  for (const g of groups(root)) {
    const library = owner(g, implicitLibraryId),
      eligible = [],
      values = new Map();
    assert(
      typeof library === 'string' && /^[A-Za-z0-9_]+$/u.test(library),
      'EXACT_FIXED_LIBRARY_ID',
    );
    const libraryScoped = g.tag === 'Library' || child(g, 'Standard') !== undefined;
    const namespace = libraryScoped ? ' Library="' + library + '"' : '';
    for (const e of g.children.filter(
      (n) => n.tag === 'Element' && n.attributes.Type === 'Param',
    )) {
      const token = literal(xml, e);
      if (typeof token !== 'string' || !token.includes('.') || token.split('.')[1].length <= 4)
        continue;
      const previous = prior.get(JSON.stringify([library, 'Param', e.attributes.Id]));
      if (previous && literal(existingXml, previous) === token) continue;
      assert(
        token.length <= 128 && /^[+-]?\d+\.\d+$/u.test(token),
        'EXACT_FIXED_NON_DECIMAL_TOKEN',
      );
      assert(
        e.children.every((n) => ['ParameterDef', 'ValueType', 'Value'].includes(n.tag)),
        'EXACT_FIXED_NONLITERAL_PARAM',
      );
      eligible.push({ element: e, token });
    }
    if (!eligible.length) continue;
    const allocate = (role) => {
      for (let salt = 0; ; salt++) {
        const id = sha(xml + '\0' + library + '\0' + role + '\0' + salt)
          .slice(0, 8)
          .toUpperCase();
        if (!used.has(id)) {
          used.add(id);
          return id;
        }
      }
    };
    const presetId = allocate('exact-fixed-preset'),
      items = [],
      elements = [];
    for (const { element: e, token } of eligible) {
      if (!values.has(token)) {
        const id = allocate('exact-fixed-value:' + token);
        values.set(token, id);
        items.push(`<Item Type="PresetValue"${namespace} Id="${id}"/>`);
        elements.push(
          `<Element Type="PresetValue" Id="${id}"><Identifier>Fixed${values.size}</Identifier><Value>${token}</Value></Element>`,
        );
      }
      const value = child(e, 'Value'),
        type = child(e, 'ValueType'),
        id = values.get(token);
      edits.push(
        { start: type.start, end: type.end, text: '' },
        {
          start: value.start,
          end: value.end,
          text: `<Preset Type="PresetValue"${namespace} Id="${id}"/>`,
        },
      );
      records.push({
        library,
        paramId: e.attributes.Id,
        presetId,
        presetValueId: id,
        token,
        baseType: 'fixed',
      });
    }
    const r = child(g, 'Root');
    assert(r, 'EXACT_FIXED_ROOT_MISSING');
    const item = `<Item Type="Preset"${namespace} Id="${presetId}"/>`;
    edits.push(
      r.selfClosing
        ? { start: r.start, end: r.end, text: '<Root>' + item + '</Root>' }
        : { start: r.closeStart, end: r.closeStart, text: item },
    );
    elements.unshift(
      `<Element Type="Preset" Id="${presetId}"><Identifier>RecoveredFixedLiterals</Identifier><PresetCustom/><BaseType Value="fixed"/>${items.join('')}</Element>`,
    );
    assert(!g.selfClosing, 'EXACT_FIXED_GROUP_EMPTY');
    edits.push({ start: g.closeStart, end: g.closeStart, text: elements.join('') });
    presets.push({
      library,
      libraryScoped,
      id: presetId,
      values: [...values].map(([token, id]) => ({ token, id })),
      baseType: 'fixed',
      generateConstants: false,
    });
  }
  if (!records.length)
    return {
      xml,
      proof: {
        kind: 'EXACT_FIXED_LITERAL_CARRIERS',
        changed: false,
        records: [],
        presets: [],
        wholeProgramEquivalent: false,
      },
    };
  let after = '',
    cursor = 0;
  const inverse = [];
  for (const e of edits.toSorted((a, b) => a.start - b.start || a.end - b.end)) {
    assert(e.start >= cursor, 'EXACT_FIXED_OVERLAPPING_EDITS');
    after += xml.slice(cursor, e.start);
    inverse.push({ at: after.length, length: e.text.length, original: xml.slice(e.start, e.end) });
    after += e.text;
    cursor = e.end;
  }
  after += xml.slice(cursor);
  xmlTree(after);
  let restored = after;
  for (const e of inverse.toReversed())
    restored = restored.slice(0, e.at) + e.original + restored.slice(e.at + e.length);
  assert.equal(restored, xml, 'EXACT_FIXED_INVERSE');
  return {
    xml: after,
    proof: {
      kind: 'EXACT_FIXED_LITERAL_CARRIERS',
      changed: true,
      beforeSha256: sha(xml),
      afterSha256: sha(after),
      records,
      presets,
      allOtherBytesExactByInverse: true,
      roundingOrArithmeticNormalizationUsed: false,
      newNative: 0,
      newCustomScript: 0,
      newRuntimeFunctions: 0,
      newRuntimeDeclarations: 0,
      wholeProgramEquivalent: false,
    },
  };
}
