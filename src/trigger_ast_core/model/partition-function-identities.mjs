import {createHash} from 'node:crypto';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const signature=(source,node)=>source.text.slice(node.pos,node.body.pos).trim();
const body=(source,node)=>source.text.slice(node.body.pos,node.body.end);
function functions(source){
 const map=new Map();
 for(const node of source.statements??[]){
  if(node.kind!==K.FunctionDeclaration||!node.body||!node.name?.name)continue;
  const list=map.get(node.name.name)??[];list.push(node);map.set(node.name.name,list);
 }
 return map;
}

// This certifies textual identity of explicitly requested function definitions;
// it does not certify reachability, a closed dependency graph, or GUI semantics.
export function classifyPartitionFunctionIdentities({whole,part,wholeSha256,partSha256,names,compareBodies=true}){
 if(!whole||!part||typeof whole.text!=='string'||typeof part.text!=='string'||
    !Array.isArray(whole.statements)||!Array.isArray(part.statements)||whole.parseDiagnostics?.length||part.parseDiagnostics?.length||
    sha(whole.text)!==wholeSha256||sha(part.text)!==partSha256||!Array.isArray(names)||names.length===0||
    names.some(name=>typeof name!=='string'||!name)||new Set(names).size!==names.length||typeof compareBodies!=='boolean')
  return {status:'REFUSED',reason:'INPUT_IDENTITY_OR_PARSE',records:[]};
 const source=functions(whole),target=functions(part),records=[],rejected=[];
 for(const name of names){
  const a=source.get(name)??[],b=target.get(name)??[];
  if(a.length!==1||b.length!==1){rejected.push({name,reason:'FUNCTION_IDENTITY_NOT_UNIQUE'});continue;}
  const aSig=signature(whole,a[0]),bSig=signature(part,b[0]),aBody=body(whole,a[0]),bBody=body(part,b[0]);
  if(aSig!==bSig||(compareBodies&&aBody!==bBody)){rejected.push({name,reason:'FUNCTION_CONTENT_CHANGED'});continue;}
  records.push({name,signatureSha256:sha(aSig),...(compareBodies?{bodySha256:sha(aBody)}:{bodyCompared:false})});
 }
 return {status:'CLASSIFIED',wholeSha256,partSha256,records,rejected,bodiesCompared:compareBodies,identityOnly:true,startupMovementAuthorized:false,wholeProgramEquivalenceProved:false};
}
export function provePartitionFunctionIdentities(input){
 const result=classifyPartitionFunctionIdentities({...input,compareBodies:true});if(result.status!=='CLASSIFIED')return result;
 if(result.rejected.length)return {status:'REFUSED',...result.rejected[0],records:[]};
 const {rejected,...rest}=result;return {...rest,status:'MATCHED'};
}
