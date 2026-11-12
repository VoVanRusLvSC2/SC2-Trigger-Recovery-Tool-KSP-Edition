import {isRetainedSourceStartupInterface} from "../../bindings/retained-source-startup-interface.mjs";
import {createStructuredInitializerSlot} from "../../gui/structured-initializer-slot.action-role.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planSourceInitializerWeave} from "../../lowering/source-initializer-weave.mjs";
import {indexSourceFunctionDeclarations} from "../../model/source-function-declarations.mjs";

const sha = text => createHash('sha256').update(text).digest('hex');
const ref = (library, type, id) => ({library, type, id});

// This only lowers a bound slot of an existing initializer. It cannot authorize
// a new anchor, move prefix effects, or establish whole-phase equivalence.
export function lowerSourceInitializerActionList({program, fileName, phaseName, automaticNames,
  automaticName, library, libraries, targetFunctions, allocateId}) {
  const {proof: phase} = planSourceInitializerWeave({program, fileName, phaseName, automaticNames});
  const slot = phase.slots.find(item => item.automaticName === automaticName);
  assert(slot, 'INITIALIZER_ACTION_SLOT_MISSING');
  if (!slot.calls.length) return undefined;
  assert(libraries instanceof Map && libraries.has(library), 'INITIALIZER_ACTION_OWNER_REQUIRED');
  assert(targetFunctions instanceof Map && typeof allocateId === 'function', 'INITIALIZER_ACTION_BINDINGS_REQUIRED');
  const declarations = indexSourceFunctionDeclarations(program.documents);
  const targets = slot.calls.map(call => {
    const declaration = declarations.get(call.name)?.body?.node;
    assert(declaration, 'INITIALIZER_ACTION_SOURCE_DECLARATION_MISSING');
    assert.deepEqual(program.location(declaration), call.target, 'INITIALIZER_ACTION_SOURCE_IDENTITY_CHANGED');
    // Keys are original declaration nodes, never a globally matched name.
    const target = targetFunctions.get(declaration);
    assert(target?.type === 'FunctionDef' && target.library && target.id, 'INITIALIZER_ACTION_TYPED_TARGET_REQUIRED');
    const definition = libraries.get(target.library)?.elementsByType?.FunctionDef?.[target.id];
    assert(definition && definition.library === target.library, 'INITIALIZER_ACTION_TARGET_OWNER_MISMATCH');
    assert.equal(definition.identifier ?? definition.name, call.name, 'INITIALIZER_ACTION_SOURCE_NAME_CHANGED');
    assert(definition.flags?.includes('NoScriptPrefix') && (definition.flags?.includes('Action') || definition.isFuncAction === true),
      'INITIALIZER_ACTION_ORIGINAL_ZERO_ABI_REQUIRED');
    const retainedSource=isRetainedSourceStartupInterface(definition,{program,declaration});
    if(!retainedSource){
    assert(!definition.flags.some(flag => ['Native', 'Event', 'Operator', 'CreateThread', 'SubFunctions', 'Template', 'Inline'].includes(flag)),
      'INITIALIZER_ACTION_TARGET_IS_NOT_ORDINARY_SOURCE_FUNCTION');
    assert.equal(definition.returnType?.type ?? 'void', 'void', 'INITIALIZER_ACTION_RETURN_ABI_CHANGED');
    assert.equal(definition.parameters?.length ?? 0, 0, 'INITIALIZER_ACTION_PARAMETER_ABI_CHANGED');
    assert(!definition.scriptCode && !definition.expressionCode, 'INITIALIZER_ACTION_OPAQUE_TARGET_FORBIDDEN');
    }
    return {reference: ref(target.library, 'FunctionDef', target.id), source: call.target,
      sourceCallSha256: call.callSha256, definitionSha256: sha(JSON.stringify(definition))};
  });
  const used = new Set(Object.values(libraries.get(library).elements).map(element => element.id));
  const id = () => {
    const value = allocateId();
    assert(typeof value === 'string' && /^[0-9A-F]{8}$/i.test(value) && !used.has(value),
      'INITIALIZER_ACTION_ID_COLLISION');
    used.add(value);
    return value;
  };
  const definitionId = id(), typeId = id(), callId = id();
  const childIds = targets.map(() => id());
  const owner=libraries.get(library);
  assert.equal(owner.id,library,'INITIALIZER_ACTION_OWNER_ID_MISMATCH');
  const slotModel=createStructuredInitializerSlot({library:owner,libraries,definitionId,subFunctionTypeId:typeId,eventCallId:callId,
    identifier:'SourceInitializerActions_'+definitionId,
    actions:targets.map((target,i)=>({callId:childIds[i],functionDef:target.reference}))});
  const order=[['FunctionDef',definitionId],['SubFuncType',typeId],['FunctionCall',callId],...childIds.map(id=>['FunctionCall',id])];
  const elements=order.map(([type,id])=>({...slotModel.elements[type+':'+id],library}));
  return {elements, event: ref(library, 'FunctionCall', callId), proof: {
    kind: 'BOUND_SOURCE_INITIALIZER_ACTION_LIST', phaseName, automaticName,
    sourcePhaseSha256: phase.sourceSha256, targets, prefixCallsStillRequired: phase.prefix.length,
    originalCallOrder: slot.calls.map(call => call.name), newNative: 0, newRuntimeFunctions: 0,
    newCustomScript: 0, declarativeMacroTemplates: 1, sourceBodyChanged: false,
    guiEmissionAuthorized: false, wholePhaseAccepted: false, wholeMapAccepted: false,
  }};
}
