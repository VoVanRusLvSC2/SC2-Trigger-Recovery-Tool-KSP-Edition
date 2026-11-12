// Independent native-XML check. No generator receipt or inferred display name
// grants a label. Existing folders/intentional translations remain source-owned.
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
const identity=(library,id)=>JSON.stringify([library,id]);
function categories(xml){
 if(!xml.trim())return [];
 const root=xmlTree(xml);if(root.tag!=='TriggerData')throw Error('GUI_LOCALIZATION_ROOT_REQUIRED');
 const scopes=[{library:'',nodes:root.children},...root.children.filter(n=>n.tag==='Library').map(n=>({library:n.attributes.Id,nodes:n.children}))];
 return scopes.flatMap(({library,nodes})=>nodes.filter(n=>n.tag==='Element'&&n.attributes.Type==='Category').map(n=>({library,id:n.attributes.Id,
  named:n.children.some(c=>c.tag==='Identifier'&&!c.selfClosing&&xml.slice(c.openEnd,c.closeStart).length>0)})));
}
export function verifyNewCategoryLocalization({before='',after,triggerStrings}){
 const old=new Set(categories(before).map(c=>identity(c.library,c.id)));
 const keys=new Set(triggerStrings.replace(/^\uFEFF/u,'').split(/\r?\n/u).filter(l=>l.includes('=')).map(l=>l.slice(0,l.indexOf('='))));
 const checked=[],issues=[];
 for(const c of categories(after)){
  if(old.has(identity(c.library,c.id))||!c.named)continue;
  const key=(c.library?'Lib'+c.library+'/':'')+'Category/Name/'+c.id;
  checked.push({...c,key});if(!keys.has(key))issues.push({kind:'NEW_GUI_CATEGORY_LOCALIZATION_MISSING',library:c.library,id:c.id,key});
 }
 return {kind:'INDEPENDENT_NEW_GUI_CATEGORY_LOCALIZATION',passed:!issues.length,checked,issues,
  existingTranslationsChanged:false,generatorReceiptsUsed:false,actualEditor:false};
}
