import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {reconcileAuthoredContextualNativeGetters as reconcile} from './authored-contextual-native-getters.scoped.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const getter={type:'FunctionDef',id:'GET',library:'Stock',name:'Fetch',identifier:'Fetch',parameters:[],flags:['Operator','Call'],returnType:{type:'int'},scriptCode:'#AUTOVAR(var,ancestor:Each)'};
const candidate={key:'Stock:GET',symbol:'Fetch',origin:'emitted',library:{id:'Stock'},definition:getter};
const candidates={bySymbol:new Map([['Fetch',[candidate]]]),carrier:t=>t?.type,resolve:()=>({status:'RESOLVED'})};
const xml='<TriggerData><!-- authored spacing --><Root><Item Type="FunctionCall" Id="CALL"/></Root><Element Type="FunctionCall" Id="CALL"><FunctionDef Type="FunctionDef" Library="Stock" Id="GET"/></Element></TriggerData>';
const owners=[{library:'Map',sourceFunction:'F',roots:[{type:'FunctionCall',id:'CALL'}]}];
function run({text=xml,source='void F(){int a; a=Fetch();}',os=owners,deny=false}={}){
 const files=[{fileName:'root.galaxy',text:source,owned:true},{fileName:'native.galaxy',text:'native int Fetch();',owned:false}].map(f=>({...f,sourceId:f.fileName,contentSha256:sha(f.text)}));
 const program=new GalaxyProgramContext(files,{files,dependencies:[]},sha);for(const ast of program.documents.values())program.attachOriginal(ast);
 const factory={describe:(call,ctx)=>{if(deny)return;const d={type:'FunctionDef',id:'NEW',library:ctx.libId,identifier:'Fetch',name:'Fetch',flags:['Native','NoScriptPrefix','Call'],returnType:{type:'int'},parameters:[]};ctx.elements.NEW=d;return d;},report:()=>({testFactory:true})};
 try{return reconcile({xml:text,sourceAst:program.documents.get('root.galaxy'),program,candidates,factory,owners:os});}finally{program.dispose();}
}
test('changes only scoped getter references and appends exact descriptors; inverse restores all authored XML',()=>{
 const r=run();assert.equal(r.proof.records.length,1);assert.equal(r.proof.newNativeDescriptions,1);assert.equal(r.proof.newRuntimeFunctions,0);assert.equal(r.proof.wholeProgramEquivalenceProved,false);assert(r.proof.allOtherXmlBytesExactByInverse);
 assert(r.xml.includes('<!-- authored spacing -->'));assert(r.xml.includes('Library="Map" Id="NEW"'));assert(r.xml.includes('<FlagNative/>'));
});
test('missing runtime source call, a shadowing ordinary function, and occurrence mismatch retain original binding',()=>{
 for(const source of ['void F(){}','int Fetch(){return 0;} void F(){int a;a=Fetch();}','void F(){int a;a=Fetch()+Fetch();}'])assert.equal(run({source}).xml,xml);
});
test('shared GUI expressions or owners never acquire guessed runtime semantics',()=>{
 const shared=xml.replace('</Root>','<Item Type="FunctionCall" Id="CALL"/></Root>');assert.equal(run({text:shared}).xml,shared);
 const os=[...owners,{...owners[0],sourceFunction:'G'}];assert.equal(run({os,source:'void F(){Fetch();} void G(){Fetch();}'}).xml,xml);
});
test('ABI factory refusal and nonempty getter expression retain original XML',()=>{
 assert.equal(run({deny:true}).xml,xml);const text=xml.replace('</Element>','<Value>7</Value></Element>');assert.equal(run({text}).xml,text);
});
test('an omitted FunctionDef library uses its expression scope, never the owning source function scope',()=>{
 const text='<TriggerData><Root><Item Type="FunctionCall" Library="Other" Id="CALL"/></Root><Library Id="Other"><Root></Root><Element Type="FunctionCall" Id="CALL"><FunctionDef Type="FunctionDef" Id="GET"/></Element></Library></TriggerData>';
 const local={...candidate,library:{id:'Map'},definition:{...getter,library:'Map'}};
 candidates.bySymbol.set('Fetch',[local]);
 try{const r=run({text,os:[{...owners[0],roots:[{type:'FunctionCall',library:'Other',id:'CALL'}]}]});assert.equal(r.xml,text);assert.equal(r.proof.newNativeDescriptions,0);}
 finally{candidates.bySymbol.set('Fetch',[candidate]);}
});
