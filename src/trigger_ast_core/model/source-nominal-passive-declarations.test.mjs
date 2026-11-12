import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from './galaxy-program-context.lexical-parameters.mjs';
import {planSourceNominalPassiveDeclarations as plan} from './source-nominal-passive-declarations.complete.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function run(text,owned='struct gs_External { fixed raw; };',alter=()=>{}){
 const primaryFiles=[{fileName:'MapScript.galaxy',text}],ownedFiles=[{fileName:'types.galaxy',text:owned}];
 for(const f of [...primaryFiles,...ownedFiles])f.sha256=sha(f.text);
 const files=[...primaryFiles,...ownedFiles].map((f,i)=>({...f,sourceId:String(i),contentSha256:f.sha256,owned:true}));
 const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});
 try{alter(primaryFiles);return plan({program,primaryFiles,ownedFiles});}finally{program.dispose();}
}
test('retains the whole passive struct/storage closure without retaining a function body',()=>{
 const root='include "types"\nstruct gs_Box{gs_External[4] lv_item;};gs_Box gv_box;void Work(){gv_box.lv_item[0].raw=1.0;}';
 const r=run(root);assert.equal(r.status,'CANDIDATE_PASSIVE_DECLARATIONS_BOUND');assert.equal(r.selectedDeclarations,2);assert.equal(r.units.length,1);
 assert(r.units[0].code.includes('struct gs_Box'));assert(!r.units[0].code.includes('void Work'));assert.equal(r.newExecutableFallback,0);assert.equal(r.guiPatchAuthorized,false);
});
test('different names and a transitive aggregate select by bound type identity',()=>{
 const r=run('include "types"\nstruct gs_One{gs_External x;};struct gs_Two{gs_One y;};gs_Two storage;int unrelated;');
 assert.equal(r.selectedDeclarations,3);assert(!r.units.some(u=>u.code.includes('unrelated')));
});
test('keeps exact original declaration text and excludes unrelated declarations between units',()=>{
 const r=run('include "types"\nstruct gs_Box {gs_External x;}; int unrelated; gs_Box storage;');
 assert.equal(r.units.length,2);assert(r.units.every(u=>sha(u.code)===u.sha256));assert(!r.units.some(u=>u.code.includes('unrelated')));
});
test('refuses a selected initializer rather than hiding its execution in a passive section',()=>{
 const r=run('include "types"\ngs_External storage = Make();');assert.equal(r.status,'REQUIRES_INTERFACE_REPAIR');assert.equal(r.failures.length,1);
});
test('refuses computed array bounds until their declaration and execution semantics are qualified',()=>{
 const r=run('include "types"\nint capacity;struct gs_Box{gs_External[capacity] x;};gs_Box storage;');assert(r.failures.length);assert.equal(r.guiPatchAuthorized,false);
});
test('records root function header consumers as blockers without creating prototypes',()=>{
 const r=run('include "types"\ngs_External storage;void Work(gs_External value){}');assert.equal(r.headerConsumers.length,1);assert.equal(r.status,'REQUIRES_INTERFACE_REPAIR');
});
test('does not select independent primitive storage or executable statements',()=>{
 const r=run('include "types"\nint storage;void Work(){storage=1;}');assert.equal(r.selectedDeclarations,0);assert.equal(r.units.length,0);
});
test('rejects stale source bytes even if identifiers still look correct',()=>{
 assert.throws(()=>run('include "types"\ngs_External storage;',undefined,files=>files[0].text+='\n'),/SOURCE_IDENTITY/);
});
test('a source reference in a function header remains a blocker even without selected storage',()=>{
 const r=run('include "types"\nvoid Work(structref<gs_External> value){}');assert.equal(r.headerConsumers.length,1);assert.equal(r.status,'REQUIRES_INTERFACE_REPAIR');
});
test('an unrelated unresolved member type cannot ride inside a selected declaration',()=>{
 const r=run('include "types"\nstruct gs_Box{gs_External x;Missing y;};gs_Box storage;');assert.equal(r.status,'REQUIRES_INTERFACE_REPAIR');assert(r.failures.length);
});
