// Choose an existing public native description only when its executable GUI
// descriptor equals every hidden/internal alias. Presentation is separate from
// identity/ABI/types. This proposes a binding; the full roundtrip oracle remains
// mandatory and no runtime equivalence is inferred from this metadata alone.
import {formalGalaxyCarrier} from '../types/formal-galaxy-carrier.mjs';
const allowedFlags=new Set(['Native','Event','Action','Call','Operator','Hidden','Internal']);
const presentationFlags=new Set(['Hidden','Internal']);
const formalUi=new Set(['id','library','name','identifier','default','preset','displayName','unknownXml']);
const definitionUi=new Set(['id','library','name','identifier','flags','parameters','displayName','grammar','grammarSource','unknownXml']);
const strip=(object,omit)=>Object.fromEntries(Object.entries(object).filter(([key])=>!omit.has(key)));
const canonical=value=>!value||typeof value!=='object'?value:Array.isArray(value)?value.map(canonical):
 Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
const json=value=>JSON.stringify(canonical(value));
const labelsOnly=nodes=>(nodes??[]).every(n=>n.tag==='Label');
function eventResponses(nodes,index,owner){
 const keys=[];
 for(const node of nodes??[]){
  if(node.tag==='Label')continue;
  const a=node.attributes;
  if(node.tag!=='EventResponse'||a?.Type!=='FunctionDef'||Object.keys(a).some(k=>!['Type','Library','Id'].includes(k))||
   (node.children??[]).length||node.text||Object.keys(node).some(k=>!['tag','attributes','position','children','text'].includes(k)))return;
  const library=index.libraries?.get(a.Library??owner.id),target=library?.elementsByType?.FunctionDef?.[a.Id];
  if(!target||target.disabled||target.scriptCode||target.isSubFunction||!target.name||target.identifier&&target.identifier!==target.name||
   !target.flags?.includes('Native')||!target.flags.includes('Event')||target.flags.some(f=>!['Native','Event','Hidden','Internal'].includes(f))||
   !labelsOnly(target.unknownXml)||index.carrier(target.returnType,library)!=='void')return;
  const carriers=(target.parameters??[]).map(ref=>{const p=index.formal(ref,library);return p?formalGalaxyCarrier(index,p,library,target):undefined;});
  if(carriers.some(c=>!c))return;
  keys.push(json({symbol:target.name,returnType:'void',parameters:['trigger',...carriers]}));
 }
 return [...new Set(keys)].toSorted();
}
export function publicNativeDescription(index,query,candidates){
 const abi=query.declaration;if(!abi||!Array.isArray(abi.parameters)||candidates.length<2)return;
 const visible=candidates.filter(c=>!c.definition.flags?.some(f=>presentationFlags.has(f)));
 if(visible.length!==1)return;
 const descriptions=[];
 for(const c of candidates){
  const d=c.definition,flags=d.flags??[];
  if(c.origin!=='emitted'||c.symbol!==query.name||d.name!==query.name||d.identifier&&d.identifier!==query.name||d.scriptCode||d.disabled)return;
  if(!flags.includes('Native')||flags.some(f=>!allowedFlags.has(f))||d.isSubFunction)return;
  const responses=eventResponses(d.unknownXml,index,c.library);if(!responses)return;
  const returned=index.carrier(d.returnType,c.library);if(!returned||returned!==abi.returnType)return;
  const role=flags.includes('Event')?'event':flags.includes('Action')||d.isFuncAction?'action':returned!=='void'?'value':undefined;
  if(!role||query.guiUse&&query.guiUse!==role||flags.includes('Event')&&flags.includes('Action'))return;
  const hidden=role==='event'?1:0;
  if(hidden&&abi.parameters[0]!=='trigger'||(d.parameters??[]).length+hidden!==abi.parameters.length)return;
  const parameters=[];
  for(let i=0;i<d.parameters.length;i++){
   const formal=index.formal(d.parameters[i],c.library);if(!formal||!labelsOnly(formal.unknownXml))return;
   const carrier=formalGalaxyCarrier(index,formal,c.library,d);
   if(!carrier||carrier!==abi.parameters[i+hidden])return;
   parameters.push(strip(formal,formalUi));
  }
  descriptions.push({role,flags:flags.filter(f=>!presentationFlags.has(f)).toSorted(),metadata:strip(d,definitionUi),parameters,eventResponseAbis:responses});
 }
 if(!descriptions.every(d=>json(d)===json(descriptions[0])))return;
 const selected=visible[0];
 return {candidate:selected,proof:{kind:'EXISTING_PUBLIC_NATIVE_WITH_EQUAL_EXECUTABLE_DESCRIPTORS',
  symbol:query.name,role:descriptions[0].role,selected:selected.key,aliases:candidates.filter(c=>c!==selected).map(c=>c.key),
  actualAbi:abi,semanticDescriptor:descriptions[0],explicitNativeArgumentsRequired:true,
  presentationExcluded:['displayName','grammar','grammarSource','default','preset'],originalMetadataPreserved:true,
  sourceChanged:false,newNativeDefinitions:0,fullRoundtripRequired:true,wholeProgramEquivalenceProved:false}};
}
