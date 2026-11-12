// A public Event and hidden/internal editor aliases may describe one native
// symbol. This is narrower than equal carrier signatures: all executable GUI
// metadata and complete ParamDef types must also agree. Explicit source ABI is
// mandatory; ordinary duplicate public owners remain ambiguous.
import {formalGalaxyCarrier} from '../types/formal-galaxy-carrier.mjs';
const flags=new Set(['Event','Native','Hidden','Internal']);
const clean=(object,omit)=>Object.fromEntries(Object.entries(object).filter(([k])=>!omit.has(k)));
const canonical=value=>{
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(canonical);
 return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
};
const json=value=>JSON.stringify(canonical(value));
const uiXml=value=>(value??[]).every(n=>n.tag==='Label');
const formalUi=new Set(['id','library','name','identifier','default','preset','unknownXml']);
const definitionUi=new Set(['id','library','name','identifier','flags','parameters','unknownXml']);
export function publicNativeEventAlias(index,query,candidates){
 const abi=query.declaration;
 if(!abi||abi.returnType!=='void'||abi.parameters?.[0]!=='trigger'||candidates.length<2)return;
 if(query.guiUse&&query.guiUse!=='event')return;
 const publicCandidates=candidates.filter(c=>!c.definition.flags?.some(f=>f==='Hidden'||f==='Internal'));
 if(publicCandidates.length!==1)return;
 const descriptions=[];
 for(const c of candidates){
  const d=c.definition;
  if(c.origin!=='emitted'||c.symbol!==query.name||d.name!==query.name||d.identifier&&d.identifier!==query.name||d.scriptCode||d.disabled)return;
  if(!d.flags?.includes('Native')||!d.flags.includes('Event')||d.flags.some(f=>!flags.has(f))||!uiXml(d.unknownXml))return;
  if(d.isSubFunction||d.isFuncAction||d.isFuncCall||index.carrier(d.returnType,c.library)!=='void')return;
  if((d.parameters??[]).length+1!==abi.parameters.length)return;
  const parameters=[];
  for(let i=0;i<d.parameters.length;i++){
   const formal=index.formal(d.parameters[i],c.library);if(!formal||!uiXml(formal.unknownXml))return;
   const carrier=formalGalaxyCarrier(index,formal,c.library,d);
   if(!carrier||carrier!==abi.parameters[i+1])return;
   parameters.push(clean(formal,formalUi));
  }
  descriptions.push({metadata:clean(d,definitionUi),parameters});
 }
 if(!descriptions.every(d=>json(d)===json(descriptions[0])))return;
 const selected=publicCandidates[0];
 return {candidate:selected,proof:{kind:'EXISTING_PUBLIC_EVENT_WITH_EXECUTABLY_IDENTICAL_HIDDEN_ALIASES',
  symbol:query.name,selected:selected.key,aliases:candidates.filter(c=>c!==selected).map(c=>c.key),
  actualAbi:abi,explicitNativeArgumentsRequired:true,semanticDescriptor:descriptions[0],
  defaultAndChooserMetadataNotUsedForExplicitGalaxyArguments:true,
  sourceOrRuntimeCodeChanged:false,newNativeDefinitions:0,wholeProgramEquivalenceProved:false}};
}
