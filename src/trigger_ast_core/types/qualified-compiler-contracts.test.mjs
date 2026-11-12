import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadQualifiedCompilerContracts,supplementCompilerContracts} from './qualified-compiler-contracts.mjs';
import {validateGalaxyPair} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/validation.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const profilePath=new URL('./compiler-contracts.qualified.json',import.meta.url),bytes=await readFile(profilePath),profile=JSON.parse(bytes);
const old=JSON.parse(await readFile(new URL('../../trigger_ast_implementation_2026-10-07/runs/NATIVE_HEADER_SUPPLEMENT_PROOF_v2211.json',import.meta.url),'utf8'));
const options={profilePath,profileSha256:sha(bytes),editorPath:'C:/Program Files (x86)/StarCraft II/Support64/SC2Editor_x64.exe',nativeHeaderPath:old.nativePath};
const qualification=await loadQualifiedCompilerContracts(options);
const source=text=>({fileName:'Map.galaxy',text});
const supplement=(text='string Main(text v){return TextToString(v);}',missing=['TextToString'],more=[])=>supplementCompilerContracts({sources:[source(text),...more],missing,qualification});
const temp=await mkdtemp('K:/SC2_MAP_Workspace/sc2_editor_C++/sdk_gui_closure_20261019/compiler-contract-tests-');
async function variant(edit){const p=structuredClone(profile);edit(p);const text=JSON.stringify(p),file=temp+'/'+crypto.randomUUID()+'.json';await writeFile(file,text,{flag:'wx'});return {...options,profilePath:file,profileSha256:sha(text)};}

test('qualified builtin restores a language signature without any GUI or runtime authority',()=>{
 const result=supplement();assert.equal(result.text,'native string TextToString(text value);');assert.equal(result.evidence.length,1);
 for(const key of ['implementationsAdded','syntheticGuiDefinitionsAdded','guiLoweringAuthorized'])assert.equal(result[key],false);
 assert.equal(result.evidence[0].guiDefinitionsAdded,false);
});
test('unknown API and absent missing name receive no declaration',()=>{
 assert.equal(supplement(undefined,['UnknownApi']).text,'');assert.equal(supplement(undefined,[]).text,'');
});
test('owned function is never replaced by a compiler declaration',()=>assert.equal(supplement('string TextToString(text value){return "authored";}').text,''));
test('an owned variable with the same name blocks supplementation',()=>assert.equal(supplement('int TextToString;').text,''));
test('a dependency declaration is never overridden',()=>assert.equal(supplement(undefined,undefined,[{fileName:'Dependency.galaxy',text:'int TextToString(int v);'}]).text,''));
test('local shadow does not erase the distinct global contract',()=>assert(supplement('string Other(){string TextToString;return TextToString;} string Main(text t){return TextToString(t);}').text));
test('real type checker accepts the qualified signature',()=>{
 const s=source('string Main(text v){return TextToString(v);}');
 assert.equal(validateGalaxyPair([s],[{fileName:'Builtin.galaxy',text:supplement().text}],true).verification.errors,0);
});
for(const [name,text]of [['zero arguments','string Main(){return TextToString();}'],['two arguments','string Main(text v){return TextToString(v,v);}'],['wrong type','string Main(string v){return TextToString(v);}'],['wrong return','int Main(text v){return TextToString(v);}']]){
 test('the type checker still rejects '+name,()=>assert(validateGalaxyPair([source(text)],[{fileName:'Builtin.galaxy',text:supplement().text}],true).verification.errors>0));
}
test('a forged qualification object is rejected',()=>assert.throws(()=>supplementCompilerContracts({sources:[],missing:['TextToString'],qualification:{contracts:profile.contracts}}),/UNQUALIFIED/));
test('profile hash and editor/header bytes remain pinned',async()=>{
 await assert.rejects(loadQualifiedCompilerContracts({...options,profileSha256:'0'.repeat(64)}),/PROFILE_CHANGED/);
 await assert.rejects(loadQualifiedCompilerContracts({...options,editorPath:profilePath}),/BUILD_CHANGED/);
 await assert.rejects(loadQualifiedCompilerContracts({...options,nativeHeaderPath:profilePath}),/HEADER_CHANGED/);
});
test('a runtime implementation cannot masquerade as an interface',async()=>await assert.rejects(loadQualifiedCompilerContracts(await variant(p=>p.contracts[0].declaration='native string TextToString(text v){return "";}'))));
test('prototype ABI must agree with the qualified signature',async()=>await assert.rejects(loadQualifiedCompilerContracts(await variant(p=>p.contracts[0].parameterTypes=['string']))));
test('duplicate contracts are rejected',async()=>await assert.rejects(loadQualifiedCompilerContracts(await variant(p=>p.contracts.push(p.contracts[0]))),/DUPLICATE_COMPILER_CONTRACT/));
test('missing controls and modified evidence refuse qualification',async()=>{
 await assert.rejects(loadQualifiedCompilerContracts(await variant(p=>p.contracts[0].negative=[])),/NO_CONTROLS/);
 await assert.rejects(loadQualifiedCompilerContracts(await variant(p=>p.evidence[0].sha256='0'.repeat(64))),/EVIDENCE_CHANGED/);
});
test('qualified contract identity and carriers are immutable',()=>{
 assert.throws(()=>qualification.contracts[0].name='Other');assert.throws(()=>qualification.contracts[0].parameterTypes.push('int'));
 assert.equal(supplement().evidence[0].name,'TextToString');
});
