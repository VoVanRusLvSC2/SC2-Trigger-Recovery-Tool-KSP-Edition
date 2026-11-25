/** Restore Editor attribute selectors, preserving their Galaxy string values.
 * Native identities/types are resolved by the caller from the live CASC XML.
 * Only owned literal parameters of verified native calls/comparisons are edited.
 * Localization stays in Attributes/GameStrings; no display name enters Galaxy.
 */
import { applyDisjointXmlPatches } from './apply-disjoint-xml-patches.mjs';

export function nativeAttributeGuiSchema(nativeXml, parseXml) {
  const nodes = [];
  function visit(n) {
    if (n.tag === 'Element') nodes.push(n);
    for (const c of n.children) visit(c);
  }
  visit(parseXml(nativeXml));
  const key = (scope, type, id) => (scope ?? '') + ':' + type + ':' + id;
  const index = new Map(nodes.map((n) => [key(n.scope, n.attributes.Type, n.attributes.Id), n]));
  const get = (ref, scope) =>
    index.get(key(ref.attributes.Library ?? scope, ref.attributes.Type, ref.attributes.Id));
  const ident = (n) => {
    const c = n.children.find((c) => c.tag === 'Identifier');
    return c ? nativeXml.slice(c.openEnd, c.closeStart).trim() : '';
  };
  const types = {
    GameAttributeGameValue: ['Global', 'attributegame'],
    GameAttributePlayerValue: ['Player', 'attributeplayer'],
  };
  const bindings = [];
  let comparison;
  for (const n of nodes.filter((n) => n.attributes.Type === 'FunctionDef')) {
    const name = ident(n),
      params = n.children.filter((c) => c.tag === 'Parameter');
    if (types[name]) {
      if (!n.children.some((c) => c.tag === 'FlagNative'))
        throw Error('Attribute API is not native');
      const formal = get(params[0], n.scope),
        type = formal?.children
          .find((c) => c.tag === 'ParameterType')
          ?.children.find((c) => c.tag === 'Type')?.attributes.Value;
      if (type !== types[name][1]) throw Error('Unexpected live native attribute GUI type');
      bindings.push({
        apiName: name,
        libraryId: n.scope,
        functionDefId: n.attributes.Id,
        firstParamId: formal.attributes.Id,
        attributeType: types[name][0],
        valueType: type,
      });
    }
    if (name === 'Comparison' && n.scope === 'Ntve') {
      if (!n.children.some((c) => c.tag === 'FlagOperator') || params.length !== 3)
        throw Error('Unexpected live Comparison contract');
      comparison = {
        libraryId: n.scope,
        functionDefId: n.attributes.Id,
        operandIds: [params[0].attributes.Id, params[2].attributes.Id],
      };
    }
  }
  if (bindings.length !== 2 || !comparison)
    throw Error('Incomplete or ambiguous live attribute schema');
  return { bindings, comparison };
}
export function restoreAttributeGui({ triggerXml, attributes, schema, parseXml }) {
  const nodes = [],
    index = new Map(),
    refUses = new Map();
  const key = (scope, type, id) => (scope ?? '') + ':' + type + ':' + id;
  const nk = (n) => key(n.scope, n.attributes.Type, n.attributes.Id);
  const rk = (r, scope) => key(r.attributes.Library ?? scope, r.attributes.Type, r.attributes.Id);
  function visit(n) {
    if (n.tag === 'Element') {
      const k = nk(n);
      if (index.has(k)) throw Error('Duplicate scoped element');
      index.set(k, n);
      nodes.push(n);
    }
    for (const c of n.children) visit(c);
  }
  visit(parseXml(triggerXml));
  for (const n of nodes)
    for (const r of n.children.filter((c) => c.tag === 'Parameter')) {
      const k = rk(r, n.scope);
      refUses.set(k, (refUses.get(k) ?? 0) + 1);
    }
  const resolve = (r, n) => r && index.get(rk(r, n.scope));
  const owned = new Map(attributes.attributes.map((a) => [String(a.id), a]));
  const edits = [],
    changes = [],
    callAttributes = new Map();
  const literal = (n) => {
    if (!n || n.attributes.Type !== 'Param') return;
    const v = n.children.find((c) => c.tag === 'Value'),
      t = n.children.find((c) => c.tag === 'ValueType');
    if (
      !v ||
      v.selfClosing ||
      !t ||
      n.children.some((c) =>
        ['ScriptCode', 'FunctionCall', 'Variable', 'Parameter', 'Preset', 'ValueParam'].includes(
          c.tag,
        ),
      )
    )
      return;
    return {
      node: n,
      value: triggerXml.slice(v.openEnd, v.closeStart).trim(),
      type: t.attributes.Type,
      v,
      t,
    };
  };
  function rewrite(p, type, value, attributeId, kind) {
    if (p.type === type && p.value === value) return;
    if (refUses.get(nk(p.node)) !== 1)
      throw Error('Shared parameter requires separate ownership proof');
    if (!['string', type].includes(p.type)) throw Error('Unexpected parameter domain ' + p.type);
    if (p.type !== type) {
      const old = triggerXml.slice(p.t.start, p.t.end),
        pattern = /\bType=("|')string\1/;
      if (!pattern.test(old)) throw Error('ValueType edit is ambiguous');
      edits.push({
        start: p.t.start,
        end: p.t.end,
        text: old.replace(pattern, 'Type="' + type + '"'),
      });
    }
    if (p.value !== value) edits.push({ start: p.v.openEnd, end: p.v.closeStart, text: value });
    changes.push({
      scope: p.node.scope ?? '',
      paramId: p.node.attributes.Id,
      kind,
      attributeId,
      oldType: p.type,
      newType: type,
      oldValue: p.value,
      newValue: value,
    });
  }
  for (const call of nodes.filter((n) => n.attributes.Type === 'FunctionCall')) {
    const f = call.children.find((c) => c.tag === 'FunctionDef');
    if (!f) continue;
    const binding = schema.bindings.find(
      (b) =>
        (f.attributes.Library ?? call.scope) === b.libraryId && f.attributes.Id === b.functionDefId,
    );
    if (!binding) continue;
    for (const r of call.children.filter((c) => c.tag === 'Parameter')) {
      const p = resolve(r, call),
        d = p?.children.find((c) => c.tag === 'ParameterDef');
      if (
        !d ||
        (d.attributes.Library ?? p.scope) !== binding.libraryId ||
        d.attributes.Id !== binding.firstParamId
      )
        continue;
      const v = literal(p);
      if (!v || !owned.has(v.value)) continue;
      if (owned.get(v.value).type !== binding.attributeType)
        throw Error('Attribute definition type does not match native API');
      rewrite(v, binding.valueType, v.value, v.value, 'attribute');
      callAttributes.set(nk(call), v.value);
    }
  }
  // Only a direct comparison with a known owned attribute can own a value label.
  // Unrelated strings, computed operands and dynamic attribute arguments remain intact.
  for (const call of nodes.filter((n) => n.attributes.Type === 'FunctionCall')) {
    const f = call.children.find((c) => c.tag === 'FunctionDef'),
      cmp = schema.comparison;
    if (
      !f ||
      (f.attributes.Library ?? call.scope) !== cmp.libraryId ||
      f.attributes.Id !== cmp.functionDefId
    )
      continue;
    const operands = cmp.operandIds.map((id) =>
      call.children
        .filter((c) => c.tag === 'Parameter')
        .map((r) => resolve(r, call))
        .filter(Boolean)
        .find((p) =>
          p.children.some(
            (c) =>
              c.tag === 'ParameterDef' &&
              c.attributes.Id === id &&
              (c.attributes.Library ?? p.scope) === cmp.libraryId,
          ),
        ),
    );
    for (let i = 0; i < 2; i++) {
      const p = operands[i],
        ref = p?.children.find((c) => c.tag === 'FunctionCall');
      if (!ref) continue;
      const attributeId = callAttributes.get(rk(ref, p.scope));
      if (!attributeId) continue;
      const v = literal(operands[1 - i]);
      if (!v) continue;
      const token = v.type === 'attributevalue' ? v.value.split('|')[1] : v.value;
      if (v.type === 'attributevalue' && v.value.split('|')[0] !== attributeId)
        throw Error('Existing attribute value owner differs');
      if (
        !/^\d{4}$/.test(token ?? '') ||
        !owned.get(attributeId).values.some((x) => String(x.id) === String(Number(token)))
      )
        continue;
      rewrite(v, 'attributevalue', attributeId + '|' + token, attributeId, 'value');
    }
  }
  const next = edits.length ? applyDisjointXmlPatches(triggerXml, edits) : triggerXml;
  parseXml(next);
  return {
    triggerXml: next,
    changes,
    attributeParameters: changes.filter((c) => c.kind === 'attribute').length,
    valueParameters: changes.filter((c) => c.kind === 'value').length,
  };
}
