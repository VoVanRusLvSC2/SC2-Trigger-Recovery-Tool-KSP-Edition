import {readLocalizedOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/d093c0e9cb54-1d107a6c6608-087afa3380b3-661b40199351-localized-owned-libraries.mjs';
import {transferOwnedTriggerStorage} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/bc4e3fab801a-527734850204-72cb054f0a93-5b244285e80a-owned-trigger-storage-transfer.transaction.mjs';
import {verifyOwnedTriggerStorageTransfer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/b3836ace1278-b550627f11ae-e855da899df3-ebd491571d88-owned-trigger-storage-transfer.transaction.mjs';
import {qualifyNativePrefixBeforeComposition} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a4accf5f0a70-a3ead56c6a53-a79f70d50ee6-native-prefix-before-owned-composition.mjs';

export async function prepareOwnedTriggerStorage({triggerXml,triggerStrings,nativeProof,declarations,implicitLibraryId,...input}) {
  const guiLibraries=await readLocalizedOwnedGuiLibraries(triggerXml,triggerStrings,implicitLibraryId);
  const plan=transferOwnedTriggerStorage({...input,guiLibraries,implicitLibraryId});
  const prefix=qualifyNativePrefixBeforeComposition(input.generatedRoot,{declarations,nativeProof});
  const verification=verifyOwnedTriggerStorageTransfer({...input,generatedRoot:prefix.text,
    beforeFiles:input.ownedSources??[],afterFiles:plan.files,candidateRoot:plan.root,guiLibraries,implicitLibraryId});
  return {...plan,proof:{...plan.proof,nativePrefix:prefix.proof,verification}};
}
