import {readLocalizedOwnedGuiLibraries} from '../gui/localized-owned-libraries.mjs';
import {transferOwnedTriggerStorage} from '../model/owned-trigger-storage-transfer.mjs';
import {verifyOwnedTriggerStorageTransfer} from '../verification/owned-trigger-storage-transfer.mjs';
import {qualifyNativePrefixBeforeComposition} from '../verification/native-prefix-before-owned-composition.mjs';

export async function prepareOwnedTriggerStorage({triggerXml,triggerStrings,nativeProof,declarations,implicitLibraryId,...input}) {
  const guiLibraries=await readLocalizedOwnedGuiLibraries(triggerXml,triggerStrings,implicitLibraryId);
  const plan=transferOwnedTriggerStorage({...input,guiLibraries,implicitLibraryId});
  const prefix=qualifyNativePrefixBeforeComposition(input.generatedRoot,{declarations,nativeProof});
  const verification=verifyOwnedTriggerStorageTransfer({...input,generatedRoot:prefix.text,
    beforeFiles:input.ownedSources??[],afterFiles:plan.files,guiLibraries,implicitLibraryId});
  return {...plan,proof:{...plan.proof,nativePrefix:prefix.proof,verification}};
}
