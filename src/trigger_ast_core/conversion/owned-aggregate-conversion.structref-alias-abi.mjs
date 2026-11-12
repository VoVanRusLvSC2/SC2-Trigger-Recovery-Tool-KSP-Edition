import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {partitionDeclarationViews,logicalSourcePath} from '../model/source-ownership.mjs';
import {resolveGuiRecoveryPolicy} from '../model/gui-recovery-policy.source-includes.mjs';
import {planOwnedAggregateMigration} from '../model/owned-aggregate-migration.structref-alias-abi.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const key=name=>logicalSourcePath(name).replace(/\.galaxy$/u,'');

/** Scope the ownership projection to one call. The strict converter and oracle
 * keep their normal gates; a plan never authorizes a raw/native definition. */
export function createOwnedAggregateConversion(engine) {
  assert.equal(typeof engine.convertGalaxyToTriggers,'function');
  return Object.freeze({
    async convertGalaxyToTriggers(input,signal) {
      const policy=resolveGuiRecoveryPolicy(input);
      if(!policy.preserveAuthoredCode||!input.additionalScripts?.length||input.existingTriggerData?.trim())
        return engine.convertGalaxyToTriggers(input,signal);
      signal?.throwIfAborted();
      const primaryFiles=[{fileName:'MapScript.galaxy',text:input.script??''},
        {fileName:'MapScript_h.galaxy',text:input.header??''}].map(f=>({...f,sha256:sha(f.text)}));
      const ownedFiles=input.additionalScripts.map(f=>({...f,sha256:sha(f.text)}));
      for(const [i,f]of ownedFiles.entries())assert(input.additionalScripts[i].sha256===undefined||f.sha256===input.additionalScripts[i].sha256,'AGGREGATE_INPUT_SHA');
      const views=partitionDeclarationViews(ownedFiles,input.galaxyDeclarations??[]);
      assert.equal(views.conflicts.length,0,'AGGREGATE_DECLARATION_CONFLICT');
      const materials=[...primaryFiles,...ownedFiles].map((f,i)=>({...f,contentSha256:f.sha256,sourceId:'aggregate-owned:'+i,owned:true}));
      const external=views.external.map((f,i)=>({...f,contentSha256:sha(f.text),sourceId:'aggregate-declaration:'+i,owned:false}));
      const files=[...materials,...external],program=new GalaxyProgramContext(files,{files,dependencies:[]},sha);
      let plan;
      try{plan=planOwnedAggregateMigration({program,primaryFiles,ownedFiles});}finally{program.dispose();}
      input.onAggregateMigrationProof?.(plan.proof);
      if(!plan.inputChanged)return engine.convertGalaxyToTriggers(input,signal);
      const selected=new Set(plan.selectedFiles.flatMap(f=>[f.fileName,f.originalPath].filter(Boolean).map(key)));
      for(const file of input.customAiScripts??[])if(selected.has(key(file.originalPath??file.fileName))) {
        const matches=plan.selectedFiles.filter(owner=>[owner.fileName,owner.originalPath].filter(Boolean).map(key).includes(key(file.originalPath??file.fileName)));
        assert.equal(matches.length,1,'AGGREGATE_AI_OWNER_AMBIGUOUS');
        assert.equal(file.text,matches[0].text,'AGGREGATE_AI_REVISION_CONFLICT');
      }
      const prepared={...input,script:plan.primaryFiles[0].text,header:plan.primaryFiles[1].text,
        additionalScripts:plan.ownedFiles,galaxyDeclarations:views.external,
        primaryGalaxyIncludeFiles:input.primaryGalaxyIncludeFiles?.filter(name=>!selected.has(key(name))),
        customAiScripts:input.customAiScripts?.filter(f=>!selected.has(key(f.originalPath??f.fileName)))};
      // A caller's AST and checkpoint describe the unprojected revision. They
      // must not be reused against a different source span/name universe.
      delete prepared.sourceSyntax;
      try {
        const result=await engine.convertGalaxyToTriggers(prepared,signal);
        return {...result,aggregateMigration:plan.proof};
      } catch(error) {
        error.aggregateMigration=plan.proof;
        if(error.context&&typeof error.context==='object')error.context={...error.context,aggregateMigration:plan.proof};
        throw error;
      }
    },
    convertTriggersToGalaxy:engine.convertTriggersToGalaxy,
  });
}
