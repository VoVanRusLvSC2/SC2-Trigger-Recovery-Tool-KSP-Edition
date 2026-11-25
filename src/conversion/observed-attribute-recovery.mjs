import { SyntaxKind as K, forEachChild } from './exact-function-signatures/index-alternate-3.js';
import { readStringLiteralValue } from './exact-function-signatures/string-literal-value.mjs';
import { writeAttributes } from '../sdk/array-values/modules/map/shared/format/formats/attributes.js';

const domains = new Map([
  ['GameAttributeGameValue', 'Global'],
  ['GameAttributePlayerValue', 'Player'],
]);
const attributeId = /^[1-9]\d{0,9}$/u;
const literal = (node) =>
  node?.kind === K.StringLiteral ? readStringLiteralValue(node.text)?.value : undefined;

function localizedDefinitions(tables) {
  const definitions = new Map();
  for (const table of tables) {
    for (const line of (table.gameStrings ?? '').split(/\r?\n/u)) {
      const match = /^\uFEFF?(Attribute(\d+)(?:\/Value(\d+))?\/Name)=\s*\S/u.exec(line);
      if (!match) continue;
      const [, key, attributeId, valueId] = match;
      const id = String(Number(attributeId));
      if (!Number.isSafeInteger(Number(attributeId))) continue;
      const definition = definitions.get(id) ?? { name: undefined, values: new Map() };
      if (valueId === undefined) definition.name ??= key;
      else if (Number.isSafeInteger(Number(valueId))) {
        const normalized = String(Number(valueId));
        if (!definition.values.has(normalized)) definition.values.set(normalized, key);
      }
      definitions.set(id, definition);
    }
  }
  return definitions;
}

function comparedValue(call) {
  let operand = call;
  while (operand.parent?.kind === K.ParenthesizedExpression) operand = operand.parent;
  const comparison = operand.parent;
  if (
    comparison?.kind !== K.BinaryExpression ||
    ![K.EqualsEqualsToken, K.ExclamationEqualsToken].includes(comparison.operatorToken.kind)
  )
    return;
  let other = comparison.left === operand ? comparison.right : comparison.left;
  while (other?.kind === K.ParenthesizedExpression) other = other.expression;
  const token = literal(other);
  if (token !== undefined && /^\d{4}$/u.test(token)) return token;
}

/** A recovery draft backed by the map's own code and localization. Literal
 * selectors retain their original namespace and values, including in Galaxy. */
export function recoverObservedAttributes(ast, localizedStrings) {
  const calls = new Map();
  const unresolved = [];
  function visit(node) {
    const type = node.kind === K.CallExpression ? domains.get(node.expression?.name) : undefined;
    if (type) {
      const selector = literal(node.arguments?.[0]);
      const qualified = /^\[bnet:local\/0\.0\/([1-9]\d*)\]((?:0|[1-9]\d*))$/u.exec(selector ?? '');
      const id = qualified?.[2] ?? selector;
      if (!attributeId.test(id ?? '') || Number(id) > 4294967295) {
        unresolved.push({ selector, position: node.pos, reason: 'UNSUPPORTED_ATTRIBUTE_SELECTOR' });
      } else {
        const item = calls.get(selector) ?? {
          id,
          selector,
          namespace: qualified?.[1],
          types: new Set(),
          values: new Set(),
          count: 0,
        };
        item.types.add(type);
        const value = comparedValue(node);
        if (value !== undefined) item.values.add(value);
        item.count++;
        calls.set(selector, item);
      }
    }
    forEachChild(node, visit);
  }
  visit(ast);
  if (calls.size === 0) return undefined;

  const labels = localizedDefinitions(localizedStrings);
  const candidateOwners = new Set(
    [...calls.values()]
      .filter((item) => item.namespace && labels.get(item.id)?.name)
      .map((item) => item.namespace),
  );
  const localNamespace = candidateOwners.size === 1 ? [...candidateOwners][0] : undefined;
  const local = new Map();
  for (const item of calls.values()) {
    if (item.namespace && item.namespace !== localNamespace) {
      unresolved.push({ selector: item.selector, reason: 'ATTRIBUTE_OWNER_UNVERIFIED' });
      continue;
    }
    const group = local.get(item.id) ?? [];
    group.push(item);
    local.set(item.id, group);
  }
  const attributes = [];
  const definitions = [];
  for (const [id, items] of [...local].sort(([a], [b]) => Number(a) - Number(b))) {
    const types = new Set(items.flatMap((item) => [...item.types]));
    const comparedTokens = [...new Set(items.flatMap((item) => [...item.values]))].sort();
    const label = labels.get(id);
    const values = new Map(label?.values ?? []);
    for (const token of comparedTokens) {
      const valueId = String(Number(token));
      if (!values.has(valueId)) values.set(valueId, undefined);
    }
    if (types.size !== 1 || (!label?.name && values.size === 0)) {
      for (const item of items)
        unresolved.push({ selector: item.selector, reason: 'INSUFFICIENT_DEFINITION_EVIDENCE' });
      continue;
    }
    const type = [...types][0];
    attributes.push({
      id,
      type,
      name: label?.name,
      defaults: [],
      values: [...values]
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([id, name]) => ({
          id,
          ...(name === undefined ? {} : { name }),
        })),
    });
    definitions.push({
      id,
      type,
      nameKey: label?.name,
      selectors: items.map(({ selector, count }) => ({ selector, count })),
      comparedTokens,
      localizedValueCount: label?.values.size ?? 0,
    });
  }
  if (attributes.length === 0) return undefined;
  const model = { attributes, variants: [] };
  return {
    model,
    xml: writeAttributes(model),
    proof: {
      kind: 'SOURCE_OBSERVED_ATTRIBUTE_DEFINITIONS',
      attributesPolicy: 'Draft definitions inferred from Galaxy selectors and original GameStrings',
      localNamespace,
      namespaceVerified: false,
      originalLobbyVerified: false,
      defaultsRecovered: false,
      variantsRecovered: false,
      referencedDefinitionsCovered: unresolved.length === 0,
      callsCovered: definitions.reduce(
        (count, item) =>
          count + item.selectors.reduce((total, selector) => total + selector.count, 0),
        0,
      ),
      definitions,
      unresolved,
    },
  };
}
