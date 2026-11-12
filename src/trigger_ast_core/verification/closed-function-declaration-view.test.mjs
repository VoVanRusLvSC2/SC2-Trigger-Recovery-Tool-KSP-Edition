import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalClosedFunctionDeclarations as view} from './closed-function-declaration-view.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
test('private bound direct calls retain body and ABI with neutral linkage',async()=>{
  const a='static int Value(int p){return p+1;}void InitMap(){Value(2);}';const r=view(a);
  assert.equal(r.proof.records.length,1);assert(r.proof.byteInverseVerified&&r.proof.allOtherAstExact);
  const oracle=await openPinnedUserOracle();assert((await oracle.compare(r.text,a.replace('static ',''))).exact);
});
test('an unused bodiless prototype has no runtime action',()=>{
  const a='void Unused();void InitMap(){}',r=view(a);assert.equal(r.proof.records.length,1);assert(!r.text.includes('Unused'));
});
test('used unresolved prototypes, entrypoints and native APIs remain',()=>{
  for(const a of ['void Missing();void InitMap(){Missing();}','static void InitMap(){}','native int Value();void InitMap(){Value();}'])assert.equal(view(a).text,a);
});
test('function-name callbacks and unknown protocol inputs prevent linkage permission',()=>{
  for(const arg of ['"Value"','"Va"+"lue"','input']){
    const a='native trigger TriggerCreate(string functionName);string input;static bool Value(bool a,bool b){return a;}void Other(string input){TriggerCreate('+arg+');}void InitMap(){Value(true,false);Other(input);}';
    assert.equal(view(a).text,a);
  }
});
test('conflicting or externally declared function groups remain unchanged',()=>{
  const a='static int Value(int p){return p;}void InitMap(){Value(1);}';
  const r=view(a,{externalSources:[{fileName:'Extra.galaxy',text:'int Value(int q);'}]});
  // An unreachable declaration is not part of this closed compilation unit.
  assert.equal(r.proof.records.length,1);
  const b='include "Extra"\n'+a;assert.equal(view(b,{externalSources:[{fileName:'Extra.galaxy',text:'int Value(int q);'}]}).text,b);
});
test('changed implementation, signature and call values are still rejected',async()=>{
  const oracle=await openPinnedUserOracle(),a='static int Value(int p){return p+1;}void InitMap(){Value(2);}';
  for(const b of [a.replace('p+1','p+2'),a.replace('Value(2)','Value(3)'),a.replace('int Value','fixed Value')])assert(!(await oracle.compare(view(a).text,view(b).text)).exact);
});
