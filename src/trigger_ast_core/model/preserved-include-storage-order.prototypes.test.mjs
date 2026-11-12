import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from './immutable-galaxy-syntax.mjs';
import {planPreservedIncludeStorageOrder,orderPreservedIncludeStorage} from './preserved-include-storage-order.prototypes.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function fixture(dep='const int N=4;',source='include "dep"\nstatic int[N] cells;'){
 const input={script:source,header:'',libraryId:'Map',additionalScripts:[{fileName:'dep.galaxy',text:dep}],galaxyDeclarations:[],includeEvidence:[{from:'MapScript.galaxy',include:'dep',path:'dep.galaxy',layerId:'own'}]};
 const ast=parse(source,'primary.galaxy'),node=ast.statements.at(-1),code=source.slice(node.pos,node.end);
 const section={passiveDeclarationOnly:true,fileName:'primary.galaxy',library:'Map',sourceSha256:sha(source),start:node.pos,end:node.end,code,sha256:sha(code)};
 const elements={S:{type:'CustomScript',id:'S',library:'Map',scriptCode:code},I:{type:'CustomScript',id:'I',library:'Map',scriptCode:'include "dep"',initFunc:'InitializeDep'}};
 const rootRefs=['S','I'].map(id=>({type:'CustomScript',id})),records=[{kind:'ORIGINAL_AUTHORED_SECTION',type:'CustomScript',id:'S',library:'Map',sectionSha256:section.sha256,sourceSha256:section.sourceSha256}];
 const plan=()=>planPreservedIncludeStorageOrder(input,[section]);
 const apply=(p,repairOrder=true)=>orderPreservedIncludeStorage({elements,library:'Map',rootRefs,sections:[section],records,plan:p,isPreservedInclude:e=>e.id==='I',repairOrder});
 return {input,section,elements,rootRefs,records,plan,apply};
}
test('bound constant extent places unchanged include before passive array and rechecks independently',()=>{
 const f=fixture(),p=f.plan();assert.equal(p.constraints.length,1);assert.equal(p.constraints[0].direction,'INCLUDE_BEFORE_STORAGE');
 const code=f.elements.S.scriptCode;assert(f.apply(p).changed);assert.deepEqual(f.rootRefs.map(r=>r.id),['I','S']);assert.equal(f.elements.S.scriptCode,code);
 assert.equal(f.elements.I.initFunc,'InitializeDep');assert.equal(f.apply(p,false).changed,false);
});
test('source function observing primary storage requires the opposite order',()=>{
 const f=fixture('void sample(){cells[0]=1;}','int[4] cells;\ninclude "dep"\n');
 // Build the selected declaration span independently of directive placement.
 const n=parse(f.input.script,'primary.galaxy').statements[0];Object.assign(f.section,{start:n.pos,end:n.end,code:f.input.script.slice(n.pos,n.end)});f.section.sha256=sha(f.section.code);
 f.records[0].sectionSha256=f.section.sha256;f.elements.S.scriptCode=f.section.code;
 const p=f.plan();assert(p.constraints.some(c=>c.direction==='STORAGE_BEFORE_INCLUDE'));assert.equal(f.apply(p).changed,false);
});
test('local shadow in preserved file is not a primary storage dependency',()=>{
 const f=fixture('const int N=4; void sample(){int cells;cells=2;}');
 const p=f.plan();assert.deepEqual(p.constraints.map(c=>c.direction),['INCLUDE_BEFORE_STORAGE']);assert(f.apply(p).changed);
});
test('mutually dependent atomic include and array refuses without mutation',()=>{
 const f=fixture('const int N=4;void sample(){cells[0]=1;}','include "dep"\nint[N] cells;'),p=f.plan(),before=structuredClone(f.rootRefs);
 assert.throws(()=>f.apply(p),/INCLUDE_STORAGE_DEPENDENCY_CYCLE/);assert.deepEqual(f.rootRefs,before);
});
test('effectful or unrelated GUI section cannot be crossed',()=>{
 const f=fixture(),p=f.plan();f.elements.E={type:'CustomScript',id:'E',library:'Map',scriptCode:'void init(){}',initFunc:'init'};
 f.rootRefs.splice(1,0,{type:'CustomScript',id:'E'});const before=structuredClone(f.rootRefs);
 assert.throws(()=>f.apply(p),/INCLUDE_STORAGE_EFFECT_OR_FOLDER_BARRIER/);assert.deepEqual(f.rootRefs,before);
});
test('verification alone does not silently repair wrong order',()=>{
 const f=fixture(),p=f.plan();assert.throws(()=>f.apply(p,false),/INCLUDE_STORAGE_ORDER_NOT_SATISFIED/);assert.deepEqual(f.rootRefs.map(r=>r.id),['S','I']);
});
test('an initializer is not a passive declaration',()=>{
 const f=fixture('const int N=4;','include "dep"\nstatic int cells=1;');assert.throws(()=>f.plan(),/INCLUDE_STORAGE_PASSIVE_DECLARATION_REQUIRED/);
});
test('stale origin or unsatisfied source closure cannot authorize an order change',()=>{
 const f=fixture();f.section.sourceSha256='bad';assert.throws(()=>f.plan(),/INCLUDE_STORAGE_ORIGINAL_SOURCE_SHA/);
 const g=fixture();g.input.includeEvidence=[];assert.throws(()=>g.plan(),/INCLUDE_STORAGE_COMPLETE_BINDINGS_REQUIRED/);
});
test('an invalid cross-file static reference cannot be treated as absence of dependency',()=>{
 const f=fixture('const int N=4; void sample(){cells[0]=1;}');assert.throws(()=>f.plan(),/INCLUDE_STORAGE_UNBOUND_SOURCE_REFERENCE/);
});
