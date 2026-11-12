import {indexSourceFunctionFamilies,requireRetainedSourceFunctionFamily} from "../../model/source-function-families.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from "../../model/verified-source-binding-program.lexical-parameters.mjs";
import {logicalSourcePath} from "../../model/source-ownership.mjs";
import {SyntaxKind as K,forEachChild} from "../../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=s=>createHash('sha256').update(s).digest('hex');
const id=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);

// One atomic preserved include section can move across exact passive original
// declarations only. Original bound references impose both directions of the
// declaration-before-use relation; cycles need a richer source weave, not a
// silent source rewrite, partial include split or fallback.
export function planPreservedIncludeStorageOrder(input,sections){
 const selected=sections.filter(s=>s.passiveDeclarationOnly&&['primary.galaxy','header.galaxy'].includes(s.fileName));
 const result={kind:'BOUND_PRESERVED_INCLUDE_STORAGE_ORDER',constraints:[],sourceHashes:[],semanticEquivalenceProved:false};
 if(!selected.length||!input.additionalScripts?.length)return result;
 const header=input.header??'',text=[header,input.script].filter(Boolean).join('\n'),offset=header?header.length+1:0;
 const opened=openVerifiedSourceBindingProgram(text,{ownedSources:input.additionalScripts,externalSources:input.galaxyDeclarations??[],includeEvidence:input.includeEvidence});
 assert(opened.program,'INCLUDE_STORAGE_COMPLETE_BINDINGS_REQUIRED: '+opened.reason);
 const {program}=opened,root=program.documents.get('mapscript.galaxy');assert(root,'INCLUDE_STORAGE_ROOT_REQUIRED');
 try{
  const owned=new Set(input.additionalScripts.map(f=>logicalSourcePath(f.originalPath??f.fileName))),byStart=new Map(),names=new Set(),families=indexSourceFunctionFamilies(program);
  for(const section of selected){
   const source=section.fileName==='header.galaxy'?header:input.script??'',sectionOffset=section.fileName==='header.galaxy'?0:offset;
   assert.equal(section.sourceSha256,sha(source),'INCLUDE_STORAGE_ORIGINAL_SOURCE_SHA');
   assert.equal(section.code,source.slice(section.start,section.end),'INCLUDE_STORAGE_ORIGINAL_SECTION');
   const nodes=root.statements.filter(n=>n.pos>=section.start+sectionOffset&&n.end<=section.end+sectionOffset);
   assert(nodes.length&&nodes[0].pos===section.start+sectionOffset&&nodes.at(-1).end===section.end+sectionOffset,'INCLUDE_STORAGE_DECLARATION_SPANS');
   for(const node of nodes){
    const prototype=section.sourcePrototypeDeclarations===true;
    assert(prototype?node.kind===K.FunctionDeclaration&&!node.body&&!node.modifiers?.length:section.sourceNominalDeclarations===true?[K.VariableDeclaration,K.StructDeclaration,K.TypedefDeclaration].includes(node.kind)&&!node.initializer&&!node.modifiers?.length:node.kind===K.VariableDeclaration&&!node.initializer&&(node.modifiers??[]).every(m=>m.kind===K.StaticKeyword),'INCLUDE_STORAGE_PASSIVE_DECLARATION_REQUIRED');
    if(prototype){
     const family=requireRetainedSourceFunctionFamily(families.at(node)?.family,owned);
     result.constraints.push({sectionSha256:section.sha256,direction:'STORAGE_BEFORE_INCLUDE',reference:{sourceFile:'mapscript.galaxy',start:node.pos,end:node.end},target:family.body,role:'ORIGINAL_FORWARD_DECLARATION'});
    }
    assert(!byStart.has(node.pos),'INCLUDE_STORAGE_DUPLICATE_DECLARATION');byStart.set(node.pos,section);names.add(node.name.name);
    function typeReference(n){
     if(n.kind===K.Identifier){
      const target=program.declarationAt(n),where=target&&program.location(target);
      assert(where,'INCLUDE_STORAGE_UNBOUND_TYPE_REFERENCE');
      if(owned.has(where.sourceFile)){
       assert(prototype||section.sourceNominalDeclarations===true?[K.StructDeclaration,K.TypedefDeclaration].includes(target.kind)||target.kind===K.VariableDeclaration&&target.modifiers?.some(m=>m.kind===K.ConstKeyword):target.kind===K.VariableDeclaration&&target.modifiers?.some(m=>m.kind===K.ConstKeyword),'INCLUDE_STORAGE_CONSTANT_BOUND_REQUIRED');
       result.constraints.push({sectionSha256:section.sha256,direction:'INCLUDE_BEFORE_STORAGE',reference:{sourceFile:'mapscript.galaxy',start:n.pos,end:n.end},target:where});
      }
     }forEachChild(n,typeReference);
    }for(const type of node.kind===K.StructDeclaration?node.members.map(m=>m.type):[node.type])typeReference(type);if(prototype)for(const p of node.parameters)typeReference(p.type);
   }
  }
  for(const file of owned){
   const doc=program.documents.get(file);if(!doc)continue;
   function reference(n){
    if(n.kind===K.Identifier){
     const target=program.declarationAt(n),where=target&&program.location(target),section=where?.sourceFile==='mapscript.galaxy'&&byStart.get(target.pos);
     const member=n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n;
     assert(target||!names.has(n.name)||member,'INCLUDE_STORAGE_UNBOUND_SOURCE_REFERENCE');
     if(section)result.constraints.push({sectionSha256:section.sha256,direction:'STORAGE_BEFORE_INCLUDE',reference:{sourceFile:file,start:n.pos,end:n.end},target:where});
    }forEachChild(n,reference);
   }reference(doc);
  }
  result.sourceHashes=[...program.documents].map(([fileName,doc])=>({fileName,sha256:sha(doc.text)}));
  return result;
 }finally{opened.dispose();}
}

