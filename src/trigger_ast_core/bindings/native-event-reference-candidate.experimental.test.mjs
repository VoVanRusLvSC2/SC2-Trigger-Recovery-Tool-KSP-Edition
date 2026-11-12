import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveNativeEventReferenceCandidate as resolve} from './native-event-reference-candidate.experimental.mjs';
function fixture(){
 const lib={id:'Ntve'},formals=[{paramType:{type:'unit'},isReference:true},{paramType:{type:'int'}}];
 const definition={name:'Example',id:'A',flags:['Event','Native'],parameters:[0,1],returnType:{type:'void'}};
 const candidate={key:'Ntve:FunctionDef:A',library:lib,definition,origin:'emitted',symbol:'Example'};
 const index={libraries:new Map([['Ntve',lib]]),bySymbol:new Map([['Example',[candidate]]]),formal:r=>formals[r],carrier:p=>p?.type};
 const query={name:'Example',declaration:{returnType:'void',parameters:['trigger','unitref','int']}},prior={status:'SIGNATURE_MISMATCH',candidateKeys:[]};
 return {index,query,prior,definition,candidate,formals,lib};
}
test('exact stock reference ABI resolves one Event without creating a definition',()=>{const x=fixture(),r=resolve(x.index,x.query,x.prior,'Ntve');assert.equal(r.status,'RESOLVED');assert.equal(r.definition,x.definition);assert.equal(r.proof.newNativeDefinitions,0)});
test('mismatched reference, arity, role, return and missing identity are refused',()=>{for(const mutation of [x=>x.formals[0].isReference=false,x=>x.query.declaration.parameters.pop(),x=>x.query.guiUse='action',x=>x.query.declaration.returnType='int',x=>x.candidate.origin='imported',x=>x.definition.scriptCode='fake']){const x=fixture();mutation(x);assert.equal(resolve(x.index,x.query,x.prior,'Ntve').status,'SIGNATURE_MISMATCH')}});
test('another native Event owner stays ambiguous',()=>{const x=fixture();x.index.bySymbol.get('Example').push({...x.candidate,key:'Other:A',library:{id:'Other'}});assert.equal(resolve(x.index,x.query,x.prior,'Ntve').status,'SIGNATURE_MISMATCH')});
test('does not override other prior errors',()=>{const x=fixture();for(const status of ['AMBIGUOUS','UNRESOLVED','RESOLVED'])assert.equal(resolve(x.index,x.query,{status},'Ntve').status,status)});
