import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareOwnedGuiExpressionProjection} from './owned-gui-expression-projection.mjs';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {lowerLiteralInitializerPhaseSuffix} from '../lowering/literal-initializer-phase-suffix.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');

// The caller supplies its existing initializer-prefix recognizer. This stage
// adds no folded language or raw exception, and keeps every original source
// function. The independent archive benchmark still compares against originals.
export function prepareOwnedGuiSourcePhases(plan,options){
 const projected=prepareOwnedGuiExpressionProjection(plan,options);
 assert(typeof options.isFoldableInitializationPrefix==='function','SOURCE_PHASE_PREFIX_RECOGNIZER_REQUIRED');
 const own=[...projected.primaryFiles,...plan.ownedFiles],external=options.declarations??[],
  files=[...own.map((f,i)=>({...f,sourceId:'gui-source:'+i,contentSha256:sha(f.text),owned:true})),
   ...external.map((f,i)=>({...f,sourceId:'gui-declaration:'+i,contentSha256:sha(f.text),owned:false}))];
 const program=new GalaxyProgramContext(files,{files,dependencies:[]},sha,{checks:'binding'});
 try{
  for(const ast of program.documents.values())program.attachOriginal(ast);
  const nodes=own.flatMap(f=>program.documents.get(f.fileName).statements);
  const suffix=lowerLiteralInitializerPhaseSuffix({program,fileName:projected.primaryFiles[0].fileName,
   foldPrefix:(fn,statements)=>options.isFoldableInitializationPrefix(nodes,fn,statements)});
  const primaryFiles=projected.primaryFiles.map((f,i)=>i===0?{...f,text:suffix.text}:f);
  return {primaryFiles,proof:{...projected.proof,initializerSuffix:suffix.proof,
   runtimeNamedDispatchQualification:'NOT_RUN',wholeProgramEquivalent:false,wholeMapAccepted:false}};
 }finally{program.dispose();}
}
