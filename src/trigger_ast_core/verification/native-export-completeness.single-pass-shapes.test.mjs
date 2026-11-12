import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNativeExportCompleteness as check} from './native-export-completeness.single-pass-shapes.mjs';
const original='int gv_count; void Main(int value){int result=value+1;gv_count=result;}';
const compare=(actual,options={})=>check({expectedSource:original,exportedSource:actual,requireExactSourceSet:true,...options});
test('the exact document retains complete signatures, values and declaration sets',()=>assert.equal(compare(original).status,'PASS'));
test('binder-proven local/parameter renaming remains allowed',()=>assert.equal(compare('int gv_count; void Main(int p){int q=p+1;gv_count=q;}').status,'PASS'));
test('extra wrapper functions fail the complete-document contract',()=>{
 const r=compare(original+' void ExtraWrapper(){Main(1);}');assert.equal(r.status,'FAIL');assert(r.issues.some(i=>i.kind==='UNEXPECTED_FUNCTION_BODY'&&i.function==='ExtraWrapper'));
});
test('an unused extra function also fails',()=>assert.equal(compare(original+' int Extra(){return 0;}').status,'FAIL'));
test('additional global state fails',()=>{
 const r=compare('int extra; '+original);assert.equal(r.status,'FAIL');assert(r.issues.some(i=>i.kind==='UNEXPECTED_DECLARATION'&&i.name==='extra'));
});
test('additional type declarations fail',()=>assert.equal(compare('struct Extra {int x;}; '+original).status,'FAIL'));
test('forward declarations for the same function do not create runtime functions',()=>assert.equal(compare('void Main(int other); '+original).status,'PASS'));
test('component scope remains explicit and cannot authorize an exact document',()=>{
 assert.equal(compare(original+' void Harness(){}',{requireExactSourceSet:false,scope:'source-function-component'}).status,'PASS');
 assert.throws(()=>check({expectedSource:original,exportedSource:original,expectations:[{owner:'Main',statements:'gv_count=1;'}],requireExactSourceSet:true}),/COMPLETE_DOCUMENT/);
});
test('existing operation and literal checks remain strict',()=>{
 for(const text of [original.replace('+1','+2'),original.replace('gv_count=result;',''),original.replace('gv_count=result;','gv_count=result;gv_count=0;')])assert.equal(compare(text).status,'FAIL');
});
test('return ABI changes remain unproven',()=>assert.notEqual(compare(original.replace('void Main','int Main')).status,'PASS'));
