import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {retainSourceLibraryCompilerDemand as retain} from './source-library-compiler-demand.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const xml='<TriggerData><Root><Item Type="Trigger" Id="OLD"/></Root><!-- authored --><Element Type="Trigger" Id="OLD"><Identifier>Original</Identifier></Element></TriggerData>';
function context(body='<FlagAction/>',id='AbCd') {
 const text=`<TriggerData><Standard Id="${id}"/><Element Type="FunctionDef" Id="F001">${body}</Element></TriggerData>`;
 const file={fileName:'TriggerLibs/Test.triggerlib',text,sha256:sha(text)};
 return {metadata:[file],plan:{kind:'ORIGINAL_COMPILER_LIBRARY_AUTOLOAD_DEMAND',required:['lib'+id+'_InitLib'],demands:[{id,initializer:'lib'+id+'_InitLib',sourceOrder:0,metadata:{fileName:file.fileName,sha256:file.sha256}}]}};
}
test('source-bound stock action becomes an inert flat dependency carrier; authored bytes and idempotency survive',()=>{
 const c=context(),r=retain(xml,c);assert.equal(r.proof.records.length,1);assert.equal(r.proof.newFunctionDefs,0);assert.notEqual(r.proof.records[0].trigger,r.proof.records[0].call);
 assert(r.xml.includes('<Disabled/><Action'));assert(r.xml.includes('Library="AbCd" Id="F001"'));
 assert.equal(retain(r.xml,c).xml,r.xml);assert.equal(r.proof.allOtherBytesExactByInverse,true);
});
test('parameterful, event, private, disabled and non-void actions cannot be selected',()=>{
 for(const body of ['<FlagAction/><Parameter Type="ParamDef" Id="P"/>','<FlagAction/><FlagEvent/>','<FlagAction/><Internal/>','<FlagAction/><Disabled/>','<FlagAction/><ReturnType><Type Value="int"/></ReturnType>']) {
  const r=retain(xml,context(body));assert.equal(r.xml,xml);assert.equal(r.proof.refused.length,1);
 }
});
test('metadata integrity, source order and existing carrier edits fail closed',()=>{
 const c=context();assert.throws(()=>retain(xml,{...c,metadata:[{...c.metadata[0],text:c.metadata[0].text+' '}]}),/EXACT_METADATA/);
 const r=retain(xml,c);assert.throws(()=>retain(r.xml.replace('<Disabled/>',''),c),/CARRIER_CONFLICT/);
 const bad=context();bad.plan.demands[0].sourceOrder=1;assert.throws(()=>retain(xml,bad),/SOURCE_ORDER/);
});
test('source library IDs and typed ID collisions are generic and never modify original elements',()=>{
 const c=context('<FlagAction/>','Other'),a=retain(xml,c),id=a.proof.records[0].trigger;
 const collision=xml.replace('</TriggerData>',`<Element Type="Trigger" Id="${id}"/></TriggerData>`);
 const b=retain(collision,c);assert.notEqual(b.proof.records[0].trigger,id);assert(b.xml.includes(`<Element Type="Trigger" Id="${id}"/>`));
});
test('optional demand discovery retains existing typed foreign bindings; textual names do not count',()=>{
 const c=context(),withRef=xml.replace('</TriggerData>','<Element Type="FunctionCall" Id="C"><FunctionDef Type="FunctionDef" Library="AbCd" Id="Other"/></Element></TriggerData>');
 const r=retain(withRef,{...c,onlyUnreferencedLibraries:true});assert.equal(r.xml,withRef);assert.equal(r.proof.retainedBindings.length,1);
 assert.equal(retain(xml.replace('Original','AbCd'),{...c,onlyUnreferencedLibraries:true}).proof.records.length,1);
});
