import assert from 'node:assert/strict';

/** GUI representation only. Moving source effects into this slot still needs
 * a separate, bound initialization-order proof and an actual native export. */
export function createStructuredInitializerSlot({
  library,
  libraries,
  definitionId,
  subFunctionTypeId,
  eventCallId,
  actions,
  identifier = 'InitializerActions',
  displayName = 'Initialization Actions',
}) {
  assert(
    library?.id && libraries instanceof Map && libraries.get(library.id) === library,
    'INITIALIZER_OWNER_MODEL_REQUIRED',
  );
  assert(
    /^[A-Za-z0-9_]+$/u.test(library.id) && /^[A-Za-z_]\w*$/u.test(identifier),
    'INITIALIZER_VALID_IDENTITIES_REQUIRED',
  );
  assert(Array.isArray(actions) && actions.length > 0, 'INITIALIZER_ACTIONS_REQUIRED');
  const ids = [definitionId, subFunctionTypeId, eventCallId, ...actions.map((a) => a.callId)];
  assert(
    ids.every((id) => typeof id === 'string' && /^[A-Fa-f0-9]{8}$/u.test(id)) &&
      new Set(ids).size === ids.length,
    'INITIALIZER_FRESH_DISTINCT_IDS_REQUIRED',
  );
  const occupied = new Set(Object.values(library.elements).map((e) => e.id));
  assert(
    ids.every((id) => !occupied.has(id)),
    'INITIALIZER_ID_COLLISION',
  );
  const ref = (type, id) => ({ type, library: library.id, id }),
    elements = {};
  const add = (e) => {
    elements[e.type + ':' + e.id] = e;
  };
  for (const action of actions) {
    const r = action.functionDef,
      owner = libraries.get(r?.library ?? library.id);
    assert(r?.type === 'FunctionDef' && owner, 'INITIALIZER_FUNCTION_OWNER_MISSING');
    const found = Object.values(owner.elements).filter((e) => e.type === r.type && e.id === r.id);
    assert.equal(found.length, 1, 'INITIALIZER_EXACT_FUNCTION_ID_REQUIRED');
    const fn = found[0];
    assert(fn.isFuncAction || fn.flags?.includes('Action'), 'INITIALIZER_ACTION_KIND_REQUIRED');
    assert(
      !fn.parameters?.length && (!fn.returnType || fn.returnType.type === 'void'),
      'INITIALIZER_VOID_ZERO_ABI_REQUIRED',
    );
    add({
      type: 'FunctionCall',
      id: action.callId,
      functionDef: { ...r, library: owner.id },
      parameters: [],
      subFunctionType: ref('SubFuncType', subFunctionTypeId),
    });
  }
  add({
    type: 'FunctionDef',
    id: definitionId,
    name: identifier,
    identifier,
    displayName,
    flags: ['Event', 'Operator', 'SubFunctions'],
    returnType: { type: 'void' },
    parameters: [],
    subFunctionTypes: [ref('SubFuncType', subFunctionTypeId)],
    scriptCode: '#SUBFUNCS(actions)',
  });
  add({
    type: 'SubFuncType',
    id: subFunctionTypeId,
    name: 'actions',
    identifier: 'actions',
    displayName: 'Actions',
    isAction: true,
  });
  add({
    type: 'FunctionCall',
    id: eventCallId,
    functionDef: ref('FunctionDef', definitionId),
    parameters: [],
    subFunctions: actions.map((a) => ref('FunctionCall', a.callId)),
  });
  return {
    elements,
    event: ref('FunctionCall', eventCallId),
    definition: ref('FunctionDef', definitionId),
    proof: {
      kind: 'STRUCTURED_INLINE_INITIALIZER_GUI',
      actionCount: actions.length,
      template: '#SUBFUNCS(actions)',
      newNative: 0,
      newCustomScript: 0,
      newRuntimeFunctions: 0,
      actionBodiesKeptInGui: true,
      phaseSemanticsProved: false,
      nativeExportRequired: true,
      wholeMapAccepted: false,
    },
  };
}
