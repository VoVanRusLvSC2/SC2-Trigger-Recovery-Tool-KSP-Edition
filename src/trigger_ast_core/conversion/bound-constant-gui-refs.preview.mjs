// Experimental GUI preview for a source-owned immutable int used by a stock
// comparison inside a reconstructed while. The source for must belong to a
// function without authored while/do loops. Native export and full proof remain
// mandatory; no source, archive, loop or stock metadata is changed here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {discoverBoundConstantForCandidates} from '../model/bound-constant-for-candidates.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {toGalaxyFunctionName,globalVarName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const sha=x=>createHash('sha256').update(x).digest('hex'),key=r=>JSON.stringify([r.library??'Map',r.type,r.id]),ref=e=>({library:e.library??'Map',type:e.type,id:e.id});
const walk=(n,visit)=>{visit(n);forEachChild(n,c=>walk(c,visit));};
export function previewBoundConstantGuiRefs({source,closedContext,guiXml,nativeXml,existingTriggerData=false}){
 const outcome={kind:'BOUND_CONSTANT_GUI_REFERENCE_PREVIEW',sourceSha256:sha(source),guiSha256:sha(guiXml),nativeGuiSha256:sha(nativeXml),records:[],refused:[],sourceChanged:false,newNative:0,newRuntimeFunctions:0,newCustomScript:0,guiUsabilityNotProved:true,wholeMapAccepted:false};
 if(existingTriggerData)return{...outcome,reason:'PRESERVE_EXISTING_GUI_STRUCTURE'};
 const sourceProof=discoverBoundConstantForCandidates(source,closedContext);if(!sourceProof.completeReachableClosure)return{...outcome,reason:sourceProof.reason};
 const libs=readOwnedGuiLibraries(guiXml,'Map'),native=readOwnedGuiLibraries(nativeXml,'Ntve').get('Ntve'),map=libs.get('Map');
 if(!map||!native||libs.size!==1)return{...outcome,reason:'GUI_LIBRARY_SCOPE_UNSUPPORTED'};
 const elements=Object.values(map.elements),by=new Map(elements.map(e=>[key(ref(e)),e]));
 if(new Set(elements.map(e=>e.id)).size!==elements.length)return{...outcome,reason:'GUI_CROSS_TYPE_ID_COLLISION'};
 const sdkIndex=new Map(Object.values(native.elements).map(e=>[JSON.stringify([e.type,e.id]),e]));const sdk=(type,id)=>sdkIndex.get(JSON.stringify([type,id])),definition=name=>{const rows=Object.values(native.elements).filter(e=>e.type==='FunctionDef'&&e.identifier===name&&!e.disabled);return rows.length===1?rows[0]:undefined;};
 const whileDef=definition('While'),forDef=definition('ForEachInteger'),cmp=definition('Comparison');
 if(!whileDef?.flags?.includes('SubFunctions')||!forDef?.flags?.includes('SubFunctions')||!cmp?.flags?.includes('Condition')||!cmp.flags.includes('Operator')||cmp.parameters?.length!==3||whileDef.subFunctionTypes?.length!==2)return{...outcome,reason:'STOCK_GUI_DEFINITIONS_UNQUALIFIED'};
 const conditionRole=whileDef.subFunctionTypes[0],rhsDef=sdk('ParamDef',cmp.parameters[2].id),lhsDef=sdk('ParamDef',cmp.parameters[0].id),opDef=sdk('ParamDef',cmp.parameters[1].id);
 if(rhsDef?.paramType?.type!=='sameas'||key(rhsDef.paramType.typeElement)!==key(cmp.parameters[0])||lhsDef?.paramType?.type!=='anycompare'||opDef?.paramType?.type!=='preset')return{...outcome,reason:'STOCK_COMPARISON_FORMALS_UNQUALIFIED'};
 const ast=new Parser().parseFile('original',source);assert.equal(ast.parseDiagnostics.length,0);const bySource=new Map();for(const f of ast.statements)if(f.kind===K.FunctionDeclaration&&f.body){const rows=bySource.get(f.name.name)??[];rows.push(f);bySource.set(f.name.name,rows);}
 const candidates=new Map();for(const c of sourceProof.candidates){const rows=candidates.get(c.owner)??[];rows.push(c);candidates.set(c.owner,rows);}
 const variableCategories=map.items.filter(x=>x.type==='Category'&&x.identifier==='Variables');if(variableCategories.length!==1)return{...outcome,reason:'GUI_VARIABLE_CATEGORY_AMBIGUOUS'};const category=variableCategories[0];
 const ids=new Set(elements.map(e=>e.id)),alloc=(seed)=>{for(let i=0;i<10000;i++){const id=sha(seed+':'+i).slice(0,8).toUpperCase();if(!ids.has(id)){ids.add(id);return id;}}throw Error('GUI_ID_EXHAUSTED');};
 const incoming=new Map();for(const e of elements){function visit(v,parts){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach((x,i)=>visit(x,[...parts,String(i)]));return;}if(v.type&&v.id){const k=key({library:v.library??e.library??'Map',type:v.type,id:v.id}),rows=incoming.get(k)??[];rows.push({owner:e,path:parts.join('.')});incoming.set(k,rows);return;}for(const[k,x]of Object.entries(v))if(!['parent','xmlSource','rawXml'].includes(k))visit(x,[...parts,k]);}for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))visit(v,[k]);}
 const oneOwner=(target,owner,path)=>{const rows=incoming.get(key(ref(target)))??[];return rows.length===1&&rows[0].owner===owner&&path.test(rows[0].path);};
 const occupied=new Set(elements.filter(e=>e.type==='Variable').map(e=>withImplicitLibrary('Map',()=>globalVarName('Map',e))));
 const mirrors=new Map(),patches=[],get=r=>by.get(key({library:r.library??'Map',type:r.type,id:r.id}));
 function nativeDef(r){return r?.library==='Ntve'&&r.type==='FunctionDef'?sdk('FunctionDef',r.id):undefined;}
 const fnRows=elements.filter(e=>e.type==='FunctionDef'&&e.actions?.length);
 for(const fn of fnRows){
  if(!candidates.has(fn.identifier??fn.name))continue;
  const emitted=withImplicitLibrary('Map',()=>toGalaxyFunctionName(fn,{libId:'Map',library:map,nativeLibrary:native,allLibraries:libs})),sources=bySource.get(emitted)??[],possible=candidates.get(emitted)??[];if(sources.length!==1||!possible.length)continue;
  let sourceFor=0,sourceOther=0;walk(sources[0].body,n=>{if(n.kind===K.ForStatement)sourceFor++;if([K.WhileStatement,K.DoStatement].includes(n.kind))sourceOther++;});if(sourceOther)continue;
  const eligibleNames=new Map(),ambiguous=new Set();for(const c of possible){if(ambiguous.has(c.boundName))continue;const prior=eligibleNames.get(c.boundName);if(prior&&(prior.boundValue!==c.boundValue||JSON.stringify(prior.boundDeclaration)!==JSON.stringify(c.boundDeclaration))){eligibleNames.delete(c.boundName);ambiguous.add(c.boundName);continue;}eligibleNames.set(c.boundName,c);}
  const localIds=new Set((fn.localVariables??[]).filter(r=>r.type==='Variable'&&(r.library??'Map')==='Map').map(r=>r.id));
  const visited=new Set(),guiLoops=[],comparisons=[];
  function visit(r){const call=get(r);if(!call||call.type!=='FunctionCall'||visited.has(key(ref(call))))return;visited.add(key(ref(call)));
   const f=nativeDef(call.functionDef);if(f&&[whileDef.id,forDef.id].includes(f.id))guiLoops.push(call);
   if(f?.id===whileDef.id)for(const x of call.subFunctions??[]){const condition=get(x);if(condition?.functionDef?.library==='Ntve'&&condition.functionDef.id===cmp.id&&key(condition.subFunctionType??{})===key(conditionRole)&&oneOwner(condition,call,/^subFunctions\.\d+$/u))comparisons.push(condition);}
   for(const x of call.subFunctions??[])visit(x);
  }
  for(const r of fn.actions)visit(r);if(guiLoops.length!==sourceFor){outcome.refused.push({function:emitted,reason:'SOURCE_AND_GUI_LOOP_COUNT_MISMATCH',sourceFor,guiLoops:guiLoops.length});continue;}
  for(const c of comparisons){
   if((c.parameters??[]).length!==3)continue;const params=c.parameters.map(get),find=def=>params.filter(p=>p?.parameterDef&&key(p.parameterDef)===key(def));const first=find(cmp.parameters[0]),second=find(cmp.parameters[1]),third=find(cmp.parameters[2]);if(first.length!==1||second.length!==1||third.length!==1)continue;
   const left=first[0],op=second[0],right=third[0],counter=left.variable&&get(left.variable);
   if(counter?.type!=='Variable'||counter.variableType?.type!=='int'||counter.isArray||counter.arraySizes?.length||counter.isConstant||counter.disabled||!localIds.has(counter.id)||op.preset?.library!=='Ntve')continue;
   const opValue=sdk('PresetValue',op.preset.id),opPreset=sdk('Preset',opDef.paramType.typeElement.id);if(!opValue||!opPreset||(opPreset.values??[]).every(x=>key(x)!==key(op.preset)))continue;
   if(!right.functionCall||['variable','scriptCode','value','preset','paramRef','valueElement','expressionType','structMember'].some(k=>right[k]!==undefined)||right.expressionParams?.length||right.valueParams?.length||right.arrayIndexes?.length||!oneOwner(right,c,/^parameters\.\d+$/u))continue;const call=get(right.functionCall),getter=call?.functionDef&&get(call.functionDef);if(!call||!oneOwner(call,right,/^functionCall$/u))continue;
   if(call?.type!=='FunctionCall'||call.parameters?.length||call.subFunctions?.length||getter?.type!=='FunctionDef'||getter.disabled||getter.returnType?.type!=='int'||getter.parameters?.length||getter.actions?.length||getter.conditions?.length||getter.events?.length||!['Call','Operator','NoScriptPrefix'].every(f=>getter.flags?.includes(f))||getter.flags.some(f=>!['Call','Operator','NoScriptPrefix'].includes(f))||typeof getter.scriptCode!=='string')continue;
   const sourceName=getter.scriptCode.trim(),candidate=eligibleNames.get(sourceName);if(!candidate||occupied.has(sourceName)||!/^gv_[A-Za-z_]\w*$/u.test(sourceName))continue;
   patches.push({function:emitted,param:right,oldCall:call,oldGetter:getter,source:candidate,comparison:c,counter});
  }
 }
 for(const row of patches){
  let mirror=mirrors.get(row.source.boundName);if(!mirror){const identifier=row.source.boundName.slice(3),valueId=alloc('const-value:'+row.source.boundName),variableId=alloc('const-variable:'+row.source.boundName),value={library:'Map',type:'Param',id:valueId,valueType:{type:'int'},value:row.source.boundValue},variable={library:'Map',type:'Variable',id:variableId,name:identifier,identifier,variableType:{type:'int'},disabled:true,isConstant:true,initialValue:ref(value)};
   assert.equal(withImplicitLibrary('Map',()=>globalVarName('Map',variable)),row.source.boundName,'GUI_CONSTANT_NAME_NOT_EXACT');for(const e of [value,variable]){elements.push(e);by.set(key(ref(e)),e);}category.items.push(ref(variable));mirror={value,variable};mirrors.set(row.source.boundName,mirror);}
  delete row.param.functionCall;row.param.variable=ref(mirror.variable);
  outcome.records.push({function:row.function,param:ref(row.param),comparison:ref(row.comparison),counter:ref(row.counter),sourceDeclaration:row.source.boundDeclaration,sourceName:row.source.boundName,sourceValue:row.source.boundValue,previousCall:ref(row.oldCall),previousGetter:ref(row.oldGetter),mirror:ref(mirror.variable)});
 }
 // Delete only now-unreferenced generated getter calls and definitions. Category
 // references are organizational and removed only once no runtime reference remains.
 function referenced(target,ignoreCategories=false){let found=false;for(const e of elements){if(ignoreCategories&&e.type==='Category')continue;function scan(v){if(found||!v||typeof v!=='object')return;if(Array.isArray(v)){for(const x of v)scan(x);return}if(v.type&&v.id&&key({library:v.library??e.library??'Map',type:v.type,id:v.id})===target){found=true;return}for(const[k,x]of Object.entries(v))if(!['parent','xmlSource','rawXml'].includes(k))scan(x);}for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))scan(v);}return found;}
 const removed=[];for(const c of new Set(patches.map(x=>x.oldCall)))if(!referenced(key(ref(c)))){elements.splice(elements.indexOf(c),1);by.delete(key(ref(c)));removed.push(ref(c));}
 for(const f of new Set(patches.map(x=>x.oldGetter)))if(!referenced(key(ref(f)),true)){for(const cat of elements.filter(e=>e.type==='Category'&&e.items))cat.items=cat.items.filter(r=>key({library:r.library??cat.library??'Map',type:r.type,id:r.id})!==key(ref(f)));const ix=map.items.findIndex(x=>key(ref(x))===key(ref(f)));if(ix>=0)map.items.splice(ix,1);elements.splice(elements.indexOf(f),1);by.delete(key(ref(f)));removed.push(ref(f));}
 return{...outcome,sourceProof,guiLibrary:{...map,elements:Object.fromEntries(elements.map(e=>[e.id,e]))},mirrors:[...mirrors.values()].map(x=>({variable:ref(x.variable),identifier:x.variable.identifier,value:ref(x.value)})),removed,previewOnly:true,editorAndCompleteProofRequired:true};
}
