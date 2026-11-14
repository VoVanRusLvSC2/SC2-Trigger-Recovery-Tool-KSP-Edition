import assert from 'node:assert/strict';

// Reuse an already lowered structured action region. This creates an inline
// Event grammar, never a runtime helper. Its source placement needs a bound plan.
export function createStructuredInitializerRegion({ library, elements, actions, allocateId }) {
  assert(
    typeof library === 'string' && elements && Array.isArray(actions) && actions.length,
    'INITIALIZER_REGION_ACTIONS_REQUIRED',
  );
  const used = new Set(Object.values(elements).map((e) => e.id));
  const fresh = () => {
    const id = allocateId();
    assert(
      typeof id === 'string' && /^[0-9A-F]{8}$/iu.test(id) && !used.has(id),
      'INITIALIZER_REGION_FRESH_ID',
    );
    used.add(id);
    return id;
  };
  const definitionId = fresh(),
    roleId = fresh(),
    eventId = fresh(),
    ref = (type, id) => ({ library, type, id });
  const calls = actions.map((r) => {
    assert(r.library === library && r.type === 'FunctionCall', 'INITIALIZER_REGION_ACTION_OWNER');
    const e = elements[r.id];
    assert(
      e?.type === 'FunctionCall' && e.id === r.id && e.library === library,
      'INITIALIZER_REGION_EXACT_ACTION',
    );
    return e;
  });
  assert.equal(new Set(calls).size, calls.length, 'INITIALIZER_REGION_DUPLICATE_ACTION');
  const nodes = [
    {
      type: 'FunctionDef',
      library,
      id: definitionId,
      name: 'SourceStartupActions_' + definitionId,
      identifier: 'SourceStartupActions_' + definitionId,
      flags: ['Event', 'Operator', 'SubFunctions'],
      returnType: { type: 'void' },
      parameters: [],
      subFunctionTypes: [ref('SubFuncType', roleId)],
      scriptCode: '#SUBFUNCS(actions)',
    },
    {
      type: 'SubFuncType',
      library,
      id: roleId,
      name: 'actions',
      identifier: 'actions',
      displayName: 'Actions',
      isAction: true,
    },
    {
      type: 'FunctionCall',
      library,
      id: eventId,
      functionDef: ref('FunctionDef', definitionId),
      parameters: [],
      subFunctions: actions.map((r) => ({ ...r })),
    },
  ];
  for (const call of calls) call.subFunctionType = ref('SubFuncType', roleId);
  return {
    nodes,
    event: ref('FunctionCall', eventId),
    definition: nodes[0],
    proof: {
      kind: 'STRUCTURED_INITIALIZER_SOURCE_REGION',
      actionCount: calls.length,
      newNative: 0,
      newRuntimeFunctions: 0,
      newCustomScript: 0,
      sourcePlacementProved: false,
      actualNativeExportStillRequired: true,
      wholeMapAccepted: false,
    },
  };
}
