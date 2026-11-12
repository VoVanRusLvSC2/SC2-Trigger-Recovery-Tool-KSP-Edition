// Rebind an existing call only when source and current emission each match a
// unique loaded template with the SAME parameter expressions and user body.
// IDs, XML ordering and authored content stay intact; no template is invented.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {deriveNativeLoopTemplateMatcher} from '../bindings/native-loop-template-matcher.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const key=(library,type,id)=>JSON.stringify([library,type,id]);
const omitted=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);
function shape(n){
 while(n?.kind===K.ParenthesizedExpression)n=n.expression;
 if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);
 return Object.fromEntries(Object.keys(n).filter(k=>!omitted.has(k)).sort().map(k=>[k,shape(n[k])]));
}
const name=e=>e.identifier??e.name;
const abi=p=>shape({type:p.paramType,reference:!!p.isReference,array:!!p.isArray,dimensions:p.arrayDimensions,preset:p.preset});
function functions(text){
 const ast=parseImmutableGalaxySyntax(text,'authored-template-binding');assert.equal(ast.parseDiagnostics.length,0,'TEMPLATE_BINDING_SOURCE_SYNTAX');
 const out=new Map();for(const n of ast.statements)if(n.kind===K.FunctionDeclaration&&n.body){
  assert(!out.has(n.name.name),'TEMPLATE_BINDING_DUPLICATE_FUNCTION');out.set(n.name.name,n);
 }return out;
}
function matchedCalls(fn,matcher){
 const calls=new Map();
 function visit(n){
  if(n.kind===K.Block){const statements=Array.from(n.statements);
   for(let i=0;i<statements.length;i++)for(const match of matcher.matchesAt(statements,i)){
    const ids=match.captures.filter(c=>c.kind==='AUTOVAR').map(c=>
     c.value.kind===K.Identifier&&/^auto([A-F\d]{8})_/iu.exec(c.value.name)?.[1].toUpperCase());
    if(!ids.length||ids.some(x=>!x)||new Set(ids).size!==1)continue;
    const rows=calls.get(ids[0])??[];rows.push(match);calls.set(ids[0],rows);
   }
  }forEachChild(n,visit);
 }visit(fn.body);return calls;
}
const captures=m=>m.captures.filter(c=>c.kind!=='AUTOVAR').map(c=>[c.kind+':'+c.name,shape(c.value)])
 .sort(([a],[b])=>a.localeCompare(b));

