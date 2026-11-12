import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=text=>createHash('sha256').update(text).digest('hex');

// Assemble each complete view once. Re-slicing the entire intermediate source
// for every edit costs O(source length * edit count) and retains large ropes.
// The accepted edits, source checks, offsets, inverse and proof stay identical.
export function applyReversibleSourceEdits(source,input){
  assert.equal(typeof source,'string');assert(Array.isArray(input));
  const edits=input.map(row=>({...row})).sort((a,b)=>a.start-b.start||a.end-b.end);
  const chunks=[];let delta=0,cursor=0;
  for(let i=0;i<edits.length;i++){
    const edit=edits[i];
    assert(Number.isSafeInteger(edit.start)&&Number.isSafeInteger(edit.end)&&edit.start>=0&&edit.end>=edit.start&&edit.end<=source.length);
    assert.equal(typeof edit.before,'string');assert.equal(typeof edit.replacement,'string');
    if(i)assert(edits[i-1].end<=edit.start,'OVERLAPPING_SOURCE_EDITS');
    assert.equal(source.slice(edit.start,edit.end),edit.before);
    edit.newStart=edit.start+delta;delta+=edit.replacement.length-edit.before.length;
    chunks.push(source.slice(cursor,edit.start),edit.replacement);cursor=edit.end;
  }
  chunks.push(source.slice(cursor));const text=chunks.join(''),inverse=[];cursor=0;
  for(const edit of edits){
    const end=edit.newStart+edit.replacement.length;
    assert.equal(text.slice(edit.newStart,end),edit.replacement);
    inverse.push(text.slice(cursor,edit.newStart),edit.before);cursor=end;
  }
  inverse.push(text.slice(cursor));assert.equal(inverse.join(''),source,'SOURCE_EDIT_BYTE_INVERSE');
  return {text,proof:{sourceSha256:sha(source),proofInputSha256:sha(text),edits,byteInverseVerified:true}};
}
