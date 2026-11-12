import {indexGuiDeclarationOwnership} from '../model/gui-declaration-ownership.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
const scope=new AsyncLocalStorage(),sha=s=>createHash('sha256').update(s).digest('hex');
const fields=['type','id','library','name','identifier','flags','variableType','paramType','returnType','parameters','variables','members','items','localVariables','isArray','arrayDimensions','arraySize','isConstant','isReference','isFuncAction','isFuncCall','isFuncEvent','disabled'];
export function withProvisionalGuiDeclarations({observe,stopAfterGate=true},operation){
 if(typeof observe!=='function')throw Error('GUI_DECLARATION_OBSERVER_REQUIRED');
 return scope.run({observe,stopAfterGate,active:true},async()=>{try{return await operation();}finally{scope.getStore().active=false;}});
}
// Diagnostic evidence is detached, bounded, and never a GUI authorization.
// Ordinary conversions do no inventory work and retain their original gates.
export function inspectProvisionalGuiDeclarations(elements,library,gate,rootRefs=[]){
 const context=scope.getStore();if(!context?.active)return;
 const rows=[];let truncated=false;
 for(const e of new Set(Object.values(elements))){
  if(!['Variable','Structure','FunctionDef','ParamDef','Trigger','CustomScript','Category'].includes(e.type))continue;
  if(rows.length===50000){truncated=true;break;}
  const row=Object.fromEntries(fields.filter(f=>e[f]!==undefined).map(f=>[f,e[f]]));
  if(typeof e.scriptCode==='string')row.code={sha256:sha(e.scriptCode),bytes:Buffer.byteLength(e.scriptCode),...(e.scriptCode.length<=2048?{text:e.scriptCode}:{})};
  if(e.initFunc!==undefined)row.initFunc=e.initFunc;
  rows.push(row);
 }
 const ownership=indexGuiDeclarationOwnership({elements,library,rootRefs});
 const payload={kind:'PROVISIONAL_GUI_DECLARATION_INVENTORY',library,gate,rootRefs,ownership,rows,truncated,provisional:true,guiEmissionAuthorized:false,accepted:false,benchmarkChanged:false};
 const text=JSON.stringify(payload);
 context.observe(text.length<=8*1024**2?JSON.parse(text):{...payload,rows:[],truncated:true,reason:'INVENTORY_BYTE_BUDGET'});
}
export function finishProvisionalGuiDeclarationGate(){
 const context=scope.getStore();if(context?.active&&context.stopAfterGate){const error=new Error('EVIDENCE_CAPTURE_ONLY_STOP_AFTER_STRICT_GUI_GATE');error.code='EVIDENCE_CAPTURE_ONLY';throw error;}
}
