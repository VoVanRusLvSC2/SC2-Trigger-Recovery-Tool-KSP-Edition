import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalClosedInt32ExpressionView as proof} from './closed-int32-expression-view.mjs';
const view=expr=>proof('int Main(){return '+expr+';}');
test('radices, exact integer bitwise and arithmetic agree without host floats',()=>{
 for(const [s,n]of [['(01650570 ^ ((01777777 + 00) - 44770))','101'],['(((01464013 - 0110670) + 38305) ^ 0x66be5)','17'],['0x7fff & 077','63'],['(~0) ^ 0x7fffffff','(-2147483647 - 1)'],['(3 << 4) | 2','50']])assert.equal(view(s).text,'int Main(){return '+n+';}');
});
test('array extents become actual literal counts; dimensions are never changed by convention',()=>{
 const r=proof('int[(017 ^ 010)] cells;');assert.equal(r.text,'int[7] cells;');assert(r.proof.edits.byteInverseVerified);
});
test('overflow, invalid octal, divide and signed shifts do not get evaluated',()=>{
 for(const s of ['2147483647+1','0x80000000','08','9/2','-4>>1','1<<32','1<<31','0.5+1','Read()+3','value+2']){
  const r=view(s),start='int Main(){return '.length;assert(!r.proof.records.some(x=>x.start===start&&x.end===start+s.length),'whole unknown expression must not be folded');
 }
});
test('runtime reads, allocations and side-effect order survive',()=>{
 const r=proof('int Main(){Observe();return Read()+(017^010);}');assert(r.text.includes('Observe();return Read()+7;'));
});
test('different closed values remain different for the full oracle',()=>assert.notEqual(view('07^03').text,view('07^02').text));
