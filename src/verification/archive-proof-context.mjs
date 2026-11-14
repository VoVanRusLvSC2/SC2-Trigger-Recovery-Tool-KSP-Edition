import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { readOwnedGuiLibraries } from './read-owned-gui-libraries.mjs';
import { verifyArchiveIncludeBindings } from './archive-include-bindings.mjs';
import { qualifyNativePrefixBeforeComposition } from './native-prefix-before-owned-composition.mjs';
import { composeArchiveOwnedSourcePair } from './map-owned-source-composition.include-once.v3.mjs';
import { proveSharedArchiveOwnedDeclarations } from './shared-archive-owned-declarations.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
export const checkedArchiveProofFile = async (pin) => {
  const bytes = await readFile(pin.path);
  assert.equal(sha(bytes), pin.sha256, 'ARCHIVE_PROOF_INPUT_SHA');
  return bytes;
};
const limits = { maxArchiveBytes: 1024 ** 3, maxEntries: 100000, maxEntryBytes: 256 * 1024 ** 2 };

/** Fresh context from actual archives and explicit layer resolution. This
 * function accepts no serialized proof as authority and grants no PASS. */
export async function prepareArchiveProofContext(before, after, options) {
  const {
    sourceArchive,
    candidateArchive,
    exportFile,
    declarations = [],
    nativeProof,
    closedContext = {},
  } = options;
  assert(
    typeof before === 'string' && typeof after === 'string',
    'ARCHIVE_PROOF_ROOT_TEXT_REQUIRED',
  );
  assert(
    (await checkedArchiveProofFile(exportFile)).toString('utf8') === after,
    'ARCHIVE_PROOF_EXPORT_BYTES_REQUIRED',
  );
  const source = await openMpqReader(await checkedArchiveProofFile(sourceArchive), limits);
  try {
    const entry = source.find('MapScript.galaxy');
    assert(entry, 'ARCHIVE_PROOF_ORIGINAL_ROOT_MISSING');
    assert(
      Buffer.from(await source.read(entry.id)).toString('utf8') === before,
      'ARCHIVE_PROOF_ORIGINAL_ROOT_NOT_SERVER_BYTES',
    );
  } finally {
    source.dispose();
  }
  const candidate = await openMpqReader(await checkedArchiveProofFile(candidateArchive), limits);
  let guiLibraries;
  try {
    const entry = candidate.find('Triggers');
    assert(entry, 'ARCHIVE_PROOF_CANDIDATE_GUI_MISSING');
    guiLibraries = readOwnedGuiLibraries(
      Buffer.from(await candidate.read(entry.id)).toString('utf8'),
      'Map',
    );
  } finally {
    candidate.dispose();
  }
  const bindings = await verifyArchiveIncludeBindings({
    before,
    after,
    ...options,
    includeEvidence: closedContext.includeEvidence,
  });
  const prefix = {
    before: qualifyNativePrefixBeforeComposition(before, { declarations, nativeProof }),
    after: qualifyNativePrefixBeforeComposition(after, { declarations, nativeProof }),
  };
  const composition = await composeArchiveOwnedSourcePair(prefix.before.text, prefix.after.text, {
    sourceArchive,
    candidateArchive,
    declarations,
    includeEvidence: closedContext.includeEvidence,
  });
  const readers = [];
  let sharedOwned;
  try {
    for (const pin of [sourceArchive, candidateArchive])
      readers.push(await openMpqReader(await checkedArchiveProofFile(pin), limits));
    sharedOwned = await proveSharedArchiveOwnedDeclarations({
      bindings,
      composed: [composition.proof.before, composition.proof.after],
      declarations: composition.declarations,
      readOwned: async (index, path) => {
        const entry = readers[index].find(path);
        assert(entry, 'SHARED_OWNED_ARCHIVE_MEMBER_MISSING');
        return Buffer.from(await readers[index].read(entry.id));
      },
    });
  } finally {
    for (const reader of readers) reader.dispose();
  }
  return {
    before: composition.before,
    after: composition.after,
    guiLibraries,
    declarations: composition.declarations,
    closedContext: {
      ...closedContext,
      ownedSources: [],
      externalSources: composition.declarations,
      includeEvidence: composition.includeEvidence,
    },
    proof: {
      composition: composition.proof,
      sharedOwnedDeclarations: sharedOwned,
      includeBindings: bindings,
      nativePrefix: { before: prefix.before.proof, after: prefix.after.proof },
      sourceArchive,
      candidateArchive,
      exportFile,
      allOwnedFilesMatchedExplicitLayerResolution: true,
      sourceOrExportChanged: false,
      wholeMapAccepted: false,
    },
  };
}
