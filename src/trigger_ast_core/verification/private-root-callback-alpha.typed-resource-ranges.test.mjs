import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,qualifyArchiveBoundRootRoles,verifyProtectedRootSourcesUnchanged} from './private-root-callback-alpha.typed-resource-ranges.mjs';
import {encodeFreshMpq} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/fresh-writer.js';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const source='trigger privateCell; bool Callback(bool conditions,bool actions){if(!actions){return true;}Marker(7);return true;} void Build(){privateCell=TriggerCreate("Callback");Register(privateCell,3);} void InitMap(){Build();}';
const candidate=source.replaceAll('privateCell','gt_privateCell').replaceAll('Callback','gt_privateCell_Func').replaceAll('Build','gt_privateCell_Init');
const declarations=[{fileName:'natives.galaxy',text:'native trigger TriggerCreate(string name); native void Marker(int n); native void Register(trigger t,int n); native string TriggerGetFunction(trigger t); native trigger TriggerFind(string name);'}];
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,extra=[],root=source){
 const dir=await mkdtemp(new URL('../../sdk_gui_closure_20261019/root-alpha-control-',import.meta.url));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const bytes=encodeFreshMpq([{path:'MapScript.galaxy',bytes:Buffer.from(root)},...extra]);
 const path=dir+'/source.SC2Map';await writeFile(path,bytes);const pin={path,sha256:sha(bytes)};
 return {pin,scope:()=>readPrivateRootArchiveScope(pin,root)};
}
test('independent archive capability and unchanged oracle accept only a whole alpha-equivalent pair',async t=>{
 const f=await fixture(t),scope=await f.scope(),input={scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations};
 const oracle=await openPinnedUserOracle();
 const view=projectPrivateRootCallbackAlpha(source,candidate,input);
 assert((await oracle.compare(view.before,view.after)).exact);
 for(const altered of [candidate.replace('Marker(7)','Marker(8)'),candidate.replace('Register(gt_privateCell,3)','Register(gt_privateCell,4)'),candidate.replace('Marker(7);',''),candidate.replace('return true;} void gt_privateCell_Init','return false;} void gt_privateCell_Init')]){
  const bad=projectPrivateRootCallbackAlpha(source,altered,{...input,candidateRoot:altered});
  assert(!(await oracle.compare(bad.before,bad.after)).exact,'business change must not pass');
 }
 await oracle.verify();assert.equal(view.proof.newNative,0);assert.equal(view.proof.newRuntimeFunctions,0);
 assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{...input,scope:JSON.parse(JSON.stringify(scope))}),/UNTRUSTED_ARCHIVE_SCOPE/);
 assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate.replace('TriggerCreate("gt_privateCell_Func")','TriggerCreate("Other")'),{...input,candidateRoot:candidate.replace('TriggerCreate("gt_privateCell_Func")','TriggerCreate("Other")')}),/ACTUAL_NATIVE_REGISTRATION_CHANGED/);
});
test('original GUI and wrong source root cannot qualify',async t=>{
 for(const extra of [[{path:'Triggers',bytes:Buffer.from('<TriggerData/>')}]]){
  const f=await fixture(t,extra);await assert.rejects(f.scope(),/EXISTING_GUI_PROTECTED|OWNED_SOURCE_FILES_PROTECTED/);
 }
 const f=await fixture(t);await assert.rejects(readPrivateRootArchiveScope(f.pin,source+' '),/NOT_SERVER_ROOT/);
 await assert.rejects(readPrivateRootArchiveScope({...f.pin,sha256:'0'.repeat(64)},source),/ARCHIVE_PROOF_INPUT_SHA/);
});
test('non-Galaxy literal references to old or generated names block projection',async t=>{
 for(const [name,encoding] of [['Callback','utf8'],['gt_privateCell_Func','utf16le'],['InitGlobals','utf8']]){
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
 for(const text of ['void Side(){Build();}','void Side(){TriggerGetFunction(gt_privateCell);}','native string Input(); void Side(){TriggerCreate(Input());}']){
  const f=await fixture(t,[{path:'Owned.galaxy',bytes:Buffer.from(text)}]),scope=await f.scope();
  assert.throws(()=>qualifyArchiveBoundRootRoles(scope,source,declarations),/ESCAPING_FUNCTION_REFERENCE|Foreign reference|CALLBACK_NAME_GETTER|PROTOCOL_FLOW_UNKNOWN|TRIGGER_HANDLE_FOREIGN_IDENTITY_REFERENCE/);
 }
 const f=await fixture(t,[{path:'Owned.galaxy',bytes:Buffer.from('void Side(){}')}]),scope=await f.scope();
 assert.throws(()=>qualifyArchiveBoundRootRoles(scope,source,[...declarations,{fileName:'Owned.galaxy',text:'void Different(){}'}]),/SOURCE_OWNER_CONTENT_CONFLICT/);
});

test('the archive-bound whole-pair proof composes callback and exact startup-role identities',async t=>{
 const root='int globalValue;'+source.replace('void InitMap(){Build();}','void LocalGlobals(){globalValue=4;}void Phase(){Build();}void InitMap(){LocalGlobals();Phase();}');
 const native=root.replaceAll('privateCell','gt_privateCell').replaceAll('Callback','gt_privateCell_Func').replaceAll('Build','gt_privateCell_Init').replaceAll('LocalGlobals','InitGlobals').replaceAll('Phase','InitTriggers');
 const f=await fixture(t,[],root),scope=await f.scope(),opts={scope,sourceRoot:root,candidateRoot:native,externalSources:declarations};
 const view=projectPrivateRootCallbackAlpha(root,native,opts);assert.equal(view.proof.stageRoles.records.length,2);
 const oracle=await openPinnedUserOracle();assert((await oracle.compare(view.before,view.after)).exact);
 for(const text of [native.replace('globalValue=4','globalValue=5'),native.replace('Register(gt_privateCell,3)','Register(gt_privateCell,4)')]){
  const p=projectPrivateRootCallbackAlpha(root,text,{...opts,candidateRoot:text});assert(!(await oracle.compare(p.before,p.after)).exact);
 }await oracle.verify();
});

test('a private trigger cell cannot cross named storage, local scope or foreign target capture',async t=>{
 for(const text of ['void Foreign(){UnitRefFromVariable("privateCell");}','void Foreign(){gt_privateCell=null;}','trigger gt_privateCell;']){
  const f=await fixture(t,[{path:'Owned.galaxy',bytes:Buffer.from(text)}]),scope=await f.scope();
  assert.throws(()=>qualifyArchiveBoundRootRoles(scope,source,declarations),/NAMED_STORAGE_OBSERVER|FOREIGN_IDENTITY_REFERENCE|Foreign reference/);
 }
 for(const text of [source+' void Shadow(){trigger privateCell;}',source+' void Shadow(trigger gt_privateCell){}',source+' void Shadow(){trigger gt_privateCell;}']){
  const path=(await fixture(t)).pin.path+'.shadow';const bytes=encodeFreshMpq([{path:'MapScript.galaxy',bytes:Buffer.from(text)}]);await writeFile(path,bytes);const scope=await readPrivateRootArchiveScope({path,sha256:sha(bytes)},text);
  assert.throws(()=>qualifyArchiveBoundRootRoles(scope,text,declarations),/SHADOW|shadowed|TARGET_ALREADY_REFERENCED/);
 }
});
test('actual native handle type and cell count are independently required',async t=>{
 const f=await fixture(t),scope=await f.scope();
 for(const altered of [candidate.replace('trigger gt_privateCell','int gt_privateCell'),candidate+' trigger gt_privateCell;'])assert.throws(()=>projectPrivateRootCallbackAlpha(source,altered,{scope,sourceRoot:source,candidateRoot:altered,externalSources:declarations}),/ACTUAL_NATIVE_TARGET/);
});

test('escaped original callback registration is decoded before its bound identity is checked',async t=>{
 const root=source.replace('"Callback"','"\\103allback"'),f=await fixture(t,[],root),scope=await f.scope();
 const q=qualifyArchiveBoundRootRoles(scope,root,declarations);assert.equal(q.proof.kind,'BOUND_PRIVATE_ROOT_TRIGGER_ALPHA');
 const p=projectPrivateRootCallbackAlpha(root,candidate,{scope,sourceRoot:root,candidateRoot:candidate,externalSources:declarations}),oracle=await openPinnedUserOracle();assert((await oracle.compare(p.before,p.after)).exact);await oracle.verify();
});

test('a validated texture pixel collision is not a catalog callback reference, while opaque/trailing data still vetoes',async t=>{
 const b=Buffer.alloc(144);b.write('DDS ');for(const [i,value]of [[4,124],[8,0x81007],[12,4],[16,4],[20,16],[76,32],[80,4],[108,0x1000]])b.writeUInt32LE(value,i);b.write('DXT5',84);b.write('Callback',128);
 const f=await fixture(t,[{path:'Assets/Textures/pixel.dds',bytes:b}]),scope=await f.scope(),view=projectPrivateRootCallbackAlpha(source,candidate,{scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations});assert.equal(view.proof.typedNonCodeAssets.length,1);const oracle=await openPinnedUserOracle();assert((await oracle.compare(view.before,view.after)).exact);await oracle.verify();
 for(const bytes of [Buffer.concat([b,Buffer.from('Callback')]),Buffer.from('Callback')]){const bad=await fixture(t,[{path:'Assets/Textures/pixel.dds',bytes}]),cap=await bad.scope();assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{scope:cap,sourceRoot:source,candidateRoot:candidate,externalSources:declarations}),/NON_SOURCE_LITERAL_REFERENCE/);}
});

