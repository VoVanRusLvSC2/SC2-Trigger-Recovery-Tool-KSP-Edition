// Preserve a source-observed owner+ID in existing typed GUI literals. Never
// invent definitions/defaults, infer an owner from an equal ID, or edit raw code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SyntaxKind as K, forEachChild } from './index-alternate-3.js';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';
import { readStringLiteralValue } from './string-literal-value.mjs';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const key = (library, type, id) => JSON.stringify([library, type, id]);
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
const decode = (s) =>
  s.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, x) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[x],
  );
const selector = (value) => {
  const match = /^\[(bnet:[^\]\r\n]+)\](0|[1-9]\d*)$/u.exec(value);
  return match
    ? { id: match[2], qualified: value }
    : /^(?:0|[1-9]\d*)$/u.test(value)
      ? { id: value }
      : undefined;
};
function nativeBindings(native) {
  const signatures = {
    GameAttributeGameValue: { type: 'attributegame', arity: 1 },
    GameAttributePlayerValue: { type: 'attributeplayer', arity: 2 },
  };
  const result = [];
  for (const def of Object.values(native.elements).filter((e) => e.type === 'FunctionDef')) {
    const signature = signatures[def.identifier];
    if (!signature) continue;
    assert(
      def.flags?.includes('Native') && def.parameters?.length === signature.arity,
      'ATTRIBUTE_SELECTOR_NATIVE_ABI',
    );
    const reference = def.parameters[0],
      param = Object.values(native.elements).find(
        (e) => e.type === 'ParamDef' && e.id === reference.id,
      );
    assert(
      (reference.library ?? native.id) === native.id && param?.paramType?.type === signature.type,
      'ATTRIBUTE_SELECTOR_NATIVE_DOMAIN',
    );
    result.push({
      ...signature,
      api: def.identifier,
      library: native.id,
      functionId: def.id,
      paramId: param.id,
    });
  }
  assert.equal(result.length, 2, 'ATTRIBUTE_SELECTOR_NATIVE_BINDINGS_AMBIGUOUS');
  return result;
}