export function reconcileAuthoredTemplateBindings({xml,source,generated,nativeLibrary,owners,macros,libraryId='Map'}){
 const proof={kind:'SOURCE_BOUND_AUTHORED_TEMPLATE_BINDINGS',xmlBeforeSha256:sha(xml),sourceSha256:sha(source),
  generatedSha256:sha(generated),records:[],refused:[],newNative:0,newRaw:0,newElementIds:0,treeRebuilt:false,
  wholeProgramEquivalenceProved:false};
 const index=new Map(),uses=new Map(),ownerUses=new Map();
 function walk(n,library,fn){if(n.tag==='Library')library=n.attributes.Id;fn(n,library);for(const c of n.children??[])walk(c,library,fn);}
 walk(xmlTree(xml),libraryId,(n,library)=>{
  const a=n.attributes;
  if(n.tag==='Element'){const k=key(library,a.Type,a.Id);assert(!index.has(k),'TEMPLATE_BINDING_DUPLICATE_GUI_ID');index.set(k,n);}
  else if(['Param','FunctionCall'].includes(a.Type)&&a.Id){const k=key(a.Library??library,a.Type,a.Id);uses.set(k,(uses.get(k)??0)+1);}
 });
 const owned=owner=>{
  const pending=[...(owner.roots??[])],seen=new Set();
  while(pending.length){
   const r=pending.pop(),library=r.library??owner.library??libraryId,k=key(library,r.type,r.id);if(seen.has(k))continue;seen.add(k);
   const n=index.get(k);if(!n||['FunctionDef','Trigger'].includes(n.attributes.Type))continue;
   if(n.attributes.Type==='FunctionCall'){const set=ownerUses.get(k)??new Set();set.add(owner.sourceFunction);ownerUses.set(k,set);}
   walk(n,library,(c,scope)=>{if(c===n||c.tag==='Element')return;const a=c.attributes;
    if(['Param','FunctionCall'].includes(a.Type)&&a.Id)pending.push({type:a.Type,id:a.Id,library:a.Library??scope});});
  }return seen;
 };
 const ownerGraphs=owners.map(o=>({owner:o,owned:owned(o)}));
 // Most documents have no compiler-shaped calls; avoid parsing all metadata.
 if(![...ownerUses.keys()].some(k=>/^[A-F\d]{8}$/iu.test(JSON.parse(k)[2])))
  return {xml,proof:{...proof,xmlAfterSha256:sha(xml),allOtherXmlBytesExactByInverse:true}};
 const matcher=deriveNativeLoopTemplateMatcher(nativeLibrary,{macros}),before=functions(source),current=functions(generated);
 const nativeElements=Object.values(nativeLibrary.elements),byType=(type,id)=>nativeElements.find(e=>e.type===type&&e.id===id);
 const definitions=new Map(nativeElements.filter(e=>e.type==='FunctionDef').map(e=>[e.id,e]));
 const edits=new Map();
 function replaceId(node,oldId,newId){
  if(oldId===newId)return;
  const tag=xml.slice(node.start,node.openEnd),matches=[...tag.matchAll(/\bId\s*=\s*(["'])(.*?)\1/gu)];
  assert(matches.length===1&&matches[0][2]===oldId,'TEMPLATE_BINDING_XML_REF');
  const m=matches[0],at=node.start+m.index+m[0].indexOf(m[1])+1;
  const e={start:at,end:at+oldId.length,text:newId,before:oldId};
  if(edits.has(at))assert.deepEqual(edits.get(at),e,'TEMPLATE_BINDING_SHARED_EDIT');else edits.set(at,e);
 }
 for(const {owner,owned:graph}of ownerGraphs){
  const a=before.get(owner.sourceFunction),b=current.get(owner.sourceFunction);if(!a||!b)continue;
  const sourceCalls=matchedCalls(a,matcher),emittedCalls=matchedCalls(b,matcher);
  for(const [id,observed]of sourceCalls){
   const k=key(owner.library??libraryId,'FunctionCall',id),call=index.get(k);if(!call||!graph.has(k))continue;
   const ref=call.children.find(c=>c.tag==='FunctionDef');
   if(!ref||(ref.attributes.Library??owner.library??libraryId)!==nativeLibrary.id)continue;
   const expected=observed.length===1?observed[0]:undefined;
   if(expected?.templateId===ref.attributes.Id)continue;
   const actual=emittedCalls.get(id),old=definitions.get(ref.attributes.Id),target=expected&&definitions.get(expected.templateId);
   const refuse=reason=>proof.refused.push({sourceFunction:owner.sourceFunction,callId:id,reason});
   if(!expected||actual?.length!==1||actual[0].templateId!==old?.id||!target||
     !isDeepStrictEqual(captures(expected),captures(actual[0]))||uses.get(k)!==1||ownerUses.get(k)?.size!==1){
    refuse('UNIQUE_SOURCE_EMISSION_OWNERSHIP_OR_CAPTURES_UNPROVEN');continue;
   }
   const relevant=new Set(['Action','SubFunctions','AllowBreak','AllowContinue','Call','Event','Operator','Native','CreateThread']);
   const flags=e=>(e.flags??[]).filter(f=>relevant.has(f)).sort();
   const formals=def=>(def.parameters??[]).map(r=>(r.library??nativeLibrary.id)===nativeLibrary.id?byType('ParamDef',r.id):undefined);
   const roles=def=>(def.subFunctionTypes??[]).map(r=>(r.library??nativeLibrary.id)===nativeLibrary.id?byType('SubFuncType',r.id):undefined);
   const from=formals(old),to=formals(target),oldRoles=roles(old),newRoles=roles(target);
   const unique=list=>list.every(e=>e&&typeof name(e)==='string')&&new Set(list.map(name)).size===list.length;
   if(!isDeepStrictEqual(flags(old),flags(target))||!unique(from)||!unique(to)||!unique(oldRoles)||!unique(newRoles)||
    from.length!==to.length||oldRoles.length!==newRoles.length||
    from.some(p=>!to.some(q=>name(p)===name(q)&&isDeepStrictEqual(abi(p),abi(q))))||
    oldRoles.some(p=>!newRoles.some(q=>name(p)===name(q)&&!!p.isAction===!!q.isAction&&!!p.isEvent===!!q.isEvent&&!!p.isCondition===!!q.isCondition))){
    refuse('PARAMETER_OR_ROLE_ABI_UNPROVEN');continue;
   }
   const plan=[],refs=call.children.filter(c=>c.tag==='Parameter'),seen=new Set();let valid=refs.length===from.length;
   for(const r of refs){
    const library=r.attributes.Library??owner.library??libraryId,pk=key(library,'Param',r.attributes.Id),p=index.get(pk);
    const formal=p?.children.find(c=>c.tag==='ParameterDef'),f=from.find(x=>x.id===formal?.attributes.Id);
    if(!formal||(formal.attributes.Library??library)!==nativeLibrary.id||!f||seen.has(f.id)||uses.get(pk)!==1){valid=false;break;}
    seen.add(f.id);plan.push([formal,f.id,to.find(q=>name(q)===name(f)).id]);
   }
   for(const childRef of call.children.filter(c=>c.tag==='FunctionCall')){
    const scope=childRef.attributes.Library??owner.library??libraryId,ck=key(scope,'FunctionCall',childRef.attributes.Id),child=index.get(ck);
    const role=child?.children.find(c=>c.tag==='SubFunctionType');
    if(!child||uses.get(ck)!==1){valid=false;break;}
    if(!role){if(oldRoles.length!==1)valid=false;continue;}
    const f=oldRoles.find(x=>x.id===role.attributes.Id);
    if(!f||(role.attributes.Library??scope)!==nativeLibrary.id){valid=false;break;}
    plan.push([role,f.id,newRoles.find(q=>name(q)===name(f)).id]);
   }
   if(!valid){refuse('EXPLICIT_PARAMETER_OR_CHILD_ROLE_OWNERSHIP_UNPROVEN');continue;}
   replaceId(ref,old.id,target.id);for(const e of plan)replaceId(...e);
   proof.records.push({sourceFunction:owner.sourceFunction,library:owner.library??libraryId,callId:id,
    before:old.id,after:target.id,parametersAndUserBodyAstExact:true,
    templateSha256:matcher.proof.templates.find(t=>t.id===target.id)?.templateSha256});
  }
 }
 let result='',cursor=0;const inverse=[];
 for(const e of [...edits.values()].sort((a,b)=>a.start-b.start)){
  assert(e.start>=cursor,'TEMPLATE_BINDING_OVERLAPPING_EDIT');result+=xml.slice(cursor,e.start);
  inverse.push({start:result.length,end:result.length+e.text.length,text:e.before});result+=e.text;cursor=e.end;
 }result+=xml.slice(cursor);xmlTree(result);
 let restored=result;for(const e of inverse.toReversed())restored=restored.slice(0,e.start)+e.text+restored.slice(e.end);
 assert.equal(restored,xml,'TEMPLATE_BINDING_INVERSE_NOT_EXACT');
 return {xml:result,proof:{...proof,xmlAfterSha256:sha(result),allOtherXmlBytesExactByInverse:true}};
}
