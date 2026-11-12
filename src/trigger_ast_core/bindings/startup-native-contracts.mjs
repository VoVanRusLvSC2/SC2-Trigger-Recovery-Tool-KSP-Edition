// Trusted semantic contracts for startup commutation, not generated API stubs.
// Callers must also prove the exact native ABI and absence of source overrides.
// No contract authorizes moving actor operations or opaque handle initializers.
export const startupNativeContracts=Object.freeze({
 Color:['color',['fixed','fixed','fixed']],
 StringToText:['text',['string']],
 PlayerGroupEmpty:['playergroup',[]], UnitGroupEmpty:['unitgroup',[]], TimerCreate:['timer',[]],
 UnitFilter:['unitfilter',['int','int','int','int']],
 TriggerCreate:['trigger',['string']], TriggerEnable:['void',['trigger','bool']],
 TriggerAddEventUnitProperty:['void',['trigger','unitref','int']],
 TriggerAddEventDialogControl:['void',['trigger','int','int','int']],
 StringLength:['int',['string']],
 ActorScopeCreate:['actorscope',['string']],
 ActorFromScope:['actor',['actorscope','string']],
});

// Natives.galaxy's Actor design contract states that trigger code is synchronous
// and actors asynchronous, with opaque handles instead of synchronous results.
// These two interface operations do not yield or invoke Galaxy synchronously.
// ActorScopeCreate can create an actor as well: its asynchronous effects are
// retained in place, not treated as pure or deleted.
export const startupNativeEffectBasis=Object.freeze({
 ActorScopeCreate:{semanticFamily:'ASYNCHRONOUS_ACTOR_INTERFACE',mayInvokeGalaxySynchronously:false,
  mayYield:false,pure:false,operationRemainsAtOriginalPosition:true,
  basis:'Installed Natives.galaxy Actor Design Comments: synchronous trigger code, asynchronous actors, opaque scope/actor handles.'},
 ActorFromScope:{semanticFamily:'ASYNCHRONOUS_ACTOR_INTERFACE',mayInvokeGalaxySynchronously:false,
  mayYield:false,pure:false,operationRemainsAtOriginalPosition:true,
  basis:'Installed Natives.galaxy Actor Design Comments: synchronous trigger code, asynchronous actors, opaque scope/actor handles.'},
});

for(const signature of Object.values(startupNativeContracts)){
 Object.freeze(signature[1]);Object.freeze(signature);
}
for(const basis of Object.values(startupNativeEffectBasis))Object.freeze(basis);