test('unknown trailer remains scanned while pixel coincidences and unrelated trailer bytes are separate domains',async t=>{const b=Buffer.alloc(144);b.write('DDS ');for(const[i,x]of [[4,124],[8,0x81007],[12,4],[16,4],[20,16],[76,32],[80,4],[108,0x1000]])b.writeUInt32LE(x,i);b.write('DXT5',84);b.write('Callback',128);const f=await fixture(t,[{path:'Imported/pixel.dds',bytes:Buffer.concat([b,Buffer.from('_NXD')])}]),scope=await f.scope(),view=projectPrivateRootCallbackAlpha(source,candidate,{scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations});assert.deepEqual(view.proof.typedNonCodeAssets[0].classification.opaqueRanges,[{start:144,end:148}]);assert(view.proof.nonSourcePayloadLiteralChecks.some(r=>r.path==='Imported/pixel.dds'));});

function modelResource(){const b=Buffer.alloc(160),put=(p,s)=>b.write([...s].reverse().join(''),p,'ascii');put(0,'MD34');b.writeUInt32LE(96,4);b.writeUInt32LE(4,8);b.writeUInt32LE(1,12);b.writeUInt32LE(1,16);for(const[i,t,o,c,v]of[[0,'MD34',0,1,11],[1,'MODL',32,1,99],[2,'U8__',48,16,0],[3,'CHAR',80,8,0]]){const p=96+i*16;put(p,t);b.writeUInt32LE(o,p+4);b.writeUInt32LE(c,p+8);b.writeUInt32LE(v,p+12);}return b;}
test('M3 numeric coincidences qualify, but CHAR/unknown fields and opaque trailers retain the literal veto',async t=>{
 const bytes=modelResource();bytes.write('Callback',48);const f=await fixture(t,[{path:'Imported/model.m3',bytes}]),scope=await f.scope();
 const view=projectPrivateRootCallbackAlpha(source,candidate,{scope,sourceRoot:source,candidateRoot:candidate,externalSources:declarations});
 assert.equal(view.proof.typedNonCodeAssets[0].classification.kind,'MD34_VALIDATED_INDEX_AND_PRIMITIVE_NUMERIC_RANGES');
 const oracle=await openPinnedUserOracle();assert((await oracle.compare(view.before,view.after)).exact);await oracle.verify();
 for(const offset of [32,80]){const b=Buffer.from(bytes);b.write('Callback',offset);const bad=await fixture(t,[{path:'Imported/model.m3',bytes:b}]),cap=await bad.scope();assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{scope:cap,sourceRoot:source,candidateRoot:candidate,externalSources:declarations}),/NON_SOURCE_LITERAL_REFERENCE/);}
 const b=Buffer.concat([bytes,Buffer.from('Callback')]),bad=await fixture(t,[{path:'Imported/model.m3',bytes:b}]),cap=await bad.scope();assert.throws(()=>projectPrivateRootCallbackAlpha(source,candidate,{scope:cap,sourceRoot:source,candidateRoot:candidate,externalSources:declarations}),/NON_SOURCE_LITERAL_REFERENCE/);
});
