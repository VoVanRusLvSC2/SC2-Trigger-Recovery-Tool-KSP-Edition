import {attachLocalSourceStructureMetadata as stage} from './local-source-structure-metadata.mjs';
import {localVarName,memberVarName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';

/** A NoScriptPrefix field is not consistently honoured by every forward path.
 * Stage metadata atomically and admit only exact ordinary Editor member names.
 * Other source spellings need an inline member interface, never silent renaming. */
export function attachLocalSourceStructureMetadata(options){
 const elements={...options.elements},structuresByName=new Map(options.structuresByName),membersByKey=new Map(options.membersByKey);
 const result=stage({...options,elements,structuresByName,membersByKey}),records=[],refused=[...result.refused];
 for(const record of result.records){
  const fields=record.fields.map(f=>elements[f.reference.id]);
  const incompatible=fields.filter(v=>{
   const plain={...v,flags:undefined};return localVarName(plain)!==v.identifier||memberVarName(plain,options.libraryId)!==v.identifier||
    !['bool','int','fixed','string','text'].includes(v.variableType?.type);
  });
  if(incompatible.length){refused.push({source:record.source,symbol:record.symbol,uses:record.uses,
   reason:'LOCAL_SOURCE_FIELDS_REQUIRE_SEPARATE_INLINE_INTERFACES',fields:incompatible.map(v=>({name:v.identifier,type:v.variableType}))});continue;}
  const structure=elements[record.structure.id];options.elements[structure.id]=structure;options.structuresByName.set(record.symbol,record.structure);
  for(const v of fields){delete v.flags;options.elements[v.id]=v;
   const r={library:options.libraryId,type:'Variable',id:v.id};options.membersByKey.set(options.memberKey(structure.id,v.identifier,options.libraryId),r);
   options.membersByKey.set(options.memberKey(structure.id,v.identifier),r);
  }
  records.push({...record,memberNaming:'ORDINARY_EDITOR_MEMBER_NAMES',noScriptPrefixFieldAssumed:false});
 }
 return {...result,records,refused};
}
