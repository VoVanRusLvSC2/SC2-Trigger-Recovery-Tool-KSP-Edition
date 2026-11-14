import {
  startupNativeContracts as previous,
  startupNativeEffectEvidence as priorEvidence,
} from './startup-native-effect-contracts.values.mjs';
// These calls remain at their original positions with identical arguments.
// PointSetHeight mutates engine point state; this is not a purity claim. The
// contract is limited to no synchronous Galaxy callback/yield/script-name read.
export const storageNativeContracts = Object.freeze(
  Object.fromEntries(
    Object.entries({
      PointSetHeight: ['void', ['point', 'fixed']],
      UnitFilterStr: ['unitfilter', ['string']],
      UserDataInstanceCount: ['int', ['string']],
      EventUnit: ['unit', []],
    }).map(([name, [result, args]]) => [name, Object.freeze([result, Object.freeze(args)])]),
  ),
);
export const conditionalStorageNativeContracts = Object.freeze({
  UnitRefFromVariable: Object.freeze(['unitref', Object.freeze(['string'])]),
});
export const startupNativeContracts = Object.freeze({ ...previous, ...storageNativeContracts });
export const startupNativeEffectEvidence = Object.freeze({
  ...priorEvidence,
  addedFamily:
    'Point mutation/filter construction/data-count and event-context queries; separately guarded unit-storage references',
  doesNotAssertPurity: true,
  doesNotEvaluateReturnValues: true,
  doesNotMoveEngineCalls: true,
  conditionalUnitReference:
    'Exact literal path to unique supplied scalar unit storage; complete dimensions, fields and nonprotected owner required',
  references: Object.freeze([
    ...priorEvidence.references,
    'https://github.com/SC2Mapster/SC2GameData/blob/b7587cca570f6a7ce27efa3336a6495d54a71720/mods/core.sc2mod/base.sc2data/TriggerLibs/NativeLib.galaxy',
    'https://mapster.talv.space/galaxy/reference/user-data-instance-count',
    'https://mapster.talv.space/galaxy/reference/unit-ref-from-variable',
  ]),
});
