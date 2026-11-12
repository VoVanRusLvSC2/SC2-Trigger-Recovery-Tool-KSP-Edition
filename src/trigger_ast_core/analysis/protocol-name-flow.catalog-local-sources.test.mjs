import test from 'node:test';import assert from 'node:assert/strict';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {proveClosedProtocolNameAbsence as prove} from './protocol-name-flow.catalog-local-sources.mjs';
import {readReadonlyUserCatalog} from '../model/readonly-user-catalog.mjs';
const parse=text=>{const ast=new Parser().parseFile('flow.galaxy',text);assert.equal(ast.parseDiagnostics.length,0);return ast;};
const check=text=>prove([parse(text)],['PrivateCallback']);
test('Every assignment branch, including later writes, contributes to the domain',()=>{
 const r=check('void f(){string s;s="Safe";if(true){s="Other";}TriggerCreate(s);}');assert.equal(r.finiteLocalStrings[0].writes.length,2);
 assert.throws(()=>check('void f(){string s;s="Safe";if(false){s="PrivateCallback";}TriggerCreate(s);}'),/NAME_OBSERVED/);
 assert.throws(()=>check('void f(){string s="Safe";TriggerCreate(s);s=Dynamic();}'),/UNKNOWN_STRING_EXPRESSION/);
});
test('Initialization must dominate; cyclic, compound, ref and shadowed calls refuse',()=>{
 for(const source of ['void f(){string s;if(true){s="Safe";}TriggerCreate(s);}',
  'void f(){string s="Safe";s=s;TriggerCreate(s);}',
  'void f(){string s="Safe";s+="x";TriggerCreate(s);}',
  'void f(){string s="Safe";Unknown(s);TriggerCreate(s);}',
  'void f(){string s="Safe";int TriggerCreate;TriggerCreate(s);}'])assert.throws(()=>check(source),/PROTOCOL_FLOW_/);
});
test('Decoded literals and readonly globals retain the original observed-name gate',()=>{
 assert.throws(()=>check('void f(){string s;s="\\x50rivateCallback";TriggerCreate(s);}'),/NAME_OBSERVED/);
 assert.throws(()=>check('const string s="PrivateCallback";void f(){TriggerCreate(s);}'),/NAME_OBSERVED/);
});
async function catalog(value){const text='<Catalog><CUser id="Commands"><Fields Id="Callback" Type="String"/><Instances Id="A"><String String="'+value+'"><Field Id="Callback"/></String></Instances></CUser></Catalog>';return readReadonlyUserCatalog({layers:[{id:'0'}],unresolved:[],files:async()=>({items:['base.sc2data/gamedata/userdata.xml']}),read:async()=>Buffer.from(text)});}
test('A dynamic instance can use the complete immutable field domain, never a guessed value',async()=>{
 const header='const int c_gameCatalogUser=9;native string UserDataGetString(string t,string i,string f,int n);';
 const ast=parse(header+'void f(string instance){string s;s="";if(true){s=UserDataGetString("Commands",instance,"Callback",1);}TriggerCreate(s);}');
 const r=prove([ast],['PrivateCallback'],{userCatalog:await catalog('Safe')});assert.equal(r.readonlyUserStrings.queries.length,1);assert.equal(r.finiteLocalStrings[0].allAssignmentBranchesIncluded,true);
 assert.throws(()=>prove([ast],['PrivateCallback']),/UNKNOWN_STRING_EXPRESSION/);
 assert.throws(()=>prove([ast],['PrivateCallback'],{userCatalog:null}),/UNKNOWN_STRING_EXPRESSION/);
 const unsafe=await catalog('PrivateCallback');assert.throws(()=>prove([ast],['PrivateCallback'],{userCatalog:unsafe}),/NAME_OBSERVED/);
});
