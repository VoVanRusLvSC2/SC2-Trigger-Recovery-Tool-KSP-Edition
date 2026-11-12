import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=text=>createHash('sha256').update(text).digest('hex');

export function applyReversibleSourceEdits(source,input) {
  const edits=input.map(row=>({...row})).sort((a,b)=>a.start-b.start||a.end-b.end);
  let delta=0;
  for(let index=0;index<edits.length;index++){
    const edit=edits[index];assert(edit.start>=0&&edit.end>=edit.start&&edit.end<=source.length);
    if(index)assert(edits[index-1].end<=edit.start,'OVERLAPPING_SOURCE_EDITS');
    assert.equal(source.slice(edit.start,edit.end),edit.before);edit.newStart=edit.start+delta;
    delta+=edit.replacement.length-edit.before.length;
  }
  let text=source;for(const edit of [...edits].reverse())text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
  let inverse=text;for(const edit of [...edits].reverse()){
    assert.equal(inverse.slice(edit.newStart,edit.newStart+edit.replacement.length),edit.replacement);
    inverse=inverse.slice(0,edit.newStart)+edit.before+inverse.slice(edit.newStart+edit.replacement.length);
  }
  assert.equal(inverse,source,'SOURCE_EDIT_BYTE_INVERSE');
  return {text,proof:{sourceSha256:sha(source),proofInputSha256:sha(text),edits,byteInverseVerified:true}};
}
