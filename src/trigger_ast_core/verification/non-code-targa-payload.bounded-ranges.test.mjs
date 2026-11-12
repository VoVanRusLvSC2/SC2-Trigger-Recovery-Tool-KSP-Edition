import test from 'node:test';import assert from 'node:assert/strict';
import {inspectNonCodeTargaPayload as inspect} from './non-code-targa-payload.bounded-ranges.mjs';
function raw(){const b=Buffer.alloc(18+24);b[2]=2;b.writeUInt16LE(4,12);b.writeUInt16LE(2,14);b[16]=24;return b;}
test('bounded raw pixel bytes are separate from optional image ID and trailing metadata',()=>{
 const pixels=raw();pixels.write('Private',18);const r=inspect('texture.tga',pixels);assert(r);assert.deepEqual(r.opaqueRanges,[]);
 const b=Buffer.concat([pixels.subarray(0,18),Buffer.from('IdName'),pixels.subarray(18),Buffer.from('Trailer')]);b[0]=6;const q=inspect('texture.tga',b);assert.deepEqual(q.opaqueRanges,[{start:18,end:24},{start:48,end:55}]);
});
test('RLE packets must account for exactly the complete image',()=>{
 const b=Buffer.concat([raw().subarray(0,18),Buffer.from([0x87,1,2,3])]);b[2]=10;assert(inspect('rle.tga',b));
 const over=Buffer.from(b);over[18]=0x88;assert.equal(inspect('rle.tga',over),undefined);
 assert.equal(inspect('rle.tga',b.subarray(0,b.length-1)),undefined);
});
test('unknown color maps, dimensions, interleaving, formats and truncated payloads refuse',()=>{
 for(const change of [b=>b[1]=1,b=>b[2]=7,b=>b.writeUInt16LE(0,12),b=>b[17]=0x40,b=>b[16]=17,b=>b[0]=255]){const b=raw();change(b);assert.equal(inspect('x.tga',b),undefined);}
 assert.equal(inspect('x.tga',raw().subarray(0,30)),undefined);assert.equal(inspect('x.png',raw()),undefined);
});
