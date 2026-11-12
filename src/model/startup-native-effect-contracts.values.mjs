import {startupNativeContracts as previous,startupNativeEffectEvidence as priorEvidence} from "./startup-native-effect-contracts.lookups.mjs";
// Explicit scalar conversion, geometry construction and spatial lookup effects.
// Return values/handles are NOT evaluated or moved. Allocations and engine
// reads stay in source order; only the existing no-callback/no-yield obligation
// is discharged, subject to the actual non-overridden native ABI.
export const valueNativeContracts=Object.freeze(Object.fromEntries(Object.entries({
 StringToFixed:['fixed',['string']], StringToInt:['int',['string']],
 IntToString:['string',['int']], IntToText:['text',['int']],
 FixedToString:['string',['fixed','int']], FixedToText:['text',['fixed','int']],
 ColorWithAlpha:['color',['fixed','fixed','fixed','fixed']],
 Point:['point',['fixed','fixed']], PointFromId:['point',['int']],
 CameraInfoFromId:['camerainfo',['int']], RegionFromId:['region',['int']],
 SoundLink:['soundlink',['string','int']], AbilityCommand:['abilcmd',['string','int']],
 UnitGetPosition:['point',['unit']], UnitGetFacing:['fixed',['unit']], UnitGetHeight:['fixed',['unit']],
 PointGetX:['fixed',['point']], PointGetY:['fixed',['point']],
 RegionEntireMap:['region',[]], RegionFromName:['region',['string']], RegionGetCenter:['point',['region']],
 PointWithOffsetPolar:['point',['point','fixed','fixed']],
 DistanceBetweenPoints:['fixed',['point','point']], AngleBetweenPoints:['fixed',['point','point']]
}).map(([name,[result,parameters]])=>[name,Object.freeze([result,Object.freeze(parameters)])])));
export const startupNativeContracts=Object.freeze({...previous,...valueNativeContracts});
export const startupNativeEffectEvidence=Object.freeze({...priorEvidence,
 addedFamily:'Scalar conversions, geometry constructors and existing spatial lookups',
 references:Object.freeze([...priorEvidence.references,
  'https://mapster.talv.space/galaxy/reference/string-to-fixed',
  'https://mapster.talv.space/galaxy/reference/point',
  'https://mapster.talv.space/galaxy/reference/unit-get-position'
 ]),scalarValuesOrPrecisionReinterpreted:false,engineOperationOrderMustRemainExact:true});