export function orderPreservedIncludeStorage({elements,library,rootRefs,sections,records,plan,isPreservedInclude,repairOrder=false}){
 if(!plan.constraints.length)return {kind:plan.kind,changed:false,constraints:0};
 const by=new Map([...new Set(Object.values(elements))].map(e=>[id(e,library),e]));
 const includes=[...by.values()].filter(e=>(e.library??library)===library&&!e.disabled&&isPreservedInclude(e));
 assert.equal(includes.length,1,'INCLUDE_STORAGE_ATOMIC_INCLUDE_SECTION_REQUIRED');
 const include=includes[0],includeKey=id(include,library),sectionKeys=new Map();
 for(const section of sections.filter(s=>s.library===library&&s.passiveDeclarationOnly)){
  const rows=records.filter(r=>r.kind==='ORIGINAL_AUTHORED_SECTION'&&r.library===library&&r.sectionSha256===section.sha256&&r.sourceSha256===section.sourceSha256);
  assert.equal(rows.length,1,'INCLUDE_STORAGE_GUI_ORIGIN_REQUIRED');
  const key=id(rows[0],library),element=by.get(key);
  assert(element?.type==='CustomScript'&&!element.initFunc&&!element.disabled&&element.expressionCode===undefined&&!element.flags?.length,'INCLUDE_STORAGE_PASSIVE_GUI_REQUIRED');
  assert.equal(element.scriptCode.replace(/\r\n?/gu,'\n'),section.code.replace(/\r\n?/gu,'\n'),'INCLUDE_STORAGE_GUI_CODE_CHANGED');
  sectionKeys.set(section.sha256,key);
 }
 const containers=[{refs:rootRefs,owner:library},...[...by.values()].filter(e=>e.type==='Category').map(e=>({refs:e.items??[],owner:e.library??library}))];
 const owners=containers.filter(c=>c.refs.some(r=>id(r,c.owner)===includeKey));assert.equal(owners.length,1,'INCLUDE_STORAGE_INCLUDE_TREE_OWNER');
 const {refs,owner}=owners[0],keys=refs.map(r=>id(r,owner));assert.equal(new Set(keys).size,keys.length,'INCLUDE_STORAGE_DUPLICATE_TREE_ITEM');
 const index=keys.indexOf(includeKey),without=keys.filter(k=>k!==includeKey);
 let lower=0,upper=without.length;
 for(const c of plan.constraints){
  const key=sectionKeys.get(c.sectionSha256),at=without.indexOf(key);assert(key&&at>=0,'INCLUDE_STORAGE_SAME_FOLDER_REQUIRED');
  if(c.direction==='INCLUDE_BEFORE_STORAGE')upper=Math.min(upper,at);
  else {assert.equal(c.direction,'STORAGE_BEFORE_INCLUDE');lower=Math.max(lower,at+1);}
 }
 assert(lower<=upper,'INCLUDE_STORAGE_DEPENDENCY_CYCLE');
 const destination=Math.max(lower,Math.min(index,upper));
 if(destination!==index){
  const passiveKeys=new Set(sectionKeys.values());
  const crossed=destination<index?keys.slice(destination,index):keys.slice(index+1,destination+1);
  assert(crossed.every(k=>passiveKeys.has(k)),'INCLUDE_STORAGE_EFFECT_OR_FOLDER_BARRIER');
  assert(repairOrder,'INCLUDE_STORAGE_ORDER_NOT_SATISFIED');
  const ref=refs[index];refs.splice(index,1);refs.splice(destination,0,ref);
 }
 return {kind:plan.kind,changed:destination!==index,constraints:plan.constraints.length,include:[include.library??library,include.type,include.id],folderMembershipPreserved:true,sourceCodeChanged:false,runtimeInitializationOrderChanged:false};
}
