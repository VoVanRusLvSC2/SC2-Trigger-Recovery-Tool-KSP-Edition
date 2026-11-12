import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveRootEntryStageRoleAliases as derive} from './root-entry-stage-role-aliases.mjs';
import {qualifyPrivateRootTriggerAliases} from '../passes/qualified-root-trigger-aliases.protected-sources.mjs';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const source='trigger gt_One;int g;bool Callback(bool c,bool a){return true;}void Build(){gt_One=TriggerCreate("Callback");}void Fill(){int i;for(i=0;i<2;i+=1){g=i;}}void Schedule(){Build();}void InitMap(){Fill();Schedule();}';
const otherSources=[{name:'natives.galaxy',text:'native trigger TriggerCreate(string name);'}];
function qualified(){return qualifyPrivateRootTriggerAliases({text:source,otherSources,parse:(t,n)=>new Parser().parseFile(n,t),typeName:getTypeName,sourceEligibility:{existingTriggerData:undefined,ownedSources:[]}});}
const candidate=q=>q.text.replaceAll('Fill','InitGlobals').replaceAll('Schedule','InitTriggers');
test('entry roles align only with whole identical bodies and an actual closed root permission',()=>{
 const q=qualified(),p=derive({sourceText:q.text,candidateText:candidate(q),permission:q.proof});
 assert.deepEqual(p.records.map(r=>[r.from,r.to]),[['Fill','InitGlobals'],['Schedule','InitTriggers']]);assert(p.records.every(r=>r.exactWholeBody));
});
test('changed effect or entry order cannot supply a role equality proof',()=>{
 const q=qualified();
 const changed=derive({sourceText:q.text,candidateText:candidate(q).replace('g = i;','g = 9;').replace('g=i;','g=9;'),permission:q.proof});assert(!changed.records.some(r=>r.from==='Fill'));
 const reordered=derive({sourceText:q.text,candidateText:candidate(q).replace('InitGlobals();InitTriggers();','InitTriggers();InitGlobals();'),permission:q.proof});assert.equal(reordered.records.length,0);
});
test('foreign references, function values and possible storage observation prevent role aliases',()=>{
 const q=qualified();
 const foreign=derive({sourceText:q.text,candidateText:candidate(q),permission:q.proof,otherSources:[{fileName:'Owned.galaxy',text:'void Other(){Fill();}'}]});assert(!foreign.records.some(r=>r.from==='Fill'));
 const escaped=derive({sourceText:q.text+'funcref<SomeType> slot=Fill;',candidateText:candidate(q),permission:q.proof});assert(!escaped.records.some(r=>r.from==='Fill'));
 const observed=derive({sourceText:q.text,candidateText:candidate(q),permission:{...q.proof,storage:{kind:'OBSERVED_PATHS'}}});assert.equal(observed.records.length,0);
});
test('unknown target roles or a colliding original target definition are not guessed',()=>{
 const q=qualified();
 const unknown=derive({sourceText:q.text,candidateText:candidate(q).replaceAll('InitGlobals','NewUnknownRole'),permission:q.proof});assert(!unknown.records.some(r=>r.from==='Fill'));
 const collision=derive({sourceText:q.text+'void InitGlobals(){}',candidateText:candidate(q),permission:q.proof});assert(!collision.records.some(r=>r.from==='Fill'));
});
