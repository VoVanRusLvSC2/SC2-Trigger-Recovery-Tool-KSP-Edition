import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectContextualNativeValueCandidates as inspect} from './contextual-native-source-identity.mjs';
function fixture(name='CurrentRuntimeCell'){
 const library={id:'Loaded'},definition={type:'FunctionDef',id:'1234',library:'Loaded',name,flags:['Call','Operator'],parameters:[],returnType:{type:'int'},scriptCode:'#AUTOVAR(cell,ancestor:EachValue)'};
 const candidate={definition,library,key:'Loaded:FunctionDef:1234',symbol:name,origin:'emitted'};
 return {definition,candidate,index:{bySymbol:new Map([[name,[candidate]]]),carrier:t=>t?.type},name,abi:{returnType:'int',parameters:[]}};
}
test('context-only implementation is identified without an API-name or ID table',()=>{
 for(const name of ['CurrentRuntimeCell','AnotherNativeGetter']){const f=fixture(name),p=inspect(f.index,f.name,f.abi);assert(p);assert.equal(p.candidates[0].ancestor,'EachValue');assert.equal(p.differentNativeNameAliasAccepted,false);}
});
test('an exact existing native candidate blocks creation of another description',()=>{
 const f=fixture();f.index.bySymbol.get(f.name).push({...f.candidate,key:'Loaded:FunctionDef:5678',definition:{...f.definition,id:'5678',flags:['Native','Call'],scriptCode:undefined}});assert.equal(inspect(f.index,f.name,f.abi),undefined);
});
test('different symbol, template alias, ABI mismatch and required formals refuse',()=>{
 for(const change of [f=>f.candidate.symbol='Different',f=>f.candidate.origin='template',f=>f.abi.returnType='unit',f=>f.definition.parameters=[{id:'A'}]]){const f=fixture();change(f);assert.equal(inspect(f.index,f.name,f.abi),undefined);}
});
test('effectful or unknown metadata cannot be treated as a pure lexical getter',()=>{
 for(const change of [f=>f.definition.scriptCode+='; SideEffect();',f=>f.definition.actions=[{id:'A'}],f=>f.definition.expressionCode='Runtime()',f=>f.definition.unknownXml=[{tag:'Unknown'}],f=>f.definition.flags.push('Native')]){const f=fixture();change(f);assert.equal(inspect(f.index,f.name,f.abi),undefined);}
});
test('disabled or parameterized source APIs are not authorized by this rule',()=>{
 const f=fixture();f.definition.disabled=true;assert.equal(inspect(f.index,f.name,f.abi),undefined);delete f.definition.disabled;f.abi.parameters=['int'];assert.equal(inspect(f.index,f.name,f.abi),undefined);
});
