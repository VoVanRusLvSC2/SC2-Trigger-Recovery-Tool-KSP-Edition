import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha=s=>createHash('sha256').update(s).digest('hex');

/** Migrate generated XML only. Existing authored GUI has its own binding
 * semantics and must never be reinterpreted through this operation. */
export function qualifyGeneratedLibraryReferences({xml,sourceGuiAbsent}) {
  assert.equal(sourceGuiAbsent,true,'GENERATED_GUI_SOURCE_ABSENCE_PROOF_REQUIRED');
  const root=xmlTree(xml);assert.equal(root.tag,'TriggerData');
  const edits=[],records=[];
  for(const group of root.children.filter(n=>n.tag==='Library')){
    const library=group.attributes.Id;
    assert(typeof library==='string'&&/^[A-Za-z0-9_]+$/u.test(library),'GENERATED_LIBRARY_ID_REQUIRED');
    const definitions=new Set();
    for(const node of group.children.filter(n=>n.tag==='Element')){
      const key=JSON.stringify([node.attributes.Type,node.attributes.Id]);
      assert(!definitions.has(key),'GENERATED_DUPLICATE_TYPED_ID');definitions.add(key);
    }
    const visit=node=>{
      assert(node.tag!=='Library','GENERATED_NESTED_LIBRARY_REFUSED');
      const a=node.attributes;
      if(node.tag!=='Element'&&a.Type!==undefined&&a.Id!==undefined&&a.Library===undefined){
        assert(definitions.has(JSON.stringify([a.Type,a.Id])),'GENERATED_UNQUALIFIED_TARGET_NOT_OWNED');
        const at=node.openEnd-(node.selfClosing?2:1),text=` Library="${library}"`;
        assert(xml.slice(at,node.openEnd)===(node.selfClosing?'/>':'>'),'GENERATED_REFERENCE_SPAN');
        edits.push({at,text});records.push({library,type:a.Type,id:a.Id,tag:node.tag});
      }
      for(const child of node.children)visit(child);
    };
    for(const node of group.children)visit(node);
  }
  let output=xml;
  for(const edit of edits.toSorted((a,b)=>b.at-a.at))output=output.slice(0,edit.at)+edit.text+output.slice(edit.at);
  xmlTree(output);
  let restored=output,shift=0;
  const inverse=edits.toSorted((a,b)=>a.at-b.at).map(edit=>{
    const record={at:edit.at+shift,text:edit.text};shift+=edit.text.length;return record;
  });
  for(const edit of inverse.toReversed()){
    assert.equal(restored.slice(edit.at,edit.at+edit.text.length),edit.text);
    restored=restored.slice(0,edit.at)+restored.slice(edit.at+edit.text.length);
  }
  assert.equal(restored,xml,'GENERATED_REFERENCE_QUALIFICATION_INVERSE');
  return {xml:output,proof:{kind:'GENERATED_LIBRARY_REFERENCE_QUALIFICATION',sourceGuiAbsent:true,changed:edits.length>0,
    beforeSha256:sha(xml),afterSha256:sha(output),records,allOtherBytesExactByInverse:true,
    newNative:0,newCustomScript:0,newRuntimeWrappers:0,wholeMapAccepted:false}};
}
