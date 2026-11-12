import {startupNativeContracts as previous,startupNativeEffectEvidence as previousEvidence} from "./startup-native-effect-contracts.mjs";
// Explicit existing-object lookups/proxy hookup contracts. These calls remain
// at their original sites and may read/change ENGINE state (for example the
// last hooked-up control). No value, handle or engine operation may be moved.
// As with the earlier constructor contracts, this models only no synchronous
// Galaxy callback and no yield, and requires an actual non-overridden native ABI.
const lookups={
 UnitFromId:['unit',['int']],
 CatalogFieldValueGet:['string',['int','string','string','int']],
 DialogControlHookup:['int',['int','int','string']],
 DialogControlHookupStandard:['int',['int','string']],
 DialogControlLastCreated:['int',[]]
};
export const startupNativeContracts=Object.freeze({...previous,...Object.fromEntries(
 Object.entries(lookups).map(([name,[result,parameters]])=>[name,Object.freeze([result,Object.freeze(parameters)])]))});
export const startupNativeEffectEvidence=Object.freeze({...previousEvidence,
 addedFamily:'Existing map/catalog lookup and existing UI control hookup',
 references:Object.freeze([...previousEvidence.references,
  'https://mapster.talv.space/galaxy/reference/unit-from-id',
  'https://mapster.talv.space/galaxy/reference/catalog-field-value-get',
  'https://mapster.talv.space/galaxy/reference/dialog-control-hookup',
  'https://mapster.talv.space/galaxy/reference/dialog-control-hookup-standard',
  'https://mapster.talv.space/galaxy/reference/dialog-control-last-created'
 ]),impliesReadOnlyEngineState:false,engineOperationOrderMustRemainExact:true});
