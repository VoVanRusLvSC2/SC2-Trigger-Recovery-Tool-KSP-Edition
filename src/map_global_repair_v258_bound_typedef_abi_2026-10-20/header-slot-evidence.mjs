// Read-only bridge to the same SDK carrier model and forward parameter emitter.
import {Parser,Printer} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {resolveRefFull} from './types/39006703de6e-core.mjs';
import {convertParamExpr} from './graph/e19741dab56fd734-ttg-params.mjs';
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
