// Preview only. Recover stock GUI for from an equivalent reconstructed while
// only when every source loop in the owner was a for, source bindings are
// closed, stock role identities are qualified, and the entire GUI pattern is
// uniquely owned. The caller must independently audit and run real Editor plus
// the complete unchanged benchmark. No map, source or original while is edited.
import assert from 'node:assert/strict';
import {discoverBoundConstantForCandidates} from '../model/bound-constant-for-candidates.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {toGalaxyFunctionName,globalVarName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const key=r=>JSON.stringify([r.library??'Map',r.type,r.id]),ref=e=>({library:e.library??'Map',type:e.type,id:e.id}),un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
export function previewConstantBoundGuiFor({source,closedContext,guiXml,nativeXml,existingTriggerData=false}){
 const result={kind:'CONSTANT_BOUND_SOURCE_FOR_GUI_PREVIEW',records:[],refused:[],sourceChanged:false,newNative:0,newCustomScript:0,newRuntimeFunctions:0,originalWhileChanged:false,guiUsabilityNotProved:true,wholeMapAccepted:false};
 if(existingTriggerData)return{...result,reason:'PRESERVE_EXISTING_GUI_STRUCTURE'};const discovered=discoverBoundConstantForCandidates(source,closedContext);if(!discovered.completeReachableClosure)return{...result,reason:discovered.reason};
 const libs=readOwnedGuiLibraries(guiXml,'Map'),native=readOwnedGuiLibraries(nativeXml,'Ntve').get('Ntve'),map=libs.get('Map');if(!map||!native||libs.size!==1)return{...result,reason:'GUI_SCOPE_UNSUPPORTED'};
 const elements=Object.values(map.elements),by=new Map(elements.map(e=>[key(ref(e)),e]));if(new Set(elements.map(e=>e.id)).size!==elements.length)return{...result,reason:'GUI_CROSS_TYPE_ID_COLLISION'};
 const sdkMap=new Map(Object.values(native.elements).map(e=>[JSON.stringify([e.type,e.id]),e])),sdk=(type,id)=>sdkMap.get(JSON.stringify([type,id]));
 function def(name){const xs=Object.values(native.elements).filter(e=>e.type==='FunctionDef'&&e.identifier===name&&!e.disabled);return xs.length===1?xs[0]:undefined;}
 const wh=def('While'),range=def('ForEachInteger'),cmp=def('Comparison'),set=def('SetVariable'),inc=def('IncrementInteger');
 if(!wh||!range||!cmp||!set||!inc||!['Action','SubFunctions','AllowBreak'].every(x=>wh.flags?.includes(x))||!['Action','SubFunctions','AllowBreak'].every(x=>range.flags?.includes(x))||!['Condition','Operator'].every(x=>cmp.flags?.includes(x))||!['Action','Operator'].every(x=>set.flags?.includes(x))||!['Action','Operator'].every(x=>inc.flags?.includes(x))||wh.parameters?.length!==0||wh.subFunctionTypes?.length!==2||range.parameters?.length!==4||range.subFunctionTypes?.length!==1||cmp.parameters?.length!==3||set.parameters?.length!==2||inc.parameters?.length!==3)return{...result,reason:'STOCK_LOOP_DEFINITIONS_UNQUALIFIED'};
 const fp=range.parameters.map(r=>sdk('ParamDef',r.id)),sp=set.parameters.map(r=>sdk('ParamDef',r.id)),cp=cmp.parameters.map(r=>sdk('ParamDef',r.id)),ip=inc.parameters.map(r=>sdk('ParamDef',r.id)),roles=wh.subFunctionTypes.map(r=>sdk('SubFuncType',r.id)),targetRole=sdk('SubFuncType',range.subFunctionTypes[0].id);
 if([...fp,...sp,...cp,...ip,...roles,targetRole].some(x=>!x)||fp[0].paramType?.type!=='anyvariable'||fp[0].paramType.variableType!=='int'||fp.slice(1).some(x=>x.paramType?.type!=='int'||x.isReference||x.isMultiple)||sp[0].paramType?.type!=='anyvariable'||sp[1].paramType?.type!=='sameas'||key(sp[1].paramType.typeElement)!==key(sp[0])||cp[0].paramType?.type!=='anycompare'||cp[1].paramType?.type!=='preset'||cp[2].paramType?.type!=='sameas'||key(cp[2].paramType.typeElement)!==key(cp[0])||ip[0].paramType?.type!=='anyvariable'||ip[0].paramType.variableType!=='int'||ip[1].paramType?.type!=='preset'||ip[2].paramType?.type!=='int'||!roles[1].isAction||!targetRole.isAction)return{...result,reason:'STOCK_LOOP_FORMALS_UNQUALIFIED'};
 const n=fp.map(x=>x.identifier??x.name),role=targetRole.identifier??targetRole.name,macro=`#INITAUTOVAR(ae,${n[2]}) #INITAUTOVAR(ai,${n[3]}) #PARAM(${n[0]}) = #PARAM(${n[1]}); for (; ((#AUTOVAR(ai) >= 0 && #PARAM(${n[0]}) <= #AUTOVAR(ae)) || (#AUTOVAR(ai) < 0 && #PARAM(${n[0]}) >= #AUTOVAR(ae))); #PARAM(${n[0]}) += #AUTOVAR(ai)) { #SUBFUNCS(${role}) }`;
 const whileMacro='while (#SUBFUNCS('+roles[0].identifier+'," && ")) { #SUBFUNCS('+roles[1].identifier+') }';
 if(typeof wh.scriptCode!=='string'||wh.scriptCode.replace(/\s/gu,'')!==whileMacro.replace(/\s/gu,'')||typeof range.scriptCode!=='string'||range.scriptCode.replace(/\s/gu,'')!==macro.replace(/\s/gu,'')||set.scriptCode?.replace(/\s/gu,'')!=='#PARAM(var)=#PARAM(val);'||inc.scriptCode?.replace(/\s/gu,'')!=='#PARAM(var)#PARAM(operator)=#PARAM(val);')return{...result,reason:'STOCK_MACRO_CHANGED'};
 const get=r=>r&&by.get(key({library:r.library??'Map',type:r.type,id:r.id})),incoming=new Map();for(const e of elements){function scan(v,parts){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach((x,i)=>scan(x,[...parts,String(i)]));return;}if(v.type&&v.id){const k=key({library:v.library??e.library??'Map',type:v.type,id:v.id}),a=incoming.get(k)??[];a.push({owner:e,path:parts.join('.')});incoming.set(k,a);return;}for(const[k,x]of Object.entries(v))if(!['parent','xmlSource','rawXml'].includes(k))scan(x,[...parts,k]);}for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))scan(v,[k]);}
 const oneOwner=(target,owner,pattern)=>{const xs=incoming.get(key(ref(target)))??[];return xs.length===1&&xs[0].owner===owner&&pattern.test(xs[0].path);};
 const params=(call,defs)=>{if(call.disabled||call.scriptCode!==undefined)return;const all=(call.parameters??[]).map(get);if(all.length!==defs.length)return;const selected=defs.map(d=>all.filter(x=>x?.parameterDef&&key(x.parameterDef)===key(d)));return selected.every(x=>x.length===1)?selected.map(x=>x[0]):undefined;};
 function preset(param,formal,value){const r=param?.preset;if(r?.library!=='Ntve'||r.type!=='PresetValue'||formal.paramType.type!=='preset')return false;const p=sdk('Preset',formal.paramType.typeElement.id),v=sdk('PresetValue',r.id);return !!p&&!!v&&v.value===value&&(p.values??[]).some(x=>key(x)===key(r));}
 const root=new Parser().parseFile('source',source);assert.equal(root.parseDiagnostics.length,0);const candidates=new Map();for(const c of discovered.candidates){const xs=candidates.get(c.owner)??[];xs.push(c);candidates.set(c.owner,xs);}const plans=[];
 for(const fn of elements.filter(e=>e.type==='FunctionDef'&&e.actions?.length&&candidates.has(e.identifier??e.name))){
  const emitted=withImplicitLibrary('Map',()=>toGalaxyFunctionName(fn,{libId:'Map',library:map,nativeLibrary:native,allLibraries:libs})),src=root.statements.filter(x=>x.kind===K.FunctionDeclaration&&x.body&&x.name.name===emitted),possible=candidates.get(emitted)??[];if(src.length!==1||!possible.length)continue;
  const sourceLoops=[];let forbidden=0;walk(src[0].body,x=>{if(x.kind===K.ForStatement)sourceLoops.push(x);if([K.WhileStatement,K.DoStatement].includes(x.kind))forbidden++;});if(forbidden)continue;
  const localIds=new Set((fn.localVariables??[]).filter(r=>r.type==='Variable'&&(r.library??'Map')==='Map').map(r=>r.id)),guiLoops=[],seen=new Set();let shared=false;
  function visit(list,container,depth){for(let index=0;index<list.length;index++){const call=get(list[index]);if(!call||call.type!=='FunctionCall')continue;const k=key(ref(call));if(seen.has(k)){shared=true;continue;}seen.add(k);if(call.functionDef?.library==='Ntve'&&[wh.id,range.id].includes(call.functionDef.id))guiLoops.push({call,container,list,index,depth});if(call.subFunctions?.length)visit(call.subFunctions,call,depth+1);}}
  visit(fn.actions,fn,0);if(shared||guiLoops.length!==sourceLoops.length){result.refused.push({function:emitted,reason:shared?'SHARED_GUI_CALL':'SOURCE_GUI_LOOP_COUNT_MISMATCH'});continue;}
  for(const candidate of possible){const ordinal=sourceLoops.findIndex(x=>x.pos===candidate.start);if(ordinal<0)continue;const sourceLoop=sourceLoops[ordinal],g=guiLoops[ordinal],loop=g.call;if(loop.functionDef.id!==wh.id||g.index===0)continue;
   const originalInit=un(sourceLoop.initializer),originalCond=un(sourceLoop.condition),originalStep=un(sourceLoop.incrementor),originalCounter=un(originalInit?.left)?.name;if(readCanonicalInt32Literal(originalInit?.right)!==0n||readCanonicalInt32Literal(originalStep?.right)!==1n||originalCond?.operatorToken?.kind!==K.LessThanEqualsToken||un(originalCond.right)?.name!==candidate.boundName)continue;
   const reset=get(g.list[g.index-1]),sub=(loop.subFunctions??[]).map(get),conditions=sub.filter(x=>x?.subFunctionType&&key(x.subFunctionType)===key(wh.subFunctionTypes[0])),body=sub.filter(x=>x?.subFunctionType&&key(x.subFunctionType)===key(wh.subFunctionTypes[1]));
   if(loop.disabled||loop.scriptCode!==undefined||loop.parameters?.length||reset?.functionDef?.library!=='Ntve'||reset.functionDef.id!==set.id||conditions.length!==1||body.length<1||sub.length!==conditions.length+body.length)continue;
   const condition=conditions[0],tail=body.at(-1);if(condition.functionDef?.library!=='Ntve'||condition.functionDef.id!==cmp.id||tail.functionDef?.library!=='Ntve'||tail.functionDef.id!==inc.id)continue;
   const a=params(reset,sp),b=params(condition,cp),c=params(tail,ip);if(!a||!b||!c)continue;const plainValue=x=>x.valueType?.type==='int'&&['variable','functionCall','preset','paramRef','valueElement','expressionType','scriptCode','structMember'].every(k=>x[k]===undefined)&&!x.arrayIndexes?.length&&!x.expressionParams?.length;const plainVariable=x=>!!x.variable&&['value','functionCall','preset','paramRef','valueElement','expressionType','scriptCode','structMember'].every(k=>x[k]===undefined)&&!x.arrayIndexes?.length&&!x.expressionParams?.length;if(!plainValue(a[1])||!plainValue(c[2])||![a[0],b[0],b[2],c[0]].every(plainVariable))continue;const counter=a[0].variable&&get(a[0].variable),end=b[2].variable&&get(b[2].variable);
   if(counter?.type!=='Variable'||counter.variableType?.type!=='int'||counter.isArray||counter.arraySizes?.length||counter.disabled||counter.isConstant||!localIds.has(counter.id)||counter.identifier!==originalCounter||a[1].value!=='0'||c[2].value!=='1'||key(b[0].variable??{})!==key(ref(counter))||key(c[0].variable??{})!==key(ref(counter))||!preset(b[1],cp[1],'<=' )||!preset(c[1],ip[1],'+'))continue;
   if(end?.type!=='Variable'||!end.disabled||!end.isConstant||end.variableType?.type!=='int'||withImplicitLibrary('Map',()=>globalVarName('Map',end))!==candidate.boundName)continue;const boundValue=end.initialValue&&get(end.initialValue);if(boundValue?.value!==candidate.boundValue)continue;
   if(!oneOwner(loop,g.container,/^(actions|subFunctions)\.\d+$/u)||!oneOwner(reset,g.container,/^(actions|subFunctions)\.\d+$/u)||!body.every(x=>oneOwner(x,loop,/^subFunctions\.\d+$/u))||!oneOwner(condition,loop,/^subFunctions\.\d+$/u)||!oneOwner(tail,loop,/^subFunctions\.\d+$/u)||![...a,...b,...c].every(x=>oneOwner(x,x===a[0]||x===a[1]?reset:b.includes(x)?condition:tail,/^parameters\.\d+$/u)))continue;
   plans.push({owner:emitted,source:candidate,guiLoop:loop,container:g.container,depth:g.depth,reset,condition,tail,resetParams:a,conditionParams:b,tailParams:c,body:body.slice(0,-1),counter,end});
  }
 }
 plans.sort((a,b)=>b.depth-a.depth);
 const removed=new Set();for(const plan of plans){const list=plan.container.type==='FunctionDef'?plan.container.actions:plan.container.subFunctions,index=list.findIndex(x=>key({library:x.library??'Map',type:x.type,id:x.id})===key(ref(plan.guiLoop)));if(index<1||key({library:list[index-1].library??'Map',type:list[index-1].type,id:list[index-1].id})!==key(ref(plan.reset)))continue;
  const [iterator,start]=plan.resetParams,end=plan.conditionParams[2],step=plan.tailParams[2];iterator.parameterDef=ref(fp[0]);start.parameterDef=ref(fp[1]);end.parameterDef=ref(fp[2]);step.parameterDef=ref(fp[3]);
  // Nested plans have already changed this list: using the body captured during
  // discovery would resurrect their removed reset actions as dangling references.
  const gui=plan.guiLoop,liveSub=(gui.subFunctions??[]).map(get);
  assert(liveSub.every(Boolean));
  const liveConditions=liveSub.filter(x=>x.subFunctionType&&key(x.subFunctionType)===key(wh.subFunctionTypes[0]));
  const liveBody=liveSub.filter(x=>x.subFunctionType&&key(x.subFunctionType)===key(wh.subFunctionTypes[1]));
  assert(liveConditions.length===1&&liveConditions[0]===plan.condition&&liveBody.at(-1)===plan.tail&&liveSub.length===liveConditions.length+liveBody.length);
  const body=liveBody.slice(0,-1);
  gui.functionDef=ref(range);gui.parameters=[ref(iterator),ref(start),ref(end),ref(step)];gui.subFunctions=body.map(x=>{x.subFunctionType=ref(targetRole);return ref(x)});list.splice(index-1,1);
  for(const e of [plan.reset,plan.condition,plan.tail,plan.conditionParams[0],plan.conditionParams[1],plan.tailParams[0],plan.tailParams[1]])removed.add(e);
  result.records.push({function:plan.owner,sourceForStart:plan.source.start,sourceBoundName:plan.source.boundName,sourceBoundValue:plan.source.boundValue,loop:ref(gui),counter:ref(plan.counter),bound:ref(plan.end),removed:[plan.reset,plan.condition,plan.tail,plan.conditionParams[0],plan.conditionParams[1],plan.tailParams[0],plan.tailParams[1]].map(ref),reusedParams:[iterator,start,end,step].map(ref),bodyActions:body.map(ref)});
 }
 for(const e of removed){const ix=elements.indexOf(e);assert(ix>=0);elements.splice(ix,1);by.delete(key(ref(e)));}
 // Refuse the entire preview if any retained element or root still points to a
 // removed node. Check the complete reference graph, not just loop children.
 const removedKeys=new Set([...removed].map(e=>key(ref(e))));
 function assertNoRemovedReference(value,ownerLibrary='Map'){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const x of value)assertNoRemovedReference(x,ownerLibrary);return;}
  if(value.type&&value.id){assert(!removedKeys.has(key({library:value.library??ownerLibrary,type:value.type,id:value.id})),'REMOVED_GUI_ELEMENT_STILL_REFERENCED');return;}
  for(const [name,child] of Object.entries(value))if(!['parent','xmlSource','rawXml'].includes(name))assertNoRemovedReference(child,ownerLibrary);
 }
 for(const e of elements)for(const [name,value] of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(name))assertNoRemovedReference(value,e.library??'Map');
 assertNoRemovedReference(map.items);
 return{...result,sourceProof:discovered,guiLibrary:{...map,elements:Object.fromEntries(elements.map(x=>[x.id,x]))},previewOnly:true,nativeExportAndCompleteProofRequired:true};
}
