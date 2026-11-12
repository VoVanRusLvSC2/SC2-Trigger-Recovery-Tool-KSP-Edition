/** Поля импортированной Galaxy-структуры остаются точным Custom Script выражением.
 * Здесь нет новой GUI-структуры, фиктивной библиотеки и угадывания типа поля.
 * Контракт берётся только из разобранных файлов текущей conversion operation.
 */
// @ts-nocheck
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
const rawStorageContracts=new WeakMap();
const contracts=new WeakMap(),scalars=new Set(['int','fixed','bool','string','text']);
export function attachExternalStructureFields(structures,sources){
 const rawVariables=new Map(),rawStructures=new Map(),ambiguousVariables=new Set(),ambiguousStructures=new Set();
 // A raw contract is admissible only if EVERY provided AST parsed, and every
 // repeated declaration agrees. Neither labels nor a JSON catalog infer IDs.
 if(!sources.some(s=>s.parseDiagnostics?.length))for(const source of sources)for(const n of source.statements){
  if(n.kind===140&&n.name?.name){
   const name=n.name.name;if(ambiguousStructures.has(name))continue;
   const signature=printNode(n),prior=rawStructures.get(name);
   if(prior&&prior.signature!==signature){rawStructures.delete(name);ambiguousStructures.add(name);continue;}
   if(prior)continue;
   const members=new Map(),duplicates=new Set();for(const m of n.members??[]){const key=m.name?.name;if(!key)continue;
    if(members.has(key)){members.delete(key);duplicates.add(key);continue;}if(duplicates.has(key))continue;
    const {baseType,sizes}=unwrapArrayType(m.type);members.set(key,{type:getTypeName(baseType),rank:sizes.length});
   }rawStructures.set(name,{signature,members});
  }
  if(n.kind===141&&n.name?.name){
   const name=n.name.name;if(ambiguousVariables.has(name))continue;
   const {baseType,sizes}=unwrapArrayType(n.type),contract={type:getTypeName(baseType),rank:sizes.length,sourceFile:source.fileName},prior=rawVariables.get(name);
   if(prior&&(prior.type!==contract.type||prior.rank!==contract.rank)){rawVariables.delete(name);ambiguousVariables.add(name);}else if(!prior)rawVariables.set(name,contract);
  }
 }
 rawStorageContracts.set(structures,{variables:rawVariables,structures:rawStructures});
 const definitions=new Map(),ambiguous=new Set();let count=0;
 if(sources.some(s=>s.parseDiagnostics?.length)){contracts.set(structures,definitions);return;}
 for(const source of sources){
  if(source.parseDiagnostics?.length)continue;
  for(const n of source.statements){
   if(n.kind!==140||!n.name?.name||structures.has(n.name.name)||ambiguous.has(n.name.name))continue;
   if(++count>4096)throw Error('External structure declaration bound exceeded');
   const signature=printNode(n),prior=definitions.get(n.name.name);
   if(prior&&prior.signature!==signature){definitions.delete(n.name.name);ambiguous.add(n.name.name);continue;}
   if(prior)continue;
   const members=new Map(),duplicates=new Set();
   for(const m of n.members??[]){const name=m.name?.name;if(!name)continue;if(members.has(name)){members.delete(name);duplicates.add(name);continue;}if(duplicates.has(name))continue;
    const {baseType,sizes}=unwrapArrayType(m.type),type=getTypeName(baseType);members.set(name,/^[A-Za-z_][A-Za-z0-9_]*$/u.test(type)?{type:{type},rank:sizes.length}:undefined);
   }
   definitions.set(n.name.name,{signature,members,file:source.fileName});
  }
 }
 contracts.set(structures,definitions);
}
export function externalStructureMemberType(structures,ownerType,name){
 if(!ownerType||ownerType.typeElement||structures.has(ownerType.type))return;
 const declared=contracts.get(structures)?.get(ownerType.type),member=declared?.members.get(name);
 return member?.rank===0&&scalars.has(member.type.type)?{...member.type}:undefined;
}

/** Resolve the entire lvalue path before creating native Params. An imported
 * array/record intermediate is not itself emitted with a guessed scalar type.
 */
