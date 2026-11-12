import {formalPresetRefs} from './formal-preset-domain.mjs';
import {createGuiCapabilityCatalog} from './gui-capability-catalog.mjs';

const roles=new Set(['parameter','return','variable','member']);
const identity=(ref,owner)=>ref&&({library:ref.library??owner,type:ref.type,id:ref.id});
const stable=value=>!value||typeof value!=='object'?value:Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])]));
const key=type=>JSON.stringify(stable(type));

/** Existing GUI definitions, indexed once per conversion. A type observed in
 * one role never authorizes another role. This is a representation catalog,
 * not an ABI certificate or permission to synthesize native definitions. */
export function createGuiRoleCatalog(entries,{trustedOwners=[]}={}) {
 const libraries=new Map(entries),base=createGuiCapabilityCatalog(libraries),trusted=new Set(trustedOwners);
 const uses=new Map([...roles].map(r=>[r,new Map()]));
 const add=(role,type,owner,e)=>{
  if(!type?.type)return;const k=key(type),list=uses.get(role).get(k)??[];
  list.push({owner,element:identity(e,owner)});uses.get(role).set(k,list);
 };
 for(const [owner,lib]of libraries){
  if(!trusted.has(owner))continue;
  const members=new Set(Object.values(lib.elements??{}).filter(e=>e.type==='Structure').flatMap(e=>(e.variables??[]).map(r=>JSON.stringify(identity(r,owner)))));
  for(const e of Object.values(lib.elements??{})){
   if(base.resolve(identity(e,owner),owner)!==e)continue;
   if(e.type==='FunctionDef')add('return',e.returnType??(e.flags?.includes('Action')?{type:'void'}:undefined),owner,e);
   else if(e.type==='ParamDef')add('parameter',e.paramType,owner,e);
   else if(e.type==='Variable')add(members.has(JSON.stringify(identity(e,owner)))?'member':'variable',e.variableType,owner,e);
  }
 }
 function typeUse(type,role,owner){
  if(!roles.has(role))throw Error('UNKNOWN_GUI_TYPE_ROLE');
  if(!type?.type)return {status:'UNPROVEN',reason:'GUI_TYPE_REQUIRED',role};
  if(type.typeElement){
   // A fixed domain is self-contained even if legacy XML retains a selector ref.
   if(type.userType!==undefined&&uses.get(role).has(key(type)))return {status:'RESOLVED',kind:'FIXED_USER_DOMAIN',role,type:stable(type),abiProved:false};
   const structure=base.resolve(type.typeElement,owner,type.typeElement.type);
   if(!structure)return {status:'UNPROVEN',reason:'UNRESOLVED_GUI_TYPE_OWNER',role,type:stable(type)};
   if(structure.type==='ParamDef') {
    const witnesses=uses.get(role).get(key(type));
    if(!witnesses?.length)return {status:'UNPROVEN',reason:'DEPENDENT_TYPE_ROLE_NOT_OBSERVED',role,type:stable(type)};
    return {status:'RESOLVED',kind:'FORMAL_DEPENDENT_TYPE',role,type:stable(type),
     dependsOn:identity(structure,structure.library??type.typeElement.library??owner),
     requiresCallBinding:true,abiProved:false};
   }
   if(structure.type==='Preset')return {status:'RESOLVED',kind:'NOMINAL_PRESET',role,type:stable(type),preset:identity(structure,structure.library??owner),abiProved:false};
   if(type.type!=='struct'||role==='return')return {status:'UNPROVEN',reason:'STRUCTURE_ROLE_NOT_QUALIFIED',role,type:stable(type)};
   return {status:'RESOLVED',kind:'STRUCTURE_STORAGE',role,type:stable(type),structure:identity(structure,structure.library??owner),abiProved:false};
  }
  const witnesses=uses.get(role).get(key(type));
  return witnesses?.length?{status:'RESOLVED',kind:'OBSERVED_ROLE',role,type:stable(type),witnesses,abiProved:false}:
   {status:'UNPROVEN',reason:'TYPE_NOT_OBSERVED_IN_GUI_ROLE',role,type:stable(type)};
 }
 function parameter(ref,owner){
  const formal=base.resolve(ref,owner,'ParamDef');if(!formal)return {status:'UNPROVEN',reason:'FORMAL_IDENTITY_UNRESOLVED'};
  const actualOwner=formal.library??ref.library??owner;
  return {status:'RESOLVED',formal:identity(formal,actualOwner),type:formal.paramType,
   role:'parameter',storageReference:formal.isReference===true,
   presets:formalPresetRefs(formal,actualOwner),
   preset:formalPresetRefs(formal,actualOwner).length===1?formalPresetRefs(formal,actualOwner)[0]:undefined,
   default:formal.default?identity(formal.default,actualOwner):undefined,
   representation:typeUse(formal.paramType,'parameter',actualOwner),abiProved:false};
 }
 return Object.freeze({...base,typeUse,parameter,
  functionContract(ref,owner){
   const definition=base.resolve(ref,owner,'FunctionDef');if(!definition)return {status:'UNPROVEN',reason:'FUNCTION_IDENTITY_UNRESOLVED'};
   const actualOwner=definition.library??ref.library??owner,formals=(definition.parameters??[]).map(r=>parameter(r,actualOwner));
   const ids=formals.map(p=>JSON.stringify(p.formal)),duplicate=new Set(ids).size!==ids.length;
   return {status:!duplicate&&formals.every(p=>p.status==='RESOLVED')?'RESOLVED':'UNPROVEN',definition:identity(definition,actualOwner),
    roles:{event:definition.flags?.includes('Event')===true,action:definition.flags?.includes('Action')===true,call:definition.flags?.includes('Call')===true},
    formals,returnUse:typeUse(definition.returnType??{type:'void'},'return',actualOwner),
    dependentBindings: [...formals.map(p=>({site:p.formal,use:p.representation})),
     {site:'return',use:typeUse(definition.returnType??{type:'void'},'return',actualOwner)}]
     .filter(p=>p.use.kind==='FORMAL_DEPENDENT_TYPE').map(p=>({...p,
      status:formals.some(f=>key(f.formal)===key(p.use.dependsOn))?'REQUIRES_CALL_ARGUMENT':'UNBOUND_SELECTOR_FORMAL'})),
    implicitTrigger:definition.flags?.includes('Event')===true?'CALLER_EVENT_CONTEXT':'NONE',
    explicitTargetProved:false,newNative:0,newCustomScript:0,newRuntimeFunctions:0};
  },
  roleEvidence(){return {kind:'EXISTING_GUI_ROLE_CATALOG',trustedOwners:[...trusted],
   types:Object.fromEntries([...uses].map(([role,types])=>[role,[...types].map(([type,witnesses])=>({type:JSON.parse(type),witnesses}))])),
   issues:base.issues,persistentCache:false,newDefinitions:0,newNative:0,newCustomScript:0};}
 });
}
