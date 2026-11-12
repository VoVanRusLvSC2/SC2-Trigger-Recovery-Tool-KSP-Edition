// Preserve the exact runtime operation in an authored lexical getter binding.
// This is a source-bound repair plan, not an equivalence claim: the unchanged
// whole-program oracle and an actual Editor export must qualify the result.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {serializeTriggerLibraryCanonical} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
import {inspectContextualNativeValueCandidates} from '../bindings/contextual-native-source-identity.mjs';
import {declaredCarrier} from '../../map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d47b1c49befb-galaxy-program-context.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),key=(l,t,id)=>JSON.stringify([l,t,id]);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

export function reconcileAuthoredContextualNativeGetters({xml,sourceAst,program,candidates,factory,owners,libraryId='Map'}){
 const proof={kind:'SOURCE_BOUND_AUTHORED_CONTEXTUAL_NATIVE_GETTERS',xmlBeforeSha256:sha(xml),source:program.verifiedInputIdentity(sourceAst.fileName),records:[],refused:[],
  treeRebuilt:false,newRuntimeFunctions:0,newCustomScript:0,wholeProgramEquivalenceProved:false,actualEditorExportRequired:true};
 const root=xmlTree(xml),nodes=new Map(),uses=new Map(),ownerUses=new Map(),scopes=new Map();
 function walk(n,scope,fn){if(n.tag==='Library')scope=n.attributes.Id;fn(n,scope);for(const c of n.children??[])walk(c,scope,fn);}
 walk(root,libraryId,(n,l)=>{
  if(n.tag==='Library'||n.tag==='TriggerData'&&l===libraryId)scopes.set(l,n);
  const a=n.attributes;if(n.tag==='Element'){const k=key(l,a.Type,a.Id);assert(!nodes.has(k),'CONTEXTUAL_GETTER_DUPLICATE_GUI_ID');nodes.set(k,n);}
  else if(['Param','FunctionCall'].includes(a.Type)&&a.Id){const k=key(a.Library??l,a.Type,a.Id);uses.set(k,(uses.get(k)??0)+1);}
 });
 const bodies=new Map();for(const fn of sourceAst.statements)if(fn.kind===K.FunctionDeclaration&&fn.body){assert(!bodies.has(fn.name.name),'CONTEXTUAL_GETTER_DUPLICATE_FUNCTION');bodies.set(fn.name.name,fn);}
 const graphs=owners.map(owner=>{
  const scope=owner.library??libraryId,seen=new Set(),pending=[...(owner.roots??[])];
  while(pending.length){const r=pending.pop(),l=r.library??scope,k=key(l,r.type,r.id);if(seen.has(k))continue;seen.add(k);
   const n=nodes.get(k);if(!n||['Trigger','FunctionDef'].includes(n.attributes.Type))continue;
   if(n.attributes.Type==='FunctionCall'){const set=ownerUses.get(k)??new Set();set.add(owner.sourceFunction);ownerUses.set(k,set);}
   walk(n,l,(c,cl)=>{if(c===n||c.tag==='Element')return;const a=c.attributes;if(['Param','FunctionCall'].includes(a.Type)&&a.Id)pending.push({library:a.Library??cl,type:a.Type,id:a.Id});});
  }return {owner,scope,seen};
 });
 const edits=[],staged=new Map();
 for(const {owner,scope,seen}of graphs){
  const fn=bodies.get(owner.sourceFunction);if(!fn)continue;
  const sourceGroups=new Map();
  const visit=n=>{
   if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.arguments.length===0){
    const d=program.declarationAt(n.expression),abi=d?.kind===K.FunctionDeclaration&&!d.body&&d.modifiers?.some(m=>m.kind===K.NativeKeyword)&&d.parameters.length===0?{returnType:declaredCarrier(d.type),parameters:[]}:undefined;
    const contextual=abi&&inspectContextualNativeValueCandidates(candidates,n.expression.name,abi);
    if(contextual){const g=sourceGroups.get(n.expression.name)??{calls:[],contextual,abi};g.calls.push(n);sourceGroups.set(n.expression.name,g);}
   }forEachChild(n,visit);
  };visit(fn.body);
  for(const [api,g]of sourceGroups){
   const allowed=new Set(g.contextual.candidates.map(c=>key(c.library,'FunctionDef',c.id))),matches=[];
   for(const k of seen){const n=nodes.get(k);if(n?.attributes.Type!=='FunctionCall')continue;const callScope=JSON.parse(k)[0],ref=n.children.find(c=>c.tag==='FunctionDef');
    if(ref&&allowed.has(key(ref.attributes.Library??callScope,'FunctionDef',ref.attributes.Id)))matches.push({k,n,ref});
   }
   if(!matches.length)continue;
   if(g.calls.length!==matches.length||matches.some(m=>uses.get(m.k)!==1||ownerUses.get(m.k)?.size!==1||m.n.children.length!==1)){
    proof.refused.push({sourceFunction:owner.sourceFunction,api,reason:'SOURCE_COUNT_OR_UNIQUE_EXPRESSION_OWNERSHIP_UNPROVEN',sourceCalls:g.calls.length,guiCalls:matches.length});continue;
   }
   let ctx=staged.get(scope);if(!ctx){ctx={libId:scope,elements:{}};staged.set(scope,ctx);}
   const descriptor=factory.describe(g.calls[0],ctx,'value',candidates.resolve({name:api,guiUse:'value',declaration:g.abi}));
   if(!descriptor){proof.refused.push({sourceFunction:owner.sourceFunction,api,reason:'EXACT_NATIVE_DESCRIPTION_NOT_AUTHORIZED'});continue;}
   assert(descriptor.flags.includes('Native')&&!descriptor.scriptCode&&!descriptor.expressionCode&&descriptor.parameters.length===0,'CONTEXTUAL_GETTER_NOT_EXACT_NATIVE');
   for(const {k,ref}of matches){
    edits.push({start:ref.start,end:ref.end,before:xml.slice(ref.start,ref.end),text:`<FunctionDef Type="FunctionDef" Library="${escape(scope)}" Id="${escape(descriptor.id)}"/>`});
    proof.records.push({sourceFunction:owner.sourceFunction,call:JSON.parse(k),api,definition:{library:scope,id:descriptor.id},sourceCalls:g.calls.length,guiCalls:matches.length});
   }
  }
 }
 let added=0;
 for(const [scope,ctx]of staged){
  const elements=Object.values(ctx.elements);if(!elements.length)continue;const target=scopes.get(scope);assert(target&&!target.selfClosing,'CONTEXTUAL_GETTER_SCOPE_MISSING');
  for(const e of elements)assert(!nodes.has(key(scope,e.type,e.id)),'CONTEXTUAL_GETTER_DESCRIPTOR_ID_COLLISION');
  const lib={id:scope,implicit:true,elements:ctx.elements,rootItems:elements.map(e=>({type:e.type,id:e.id}))};
  const serialized=serializeTriggerLibraryCanonical(lib),parsed=xmlTree(serialized),defs=parsed.children.filter(n=>n.tag==='Element');
  assert.equal(defs.length,elements.length,'CONTEXTUAL_GETTER_SERIALIZATION_LOST_ELEMENTS');
  edits.push({start:target.closeStart,end:target.closeStart,before:'',text:defs.map(n=>serialized.slice(n.start,n.end)).join('\n')+'\n'});
  const guiRoot=target.children.find(n=>n.tag==='Root');assert(guiRoot&&!guiRoot.selfClosing,'CONTEXTUAL_GETTER_ROOT_MISSING');
  edits.push({start:guiRoot.closeStart,end:guiRoot.closeStart,before:'',text:elements.map(e=>`<Item Type="${escape(e.type)}" Id="${escape(e.id)}"/>`).join('\n')+'\n'});added+=elements.length;
 }
 let result='',cursor=0;const inverse=[];
 for(const e of edits.sort((a,b)=>a.start-b.start)){
  assert(e.start>=cursor,'CONTEXTUAL_GETTER_SHARED_OR_OVERLAPPING_EDIT');result+=xml.slice(cursor,e.start);inverse.push({start:result.length,end:result.length+e.text.length,text:e.before});result+=e.text;cursor=e.end;
 }result+=xml.slice(cursor);xmlTree(result);
 let restored=result;for(const e of inverse.toReversed())restored=restored.slice(0,e.start)+e.text+restored.slice(e.end);
 assert.equal(restored,xml,'CONTEXTUAL_GETTER_INVERSE_NOT_EXACT');
 return {xml:result,proof:{...proof,xmlAfterSha256:sha(result),newNativeDescriptions:added,allOtherXmlBytesExactByInverse:true,nativeDescriptions:factory.report()}};
}
