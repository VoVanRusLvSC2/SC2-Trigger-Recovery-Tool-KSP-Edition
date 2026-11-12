import {startupNativeContracts as previous,startupNativeEffectEvidence as prior} from './startup-native-effect-contracts.storage.mjs';
// A query of the last played sound, not playback, a wait or callback dispatch.
// Its returned handle and the query's relative engine-call order stay intact.
export const startupNativeContracts=Object.freeze({...previous,SoundLastPlayed:Object.freeze(['sound',Object.freeze([])])});
export const startupNativeEffectEvidence=Object.freeze({...prior,
 addedFamily:'Last played sound handle query; actual native ABI required',
 references:Object.freeze([...prior.references,'https://github.com/SC2Mapster/SC2GameData/blob/master/mods/core.sc2mod/base.sc2data/TriggerLibs/natives.galaxy']),
 noEngineCallMovedOrEvaluated:true,allowsReorderingEngineCalls:false});
