// An empty serialization envelope is not existing GUI. Keep any authored node,
// root item, foreign library, XML comment or unknown metadata conservatively.
import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
export function authoredGuiInventory(xml,{libraryId='Map'}={}){
 const present=typeof xml==='string'&&!!xml.trim();
 const result={kind:'AUTHORED_GUI_STRUCTURE_INVENTORY',present,definitionCount:0,itemCount:0,
  foreignLibraries:[],unknownTags:[],unknownAttributes:[],xmlComments:present&&xml.includes('<!--'),
  xmlSha256:present?createHash('sha256').update(xml).digest('hex'):null};
 if(!present)return {...result,effectivelyEmpty:true};
 const root=xmlTree(xml),unknown=new Set();
 function visit(n){
  if(n.tag==='Element')result.definitionCount++;
  else if(n.tag==='Item')result.itemCount++;
  else if(!['TriggerData','Root','Library','Standard'].includes(n.tag))unknown.add(n.tag);
  const allowed={TriggerData:['Version'],Root:[],Library:['Id'],Standard:['Id']}[n.tag];
  if(allowed)for(const attribute of Object.keys(n.attributes))if(!allowed.includes(attribute))
   result.unknownAttributes.push({tag:n.tag,attribute});
  if(n.tag==='Library'&&n.attributes.Id!==libraryId)result.foreignLibraries.push(n.attributes.Id);
  for(const c of n.children??[])visit(c);
 }visit(root);
 result.unknownTags=[...unknown];
 return {...result,effectivelyEmpty:root.tag==='TriggerData'&&!result.definitionCount&&!result.itemCount&&
  !result.foreignLibraries.length&&!result.unknownTags.length&&!result.unknownAttributes.length&&!result.xmlComments};
}
