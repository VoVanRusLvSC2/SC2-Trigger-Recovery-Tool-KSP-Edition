import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planPrimarySourcePrototypes,verifyPrimarySourcePrototypeGui} from './primary-source-prototypes.mjs';
import {planPreservedIncludeStorageOrder,orderPreservedIncludeStorage} from './preserved-include-storage-order.prototypes.mjs';
import {excludeVerifiedSourcePrototypes} from './separate-source-prototypes.mjs';
function input(script='void later(int value);\ninclude "dep"',dep='void start(){later(1);}\nvoid later(int x){}'){
 return {script,header:'',libraryId:'Map',additionalScripts:[{fileName:'dep.galaxy',text:dep}],galaxyDeclarations:[],includeEvidence:[{from:'MapScript.galaxy',include:'dep',path:'dep.galaxy',layerId:'owned'}]};
}
function gui(sections){
 const elements={},records=[],rootRefs=[];for(const [i,s]of sections.entries()){
  const id='P'+i;elements[id]={type:'CustomScript',id,library:'Map',scriptCode:s.code};rootRefs.push({type:'CustomScript',id});
  records.push({type:'CustomScript',id,library:'Map',kind:'ORIGINAL_AUTHORED_SECTION',sourceSha256:s.sourceSha256,sectionSha256:s.sha256});
 }return {elements,records,rootRefs};
}
test('exact original prototype and unchanged included body form one ABI family',()=>{
 const i=input(),s=planPrimarySourcePrototypes(i);assert.equal(s.length,1);assert.equal(s[0].code,'void later(int value);');
 assert.equal(s[0].families[0].body.sourceFile,'dep.galaxy');assert.equal(s[0].families[0].abi.parameters[0].type,'int');assert.deepEqual(s[0].functions,[]);
 const g=gui(s),proof=verifyPrimarySourcePrototypeGui(i,s,new Map([['Map',{elements:g.elements}]]));assert.equal(proof[0].newRuntimeFunctions,0);
});
test('no forward declaration is synthesized when absent from original',()=>{
 assert.deepEqual(planPrimarySourcePrototypes(input('include "dep"')),[]);
});
test('ordinary primary function retains its existing GUI declaration path',()=>{
 const i=input('void local();\nvoid local(){}\ninclude "dep"','void start(){}');assert.deepEqual(planPrimarySourcePrototypes(i),[]);
});
test('ABI mismatch and duplicate included bodies cannot authorize original prototype retention',()=>{
 assert.throws(()=>planPrimarySourcePrototypes(input(undefined,'void later(fixed value){}')),/SOURCE_PROTOTYPE_ABI_MISMATCH/);
 assert.throws(()=>planPrimarySourcePrototypes(input(undefined,'void later(int value){} void later(int value){}')),/SOURCE_PROTOTYPE_UNIQUE_BODY_REQUIRED/);
});
test('only exact passive GUI origin is accepted',()=>{
 const i=input(),s=planPrimarySourcePrototypes(i),g=gui(s),libraries=new Map([['Map',{elements:g.elements}]]);
 g.elements.P0.initFunc='Injected';assert.throws(()=>verifyPrimarySourcePrototypeGui(i,s,libraries),/SOURCE_PROTOTYPE_GUI_EXECUTABLE_METADATA/);
 delete g.elements.P0.initFunc;g.elements.P0.scriptCode='void later(int value){}';assert.throws(()=>verifyPrimarySourcePrototypeGui(i,s,libraries),/SOURCE_PROTOTYPE_GUI_MISSING_OR_DUPLICATED/);
});
test('header prototypes keep independent source spans and ABI evidence',()=>{
 const i=input('include "dep"');i.header='void later(int original);\n';const s=planPrimarySourcePrototypes(i);assert.equal(s.length,1);assert.equal(s[0].fileName,'header.galaxy');assert.equal(s[0].code,'void later(int original);');
});
test('original prototype is scheduled before its retained included implementation',()=>{
 const i=input(),sections=planPrimarySourcePrototypes(i),g=gui(sections),plan=planPreservedIncludeStorageOrder(i,sections);
 g.elements.I={type:'CustomScript',id:'I',library:'Map',scriptCode:'include "dep"',initFunc:'InitializeDep'};
 g.rootRefs.unshift({type:'CustomScript',id:'I'});
 const p=orderPreservedIncludeStorage({...g,library:'Map',sections,plan,isPreservedInclude:e=>e.id==='I',repairOrder:true});
 assert(p.changed);assert.deepEqual(g.rootRefs.map(r=>r.id),['P0','I']);assert.equal(g.elements.I.initFunc,'InitializeDep');
});
test('types defined inside an atomic include create an explicit dependency cycle',()=>{
 const i=input('void later(structref<Row> value);\ninclude "dep"','struct Row {int x;};\nvoid later(structref<Row> value){}');
 const sections=planPrimarySourcePrototypes(i),g=gui(sections),plan=planPreservedIncludeStorageOrder(i,sections);
 g.elements.I={type:'CustomScript',id:'I',library:'Map',scriptCode:'include "dep"'};g.rootRefs.push({type:'CustomScript',id:'I'});
 assert.throws(()=>orderPreservedIncludeStorage({...g,library:'Map',sections,plan,isPreservedInclude:e=>e.id==='I',repairOrder:true}),/INCLUDE_STORAGE_DEPENDENCY_CYCLE/);
});
test('same spelling in another static owner is not a callable family match',()=>{
 assert.throws(()=>planPrimarySourcePrototypes(input('static void later(int x);\ninclude "dep"','static void later(int x){}')),/SOURCE_PROTOTYPE_STATIC_OWNER_MISMATCH/);
});
test('stale family receipts and unresolved source closure refuse',()=>{
 const i=input(),s=planPrimarySourcePrototypes(i),g=gui(s);s[0].families[0].abi.returnType='int';
 assert.throws(()=>verifyPrimarySourcePrototypeGui(i,s,new Map([['Map',{elements:g.elements}]])),/SOURCE_PROTOTYPE_ORIGIN_CHANGED/);
 i.includeEvidence=[];assert.throws(()=>planPrimarySourcePrototypes(i),/SOURCE_PROTOTYPE_COMPLETE_BINDINGS_REQUIRED/);
});
test('passive prototypes do not become executable phases or storage providers',()=>{
 const i=input(),s=planPrimarySourcePrototypes(i),ordinary={kind:'ORIGINAL_AUTHORED_SECTION',code:'void Original(){}'};
 assert.deepEqual(excludeVerifiedSourcePrototypes(i,[ordinary,...s]),[ordinary]);
});
test('separation cannot authorize a forged source prototype section',()=>{
 const i=input(),s=planPrimarySourcePrototypes(i);s[0].functions=[{name:'Injected'}];
 assert.throws(()=>excludeVerifiedSourcePrototypes(i,s),/SOURCE_PROTOTYPE_SELECTION_ORIGIN_CHANGED/);
});
