import { readLocalizedOwnedGuiLibraries } from '../implicit-gui-localization/localized-owned-libraries.mjs';
import { transferOwnedTriggerStorage } from './owned-trigger-storage-transfer.transaction-alternate.mjs';
import { verifyOwnedTriggerStorageTransfer } from './owned-trigger-storage-transfer.transaction.mjs';
import { qualifyNativePrefixBeforeComposition } from './native-prefix-before-owned-composition.mjs';
import { createCompilationOwnershipCheck } from '../exact-function-signatures/compilation-global-ownership.mjs';

export async function prepareOwnedTriggerStorage({
  triggerXml,
  triggerStrings,
  nativeProof,
  declarations,
  implicitLibraryId,
  ...input
}) {
  const guiLibraries = await readLocalizedOwnedGuiLibraries(
    triggerXml,
    triggerStrings,
    implicitLibraryId,
  );
  const ownershipTransaction = createCompilationOwnershipCheck();
  const plan = transferOwnedTriggerStorage({
    ...input,
    guiLibraries,
    implicitLibraryId,
    ownershipTransaction,
  });
  const prefix = qualifyNativePrefixBeforeComposition(input.generatedRoot, {
    declarations,
    nativeProof,
  });
  const verification = verifyOwnedTriggerStorageTransfer({
    ...input,
    generatedRoot: prefix.text,
    beforeFiles: input.ownedSources ?? [],
    afterFiles: plan.files,
    candidateRoot: plan.root,
    guiLibraries,
    implicitLibraryId,
    ownershipTransaction,
  });
  return { ...plan, proof: { ...plan.proof, nativePrefix: prefix.proof, verification } };
}
