import {verifyLocalSourceStructureAbi} from "./local-source-structure-abi.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveGuiRecoveryPolicy} from "../../model/gui-recovery-policy.source-includes.mjs";
import {logicalSourcePath} from "../../model/source-ownership.mjs";

const sha=text=>createHash('sha256').update(text).digest('hex');
const identity=file=>logicalSourcePath(file.originalPath??file.fileName);
function sourceInventory(files){
 const result=new Map();
 for(const file of files){
  assert(typeof file.text==='string','SOURCE_RETENTION_TEXT_REQUIRED');
  const key=identity(file),digest=sha(file.text);
  assert(file.sha256===undefined||file.sha256===digest,'SOURCE_RETENTION_INPUT_SHA');
  assert(!result.has(key),'SOURCE_RETENTION_DUPLICATE_OWNER');
  result.set(key,digest);
 }
 return result;
}

/** A representation boundary, not an equivalence permission. Additional source
 * units reach the existing engine unchanged; nominal/ref ABI failures cannot
 * silently promote those units into the GUI root. Full-GUI remains explicit. */
export function createSourcePreservingConversion(engine){
 assert.equal(typeof engine.convertGalaxyToTriggers,'function');
 return Object.freeze({
  async convertGalaxyToTriggers(input,signal){
   const policy=resolveGuiRecoveryPolicy(input);
   if(!policy.preserveAuthoredCode||!input.additionalScripts?.length)
    return engine.convertGalaxyToTriggers(input,signal);
   signal?.throwIfAborted();
   const original=sourceInventory(input.additionalScripts);
   const result=await engine.convertGalaxyToTriggers(input,signal);
   const unchanged=sourceInventory(input.additionalScripts);
   assert.deepEqual(unchanged,original,'SOURCE_RETENTION_INPUT_MUTATED');
   const retained=result.guiRecovery?.preservedGalaxyScripts;
   assert(Array.isArray(retained),'SOURCE_RETENTION_EVIDENCE_MISSING');
   const actual=new Map();
   for(const file of retained){
    const key=identity(file);assert(!actual.has(key),'SOURCE_RETENTION_DUPLICATE_OUTPUT');
    actual.set(key,file.sha256);
   }
   for(const [fileName,digest]of original)
    assert.equal(actual.get(fileName),digest,'SOURCE_RETENTION_BOUNDARY_VIOLATION:'+fileName);
   const localSourceStructureAbi=typeof result.output?.triggerData==='string'?verifyLocalSourceStructureAbi(input,result.output.triggerData):undefined;
   return {...result,...(localSourceStructureAbi?{localSourceStructureAbi}:{}),sourceRepresentationBoundary:{kind:'UNCHANGED_ADDITIONAL_GALAXY_SOURCE_BOUNDARY',
    mode:policy.mode,files:[...original].map(([fileName,sha256])=>({fileName,sha256})),
    implicitMigration:false,newRuntimeFunctions:0,wholeProgramEquivalent:false,archivePackingVerified:false}};
  },
  convertTriggersToGalaxy:engine.convertTriggersToGalaxy,
 });
}
