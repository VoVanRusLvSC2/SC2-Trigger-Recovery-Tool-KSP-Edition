import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,qualifyArchiveBoundRootRoles,verifyProtectedRootSourcesUnchanged} from './private-root-callback-alpha.protected-sources.mjs';
import {encodeFreshMpq} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/fresh-writer.js';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const source='trigger gt_One; bool Callback(bool conditions,bool actions){if(!actions){return true;}Marker(7);return true;} void Build(){gt_One=TriggerCreate("Callback");Register(gt_One,3);} void InitMap(){Build();}';
const candidate=source.replaceAll('Callback','gt_One_Func').replaceAll('Build','gt_One_Init');
const declarations=[{fileName:'natives.galaxy',text:'native trigger TriggerCreate(string name); native void Marker(int n); native void Register(trigger t,int n); native string TriggerGetFunction(trigger t); native trigger TriggerFind(string name);'}];
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,extra=[]){
 const dir=await mkdtemp(new URL('../../sdk_gui_closure_20261019/root-alpha-control-',import.meta.url));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const bytes=encodeFreshMpq([{path:'MapScript.galaxy',bytes:Buffer.from(source)},...extra]);
 const path=dir+'/source.SC2Map';await writeFile(path,bytes);const pin={path,sha256:sha(bytes)};
 return {pin,scope:()=>readPrivateRootArchiveScope(pin,source)};
}
test('independent archive capability and unchanged oracle accept only a whole alpha-equivalent pair',async t=>{
 const f=await fixture(t),scope=await f.scope(),input={scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations};
 const oracle=await openPinnedUserOracle();
 const view=projectPrivateRootCallbackAlpha(source,candidate,input);
 assert((await oracle.compare(view.before,view.after)).exact);
 for(const altered of [candidate.replace('Marker(7)','Marker(8)'),candidate.replace('Register(gt_One,3)','Register(gt_One,4)'),candidate.replace('Marker(7);',''),candidate.replace('return true;} void gt_One_Init','return false;} void gt_One_Init')]){
  const bad=projectPrivateRootCallbackAlpha(source,altered,{...input,candidateRoot:altered});
  assert(!(await oracle.compare(bad.before,bad.after)).exact,'business change must not pass');
 }
 await oracle.verify();assert.equal(view.proof.newNative,0);assert.equal(view.proof.newRuntimeFunctions,0);
 assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{...input,scope:JSON.parse(JSON.stringify(scope))}),/UNTRUSTED_ARCHIVE_SCOPE/);
 assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate.replace('TriggerCreate("gt_One_Func")','TriggerCreate("Other")'),{...input,candidateRoot:candidate.replace('TriggerCreate("gt_One_Func")','TriggerCreate("Other")')}),/ACTUAL_NATIVE_REGISTRATION_CHANGED/);
});
test('original GUI and wrong source root cannot qualify',async t=>{
 for(const extra of [[{path:'Triggers',bytes:Buffer.from('<TriggerData/>')}]]){
  const f=await fixture(t,extra);await assert.rejects(f.scope(),/EXISTING_GUI_PROTECTED|OWNED_SOURCE_FILES_PROTECTED/);
 }
 const f=await fixture(t);await assert.rejects(readPrivateRootArchiveScope(f.pin,source+' '),/NOT_SERVER_ROOT/);
 await assert.rejects(readPrivateRootArchiveScope({...f.pin,sha256:'0'.repeat(64)},source),/ARCHIVE_PROOF_INPUT_SHA/);
});
test('non-Galaxy literal references to old or generated names block projection',async t=>{
 for(const [name,encoding] of [['Callback','utf8'],['gt_One_Func','utf16le'],['InitGlobals','utf8']]){
  const f=await fixture(t,[{path:'LocalizedData/TriggerStrings.txt',bytes:Buffer.from(name,encoding)}]),scope=await f.scope();
  assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations}),/NON_SOURCE_LITERAL_REFERENCE/);
 }
});

test('every other Galaxy member is scanned and remains byte-identical in the candidate',async t=>{
 const payload={path:'Owned.galaxy',bytes:Buffer.from('void Side(){}')},f=await fixture(t,[payload]),scope=await f.scope();
 const q=qualifyArchiveBoundRootRoles(scope,source,declarations);
 assert.equal(q.proof.ownedSourceFilesReadOnly,true);assert.equal(q.proof.ownedSourceFilesAbsent,false);assert.equal(q.proof.preservedSourceFiles.length,1);
 const preserved=await verifyProtectedRootSourcesUnchanged(scope,f.pin);assert.equal(preserved.files.length,1);
 const changed=encodeFreshMpq([{path:'MapScript.galaxy',bytes:Buffer.from(candidate)},{path:'Owned.galaxy',bytes:Buffer.from('void Side(){Marker(9);}') }]);
 const path=f.pin.path+'.changed';await writeFile(path,changed);await assert.rejects(verifyProtectedRootSourcesUnchanged(scope,{path,sha256:sha(changed)}),/PRESERVED_SOURCE_CHANGED/);
});
test('preserved foreign calls, unknown name consumers and conflicting owners block alpha permission',async t=>{
 for(const text of ['void Side(){Build();}','void Side(){TriggerGetFunction(gt_One);}','native string Input(); void Side(){TriggerCreate(Input());}']){
  const f=await fixture(t,[{path:'Owned.galaxy',bytes:Buffer.from(text)}]),scope=await f.scope();
  assert.throws(()=>qualifyArchiveBoundRootRoles(scope,source,declarations),/ESCAPING_FUNCTION_REFERENCE|Foreign reference|CALLBACK_NAME_GETTER|PROTOCOL_FLOW_UNKNOWN/);
 }
 const f=await fixture(t,[{path:'Owned.galaxy',bytes:Buffer.from('void Side(){}')}]),scope=await f.scope();
 assert.throws(()=>qualifyArchiveBoundRootRoles(scope,source,[...declarations,{fileName:'Owned.galaxy',text:'void Different(){}'}]),/SOURCE_OWNER_CONTENT_CONFLICT/);
});
