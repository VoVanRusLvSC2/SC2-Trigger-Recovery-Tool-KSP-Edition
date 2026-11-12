import test from 'node:test';import assert from 'node:assert/strict';
import {qualifyPrivateRootTriggerAliases as qualify} from './qualified-root-trigger-aliases.catalog-local-sources.mjs';
import {readReadonlyUserCatalog} from '../model/readonly-user-catalog.mjs';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const declarations='const int c_gameCatalogUser=9;native trigger TriggerCreate(string inFunction);native trigger TriggerFind(string inFunction);native string UserDataGetString(string t,string i,string f,int n);';
const source='trigger ownedHandle;bool OriginalCallback(bool a,bool b){return true;}void build(){ownedHandle=TriggerCreate("OriginalCallback");}void InitTriggers(){build();}void InitMap(){InitTriggers();}void dispatch(string instance){string s;s="";if(true){s=UserDataGetString("Commands",instance,"Callback",1);}TriggerFind(s);}';
async function catalog(value){const xml='<Catalog><CUser id="Commands"><Fields Id="Callback" Type="String"/><Instances Id="A"><String String="'+value+'"><Field Id="Callback"/></String></Instances></CUser></Catalog>';return readReadonlyUserCatalog({layers:[{id:'0'}],unresolved:[],files:async()=>({items:['base.sc2data/gamedata/userdata.xml']}),read:async()=>Buffer.from(xml)});}
const input={text:source,parse:(t,n)=>new Parser().parseFile(n,t),typeName:getTypeName,otherSources:[{name:'natives.galaxy',text:declarations}],sourceEligibility:{existingTriggerData:undefined,ownedSources:[],preserveOtherSources:true}};
test('Existing privacy/ABI gates accept a source-bound finite catalog domain only',async()=>{
 const result=qualify({...input,userCatalog:await catalog('UnrelatedCallback')});assert.equal(result.proof.bindings.length,1);assert(result.proof.edits>0);assert.equal(result.proof.newNative,0);assert.equal(result.proof.newRuntimeFunctions,0);assert.equal(result.proof.wholeMapAccepted,false);
 assert.equal(result.proof.flow.readonlyUserStrings.queries.length,1);
});
test('An observed original callback still blocks private root alpha',async()=>{
 const capability=await catalog('OriginalCallback');assert.throws(()=>qualify({...input,userCatalog:capability}),/NAME_OBSERVED/);
 assert.throws(()=>qualify(input),/UNKNOWN_STRING_EXPRESSION/);
});
