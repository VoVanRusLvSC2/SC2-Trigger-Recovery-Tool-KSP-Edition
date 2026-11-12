/** Поля импортированной Galaxy-структуры остаются точным Custom Script выражением.
 * Здесь нет новой GUI-структуры, фиктивной библиотеки и угадывания типа поля.
 * Контракт берётся только из разобранных файлов текущей conversion operation.
 */
// @ts-nocheck
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/1460ea54e793-6264c2524955-eae6ab3d18153439-g2t-core.mjs';
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/d9d6ed13d377-4f9a4831ec5a-86eefed28afd5e24-script-template.mjs';
const contracts=new WeakMap(),scalars=new Set(['int','fixed','bool','string','text']);
export function attachExternalStructureFields(structures,sources){
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
