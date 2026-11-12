/** Optional, explicitly NEW test inputs for the three user-approved maps.
 * Never use these defaults for another revision, a title match or the corpus.
 * Source labels and API references are read from the ORIGINAL prepared map.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {policies,makeAttributes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/attribute_restoration_2026-10-03/attributes_policy.mjs';
import {writeAttributes,readAttributes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-literal-native-v173-2026-10-05/dist/modules/map/shared/format/formats/attributes.js';
import {parseGalaxySource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/3b4f2f6bdb8b-bb6f8d7de0-6cc704d9af52-31c4bd6f5998-95a9fde2fe9c86-eeb9f7481eeaf8c1-galaxy-to-trigger.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
// City is the only fully proven direct-reference input in this draft.
// Cold's attributes 2..6 are bank encryption inputs through a wrapper: do not
// synthesize their tokens/defaults from labels or recover only attribute 7.
// Historical Rainbow 0011 is the 2019 revision, NOT approved latest-replay 0010.
const historicalPolicyIds=new Map([['previous13-0001','0001']]);
export async function approvedHistoricalAttributeSource({row,localizedStrings,originalGalaxy,indexPath='map_autonomous_recovery_v129_2026-10-05/HISTORICAL_13_INTEGRITY.json'}){
 const policyId=historicalPolicyIds.get(row.id);if(!policyId)return {used:false,reason:'No explicit approved policy for this input'};
 const bytes=await readFile(indexPath),index=JSON.parse(bytes),entry=index.pairs.find(r=>'previous13-'+r.id===row.id);assert(entry?.allHashesBound);
 assert.equal(row.originalSha256,entry.hashes.originalMap,'Approved test policy must match the EXACT historical archive');
 assert.equal(sha(await readFile(row.original)),entry.hashes.originalMap);
 const policy=policies.find(p=>p.id===policyId);assert(policy);const namespace=Number(/\/(\d+)\]/u.exec(policy.owner)[1]);
 const labels=localizedStrings.filter(l=>typeof l.gameStrings==='string').map(l=>({path:l.locale+'.SC2Data/LocalizedData/GameStrings.txt',values:l.gameStrings.split(/\r?\n/u)}));
 const model=makeAttributes(policy,labels),xml=writeAttributes(model);assert.equal(writeAttributes(readAttributes(xml)),xml);
 const defs=new Map(model.attributes.map(a=>[a.id,a])),source=parseGalaxySource(originalGalaxy,'approved-original.galaxy');assert.equal(source.parseDiagnostics.length,0);
 const apis=new Map([['GameAttributeGameValue','Global'],['GameAttributePlayerValue','Player']]);
 const shadowed=new Set(source.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body).map(n=>n.name.name)),counts=new Map(),localCounts=new Map(),unknown=[];
 function walk(n){
  if(n?.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&apis.has(n.expression.name)){
   assert(!shadowed.has(n.expression.name),'Native attribute API shadowed');
   let argument=n.arguments[0];while(argument?.kind===K.ParenthesizedExpression)argument=argument.expression;
   if(argument?.kind!==K.StringLiteral)unknown.push({api:n.expression.name,reason:'Dynamic attribute owner not proven'});
   else{
    const value=argument.value,qualified=/^\[bnet:local\/0\.0\/(\d+)\](\d+)$/u.exec(value);
    const id=qualified&&Number(qualified[1])===namespace?qualified[2]:/^\d+$/u.test(value)?value:null;
    if(id!==null){assert.equal(defs.get(id)?.type,apis.get(n.expression.name),'Owned called attribute definition/domain missing');
     const target=qualified?counts:localCounts;target.set(id,(target.get(id)??0)+1);
    }
   }
  }forEachChild(n,walk);
 }walk(source);
 assert(counts.size||localCounts.size,'No actual own attribute use for approved source');assert.equal(unknown.length,0,'Dynamic attribute ownership requires separate evidence');
 const mappings=[...counts].map(([id,references])=>({sourceId:policy.owner+id,targetId:id,type:defs.get(id).type,references}));
 return {used:true,sourceKind:'APPROVED_NEW_TEST_DEFAULTS',namespace,model,xml,mappings,
  proof:{sourceKind:'APPROVED_NEW_TEST_DEFAULTS',originalArchive:row.original,originalSha256:row.originalSha256,expandedOriginalGalaxySha256:sha(originalGalaxy),registry:indexPath,registrySha256:sha(bytes),policyId,namespace,
   definitionsAndNameKeysFromOriginalLocalization:true,labelSources:labels.map(l=>({path:l.path,sha256:sha(l.values.join('\n'))})),mappings,alreadyLocalReferences:[...localCounts],
   newTestDefaults:true,authoredDefaultsRecovered:false,exactPublishedDefaultsRecovered:false,userApprovedPolicy:'City Standard; Cold Tutorial; Rainbow Six both Off. Explicitly new settings.',
   testDefaults:policy.attributes.map(a=>({attributeId:a.id,type:a.type,valueId:a.defaultId,slots:a.slots})),fullLobbyRecovered:false,playerSlotMappingNativeVerified:false,editorVerified:false}};
}
