import {guiGameLinkLiteralType,declaredGuiGameLinkType} from "../../types/gui-game-link-type.mjs";
import {guiVariableAccessType} from "../../types/gui-variable-access-type.mjs";
import {numericExpressionGrammar} from "../../gui/numeric-expression-grammar.mjs";
import {createGuiCallTypeResolver} from "./gui-call-contract.mjs";
// Typed GUI remainder contract: preserve the actual operator, numeric types,
// operand order, ownership and single evaluation. No arithmetic substitution.
// ExpressionCode is a slot label only after this proof; every other code field
// remains raw. No generic code text, user function, Native or stub is allowed.
const key=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);
const values=l=>Object.values(l?.elements??{});
const numeric=t=>t==='int'||t==='fixed';
const declared=(p,type)=>!p.valueType||p.valueType.type===type?type:undefined;
export const remainderType=(a,b)=>numeric(a)&&numeric(b)?(a==='fixed'||b==='fixed'?'fixed':'int'):undefined;
const intLiteral=s=>typeof s==='string'&&/^-?(?:[0-9]+|0[xX][0-9A-Fa-f]+)$/u.test(s);
const fixedLiteral=s=>typeof s==='string'&&/^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/u.test(s);
export function validateGuiExpressionMarkers(ownedLibraries,externalLibraries=new Map()){
 const owned=ownedLibraries instanceof Map?ownedLibraries:new Map(ownedLibraries.map(l=>[l.id,l]));
 const all=new Map([...externalLibraries,...owned]),index=new Map(),issues=[],validMarkers=new Set(),expressions=[];
 for(const[id,l]of all)for(const e of values(l)){const k=key(e,id);if(index.has(k)&&index.get(k)!==e)issues.push({code:'DUPLICATE_ELEMENT_IDENTITY',identity:k});else index.set(k,e);}
 const resolve=(r,owner)=>r&&typeof r.id==='string'&&typeof r.type==='string'?index.get(key(r,owner)):undefined;
 const refs=[],usageByIdentity=new Map();
 function visit(v,owner,source,path){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach((x,i)=>visit(x,owner,source,path+'['+i+']'));return;}if(v.type&&v.id){const identity=key(v,owner),use={identity,source,path};refs.push(use);const uses=usageByIdentity.get(identity)??[];uses.push(use);usageByIdentity.set(identity,uses);return;}for(const[k,x]of Object.entries(v))if(!['parent','xmlSource','rawXml'].includes(k))visit(x,owner,source,path+'.'+k);}
 for(const[id,l]of owned){for(const e of values(l))for(const[k,v]of Object.entries(e))if(k!=='parent'&&k!=='xmlSource'&&k!=='rawXml')visit(v,id,key(e,id),k);if(l.rootRefs??l.items)visit(l.rootRefs??l.items,id,'library:'+id,'rootRefs');}
 const forms=['value','variable','paramRef','functionCall','preset','valueElement','expressionText'];
 const typeRefusals=[];const callType=createGuiCallTypeResolver({resolve,key,argumentType,declared,onRefusal:r=>typeRefusals.push(r)});
 function operandType(p,owner,seen=new Set()){
  if(!p||p.type!=='Param'||seen.has(key(p,owner)))return undefined;seen.add(key(p,owner));
  if(p.scriptCode!==undefined||p.valueElement||p.preset||p.valueType&&!numeric(p.valueType.type))return undefined;
  if(forms.filter(f=>p[f]!==undefined).length!==1)return undefined;
  for(const r of p.arrayIndexes??[]){const a=resolve(r,owner);if(operandType(a,owner,new Set(seen))!=='int')return undefined;}
  if(p.variable){const type=guiVariableAccessType(p,owner,{resolve,key,indexType:operandType});return type?declared(p,type):undefined;}
  if(p.paramRef){const d=resolve(p.paramRef,owner);return d?.type==='ParamDef'?(d.paramType?.type==='gamelink'?declaredGuiGameLinkType(p,d.paramType):declared(p,d.paramType?.type)):undefined;}
  if(p.functionCall){const actual=callType(p,owner,seen);return numeric(actual)?actual:undefined;}
  if(p.expressionText!==undefined)return numeric(p.expressionType)&&numericExpressionGrammar(p.expressionText)?p.expressionType:undefined;
  return p.valueType?.type==='int'&&intLiteral(p.value)?'int':p.valueType?.type==='fixed'&&fixedLiteral(p.value)?'fixed':undefined;
 }
 function argumentType(p,owner,seen){
  if(!p||p.type!=='Param'||p.scriptCode!==undefined||forms.filter(f=>p[f]!==undefined).length!==1)return undefined;
  for(const r of p.arrayIndexes??[])if(operandType(resolve(r,owner),owner,new Set(seen))!=='int')return undefined;
  if(p.functionCall){const identity=key(p,owner);if(seen.has(identity))return undefined;const nested=new Set(seen);nested.add(identity);return callType(p,owner,nested);}
  if(p.expressionText!==undefined)return operandType(p,owner,seen);
  if(p.variable){const type=guiVariableAccessType(p,owner,{resolve,key,indexType:operandType});return type?declared(p,type):undefined;}
  if(p.paramRef){const d=resolve(p.paramRef,owner);return d?.type==='ParamDef'?(d.paramType?.type==='gamelink'?declaredGuiGameLinkType(p,d.paramType):declared(p,d.paramType?.type)):undefined;}
  if(p.preset)return resolve(p.preset,owner)?.type==='PresetValue'?'preset':undefined;
  if(p.value!==undefined&&p.valueType?.type){if(p.valueType.type==='gamelink')return guiGameLinkLiteralType(p);if(p.valueType.type==='int')return /^-?(?:[0-9]+|0[xX][0-9A-Fa-f]+)$/u.test(p.value)?'int':undefined;if(p.valueType.type==='bool')return /^(true|false)$/u.test(p.value)?'bool':undefined;if(p.valueType.type==='fixed')return /^-?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/u.test(p.value)?'fixed':undefined;if(p.valueType.type==='string')return typeof p.value==='string'?'string':undefined;return undefined;}
  return undefined;
 }
 for(const[id,l]of owned)for(const p of values(l))if(p.expressionText!==undefined||p.expressionParams?.length){
  const fail=code=>issues.push({code,owner:key(p,id),id:p.id,callTypeRefusals:typeRefusals.slice(-8)});let ok=true;const grammar=numericExpressionGrammar(p.expressionText);
  if(p.type!=='Param'||!numeric(p.expressionType)||p.valueType&&p.valueType.type!==p.expressionType||!grammar||forms.filter(f=>p[f]!==undefined).length!==1||p.scriptCode!==undefined){fail('GUI_EXPRESSION_GRAMMAR_OR_TYPE');continue;}
  if(p.expressionParams?.length!==grammar.slots.length||new Set(p.expressionParams.map(r=>key(r,id))).size!==grammar.slots.length){fail('GUI_EXPRESSION_SLOT_COUNT_OR_DUPLICATE');continue;}
  const slots=[];
  for(let i=0;i<grammar.slots.length;i++){const r=p.expressionParams[i],child=resolve(r,id),expected=grammar.slots[i];
   if(r.type!=='Param'||(r.library??id)!==id||!child||child.type!=='Param'||(child.library??id)!==id||child===p){fail('GUI_EXPRESSION_SLOT_REFERENCE_OR_OWNER');ok=false;continue;}
   if(child.expressionCode!==expected){fail('GUI_EXPRESSION_SLOT_MARKER_SHADOW_OR_ORDER');ok=false;}
   const uses=usageByIdentity.get(key(child,id))??[];if(uses.length!==1||uses[0].source!==key(p,id)||uses[0].path!==`expressionParams[${i}]`){fail('GUI_EXPRESSION_SLOT_NOT_EXCLUSIVE');ok=false;}
   if(!numeric(operandType(child,id))){fail('GUI_EXPRESSION_OPERAND_NOT_PROVEN_NUMERIC');ok=false;}
   // All typed operand references, including nested arrays/calls, must exist.
   function integrity(v,owner){if(!v||typeof v!=='object')return true;if(Array.isArray(v))return v.every(x=>integrity(x,owner));if(v.type&&v.id)return !!resolve(v,owner);return Object.entries(v).filter(([k])=>!['parent','xmlSource','rawXml'].includes(k)).every(([,x])=>integrity(x,owner));}
   if(!Object.entries(child).filter(([k])=>!['parent','xmlSource','rawXml'].includes(k)).every(([,v])=>integrity(v,id))){fail('GUI_EXPRESSION_OPERAND_REFERENCE_MISSING');ok=false;}
   slots.push(child);
  }
  if(ok&&grammar.resultType(slots.map(c=>operandType(c,id)))!==p.expressionType){fail('GUI_EXPRESSION_RESULT_TYPE_MISMATCH');ok=false;}
  if(ok){for(const c of slots)validMarkers.add(key(c,id));expressions.push({owner:key(p,id),library:id,id:p.id,expressionType:p.expressionType,grammar:grammar.text,slots:slots.map(c=>({id:c.id,marker:c.expressionCode,type:operandType(c,id)})),eachOperandOnce:true});}
 }
 // A dangling/foreign/shadowed marker is never exempted from the raw gate.
 for(const[id,l]of owned)for(const p of values(l))if(p.expressionCode!==undefined&&!validMarkers.has(key(p,id)))issues.push({code:'UNPROVEN_GUI_EXPRESSION_MARKER',owner:key(p,id),id:p.id,marker:p.expressionCode});
 if(issues.length)validMarkers.clear();
 return {valid:issues.length===0,validMarkers,expressions,issues};
}
export const guiExpressionElementKey=key;
