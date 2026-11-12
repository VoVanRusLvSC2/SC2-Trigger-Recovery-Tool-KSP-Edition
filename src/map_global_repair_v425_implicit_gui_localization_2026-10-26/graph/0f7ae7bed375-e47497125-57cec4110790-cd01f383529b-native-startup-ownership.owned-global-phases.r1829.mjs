import {createHash} from 'node:crypto';
import {readOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/bfa5ccb94e8b-ec1a7bd2ecbf-e3b55d182995-0511d3687a2c-read-owned-gui-libraries.mjs';
import {startupFunctionName,withImplicitLibrary,sanitizeIdentifier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const mode=value=>typeof value==='string'?value:value?.mode;

// SDK preserve mode suppresses SDK boilerplate only. It is not serialized
// authority to suppress the editor's automatic runtime owners. This audit
// never removes source functions or establishes native equivalence.
export function auditNativeStartupOwnership({packedXml,documentKind,implicitLibraryId='Map',sdkInitialization,generationInitialization}) {
 const result={kind:'NATIVE_STARTUP_OWNERSHIP',status:'UNKNOWN',nativeReady:false,
  packedXmlSha256:typeof packedXml==='string'?createHash('sha256').update(packedXml).digest('hex'):null,
  sdkPreserve:mode(sdkInitialization)==='preserve'||mode(generationInitialization)==='preserve',
  serializedPhaseOwnershipProved:false,actualEditor:false,wholeMapAccepted:false,obligations:[],collisions:[]};
 const requireNative=reason=>result.obligations.push(reason);
 if(documentKind!=='map'||typeof packedXml!=='string'){
  requireNative('IMPLICIT_MAP_CONTRACT_REQUIRED');return result;
 }
 try {
  const libraries=readOwnedGuiLibraries(packedXml,implicitLibraryId);
  const owners=[...libraries.values()].filter(l=>l.implicit===true);
  if(owners.length!==1){requireNative('UNIQUE_IMPLICIT_MAP_OWNER_REQUIRED');return result;}
  const owner=owners[0];
  // Use unallocated engine ABI names. libraryInitializationNames additionally
  // avoids authored collisions in SDK; that renaming is not an editor contract.
  result.phaseSymbols=withImplicitLibrary(owner.id,()=>Object.fromEntries([
   ['libraries','InitLibraries'],['variables','InitVariables'],['customScript','InitCustomScript'],
   ['triggers','InitTriggers'],['entry','InitLib'],
  ].map(([phase,role])=>[phase,startupFunctionName(owner.id,role)])));
  result.owner=owner.id;result.contract='implicit-map startupFunctionName ABI; phase presence/effects still require native evidence';
  const phases=new Map(Object.entries(result.phaseSymbols).map(([phase,name])=>[name,phase]));
  // NoScriptPrefix is a global runtime name even inside an owned embedded
  // library. Checking only the implicit map misses those phase claimants.
  for(const library of libraries.values())for(const definition of Object.values(library.elements)){
   if(definition.disabled)continue;
   if(definition.type==='CustomScript'&&definition.scriptCode){requireNative('AUTHORED_SCRIPT_PHASE_OWNERSHIP_REQUIRES_NATIVE');continue;}
   if(definition.type!=='FunctionDef'||!definition.flags?.includes('NoScriptPrefix'))continue;
   const symbol=sanitizeIdentifier(definition.identifier??definition.name??definition.id),phase=phases.get(symbol);
   if(!phase)continue;
   result.collisions.push({phase,symbol,reference:{library:library.id,type:'FunctionDef',id:definition.id},
    flags:[...definition.flags],parameters:definition.parameters?.length??0,actions:definition.actions?.length??0,
    classification:'SERIALIZED_DEFINITION_CLAIMS_ENGINE_PHASE_SYMBOL'});
  }
  if(result.sdkPreserve)requireNative('SDK_PRESERVE_IS_NOT_SERIALIZED_ENGINE_OWNERSHIP');
  if(result.collisions.length)requireNative('ENGINE_PHASE_SINGLE_RUNTIME_OWNER_UNPROVED');
  if(result.sdkPreserve||result.collisions.length)requireNative('SOURCE_EXTRA_PHASE_EFFECTS_AND_ORDER_REQUIRE_NATIVE_PROOF');
  result.obligations=[...new Set(result.obligations)];
  result.status=result.obligations.length?'REQUIRES_NATIVE':'NO_OWNERSHIP_CONFLICT';
  return result;
 } catch(error) {
  requireNative('AUTOMATIC_PHASE_CONTRACT_UNRESOLVED');result.reason=String(error.message).slice(0,512);return result;
 }
}
