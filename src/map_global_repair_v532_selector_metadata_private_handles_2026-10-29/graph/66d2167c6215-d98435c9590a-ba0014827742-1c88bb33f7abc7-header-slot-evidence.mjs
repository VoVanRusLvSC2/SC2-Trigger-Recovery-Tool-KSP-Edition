// Read-only bridge to the same SDK carrier model and forward parameter emitter.
import {Parser,Printer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {resolveRefFull} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/78e2c7a105b4-06b6407a2245-39006703de6e-core.mjs';
import {convertParamExpr} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v532_selector_metadata_private_handles_2026-10-29/graph/ed89f1c64c9f-d24315235665-16101d9ca8be-7f05dce0cbdd5d-e19741dab56fd734-ttg-params.mjs';
const printer=new Printer(),skip=new Set(['parent','pos','end','line','char','syntaxTokens']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.keys(n).filter(k=>!skip.has(k)).sort().map(k=>[k,shape(n[k])]));
export function headerSlotEvidenceResolver({libId,elements,nativeLibrary,dependencyLibraries,recoverySession}){
 const elementsByType={};
 for(const el of Object.values(elements))(elementsByType[el.type]??={})[el.id]=el;
 const library={id:libId,elements,elementsByType},allLibraries=new Map(dependencyLibraries??[]);
 if(nativeLibrary)allLibraries.set(nativeLibrary.id,nativeLibrary);allLibraries.set(libId,library);
 const ctx={libId,library,nativeLibrary,allLibraries};
 return slot=>{
  const carrier=recoverySession?.candidates.carrier(slot.variableType,library);
  if(!carrier||!slot.initialValue)return {carrier};
  const param=resolveRefFull(slot.initialValue,library,nativeLibrary,allLibraries);
  if(param?.type!=='Param'||param.disabled)return {carrier};
  const forbidden=['scriptCode','variable','paramRef','functionCall','valueElement','expressionText','structMember'];
  if(forbidden.some(k=>param[k]!==undefined)||['expressionParams','valueParams','arrayIndexes','valuePresets'].some(k=>param[k]?.length))return {carrier};
  if((param.preset!==undefined)===(param.value!==undefined))return {carrier};
  try{
   const emitted=convertParamExpr(param,ctx),text=printer.printNode(emitted);
   const ast=new Parser().parseFile('header-gui-value.galaxy','void HeaderValue(){return '+text+';}');
   if(ast.parseDiagnostics.length)return {carrier};
   const expression=ast.statements[0]?.body?.statements[0]?.expression;
   return {carrier,initializerShape:shape(expression),sourceDomainPreserved:true};
  }catch{return {carrier};}
 };
}