export function reconcileAuthoredAttributeSelectors({
  xml,
  source,
  nativeLibrary,
  owners,
  libraryId = 'Map',
}) {
  const proof = {
    kind: 'SOURCE_QUALIFIED_AUTHORED_ATTRIBUTE_SELECTORS',
    xmlBeforeSha256: sha(xml),
    sourceSha256: sha(source),
    records: [],
    refused: [],
    definitionsOrDefaultsAdded: false,
    newElementIds: 0,
    newNative: 0,
    newRaw: 0,
    treeRebuilt: false,
  };
  const root = xmlTree(xml),
    index = new Map(),
    uses = new Map();
  const walkXml = (n, library, visit) => {
    if (n.tag === 'Library') library = n.attributes.Id;
    visit(n, library);
    for (const child of n.children ?? []) walkXml(child, library, visit);
  };
  walkXml(root, libraryId, (n, library) => {
    if (n.tag === 'Element') {
      const k = key(library, n.attributes.Type, n.attributes.Id);
      assert(!index.has(k), 'ATTRIBUTE_SELECTOR_DUPLICATE_GUI_ID');
      index.set(k, n);
    } else if (n.attributes.Type === 'Param' && n.attributes.Id) {
      const k = key(n.attributes.Library ?? library, 'Param', n.attributes.Id);
      uses.set(k, (uses.get(k) ?? 0) + 1);
    }
  });
  // An absent typed attribute literal needs no source/native parsing.
  if (
    ![...index.values()].some((n) =>
      n.children.some(
        (c) =>
          c.tag === 'ValueType' && ['attributegame', 'attributeplayer'].includes(c.attributes.Type),
      ),
    )
  )
    return {
      xml,
      proof: { ...proof, xmlAfterSha256: sha(xml), allOtherXmlBytesExactByInverse: true },
    };
  const bindings = nativeBindings(nativeLibrary),
    byApi = new Map(bindings.map((b) => [b.api, b]));
  const ast = parseImmutableGalaxySyntax(source, 'authored-attribute-selectors');
  assert.equal(ast.parseDiagnostics.length, 0, 'ATTRIBUTE_SELECTOR_SOURCE_SYNTAX');
  const bodies = new Map();
  for (const n of ast.statements) {
    if (n.kind === K.FunctionDeclaration && byApi.has(n.name.name) && n.body)
      throw Error('ATTRIBUTE_SELECTOR_NATIVE_SHADOWED');
    if (n.kind === K.VariableDeclaration && byApi.has(n.name.name))
      throw Error('ATTRIBUTE_SELECTOR_NATIVE_SHADOWED');
    if (n.kind === K.FunctionDeclaration && n.body) {
      assert(!bodies.has(n.name.name), 'ATTRIBUTE_SELECTOR_DUPLICATE_SOURCE_FUNCTION');
      bodies.set(n.name.name, n);
    }
  }
  const edits = new Map(),
    ownersByParam = new Map();
  for (const owner of owners) {
    const fn = bodies.get(owner.sourceFunction);
    if (!fn) continue;
    const sourceGroups = new Map(),
      guiGroups = new Map();
    const sourceVisit = (n) => {
      if (
        n.kind === K.CallExpression &&
        n.expression.kind === K.Identifier &&
        byApi.has(n.expression.name)
      ) {
        const binding = byApi.get(n.expression.name);
        if (n.arguments.length === binding.arity && n.arguments[0].kind === K.StringLiteral) {
          const literal = readStringLiteralValue(n.arguments[0].text),
            s = literal && !literal.needsPreset && selector(literal.value);
          if (s) {
            const k = binding.api + ':' + s.id,
              list = sourceGroups.get(k) ?? [];
            list.push({ ...s, binding });
            sourceGroups.set(k, list);
          }
        }
      }
      forEachChild(n, sourceVisit);
    };
    sourceVisit(fn.body);
    const seen = new Set(),
      pending = [...(owner.roots ?? [])];
    while (pending.length) {
      const reference = pending.pop(),
        scope = reference.library ?? owner.library ?? libraryId;
      const k = key(scope, reference.type, reference.id);
      if (seen.has(k)) continue;
      seen.add(k);
      const n = index.get(k);
      if (!n || ['FunctionDef', 'Trigger'].includes(n.attributes.Type)) continue;
      if (n.attributes.Type === 'FunctionCall') {
        const ref = n.children.find((c) => c.tag === 'FunctionDef');
        const b =
          ref &&
          bindings.find(
            (b) =>
              (ref.attributes.Library ?? scope) === b.library && ref.attributes.Id === b.functionId,
          );
        if (b)
          for (const r of n.children.filter((c) => c.tag === 'Parameter')) {
            const paramScope = r.attributes.Library ?? scope,
              pk = key(paramScope, 'Param', r.attributes.Id),
              param = index.get(pk);
            const formal = param?.children.find((c) => c.tag === 'ParameterDef'),
              v = param?.children.find((c) => c.tag === 'Value'),
              t = param?.children.find((c) => c.tag === 'ValueType');
            if (
              !formal ||
              (formal.attributes.Library ?? paramScope) !== b.library ||
              formal.attributes.Id !== b.paramId ||
              !v ||
              v.selfClosing ||
              t?.attributes.Type !== b.type ||
              param.children.some((c) =>
                [
                  'ScriptCode',
                  'FunctionCall',
                  'Variable',
                  'Preset',
                  'ValueParam',
                  'Parameter',
                ].includes(c.tag),
              )
            )
              continue;
            const scalar = decode(xml.slice(v.openEnd, v.closeStart).trim()),
              quoted = readStringLiteralValue(scalar);
            const value = quoted && !quoted.needsPreset ? quoted.value : scalar,
              s = selector(value);
            if (!s) continue;
            const group = b.api + ':' + s.id,
              list = guiGroups.get(group) ?? [];
            list.push({ key: pk, node: param, value, v, s, quoted: !!quoted, binding: b });
            guiGroups.set(group, list);
            const own = ownersByParam.get(pk) ?? new Set();
            own.add(owner.sourceFunction);
            ownersByParam.set(pk, own);
          }
      }
      walkXml(n, scope, (child, library) => {
        if (child === n || child.tag === 'Element') return;
        const a = child.attributes;
        // Only expression/action references are owned by this body. A Variable,
        // StructMember or ParamDef reference reads a declaration; its initializer
        // belongs to that declaration, not to every function that reads it.
        // Local variable initializers enter through the caller's explicit roots.
        if (['Param', 'FunctionCall'].includes(a.Type) && a.Id)
          pending.push({ library: a.Library ?? library, type: a.Type, id: a.Id });
      });
    }
    for (const [group, params] of guiGroups) {
      const observed = sourceGroups.get(group) ?? [],
        values = new Set(observed.map((s) => s.qualified));
      const qualified = observed[0]?.qualified;
      if (
        !qualified ||
        values.size !== 1 ||
        observed.length !== params.length ||
        params.some((p) => p.s.qualified && p.value !== qualified) ||
        params.some((p) => uses.get(p.key) !== 1)
      ) {
        proof.refused.push({
          sourceFunction: owner.sourceFunction,
          group,
          reason: 'OWNER_COUNT_DOMAIN_OR_SHARED_PARAMETER_UNPROVEN',
        });
        continue;
      }
      for (const p of params)
        if (p.value !== qualified) {
          assert(!edits.has(p.key), 'ATTRIBUTE_SELECTOR_MULTIPLE_OWNERS');
          edits.set(p.key, {
            start: p.v.openEnd,
            end: p.v.closeStart,
            text: escape(p.quoted ? JSON.stringify(qualified) : qualified),
            before: xml.slice(p.v.openEnd, p.v.closeStart),
            param: p.key,
          });
          proof.records.push({
            library: owner.library ?? libraryId,
            ownerId: owner.id,
            ownerType: owner.type,
            sourceFunction: owner.sourceFunction,
            parameterId: p.node.attributes.Id,
            api: p.binding.api,
            domain: p.binding.type,
            before: p.value,
            after: qualified,
            sourceOccurrences: observed.length,
            guiOccurrences: params.length,
          });
        }
    }
  }
  for (const k of edits.keys())
    assert.equal(ownersByParam.get(k)?.size, 1, 'ATTRIBUTE_SELECTOR_SHARED_CALL_OWNER');
  let result = '',
    cursor = 0;
  const inverse = [];
  for (const e of [...edits.values()].sort((a, b) => a.start - b.start)) {
    assert(e.start >= cursor, 'ATTRIBUTE_SELECTOR_OVERLAPPING_EDIT');
    result += xml.slice(cursor, e.start);
    inverse.push({ start: result.length, end: result.length + e.text.length, text: e.before });
    result += e.text;
    cursor = e.end;
  }
  result += xml.slice(cursor);
  xmlTree(result);
  let restored = result;
  for (const e of inverse.toReversed())
    restored = restored.slice(0, e.start) + e.text + restored.slice(e.end);
  assert.equal(restored, xml, 'ATTRIBUTE_SELECTOR_INVERSE_NOT_EXACT');
  return {
    xml: result,
    proof: { ...proof, xmlAfterSha256: sha(result), allOtherXmlBytesExactByInverse: true },
  };
}
