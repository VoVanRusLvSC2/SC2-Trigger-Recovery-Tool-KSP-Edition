// A native macro can infer its temporary from the actual GUI operand rather
// than the formal declaration. A bare Value has no such native operand type.
import {templateMacros} from '../../map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/cf5412e476e04e5a-balanced-script-template.mjs';
const key=(reference,owner,type)=>JSON.stringify([reference.library??owner,reference.type??type,reference.id]);
export function verifyNativeMacroValueTypes(ownedLibraries,externalLibraries=new Map()){
 const all=new Map([...externalLibraries,...ownedLibraries]),index=new Map(),issues=[],checked=[],unsupported=[];
 for(const [library,document]of all)for(const element of Object.values(document.elements??{})){
  const identity=key(element,library,element.type),rows=index.get(identity)??[];rows.push(element);index.set(identity,rows);
 }
 const lookup=(reference,owner,type)=>{const rows=index.get(key(reference,owner,type))??[];return rows.length===1?rows[0]:undefined;};
 for(const [owner,document]of ownedLibraries)for(const call of Object.values(document.elements??{})){
  if(call.type!=='FunctionCall'||!call.functionDef)continue;
  const definition=lookup(call.functionDef,owner,'FunctionDef');if(!definition?.scriptCode)continue;
  const definitionOwner=call.functionDef.library??owner;
  for(const macro of templateMacros(definition.scriptCode).filter(m=>m.name==='INITAUTOVAR')){
   if(macro.args.length!==2||!macro.args.every(a=>/^[A-Za-z_]\w*$/u.test(a))){unsupported.push({owner,call:call.id,macro});continue;}
   const formals=(definition.parameters??[]).map(r=>({reference:r,element:lookup(r,definitionOwner,'ParamDef')}))
    .filter(r=>r.element?.identifier===macro.args[1]);
   if(formals.length!==1){issues.push({code:'NATIVE_MACRO_FORMAL_NOT_UNIQUE',owner,call:call.id,parameter:macro.args[1]});continue;}
   const formal=formals[0],formalKey=key(formal.reference,definitionOwner,'ParamDef');
   const argumentsForFormal=(call.parameters??[]).map(r=>lookup(r,owner,'Param'))
    .filter(p=>p?.parameterDef&&key(p.parameterDef,owner,'ParamDef')===formalKey);
   let operand=argumentsForFormal.length===1?argumentsForFormal[0]:undefined;
   if(!argumentsForFormal.length&&formal.element.default)operand=lookup(formal.element.default,definitionOwner,'Param');
   if(!operand){issues.push({code:'NATIVE_MACRO_OPERAND_NOT_UNIQUE',owner,call:call.id,parameter:macro.args[1]});continue;}
   const record={owner,call:call.id,definition:{library:definitionOwner,id:definition.id},temporary:macro.args[0],
    formal:formal.reference,operand:{library:operand.library??owner,id:operand.id}};
   checked.push(record);
   if(operand.value!==undefined&&!operand.valueType){
    issues.push({...record,code:'UNTYPED_NATIVE_MACRO_VALUE',value:operand.value});
   }
  }
 }
 return {kind:'LOADED_NATIVE_MACRO_ACTUAL_VALUE_TYPE_PREFLIGHT',valid:issues.length===0,issues,checked,unsupported,
  guiOrSourceChanged:false,nativeCompilationProved:false,fullTypeEquivalenceProved:false};
}
