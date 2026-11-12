// A final XML formatting pass, after attribute owner/value binding. No new
// definitions, labels, defaults, namespace remapping, functions or expressions.
import assert from 'node:assert/strict';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {parseOwnedTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/9df4e70daea3-55336c934a77-8700bdf83655-62a38b2020d9-ba49c37dce1d-trigger_document_scope_v383.mjs';
import {applyDisjointXmlPatches} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/apply_disjoint_xml_patches_v661.mjs';
import {quoteAttributeSelectorScalar} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/6299235e0dd2-attribute-selector-domain.literal-codec.mjs';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function finalizeAttributeSelectorQuotes(triggerXml){
 const tree=xmlTree(triggerXml),libraries=parseOwnedTriggerDocument(triggerXml),patches=[],changes=[];
 const implicit=[...libraries.values()].find(l=>l.implicit)?.id;
 function walk(n,owner){
  if(n.tag==='Library')owner=n.attributes.Id;
  if(n.tag==='Element'&&n.attributes.Type==='Param'){
   const p=libraries.get(owner)?.elementsByType.Param[n.attributes.Id];
   if(p&&['attributegame','attributeplayer'].includes(p.valueType?.type)){
    const data=structuredClone(p);
    if(quoteAttributeSelectorScalar(data)){
     const values=n.children.filter(c=>c.tag==='Value'),types=n.children.filter(c=>c.tag==='ValueType');
     assert(values.length===1&&!values[0].selfClosing&&types.length===1,'AMBIGUOUS_ATTRIBUTE_SELECTOR_SCALAR');
     assert.equal(types[0].attributes.Type,p.valueType.type);
     patches.push({start:values[0].openEnd,end:values[0].closeStart,text:escape(data.value)});
     changes.push({owner,paramId:p.id,valueType:p.valueType.type,before:p.value,after:data.value,rule:'EDITOR_ATTRIBUTE_OUTER_DELIMITERS_NO_ESCAPING'});
    }
   }
  }
  for(const c of n.children)walk(c,owner);
 }
 walk(tree,implicit);
 const output=applyDisjointXmlPatches(triggerXml,patches),parsed=parseOwnedTriggerDocument(output);
 for(const c of changes){const p=parsed.get(c.owner)?.elementsByType.Param[c.paramId];assert.equal(p.value,c.after);assert.equal(p.valueType.type,c.valueType);}
 return {triggerXml:output,changes,definitionsOrDefaultsAdded:false,ownerIdsChanged:false};
}
