// Explicit engine effects, not purity inferred from a signature or GUI flag.
// These operations stay at their original call sites. Only unrelated closed
// scalar header stores may move; handles, queries and registration order may not.
const existing = {
  Color: ['color', ['fixed', 'fixed', 'fixed']],
  StringToText: ['text', ['string']],
  StringExternal: ['text', ['string']],
  PlayerGroupEmpty: ['playergroup', []],
  UnitGroupEmpty: ['unitgroup', []],
  TimerCreate: ['timer', []],
  UnitFilter: ['unitfilter', ['int', 'int', 'int', 'int']],
  TriggerCreate: ['trigger', ['string']],
  TriggerEnable: ['void', ['trigger', 'bool']],
  TriggerAddEventUnitProperty: ['void', ['trigger', 'unitref', 'int']],
  TriggerAddEventDialogControl: ['void', ['trigger', 'int', 'int', 'int']],
  StringLength: ['int', ['string']],
};
// NativeLib's Useful Player Groups operations construct a group from engine
// player membership. They do not execute a Galaxy callback or suspend a thread.
// Active membership is NOT constant and allocation is NOT declared pure.
const groups = {
  PlayerGroupAll: ['playergroup', []],
  PlayerGroupActive: ['playergroup', []],
  PlayerGroupSingle: ['playergroup', ['int']],
};
export const startupNativeContracts = Object.freeze(
  Object.fromEntries(
    Object.entries({ ...existing, ...groups }).map(([name, [result, parameters]]) => [
      name,
      Object.freeze([result, Object.freeze(parameters)]),
    ]),
  ),
);
export const startupNativeEffectEvidence = Object.freeze({
  kind: 'EXPLICIT_NON_CALLBACK_NON_YIELDING_API_CONTRACTS',
  addedFamily: 'NativeLib Useful Player Groups',
  references: Object.freeze([
    'https://mapster.talv.space/galaxy/reference/player-group-all',
    'https://mapster.talv.space/galaxy/reference/player-group-active',
    'https://mapster.talv.space/galaxy/reference/player-group-single',
  ]),
  requiresActualNativeAbi: true,
  sourceOverridesAreNotNative: true,
  impliesPurity: false,
  allowsMovingCalls: false,
  allowsReorderingCalls: false,
  allowsMovingHandles: false,
  arbitraryNativeEffectsInferred: false,
});
