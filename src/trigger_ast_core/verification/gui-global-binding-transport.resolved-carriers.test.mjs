import test from 'node:test';import assert from 'node:assert/strict';
import {transportGuiGlobalBindings as proof} from './gui-global-binding-transport.resolved-carriers.mjs';
import {createNativeGuiSourceInterfaces,nativeGuiCarrierFor} from '../bindings/native-gui-source-interfaces.carrier-evidence.mjs';
import {createHash} from 'node:crypto';
const xml='<TriggerData><Standard Id="Stock"/><Element Type="FunctionDef" Id="A0000001"><Identifier>ControlValue</Identifier><FlagNative/><FlagNoScriptPrefix/><FlagCall/><ReturnType><Type Value="control"/></ReturnType></Element></TriggerData>';
const sourceDocuments=[{fileName:'native.galaxy',text:'native int ControlValue();'}],authority={kind:'VERIFIED_CASC_CATALOG_AUTHORITY',buildIdentity:{buildKey:'fixture'},provenance:{kind:'LOADED_DEPENDENCY_CASC_CONTENT_PINS'},files:[{libraryId:'Stock',path:'native.triggerlib',sha256:createHash('sha256').update(xml).digest('hex')}]};
const makeModel=docs=>createNativeGuiSourceInterfaces({dependencyLibraries:[{sourcePath:'native.triggerlib',triggerData:xml}],verifiedCASCCatalogAuthority:authority,sourceDocuments:docs});
const carrierModel=makeModel(sourceDocuments),options=libs=>({libraries:libs,carrierModel,sourceDocuments});
function libraries(type='control',bound='3'){
 const v={type:'Variable',id:'A0000001',library:'Map',identifier:'cell',name:'cell',variableType:{type},isArray:true,arraySizes:[{dim:0,value:bound}]};
 return new Map([['Map',{id:'Map',implicit:true,items:[{library:'Map',type:'Variable',id:v.id}],elements:{[v.id]:v},elementsByType:{Variable:{[v.id]:v}}}]]);
}
const before='int[4] cell;void Main(){cell[0]=7;}',after='int[4] gv_cell;void Main(){gv_cell[0]=7;}';
test('actual GUI control carrier binds to the same exact source/export integer cell',()=>{
 const r=proof(before,after,options(libraries()));assert.equal(r.proof.records.length,1);assert(r.before.includes('gv_cell[0]'));assert.equal(r.proof.records[0].storageShape.qualifiedGuiType.type,'control');
});
test('rank/extents, actual export carrier and unrecognized GUI domains remain strict',()=>{
 for(const [libs,out]of [[libraries('control','4'),after],[libraries('control'),after.replace('int[4]','bool[4]')],[libraries('UnrecognizedType'),after]])assert.equal(proof(before,out,options(libs)).proof.records.length,0);
});
test('unknown preset ownership and references cannot borrow a carrier',()=>{
 for(const edit of [v=>v.variableType={type:'preset',typeElement:{library:'Foreign',type:'Preset',id:'DEADBEEF'}},v=>v.isReference=true]){const libs=libraries();edit(libs.get('Map').elements.A0000001);assert.equal(proof(before,after,options(libs)).proof.records.length,0);}
});
test('a textual storage observer or target capture still prevents transport',()=>{
 for(const suffix of ['void Side(){UnitRefFromVariable("cell");}','void Side(){int gv_cell;}'])assert.equal(proof(before+suffix,after+suffix,options(libraries())).proof.records.length,0);
});
test('changing business operations is not hidden by a correct storage binding',()=>{
 const r=proof(before,after.replace('=7','=8'),options(libraries()));assert.equal(r.proof.records.length,1);assert.notEqual(r.before,r.after);
});
test('conflicting ABI, source overrides and altered snapshots do not infer aliases',()=>{
 for(const text of ['native int ControlValue();native fixed ControlValue();','int ControlValue(){return 0;}']){const docs=[{fileName:'native.galaxy',text}];assert.equal(nativeGuiCarrierFor(makeModel(docs),{type:'control'},'Map',docs),undefined);}
 assert.throws(()=>nativeGuiCarrierFor(carrierModel,{type:'control'},'Map',[{fileName:'native.galaxy',text:'native fixed ControlValue();'}]),/SNAPSHOT_CHANGED/);
 assert.throws(()=>nativeGuiCarrierFor(JSON.parse(JSON.stringify(carrierModel)),{type:'control'},'Map',sourceDocuments),/UNTRUSTED/);
});


test('computed and unknown runtime storage paths cannot bypass the literal veto',()=>{
 const native='native unitref UnitRefFromVariable(string path);';
 for(const suffix of ['void Side(){UnitRefFromVariable("ce"+"ll");}','void Side(string path){UnitRefFromVariable(path);}']){
  const r=proof(native+before+suffix,native+after+suffix,options(libraries()));
  assert.equal(r.proof.records.length,0);assert(r.proof.refused.some(x=>/NATIVE_STORAGE|UNKNOWN_NATIVE/u.test(x.reason)));
 }
});

test('an ordinary declaration cannot supply genuine native carrier evidence',()=>{
 for(const text of ['int ControlValue();','static int ControlValue();']){
  const docs=[{fileName:'ordinary.galaxy',text}],model=makeModel(docs);
  assert.equal(nativeGuiCarrierFor(model,{type:'control'},'Map',docs),undefined);
 }
});
