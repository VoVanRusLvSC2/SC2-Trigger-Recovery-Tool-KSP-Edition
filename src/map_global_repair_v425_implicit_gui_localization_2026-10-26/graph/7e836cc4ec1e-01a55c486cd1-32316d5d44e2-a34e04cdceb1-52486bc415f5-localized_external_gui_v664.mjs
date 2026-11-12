import {applyDisjointXmlPatches} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/apply_disjoint_xml_patches_v661.mjs';
/** GUI localized literals where exact, otherwise the actual native GUI call.
 * Empty/missing external keys remain StringExternal(key), not StringToText("").
 * All FunctionDef/ParamDef identities come from the mounted NativeLib document.
 */
import {createHash} from 'node:crypto';
import {recoverLocalizedTextGui} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/660334f0daf6-c2c3c8773c04-d2c5593b91e6-eaf8b8b99208-89299027571e-localized_text_gui_v663.mjs';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-local-identifier-v306-2026-10-05/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {parseOwnedTriggerDocument as parseTriggerXmlSync} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/9df4e70daea3-55336c934a77-8700bdf83655-62a38b2020d9-ba49c37dce1d-trigger_document_scope_v383.mjs';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export function recoverLocalizedExternalGui({triggerXml,localizedTables,nativeTriggerData}){
 const literal=recoverLocalizedTextGui({triggerXml,localizedTables});
 const natives=parseTriggerXmlSync(nativeTriggerData),available=[];
 for(const lib of natives.values())for(const f of Object.values(lib.elementsByType.FunctionDef??{})){
  if((f.identifier??f.name)==='StringExternal'&&f.flags?.includes('Native')&&f.flags?.includes('Call')
     &&!f.disabled&&!f.scriptCode&&f.returnType?.type==='text'&&f.parameters?.length===1){
   const p=f.parameters[0],pd=natives.get(p.library??lib.id)?.elementsByType.ParamDef?.[p.id];
   if(pd?.paramType?.type==='string'&&!pd.isMultiple&&!pd.isReference)available.push({lib,f,p});
  }
 }
 if(available.length!==1)return {...literal,nativeCallChanges:[],nativeCallUnavailable:true};
 const {lib:native,f,p:formal}=available[0];
 const xml=literal.triggerXml,tree=xmlTree(xml),libs=parseTriggerXmlSync(xml),patches=[],created=new Map(),nativeCallChanges=[];
 const used=new Set([...libs.values()].flatMap(l=>Object.values(l.elementsByType).flatMap(v=>Object.keys(v))));
 const allocate=(library,paramId,role)=>{for(let i=0;;i++){
  const id=createHash('sha256').update(`${library}|localized-gui|${paramId}|${role}|${i}`).digest('hex').slice(0,8).toUpperCase();
  if(!used.has(id)){used.add(id);return id;}
 }};
 const libraryNodes=new Map(tree.children.filter(n=>n.tag==='Library').map(n=>[n.attributes.Id,n]));
 const implicit=[...libs.values()].find(l=>l.implicit)?.id;
 const walk=(n,parentOwner)=>{
  const currentOwner=n.tag==='Library'?n.attributes.Id:parentOwner;
  if(n.tag==='Element'&&n.attributes.Type==='Param'){
   const owner=currentOwner,id=n.attributes.Id,lib=libs.get(owner),e=lib?.elementsByType.Param?.[id];
   if(e?.scriptCode&&e.valueType?.type==='text'&&!e.functionCall&&!e.variable&&!e.preset&&!e.valueElement&&!e.expressionCode){
    const m=/^StringExternal\(\s*("(?:[^"\\]|\\.)*")\s*\)$/u.exec(e.scriptCode.trim());
    if(m){
     const code=n.children.filter(c=>c.tag==='ScriptCode');if(code.length!==1)throw Error('Ambiguous localized parameter code');
     const key=JSON.parse(m[1]),argument=allocate(owner,id,'key'),call=allocate(owner,id,'call');
     patches.push({start:code[0].start,end:code[0].end,text:`<FunctionCall Type="FunctionCall"${lib.implicit?'':` Library="${escape(owner)}"`} Id="${call}"/>`});
     const extra=created.get(owner)??[];
     extra.push(`<Element Type="Param" Id="${argument}"><ValueType Type="string"/><ParameterDef Type="ParamDef" Library="${escape(formal.library??native.id)}" Id="${escape(formal.id)}"/><Value>${escape(key)}</Value></Element>`,
      `<Element Type="FunctionCall" Id="${call}"><FunctionDef Type="FunctionDef" Library="${escape(native.id)}" Id="${escape(f.id)}"/><Parameter Type="Param"${lib.implicit?'':` Library="${escape(owner)}"`} Id="${argument}"/></Element>`);
     created.set(owner,extra);nativeCallChanges.push({library:owner,id,key,nativeFunctionDef:{library:native.id,id:f.id},nativeParameterDef:formal,
      rule:'EXACT_EXTERNAL_KEY_USING_ACTUAL_NATIVE_GUI_FUNCTION',reason:'Literal cannot preserve key/empty semantics across all real locales'});
    }
   }
  }
  for(const c of n.children)walk(c,currentOwner);
 };walk(tree,implicit);
 for(const [id,extra] of created){const parent=libraryNodes.get(id)??(libs.get(id)?.implicit?tree:undefined);if(!parent)throw Error('No unique library insertion point');patches.push({start:parent.closeStart,end:parent.closeStart,text:'\n'+extra.join('\n')+'\n'});}
 let output=applyDisjointXmlPatches(xml,patches);
 const parsed=parseTriggerXmlSync(output);for(const c of nativeCallChanges){const e=parsed.get(c.library)?.elementsByType.Param?.[c.id];if(!e?.functionCall||e.scriptCode||e.valueType?.type!=='text')throw Error('Native GUI rewrite failed');}
 return {...literal,triggerXml:output,nativeCallChanges,nativeCallUnavailable:false};
}