export function externalPropertyPathType(node,ctx,lookup,ownMember){
 const structures=ctx.structureByGalaxyTypeName,defs=contracts.get(structures);
 if(!defs)return;
 const declared=definition=>{
  if(!definition)return;
  const type=definition.variableType??definition.paramType;
  const rank=definition.isArray?(definition.arraySizes?.length||undefined):0;
  return type&&rank!==undefined?{type,rank,foreign:false}:undefined;
 };
 const visit=n=>{
  while(n?.kind===126)n=n.expression;
  if(!n)return;
  if(n.kind===113){
   const local=ctx.localVarByGalaxyName.get(n.name),global=ctx.globalVarByGalaxyName.get(n.name),param=ctx.paramRefByGalaxyName?.get(n.name);
   const ref=local?{type:'Variable',id:local,library:ctx.libId}:global?{type:'Variable',...global}:param;
   const result=ref?declared(lookup(ref)):undefined;
   return result?{...result,rootName:n.name,rootRef:ref}:undefined;
  }
  if(n.kind===119){const base=visit(n.expression);return base&&base.rank>0?{...base,rank:base.rank-1}:undefined;}
  if(n.kind!==120)return;
  const base=visit(n.expression);if(!base||base.rank)return;
  if(base.type.typeElement){
   const ref=ownMember(base.type,n.name.name),member=ref?declared(lookup(ref)):undefined;
   return member?{...member,foreign:base.foreign,rootName:base.rootName,rootRef:base.rootRef}:undefined;
  }
  if(structures.has(base.type.type))return;
  const member=defs.get(base.type.type)?.members.get(n.name.name);
  return member?{type:{...member.type},rank:member.rank,foreign:true,rootName:base.rootName,rootRef:base.rootRef}:undefined;
 };
 const result=visit(node);
 if(!result?.foreign||result.rank!==0||!scalars.has(result.type.type))return;
 // An embedded expression references the original storage identifier. Retain it
 // on the own Variable, using the editor's existing explicit Identifier contract.
 const ref=result.rootRef,definition=ref&&lookup(ref);
 if(definition?.type==='Variable'&&(ref.library??ctx.libId)===ctx.libId){
  const prefix=ctx.globalVarByGalaxyName.has(result.rootName)?(ctx.libId==='Map'?'gv_':`lib${ctx.libId}_gv_`):'lv_';
  if(result.rootName.startsWith(prefix)){
   const stem=result.rootName.slice(prefix.length);
   if(definition.name===stem&&(!definition.identifier||definition.identifier===stem))definition.identifier=stem;
  }
 }
 return {...result.type};
}

/** Read only a parsed, non-ambiguous imported structure contract of this operation. */
export function externalStructureDeclaration(structures,name){
 if(!structures||structures.has(name))return;
 const def=contracts.get(structures)?.get(name);
 return def?{signature:def.signature,file:def.file}:undefined;
}

/** Foreign GUI metadata can omit a field that its ACTUAL header declares.
 * Resolve only a mounted foreign GLOBAL storage root, then every property and
 * array rank from unambiguous parsed raw declarations. Keep the complete path
 * as Custom Script; never invent a Structure/Variable ID for the missing field.
 */
export function importedRawPropertyPathType(node,ctx,lookup,ownMember){
 const raw=rawStorageContracts.get(ctx.structureByGalaxyTypeName);if(!raw)return;
 let cursor=node;while(cursor?.kind===126)cursor=cursor.expression;
 let root=cursor;while(root&&[119,120,126].includes(root.kind))root=root.expression;
 if(root?.kind!==113||ctx.localVarByGalaxyName.has(root.name)||ctx.paramRefByGalaxyName?.has(root.name))return;
 const binding=ctx.globalVarByGalaxyName.get(root.name);if(!binding||(binding.library??ctx.libId)===ctx.libId)return;
 // Existing resolved GUI member references take priority over the fallback.
 if(lookup&&ownMember){
  const declared=d=>{const type=d?.variableType??d?.paramType,rank=d?.isArray?(d.arraySizes?.length||undefined):0;return type&&rank!==undefined?{type,rank}:undefined;};
  const metadata=n=>{while(n?.kind===126)n=n.expression;if(!n)return;
   if(n.kind===113)return n.name===root.name?declared(lookup({type:'Variable',...binding})):undefined;
   if(n.kind===119){const base=metadata(n.expression);return base&&base.rank>0?{...base,rank:base.rank-1}:undefined;}
   if(n.kind!==120)return;const base=metadata(n.expression);if(!base||base.rank!==0)return;
   const member=ownMember(base.type,n.name.name);return member?declared(lookup(member)):undefined;
  };
  if(metadata(cursor))return;
 }
 const visit=n=>{
  while(n?.kind===126)n=n.expression;if(!n)return;
  if(n.kind===113)return n.name===root.name?raw.variables.get(n.name):undefined;
  if(n.kind===119){const base=visit(n.expression);return base&&base.rank>0?{...base,rank:base.rank-1}:undefined;}
  if(n.kind!==120)return;const base=visit(n.expression);if(!base||base.rank!==0)return;
  return raw.structures.get(base.type)?.members.get(n.name.name);
 };
 const leaf=visit(cursor);return leaf&&leaf.rank===0&&scalars.has(leaf.type)?{type:leaf.type}:undefined;
}

/** Preserve an external trigger ABI whose XML omits the selectable Trigger.
 * A real scalar trigger declaration in the exact Lib<owner>[_h].galaxy file
 * proves the symbol. No raw spelling alone creates a new global declaration.
 */
export function declaredRawForeignTriggerHandle(name,ctx){
 if(ctx.localVarByGalaxyName.has(name)||ctx.paramRefByGalaxyName?.has(name)||ctx.globalVarByGalaxyName.has(name)||ctx.triggerByGalaxyName?.has(name))return false;
 const m=/^lib([A-Za-z0-9]+)_gt_[A-Za-z0-9_]+$/u.exec(name);if(!m||m[1]===ctx.libId)return false;
 const declaration=rawStorageContracts.get(ctx.structureByGalaxyTypeName)?.variables.get(name);
 if(!declaration||declaration.type!=='trigger'||declaration.rank!==0)return false;
 const file=String(declaration.sourceFile??'').replaceAll('\\','/').split('/').at(-1).toLowerCase();
 return file==='lib'+m[1].toLowerCase()+'_h.galaxy'||file==='lib'+m[1].toLowerCase()+'.galaxy';
}
