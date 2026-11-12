import {attachLocalSourceStructureMetadata as stage} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/289e5ce4ae81-0511499daa0b-local-source-structure-metadata.mjs';

/** Editor members store a stem and emit lv_<stem>. Keep the complete source
 * name in binding keys, and strip exactly one prefix in GUI metadata. Plain
 * authored fields require a separate inline interface; NoScriptPrefix is not
 * authority to change this naming contract. */
export function attachLocalSourceStructureMetadata(options){
 const elements={...options.elements},structuresByName=new Map(options.structuresByName),membersByKey=new Map(options.membersByKey);
 const result=stage({...options,elements,structuresByName,membersByKey}),records=[],refused=[...result.refused];
 for(const record of result.records){
  const fields=record.fields.map(f=>elements[f.reference.id]);
  const incompatible=fields.filter(v=>!/^lv_[A-Za-z_]\w*$/u.test(v.identifier)||!['bool','int','fixed','string','text'].includes(v.variableType?.type));
  if(incompatible.length){refused.push({source:record.source,symbol:record.symbol,uses:record.uses,
   reason:'LOCAL_SOURCE_FIELDS_REQUIRE_SEPARATE_INLINE_INTERFACES',fields:incompatible.map(v=>({name:v.identifier,type:v.variableType}))});continue;}
  const structure=elements[record.structure.id];options.elements[structure.id]=structure;options.structuresByName.set(record.symbol,record.structure);
  const bindings=[];
  for(const v of fields){const sourceName=v.identifier,stem=sourceName.slice(3);v.name=stem;v.identifier=stem;delete v.flags;options.elements[v.id]=v;
   const r={library:options.libraryId,type:'Variable',id:v.id};options.membersByKey.set(options.memberKey(structure.id,sourceName,options.libraryId),r);
   options.membersByKey.set(options.memberKey(structure.id,sourceName),r);bindings.push({sourceName,identifier:stem,variable:r});
  }
  records.push({...record,memberNaming:'EXACTLY_ONE_EDITOR_MEMBER_PREFIX',bindings,noScriptPrefixFieldAssumed:false});
 }
 return {...result,records,refused};
}
