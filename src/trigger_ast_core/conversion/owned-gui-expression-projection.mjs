import assert from 'node:assert/strict';
import {createGuiExpressionPreparation} from './gui-expression-preparation.mjs';
import {createGalaxyDocument} from '../model/galaxy-document.collections.mjs';

/** Ownership expansion happens after the worker's root passes. Run that same
 * qualified preparation on the expanded GUI input, so newly owned expressions
 * do not bypass it. Retained sources and reference archives remain unchanged. */
export function prepareOwnedGuiExpressionProjection(plan,{implementations,declarations=[]}){
 assert(plan.inputChanged&&plan.proof.allSelectedEmittedOnce&&plan.proof.originalIncludeOrderPreserved,'OWNED_GUI_COMPLETE_PROJECTION_REQUIRED');
 const prepare=createGuiExpressionPreparation(implementations),records=[];
 const context=[...declarations,...plan.ownedFiles];
 const primaryFiles=plan.primaryFiles.map(file=>{
  const document=createGalaxyDocument({fileName:file.fileName,text:file.text,role:'expanded-gui-root'});
  try{
   const result=prepare(file.text,{document,declarations:context.filter(d=>d.fileName!==file.fileName)});
   records.push({fileName:file.fileName,proof:result.proof,stages:result.stages,syntax:document.evidence()});
   return {...file,text:result.text};
  }finally{document.dispose();}
 });
 return {primaryFiles,proof:{kind:'QUALIFIED_GUI_PREPARATION_AFTER_OWNERSHIP_EXPANSION',records,
  retainedSourceFilesUnchanged:true,originalArchivesChanged:false,newNative:0,newRuntimeFunctions:0,
  persistentCache:false,wholeProgramEquivalent:false,wholeMapAccepted:false}};
}
