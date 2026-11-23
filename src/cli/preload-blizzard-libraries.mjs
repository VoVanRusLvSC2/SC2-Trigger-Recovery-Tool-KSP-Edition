import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { readAuthoredTriggerDocument } from '../ast/read-authored.scope.mjs';
import { libraryInitializers } from '../analysis/compiler-library-autoload.gui-demand.mjs';
import { isStrictlyEmpty } from '../libraries/preparation/empty-dependency-documents.mjs';
import { xmlTree as preparationXml } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { xmlTree as installedXml } from '../sdk/production-preparation/modules/triggers/shared/trigger-document/lossless-xml.js';
import { beginRecoveryParseScope } from '../utilities/recovery-parse-scope.mjs';
import { loadTriggerWorkspace } from './prepare-map.mjs';

export async function preloadBlizzardLibraries(sources, libraries, isIdle) {
  const idle = async () => {
    await setImmediate();
    return isIdle();
  };
  if (!(await idle())) return;
  const context = await sources.openModContext({
    schemaVersion: 1,
    target: { sourceId: 'local:casc', path: 'Mods/Void.SC2Mod' },
  });
  try {
    if (
      context.unresolved?.length ||
      context.layers.some((layer) => layer.sourceId !== 'local:casc')
    )
      return;
    const { readTriggerDependencies } = await loadTriggerWorkspace();
    if (!(await idle())) return;
    const documents = await readTriggerDependencies(context, { ownLibraries: true });
    const classified = [];
    for (const document of documents) {
      if (!(await idle())) return;
      const { triggerData } = document;
      const sha256 = createHash('sha256').update(triggerData).digest('hex');
      const empty = libraries.classifyInstalledDocument(sha256, () =>
        isStrictlyEmpty(triggerData, installedXml),
      );
      classified.push({ document, sha256, empty });
    }
    // The following readers use the same lossless XML implementation.
    const endScope = beginRecoveryParseScope();
    try {
      const metadata = [];
      for (const { document, sha256, empty } of classified) {
        if (!(await idle())) return;
        const { sourcePath, triggerData } = document;
        libraries.classifyPreparedDocument(document, () =>
          isStrictlyEmpty(triggerData, preparationXml),
        );
        if (empty) continue;
        if (!(await idle())) return;
        const verifiedOwners = libraries.catalogOwners(sha256, triggerData);
        if (!(await idle())) return;
        const { document: authored } = await readAuthoredTriggerDocument(
          triggerData,
          undefined,
          document.triggerStrings ?? '',
          { retainSource: false },
        );
        if (!isIdle()) return;
        const owners = [...authored.libraries.keys()];
        if (
          owners.length !== verifiedOwners.length ||
          owners.some((id, index) => id !== verifiedOwners[index])
        )
          return;
        libraries.mountedOwners(document)?.remember(owners);
        libraries.confirmMountedOwners([{ path: sourcePath, sha256 }]);
        metadata.push({ fileName: sourcePath, text: triggerData, sha256 });
      }
      if (await idle())
        libraries.preloadCompilerInitializers(metadata, () => libraryInitializers(metadata));
    } finally {
      endScope();
    }
  } finally {
    await context.dispose();
  }
}
