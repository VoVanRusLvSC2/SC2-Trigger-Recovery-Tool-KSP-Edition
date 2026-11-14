// The Editor elides plain null metadata initializers. A typed literal preset
// retains the original null store; parentheses do not evaluate another value.
// Only newly reconstructed, AST-proved string array initializers are eligible.
import assert from 'node:assert/strict';
const origins = new WeakSet();
export function markExplicitNullArrayInitializer(variable, expression, kinds) {
  while (expression?.kind === kinds.ParenthesizedExpression) expression = expression.expression;
  if (
    variable?.type === 'Variable' &&
    variable.variableType?.type === 'string' &&
    variable.isArray &&
    !variable.isConstant &&
    (expression?.kind === kinds.NullKeyword ||
      (expression?.kind === kinds.Identifier && expression.name === 'null'))
  )
    origins.add(variable);
}
const ref = (library, type, id) => ({ type, library, id });
const same = (r, library, type, id) =>
  r?.type === type && r.id === id && (r.library ?? library) === library;
function paramUses(elements, library) {
  const counts = new Map(),
    seen = new WeakSet();
  function walk(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (
      node.type === 'Param' &&
      node.id &&
      (node.library ?? library) === library &&
      node !== elements[node.id]
    )
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1);
    for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
  }
  for (const element of Object.values(elements)) walk(element);
  return counts;
}
export function reifyExplicitNullArrayInitializers(elements, library, roots, allocateId) {
  const records = [],
    eligible = Object.values(elements).filter((v) => origins.has(v));
  if (!eligible.length) return records;
  const uses = paramUses(elements, library);
  let binding;
  const allocate = (key) => {
    const id = allocateId(library + '|explicit-null-string-array|' + key);
    assert(id && !elements[id], 'NULL_INITIALIZER_ID_COLLISION');
    return id;
  };
  for (const variable of eligible) {
    const initial = variable.initialValue,
      param = initial && elements[initial.id];
    assert(
      same(initial, library, 'Param', initial?.id) && param?.type === 'Param',
      'NULL_INITIALIZER_OWNER_CHANGED',
    );
    assert(
      param.value === 'null' &&
        (!param.valueType || param.valueType.type === 'string') &&
        ![
          'scriptCode',
          'functionCall',
          'variable',
          'paramRef',
          'preset',
          'valueElement',
          'expressionText',
          'expressionCode',
          'expressionType',
          'structMember',
        ].some((k) => param[k] !== undefined) &&
        !param.arrayIndexes?.length &&
        !param.expressionParams?.length &&
        !param.valueParams?.length,
      'NULL_INITIALIZER_VALUE_CHANGED',
    );
    if (!binding) {
      const presetId = allocate('preset'),
        valueId = allocate('value');
      assert.notEqual(presetId, valueId);
      elements[valueId] = {
        type: 'PresetValue',
        library,
        id: valueId,
        name: 'NoString',
        displayName: 'No String',
        identifier: 'NoString',
        value: '(null)',
      };
      elements[presetId] = {
        type: 'Preset',
        library,
        id: presetId,
        name: 'ExplicitNullString',
        displayName: 'String Value',
        identifier: 'ExplicitNullString',
        baseType: 'string',
        values: [ref(library, 'PresetValue', valueId)],
        generateConstants: false,
        generateIdentifier: false,
        integer: false,
        unknownXml: [{ tag: 'PresetCustom', position: 0 }],
      };
      roots.push(ref(library, 'Preset', presetId));
      binding = { presetId, valueId };
    }
    const references = uses.get(param.id) ?? 0,
      id = allocate('param|' + variable.id);
    assert(references >= 1, 'NULL_INITIALIZER_PARAM_HAS_NO_OWNER');
    elements[id] = {
      ...param,
      id,
      valueType: { type: 'string' },
      preset: ref(library, 'PresetValue', binding.valueId),
    };
    delete elements[id].value;
    variable.initialValue = ref(library, 'Param', id);
    if (references === 1) delete elements[param.id];
    records.push({
      library,
      variable: variable.id,
      param: id,
      previousParam: param.id,
      ...binding,
      sourceValue: 'null',
      carrier: '(null)',
      sharedOriginalParamRetained: references > 1,
      newRuntimeFunctions: 0,
      newNativeDefinitions: 0,
    });
  }
  return records;
}
export function validateExplicitNullArrayInitializers(elements, library, records) {
  for (const r of records) {
    const v = elements[r.variable],
      p = elements[r.param],
      preset = elements[r.presetId],
      value = elements[r.valueId];
    assert(
      v?.type === 'Variable' &&
        v.isArray &&
        !v.isConstant &&
        v.variableType?.type === 'string' &&
        same(v.initialValue, library, 'Param', p?.id),
      'NULL_INITIALIZER_VARIABLE_CHANGED',
    );
    assert(
      p?.type === 'Param' &&
        p.value === undefined &&
        p.valueType?.type === 'string' &&
        same(p.preset, library, 'PresetValue', r.valueId) &&
        ![
          'scriptCode',
          'functionCall',
          'variable',
          'paramRef',
          'valueElement',
          'expressionText',
          'expressionCode',
          'expressionType',
          'structMember',
        ].some((k) => p[k] !== undefined) &&
        !p.arrayIndexes?.length &&
        !p.valueParams?.length &&
        !p.expressionParams?.length,
      'NULL_INITIALIZER_PARAM_CHANGED',
    );
    assert(
      preset?.type === 'Preset' &&
        preset.baseType === 'string' &&
        !preset.integer &&
        !preset.generateConstants &&
        !preset.generateIdentifier &&
        preset.values?.length === 1 &&
        same(preset.values[0], library, 'PresetValue', r.valueId) &&
        preset.unknownXml?.some((x) => x.tag === 'PresetCustom'),
      'NULL_INITIALIZER_PRESET_CHANGED',
    );
    assert(
      value?.type === 'PresetValue' && value.value === '(null)',
      'NULL_INITIALIZER_LITERAL_CHANGED',
    );
  }
  return true;
}
