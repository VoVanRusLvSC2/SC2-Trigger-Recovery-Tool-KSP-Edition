import test from 'node:test';import assert from 'node:assert/strict';
import {inspectNonCodeModelPayload as inspect} from './non-code-model-payload.bounded-ranges.mjs';
function fixture(){const b=Buffer.alloc(144);const put=(p,s)=>b.write([...s].reverse().join(''),p,'ascii');put(0,'MD34');b.writeUInt32LE(80,4);b.writeUInt32LE(4,8);b.writeUInt32LE(1,12);b.writeUInt32LE(1,16);
 for(const[i,t,o,c,v]of[[0,'MD34',0,1,11],[1,'MODL',32,1,99],[2,'U8__',48,8,0],[3,'CHAR',64,8,0]]){const p=80+i*16;put(p,t);b.writeUInt32LE(o,p+4);b.writeUInt32LE(c,p+8);b.writeUInt32LE(v,p+12);}return b;}
const opaque=(b,r,s)=>r.opaqueRanges.some(x=>b.subarray(x.start,x.end).includes(Buffer.from(s)));
test('only bounded primitive model fields exclude incidental identifiers',()=>{
 const b=fixture();b.write('FnX',49);b.write('FnX',65);b.write('FnX',33);const r=inspect('assets/model.m3',b);assert(r);assert.equal(r.numericBlocks.length,1);assert(opaque(b,r,'FnX'));assert(r.nonReferenceRanges.some(x=>x.start<=49&&x.end>=52));
});
test('unknown block, CHAR, padding and appended tail stay opaque',()=>{
 const b=Buffer.concat([fixture(),Buffer.from('TailName')]);b.write('PadName',56);const r=inspect('model.m3',b);assert(opaque(b,r,'TailName'));assert(opaque(b,r,'PadName'));assert(r.opaqueRanges.some(x=>x.start<=64&&x.end>=72));
});
test('truncated, overlapping, overflowing and invalid owner indices refuse',()=>{
 for(const change of [b=>b.writeUInt32LE(0xffffffff,8),b=>b.writeUInt32LE(20,16),b=>b.writeUInt32LE(32,80+2*16+4),b=>b.writeUInt32LE(100,80+2*16+8),b=>b.write('BAD!',0)]){const b=fixture();change(b);assert.equal(inspect('x.m3',b),undefined);}
 assert.equal(inspect('x.m3',fixture().subarray(0,140)),undefined);
});
test('unknown primitive versions never acquire a non-reference exemption',()=>{
 const b=fixture();b.writeUInt32LE(7,80+2*16+12);const r=inspect('x.m3',b);assert(r);assert.equal(r.numericBlocks.length,0);assert(r.opaqueRanges.some(x=>x.start<=48&&x.end>=56));
});
test('extension and MD34 magic must agree',()=>{assert.equal(inspect('x.txt',fixture()),undefined);assert.equal(inspect('../x.m3',fixture()),undefined);});
