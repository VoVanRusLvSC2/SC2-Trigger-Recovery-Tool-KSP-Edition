import assert from 'node:assert/strict';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';

const child=(node,tag)=>node?.children.find(n=>n.tag===tag);
const body=(xml,node)=>node&&xml.slice(node.openEnd,node.closeStart);
const dimensions=node=>child(node,'VariableType')?.children.filter(n=>n.tag==='ArraySize')??[];
function elements(xml,implicitLibraryId) {
  const result=new Map();
  if(!xml)return result;
  const root=xmlTree(xml);
  for(const group of [root,...root.children.filter(n=>n.tag==='Library')]) {
    const owner=group.attributes.Id??child(group,'Standard')?.attributes.Id??implicitLibraryId;
    for(const node of group.children.filter(n=>n.tag==='Element')) {
      const key=JSON.stringify([owner,node.attributes.Type,node.attributes.Id]);
      assert(!result.has(key),'NATIVE_VALUE_DUPLICATE_TYPED_GUI_ID');
      result.set(key,{owner,node});
    }
  }
  return result;
}

/** Only the two representation failures witnessed in the original Editor.
 * This never edits GUI, adds a declaration or substitutes for native checking.
 * Authored values remain visible as risks; preserving them is not a waiver.
 */
export function inspectNativeGuiValueRisks({xml,existingXml='',implicitLibraryId='Map'}) {
  const prior=elements(existingXml,implicitLibraryId),current=elements(xml,implicitLibraryId),records=[];
  for(const [key,{owner,node}]of current) {
    const old=prior.get(key)?.node;
    if(node.attributes.Type==='Variable')for(const dimension of dimensions(node)) {
      const a=dimension.attributes;
      if(a.Value!=='0'||a.Type!==undefined||a.Id!==undefined)continue;
      const unchangedAuthored=dimensions(old).some(n=>JSON.stringify(n.attributes)===JSON.stringify(a));
      records.push({kind:'LITERAL_SINGLETON_BOUND',owner,variableId:node.attributes.Id,dimension:a.Dim,unchangedAuthored});
    }
    if(node.attributes.Type!=='Param'||child(node,'ValueType')?.attributes.Type!=='fixed')continue;
    const token=body(xml,child(node,'Value'));
    if(typeof token!=='string'||!token.includes('.')||token.split('.')[1].length<=4)continue;
    const unchangedAuthored=!!old&&child(old,'ValueType')?.attributes.Type==='fixed'&&body(existingXml,child(old,'Value'))===token;
    records.push({kind:'FIXED_LITERAL_PRECISION',owner,paramId:node.attributes.Id,token,unchangedAuthored});
  }
  return {kind:'KNOWN_NATIVE_GUI_VALUE_RISKS',status:records.length?'REVIEW_KNOWN_NATIVE_VALUE_RISKS':'CLEAR_FOR_KNOWN_VALUE_RISKS',
    elementsChecked:current.size,records,newOrChanged:records.filter(r=>!r.unchangedAuthored).length,
    unchangedAuthored:records.filter(r=>r.unchangedAuthored).length,
    actualEditor:false,wholeProgramEquivalent:false,newAcceptedMaps:0,sourceChanged:false};
}
