import test from 'node:test';import assert from 'node:assert/strict';
import {createVerifiedConversionProgram as create} from '../../map_global_repair_v392_exact_function_signatures_2026-10-24/graph/aa4c4c83caa8-18c27fb7e1b6-76164785f1a0-53f61e3aca29-verified-conversion-program.mjs';
import {capturePartitionStartupOwnership as capture,readPartitionStartupOwnership as read} from './partition-startup-ownership.mjs';
const program=text=>create([{fileName:'source.galaxy',text,owned:true}]);
const body=(p,name)=>p.documents.get('source.galaxy').statements.find(n=>n.name?.name===name&&n.body);
const library='void LibraryTriggers(){Create();}void LibraryInit(){LibraryTriggers();}void Create(){}';
test('Library partitions retain the bound parent startup path after parent disposal',()=>{
 const parent=program(library+'void InitMap(){LibraryInit();}'),cap=capture(parent);parent.dispose();
 const child=program(library);try{const r=read(cap,child).functionOwnership(body(child,'Create'));assert.equal(r.callers.length,1);assert.equal(r.callers[0].directStartupPath,true);assert.equal(r.allReferencesAreBoundDirectCalls,true);}finally{child.dispose();}
});
test('Runtime callers outside the partition remain visible and block automatic ownership',()=>{
 const parent=program(library+'void Runtime(){Create();}void InitMap(){LibraryInit();}'),cap=capture(parent),child=program(library);
 try{const r=read(cap,child).functionOwnership(body(child,'Create'));assert.equal(r.callers.length,2);assert.equal(r.callers.filter(c=>!c.directStartupPath).length,1);}finally{parent.dispose();child.dispose();}
});
test('Forged capabilities, changed bodies and conflicting declarations give no ownership',()=>{
 const parent=program(library+'void InitMap(){LibraryInit();}'),cap=capture(parent),child=program(library.replace('void Create(){}','void Create(){LibraryInit();}'));
 try{assert.throws(()=>read({...cap},child),/UNTRUSTED/);assert.equal(read(cap,child).functionOwnership(body(child,'Create')),undefined);}finally{parent.dispose();child.dispose();}
 const noRoot=program(library);try{assert.equal(capture(noRoot),undefined);}finally{noRoot.dispose();}
});
