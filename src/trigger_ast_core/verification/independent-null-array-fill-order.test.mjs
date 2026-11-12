import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalIndependentNullArrayFillOrder as proof} from './independent-null-array-fill-order.mjs';
const header='native timer TimerCreate();native sound SoundLastPlayed();string[3] cells;timer clock;sound last;int statusCode;';
const loop='for(i=0;i<=2;i+=1){cells[i]=null;}';
const run=(body,extra='')=>proof(header+extra+'void Main(){int i;'+body+'}');
test('complete fill commutes with exact native constructors and queries, retaining their order',()=>{
 const r=run(loop+'clock=TimerCreate();last=SoundLastPlayed();statusCode=7;');assert.equal(r.proof.records.length,1);
 assert(r.text.indexOf('clock = TimerCreate()')<r.text.indexOf('last = SoundLastPlayed()'));assert(r.text.indexOf('last = SoundLastPlayed()')<r.text.indexOf('for ('));
});
test('callback-capable/unknown calls and source overrides refuse',()=>{
 assert.equal(run(loop+'statusCode=Unknown();').proof.records.length,0);
 assert.equal(run(loop+'clock=TimerCreate();','timer TimerCreate(){return null;}').proof.records.length,0);
});
test('counter live-out, incomplete and out-of-bounds fills remain',()=>{
 for(const body of [loop+'statusCode=i;',loop.replace('<=2','<=1')+'statusCode=7;',loop.replace('<=2','<=3')+'statusCode=7;'])assert.equal(run(body).proof.records.length,0);
});
test('array reads, non-null stores and control flow block reordering',()=>{
 for(const body of [loop+'statusCode=StringLength(cells[0]);',loop.replace('=null','=Read()')+'statusCode=7;',loop+'if(Check()){statusCode=7;}'])assert.equal(run(body).proof.records.length,0);
});
test('runtime loop and call count changes cannot collapse to the same proof view',()=>{
 const a=run(loop+'clock=TimerCreate();'),b=run(loop+'clock=TimerCreate();clock=TimerCreate();');assert.notEqual(a.text,b.text);
});
