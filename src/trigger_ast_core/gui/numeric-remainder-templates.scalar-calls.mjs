import {remainderType} from './numeric-expression-contract.scalar-calls.mjs';
// Reify pure converter-style binary templates after all bindings are available.
// No names/IDs identify a candidate: exact operator grammar and typed references do.
import {validateComposedGuiExpressionMarkers as validate} from './composed-expression-contract.scalar-calls.mjs';
const identity=(r,owner)=>`${r.library??owner}|${r.type}|${r.id}`;
export function reifyTypedRemainderTemplates(elements,libId,roots,external=new Map()){
 // Indices belong to this call only. They retain original element identities
 // while projected clones are validated transactionally before committing.
 const entries=Object.entries(elements),values=entries.map(([,e])=>e);
 const byId=new Map(values.map(e=>[identity(e,libId),e]));
 const keysByElement=new Map(entries.map(([k,e])=>[e,k])),callsByDefinition=new Map();
 for(const e of values)if(e.type==='FunctionCall'&&e.functionDef){
  const k=identity(e.functionDef,libId),calls=callsByDefinition.get(k)??[];
  calls.push(e);callsByDefinition.set(k,calls);
 }
 if(byId.size!==values.length)return {changed:false,roots,changes:[],refusal:'AMBIGUOUS_ELEMENT_IDENTITIES'};
 const resolve=r=>r&&byId.get(identity(r,libId));
 const projected={...elements},removed=new Set(),changes=[],clones=new Map(),trace=[];
 const copy=e=>{if(!clones.has(e)){const clone={...e};clones.set(e,clone);projected[keysByElement.get(e)]=clone;}return clones.get(e);};
 const usage=new Map();
 function walk(value,source,field){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const v of value)walk(v,source,field);return;}
  if(value.type&&value.id){const key=identity(value,libId),uses=usage.get(key)??[];uses.push({source,field});usage.set(key,uses);return;}
  for(const[k,v]of Object.entries(value))if(!['parent','xmlSource','rawXml'].includes(k))walk(v,source,k);
 }
 for(const e of values)for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))walk(v,e,k);
 walk(roots,undefined,'root');
 const remove=e=>{removed.add(identity(e,libId));delete projected[keysByElement.get(e)];};
 for(const definition of values){
  if(definition.type!=='FunctionDef'||(definition.library??libId)!==libId||!['int','fixed'].includes(definition.returnType?.type)||
     definition.flags?.includes('Native')||!definition.flags?.includes('Call')||!definition.flags?.includes('Operator'))continue;
  const grammar=/^\s*#PARAM\(([A-Za-z_]\w*)\)\s*%\s*#PARAM\(([A-Za-z_]\w*)\)\s*$/u.exec(definition.scriptCode??'');
  if(!grammar||grammar[1]===grammar[2]||definition.parameters?.length!==2||definition.actions?.length||definition.localVariables?.length)continue;
  trace.push({definition:definition.id,stage:'grammar'});
  const formals=definition.parameters.map(resolve);
  if(formals.some((p,i)=>p?.type!=='ParamDef'||(p.library??libId)!==libId||!['int','fixed'].includes(p.paramType?.type)||p.isReference||
      (p.identifier??p.name)!==grammar[i+1]))continue;
  if(remainderType(...formals.map(p=>p.paramType.type))!==definition.returnType.type)continue;
  trace.push({definition:definition.id,stage:'formals',formals:formals.map(p=>({id:p?.id,name:p?.name,type:p?.paramType}))});
  const calls=callsByDefinition.get(identity(definition,libId))??[];
  if(!calls.length)continue;
  const uses=usage.get(identity(definition,libId))??[];
  if(uses.some(u=>u.source&&!(u.source.type==='FunctionCall'&&u.field==='functionDef')&&
      !(u.source.type==='Category'&&['items','children'].includes(u.field))))continue;
  trace.push({definition:definition.id,stage:'uses',uses:uses.map(u=>({type:u.source?.type,field:u.field})),calls:calls.length});
  const transactions=[];
  for(const call of calls){
   const callUses=usage.get(identity(call,libId))??[];
   if((call.library??libId)!==libId||call.parameters?.length!==2||callUses.length!==1||
      callUses[0].source?.type!=='Param'||callUses[0].field!=='functionCall'){transactions.length=0;break;}
   const parent=callUses[0].source,children=call.parameters.map(resolve);
   if((parent.library??libId)!==libId||parent.valueType&&parent.valueType.type!==definition.returnType.type||
      ['value','variable','preset','paramRef','scriptCode','expressionText','expressionParams','array','structMember'].some(k=>parent[k]!==undefined)||
      children[0]===children[1]||children.some((p,i)=>p?.type!=='Param'||(p.library??libId)!==libId||
       !p.parameterDef||identity(p.parameterDef,libId)!==identity(definition.parameters[i],libId)||
       p.expressionCode!==undefined||(usage.get(identity(p,libId))??[]).length!==1)){
    transactions.length=0;break;
   }
   transactions.push({call,parent,children});
  }
  trace.push({definition:definition.id,stage:'transactions',count:transactions.length,expected:calls.length});
  if(transactions.length!==calls.length)continue;
  for(const {call,parent,children}of transactions){
   const owner=copy(parent);delete owner.functionCall;
   owner.expressionType=definition.returnType.type;owner.expressionText='(~left~ % ~right~)';
   owner.expressionParams=call.parameters.map(r=>({...r}));
   for(let i=0;i<children.length;i++){const child=copy(children[i]);delete child.parameterDef;child.expressionCode=i===0?'left':'right';}
   remove(call);
  }
  remove(definition);
  // Formal definitions are removed only when all references are the template's
  // own formal list or the actual arguments just reified into expression slots.
  for(const formal of formals){
   const uses=usage.get(identity(formal,libId))??[];
   if(uses.every(u=>u.source===definition||transactions.some(t=>t.children.includes(u.source)&&u.field==='parameterDef')))remove(formal);
  }
  changes.push({definition:definition.id,calls:transactions.map(t=>t.call.id),expressionOwners:transactions.map(t=>t.parent.id)});
 }
 if(!changes.length)return {changed:false,roots,changes:[],trace};
 const filtered=refs=>refs?.filter(r=>!removed.has(identity(r,libId)));
 const nextRoots=filtered(roots);
 for(const e of values)if(e.type==='Category')for(const field of ['items','children'])if(Array.isArray(e[field])&&e[field].some(r=>removed.has(identity(r,libId))))copy(e)[field]=filtered(e[field]);
 const proof=validate(new Map([[libId,{id:libId,elements:projected,items:nextRoots}]]),external);
 if(!proof.valid)return {changed:false,roots,changes:[],refusal:proof.issues,trace};
 // Commit only after the complete final typed/ownership contract succeeds.
 for(const key of Object.keys(elements))if(!(key in projected))delete elements[key];
 for(const[key,value]of Object.entries(projected))elements[key]=value;
 return {changed:true,roots:nextRoots,changes,validatedExpressions:proof.expressions.length,trace};
}
