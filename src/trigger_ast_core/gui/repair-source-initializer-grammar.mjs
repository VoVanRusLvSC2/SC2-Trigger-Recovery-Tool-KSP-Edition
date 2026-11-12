import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {verifySourceInitializerGuiOwnership} from '../verification/source-initializer-gui-ownership.native-action-role.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Repair previously reconstructed GUI only after independent source/lifetime
// reconstruction. Existing authored definitions retain their original policy.
// No map names, API aliases, runtime source or new graph identities are involved.
export function repairSourceInitializerGrammar({input,xml}){
 const root=xmlTree(xml),edits=[],changed=[];
 const owner=root.children.find(n=>n.tag==='Standard')?.attributes.Id??input.libraryId??'Map';
 const key=(library,id)=>JSON.stringify([library,'FunctionDef',id]);
 const old=new Set();
 if(input.existingTriggerData){
  const prior=xmlTree(input.existingTriggerData);
  function remember(node,library){if(node.tag==='Library')library=node.attributes.Id;
   if(node.tag==='Element'&&node.attributes.Type==='FunctionDef')old.add(key(library,node.attributes.Id));
   for(const child of node.children)remember(child,library);}
  remember(prior,prior.children.find(n=>n.tag==='Standard')?.attributes.Id??input.libraryId??'Map');
 }
 function visit(node,library){
  if(node.tag==='Library')library=node.attributes.Id;
  if(node.tag==='Element'&&node.attributes.Type==='FunctionDef'&&!old.has(key(library,node.attributes.Id))){
   const code=node.children.find(n=>n.tag==='ScriptCode'),flags=node.children.filter(n=>n.tag.startsWith('Flag'));
   if(code&&xml.slice(code.openEnd,code.closeStart).trim()==='#SUBFUNCS(actions)'&&flags.some(n=>n.tag==='FlagEvent')&&flags.some(n=>n.tag==='FlagSubFunctions')){
    const action=flags.filter(n=>n.tag==='FlagAction');
    if(action.length){
     assert.equal(action.length,1,'INITIALIZER_GRAMMAR_AMBIGUOUS_ACTION_FLAG');
     assert(!flags.some(n=>n.tag==='FlagOperator'),'INITIALIZER_GRAMMAR_CONFLICTING_ROLES');
     edits.push({start:action[0].start,end:action[0].end,before:xml.slice(action[0].start,action[0].end),after:'<FlagOperator/>'});
     changed.push({library,type:'FunctionDef',id:node.attributes.Id});
    }
   }
  }
  for(const child of node.children)visit(child,library);
 }
 visit(root,owner);let after=xml;
 for(const edit of edits.toReversed())after=after.slice(0,edit.start)+edit.after+after.slice(edit.end);
 const ownership=verifySourceInitializerGuiOwnership({input,after,before:input.existingTriggerData??''});
 const reconstructed=new Set(ownership.records.map(r=>key(r.definition.library,r.definition.id)));
 assert(changed.every(r=>reconstructed.has(key(r.library,r.id))),'INITIALIZER_GRAMMAR_SOURCE_RECONSTRUCTION_REQUIRED');
 return {xml:after,proof:{kind:'SOURCE_RECONSTRUCTED_NATIVE_INITIALIZER_GRAMMAR_REPAIR',beforeSha256:sha(xml),afterSha256:sha(after),
  changed,edits,ownership,newNative:0,newCustomScript:0,newRuntimeFunctions:0,newGuiIdentities:0,
  sourceOrBusinessLogicChanged:false,onlyDeclarativeRoleFlagsChanged:true,nativeExportRequired:true,wholePhaseAccepted:false,wholeMapAccepted:false}};
}
