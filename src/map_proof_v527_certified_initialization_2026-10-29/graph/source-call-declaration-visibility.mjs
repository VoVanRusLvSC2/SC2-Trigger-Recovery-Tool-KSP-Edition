import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {indexSourceFunctionFamilies} from '../model/source-function-families.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const token=s=>logicalSourcePath(s.replace(/\.galaxy$/iu,''));

/** Independent compile-fidelity obligation, not a replacement Galaxy compiler.
 * Resolve include paths/owners and call targets first, then replay declaration
 * visibility in their actual include order. Only closed non-native families
 * are certified. Unknown/native API availability remains outside this proof.
 * No source, business-logic verdict or oracle asset is changed. */
export function verifySourceCallDeclarationVisibility(source,context={}){
 const opened=openVerifiedSourceBindingProgram(source,context);
 assert(opened.program,'CALL_VISIBILITY_COMPLETE_BINDINGS_REQUIRED: '+opened.reason);
 try{
  const {program}=opened,index=indexSourceFunctionFamilies(program),owned=new Set(['mapscript.galaxy',...(context.ownedSources??[]).map(f=>logicalSourcePath(f.originalPath??f.fileName))]);
  const edges=new Map(),seenFiles=new Set(),visible=new Set(),checked=[],failures=[],unqualified=[],visits=[];
  for(const e of context.includeEvidence??[]){
   const key=logicalSourcePath(e.from)+'\0'+token(e.include),target=logicalSourcePath(e.path),previous=edges.get(key);
   assert(!previous||previous.path===target&&previous.layerId===e.layerId,'CALL_VISIBILITY_AMBIGUOUS_INCLUDE');edges.set(key,{path:target,layerId:e.layerId});
  }
  function calls(node,file){
   if(node.kind===K.CallExpression){
    const callee=node.expression;
    if(callee.kind!==K.Identifier)unqualified.push({file,start:node.pos,reason:'NON_IDENTIFIER_CALLEE'});
    else{
     const declaration=program.declarationAt(callee),row=declaration&&index.at(declaration),family=row?.family;
     if(!family||family.declarations.some(r=>r.abi.native)||!family.declarations.some(r=>r.node.body)){
      unqualified.push({file,start:callee.pos,callee:callee.name,reason:family?.declarations.some(r=>r.abi.native)?'NATIVE_AVAILABILITY_NOT_CERTIFIED':'NO_CLOSED_NON_NATIVE_BODY'});
     }else{
      const signatures=new Set(family.declarations.map(r=>JSON.stringify(r.abi)));
      const valid=signatures.size===1&&family.declarations.filter(r=>r.node.body).length===1&&visible.has(family.key);
      const record={file,start:callee.pos,end:callee.end,callee:callee.name,visibleBeforeCall:visible.has(family.key),abiCompatible:signatures.size===1,
       uniqueBody:family.declarations.filter(r=>r.node.body).length===1,target:program.location(declaration)};
      checked.push(record);if(!valid)failures.push({...record,reason:!record.abiCompatible?'ABI_MISMATCH':!record.uniqueBody?'AMBIGUOUS_BODY':'FORWARD_DECLARATION_MISSING_AT_CALL'});
     }
    }
   }
   forEachChild(node,n=>calls(n,file));
  }
  function visit(file){
   if(seenFiles.has(file))return;seenFiles.add(file);const doc=program.documents.get(file);assert(doc,'CALL_VISIBILITY_INCLUDE_CONTENT_REQUIRED');
   visits.push({file,sha256:sha(doc.text)});
   for(const node of doc.statements){
    if(node.kind===K.IncludeStatement){const target=edges.get(file+'\0'+token(node.path.value));assert(target,'CALL_VISIBILITY_EXPLICIT_INCLUDE_REQUIRED');visit(target.path);}
    else if(node.kind===K.FunctionDeclaration){
     const row=index.at(node);assert(row,'CALL_VISIBILITY_FAMILY_REQUIRED');visible.add(row.family.key);
     if(node.body&&owned.has(file))calls(node.body,file);
    }else if(owned.has(file))calls(node,file);
   }
  }
  visit('mapscript.galaxy');
  return {kind:'CLOSED_NON_NATIVE_CALL_DECLARATION_VISIBILITY',sourceSha256:sha(source),passed:failures.length===0,checkedCalls:checked.length,checked,failures,unqualifiedCalls:unqualified.length,unqualified,
   visitedSources:visits,includeOnceByResolvedPath:true,sourceOrExportChanged:false,businessLogicVerdictChanged:false,actualEditor:false,completeGalaxyCompiler:false,wholeMapAccepted:false};
 }finally{opened.dispose();}
}
