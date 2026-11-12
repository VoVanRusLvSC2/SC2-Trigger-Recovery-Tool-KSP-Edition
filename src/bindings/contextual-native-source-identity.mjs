import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const allowedFlags=new Set(['Operator','Call','NoScriptPrefix','Hidden','Internal']);

// A direct call to a declared native is an observation of runtime state. A
// pure AUTOVAR macro reads an editor-created lexical cell instead. Matching
// spelling/ABI is not proof that these operations are interchangeable, even
// when a GUI ancestor happens to be present. This rule has no API/ID list.
export function inspectContextualNativeValueCandidates(index,name,abi){
 if(!abi?.returnType||abi.returnType==='void'||abi.parameters?.length!==0)return;
 const candidates=index.bySymbol.get(name)??[];if(!candidates.length)return;
 const records=[];
 for(const c of candidates){
  const d=c.definition,flags=d.flags??[],macro=/^\s*#AUTOVAR\(\s*([_A-Za-z]\w*)\s*,\s*ancestor:\s*([_A-Za-z]\w*)\s*\)\s*$/u.exec(d.scriptCode??'');
  if(d.type!=='FunctionDef'||(d.library??c.library.id)!==c.library.id||c.origin!=='emitted'||c.symbol!==name||d.name!==name||d.identifier&&d.identifier!==name||!macro||d.disabled||d.expressionCode||d.isSubFunction||
   d.parameters?.length||d.localVariables?.length||d.actions?.length||d.subFunctionTypes?.length||d.subFunctions?.length||
   !flags.includes('Operator')||!flags.includes('Call')||flags.some(f=>!allowedFlags.has(f))||
   (d.unknownXml??[]).some(n=>n.tag!=='Label')||index.carrier(d.returnType,c.library)!==abi.returnType)return;
  records.push({key:c.key,library:c.library.id,type:d.type,id:d.id,definitionSha256:sha(d),macro:macro[0].trim(),cell:macro[1],ancestor:macro[2],
   reason:'LEXICAL_AUTOVAR_IS_NOT_A_DIRECT_RUNTIME_NATIVE_INVOCATION'});
 }
 return {kind:'CONTEXTUAL_GUI_NATIVE_SOURCE_IDENTITY',api:name,abi,candidates:records,allLoadedSymbolCandidatesInspected:true,
  differentNativeNameAliasAccepted:false,guiLoopModernizationProved:false,sourceOrGuiChanged:false};
}
