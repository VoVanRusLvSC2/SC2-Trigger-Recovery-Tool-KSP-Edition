// Compose two existing typed GUI contracts without treating code as a marker.
import {validateGuiExpressionMarkers,guiExpressionElementKey as key} from '../map_global_repair_v14_2026-10-12/gui-expression-markers.mjs';
import {localizedTokenCodeBindings} from '../map_global_repair_v68_local_structure_bound_body_2026-10-16/localized-token-code.mjs';
export {key as guiExpressionElementKey};
export function validateComposedGuiExpressionMarkers(ownedLibraries,external=new Map()){
 const owned=ownedLibraries instanceof Map?ownedLibraries:new Map(ownedLibraries.map(l=>[l.id,l]));
 const usage=new Map();
 function scan(value,owner){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const v of value)scan(v,owner);return;}
  if(value.type&&value.id){const id=key(value,owner);usage.set(id,(usage.get(id)??0)+1);return;}
  for(const[k,v]of Object.entries(value))if(!['parent','xmlSource','rawXml'].includes(k))scan(v,owner);
 }
 for(const[id,l]of owned){
  for(const e of Object.values(l.elements??{}))for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))scan(v,id);
  scan(l.rootRefs??l.items,id);
 }
 const projected=new Map(),textMarkers=new Set(),textParents=[];
 for(const[id,l]of owned){
  const elements=l.elements??{},codes=localizedTokenCodeBindings(elements,id),parents=new Set(),children=new Set();
  for(const p of Object.values(elements)){
   const refs=p.expressionParams??[];
   if(p.type==='Param'&&p.expressionType==='text'&&p.valueType?.type==='text'&&refs.length&&
      refs.every(r=>codes.has(r.id)&&usage.get(key(r,id))===1)){
    parents.add(p.id);for(const ref of refs)children.add(ref.id);
    textParents.push({library:id,id:p.id,expressionType:'text',existingContract:'LOCALIZED_TOKEN_CODE'});
   }
  }
  const copy={};
  for(const[k,p]of Object.entries(elements)){
   let value=p;
   if(parents.has(p.id)){
    value={...p,provenLocalizedSlots:p.expressionParams};
    delete value.expressionType;delete value.expressionParams;delete value.expressionText;
   }
   if(children.has(p.id)){
    value={...value};delete value.expressionCode;textMarkers.add(key(p,id));
   }
   copy[k]=value;
  }
  projected.set(id,{...l,elements:copy});
 }
 // Original references remain in provenLocalizedSlots, so numeric exclusivity
 // checks still see aliases into a text expression. Input objects are untouched.
 const result=validateGuiExpressionMarkers(projected,external);
 if(result.valid)for(const marker of textMarkers)result.validMarkers.add(marker);
 return {...result,localizedTextExpressions:textParents};
}
