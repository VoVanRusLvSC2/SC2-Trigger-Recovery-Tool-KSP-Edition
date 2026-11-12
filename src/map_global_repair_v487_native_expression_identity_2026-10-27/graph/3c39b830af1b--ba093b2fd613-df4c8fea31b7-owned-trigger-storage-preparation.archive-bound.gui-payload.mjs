import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareOwnedTriggerStorage as prepare} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/95a988e4d48f-7-fd08ae9234c9-cd52de5fd872-1fe99a14d47e-owned-trigger-storage-preparation.transaction.mjs';
import {logicalSourcePath} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';

const capabilities=new WeakMap(),sha=text=>createHash('sha256').update(text).digest('hex');
const member=(file,text=file.text)=>({path:logicalSourcePath(file.originalPath??file.fileName),sha256:sha(text),size:Buffer.byteLength(text)});

// The opaque token is created only after the existing independent verifier has
// reconstructed the complete passive declaration transfer from actual sources,
// generated Galaxy and qualified GUI owners. A JSON receipt cannot mint it.
export async function prepareOwnedTriggerStorage(input){
  const {triggerStringsArchivePath,...sourceInput}=input;
  const result=await prepare(sourceInput);
  assert(result.proof.verification.passed&&result.proof.verification.storedRootStorage.passed);
  const original=[member(input.root),...(input.ownedSources??[]).map(file=>member(file))];
  const candidate=[member(result.root),...result.files.map(file=>member(file))];
  const presentation=[member({fileName:'Triggers',text:input.triggerXml})];
  if(triggerStringsArchivePath)presentation.push(member({fileName:triggerStringsArchivePath,text:input.triggerStrings??''}));
  else assert(!(input.triggerStrings??''),'STORAGE_LOCALIZATION_ARCHIVE_PATH_REQUIRED');
  const token=Object.freeze({kind:'VERIFIED_PASSIVE_STORAGE_COMPONENT_CAPABILITY'});
  capabilities.set(token,{original,candidate,presentation,movedDeclarations:result.proof.movedDeclarations,
    rootTransfer:structuredClone(result.proof.verification.rootTransfer)});
  return {...result,archiveSourceCapability:token};
}

function index(rows){
  const result=new Map();
  for(const row of rows){const name=logicalSourcePath(row.path);assert(!result.has(name),'DUPLICATE_SOURCE_COMPONENT_PATH');result.set(name,row);}
  return result;
}

// This does not waive the archive's other component checks. Bind exactly the
// already verified source transaction to both actual archive inventories and
// the staged manifest. Replaced bodies, types, initializers or extra edits fail.
export function verifyArchiveStorageSourceComponents(token,{beforeEntries,afterEntries,manifest}){
  const verified=capabilities.get(token);assert(verified,'VERIFIED_STORAGE_COMPONENT_CAPABILITY_REQUIRED');
  const before=index(beforeEntries),after=index(afterEntries),staged=index(manifest.components);
  for(const [side,actual]of [[verified.original,before],[verified.candidate,after]])for(const expected of side){
    const row=actual.get(expected.path);assert(row,'SOURCE_COMPONENT_MISSING:'+expected.path);
    assert.equal(row.sha256,expected.sha256,'SOURCE_COMPONENT_BYTES_OUTSIDE_VERIFIED_TRANSFER:'+expected.path);
    assert.equal(row.size??row.bytes,expected.size,'SOURCE_COMPONENT_SIZE_OUTSIDE_VERIFIED_TRANSFER:'+expected.path);
  }
  for(const expected of verified.presentation){
    const row=after.get(expected.path);assert(row,'VERIFIED_STORAGE_GUI_COMPONENT_MISSING:'+expected.path);
    assert.equal(row.sha256,expected.sha256,'VERIFIED_STORAGE_GUI_COMPONENT_CHANGED:'+expected.path);
    assert.equal(row.size??row.bytes,expected.size,'VERIFIED_STORAGE_GUI_COMPONENT_SIZE_CHANGED:'+expected.path);
  }
  const originals=index(verified.original);
  for(const expected of verified.candidate)if(originals.get(expected.path).sha256!==expected.sha256){
    const row=staged.get(expected.path);assert(row,'SOURCE_TRANSFER_NOT_REGISTERED_IN_MANIFEST:'+expected.path);
    assert.equal(row.sha256,expected.sha256,'STAGED_SOURCE_TRANSFER_MISMATCH:'+expected.path);
    assert.equal(row.bytes??row.size,expected.size,'STAGED_SOURCE_TRANSFER_SIZE_MISMATCH:'+expected.path);
  }
  return {kind:'ARCHIVE_BOUND_VERIFIED_PASSIVE_STORAGE_TRANSFER',passed:true,
    originalRoot:verified.original[0],storedRoot:verified.candidate[0],checkedOwnedFiles:verified.original.length-1,
    qualifiedGuiComponents:verified.presentation,
    movedDeclarations:verified.movedDeclarations,rootTransfer:verified.rootTransfer,
    opaqueCapabilityUsed:true,serializedReceiptUsedAsAuthority:false,nonDeclarationBytesPreserved:true,
    unrelatedComponentChecksStillRequired:true,wholeMapAccepted:false};
}
