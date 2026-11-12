// A code proof cannot establish the value returned by StringExternal when the
// packed string table changes. Keep this independent from Galaxy normalization.
import assert from 'node:assert/strict';
import {parseSc2Strings} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/strings/shared/core/text-file.js';

export function compareLocalizedValues(before,after,{discoveryComplete=true}={}) {
 assert(before instanceof Map&&after instanceof Map);
 const changes=[],additions=[];let checkedKeys=0;
 for(const [file,text]of before) {
  assert.equal(typeof text,'string');
  if(!after.has(file)){changes.push({kind:'TABLE_REMOVED',file});continue;}
  const a=parseSc2Strings(text),b=parseSc2Strings(after.get(file));
  for(const [key,value]of a) {
   checkedKeys++;
   if(!b.has(key))changes.push({kind:'KEY_REMOVED',file,key,before:value});
   else if(b.get(key)!==value)changes.push({kind:'VALUE_CHANGED',file,key,before:value,after:b.get(key)});
  }
  for(const [key,value]of b)if(!a.has(key))additions.push({kind:'KEY_ADDED',file,key,value});
 }
 for(const [file,text]of after)if(!before.has(file)) {
  assert.equal(typeof text,'string');
  additions.push({kind:'TABLE_ADDED',file,keys:parseSc2Strings(text).size});
 }
 const existingValuesPreserved=changes.length===0;
 const status=changes.length?'DIFFERENT':!discoveryComplete?'DISCOVERY_INCOMPLETE'
  :additions.length?'PRESERVED_WITH_ADDITIONS_REVIEW':'EXACT_EFFECTIVE_TABLES';
 return {status,existingValuesPreserved,checkedKeys,changes,additions,discoveryComplete,
  additionsUnobservableProved:false,wholeProgramEquivalent:false,
  scope:'Effective existing localized values under the pinned SDK string-table parser; added keys and locale fallback remain separate.'};
}
