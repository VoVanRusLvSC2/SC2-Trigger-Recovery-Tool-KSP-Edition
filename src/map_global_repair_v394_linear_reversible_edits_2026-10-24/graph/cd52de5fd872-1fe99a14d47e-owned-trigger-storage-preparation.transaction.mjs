import {readLocalizedOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/gui/localized-owned-libraries.mjs';
import {transferOwnedTriggerStorage} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v394_linear_reversible_edits_2026-10-24/graph/72cb054f0a93-5b244285e80a-owned-trigger-storage-transfer.transaction.mjs';
import {verifyOwnedTriggerStorageTransfer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v394_linear_reversible_edits_2026-10-24/graph/e855da899df3-ebd491571d88-owned-trigger-storage-transfer.transaction.mjs';
import {qualifyNativePrefixBeforeComposition} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/a79f70d50ee6-native-prefix-before-owned-composition.mjs';

export async function prepareOwnedTriggerStorage({triggerXml,triggerStrings,nativeProof,declarations,implicitLibraryId,...input}) {
  const guiLibraries=await readLocalizedOwnedGuiLibraries(triggerXml,triggerStrings,implicitLibraryId);
  const plan=transferOwnedTriggerStorage({...input,guiLibraries,implicitLibraryId});
  const prefix=qualifyNativePrefixBeforeComposition(input.generatedRoot,{declarations,nativeProof});
  const verification=verifyOwnedTriggerStorageTransfer({...input,generatedRoot:prefix.text,
    beforeFiles:input.ownedSources??[],afterFiles:plan.files,candidateRoot:plan.root,guiLibraries,implicitLibraryId});
  return {...plan,proof:{...plan.proof,nativePrefix:prefix.proof,verification}};
}
