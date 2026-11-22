import assert from 'node:assert/strict';
import { recoveryTextSha256 as sha } from '../../utilities/recovery-parse-scope.mjs';
import { GalaxyProgramContext } from './galaxy-program-context.lazy-carriers.mjs';
const verifiedDocuments = new WeakMap();

/** Verified programs register their private semantic documents at construction. */
export function attachProgramDocuments(program) {
  for (const document of program.documents.values()) attachProgramDocument(program, document);
}

export function attachProgramDocument(program, document) {
  if (!verifiedDocuments.get(program)?.has(document)) program.attachOriginal(document);
}

export function findVerifiedProgramDocument(program, { fileName, text }) {
  const document = program.documents.get(fileName);
  if (document?.text === text && verifiedDocuments.get(program)?.has(document)) return document;
}

// Type facts belong to the exact current conversion view. Self-hashing these
// inputs establishes AST identity; it never certifies an original archive,
// unchanged payload, Editor compilation, or permission to preserve raw code.
// Those independent origin/ownership/packing gates remain mandatory.
export function createVerifiedConversionProgram(
  files,
  snapshot,
  hashText,
  { partitionStartup = false } = {},
) {
  const identities = files.map((file) => {
    const digest = sha(file.text),
      claimed = snapshot?.files?.find((f) => f.fileName === file.fileName);
    for (const row of [file, claimed].filter(Boolean))
      if (row.contentSha256 !== undefined)
        assert.equal(
          row.contentSha256,
          digest,
          'CONVERSION_SOURCE_VIEW_SHA_CHANGED:' + file.fileName,
        );
    if (hashText)
      assert.equal(hashText(file.text), digest, 'CONVERSION_HASH_IMPLEMENTATION_MISMATCH');
    return {
      ...file,
      sourceId: file.sourceId ?? claimed?.sourceId ?? 'conversion-view:' + file.fileName,
      contentSha256: digest,
    };
  });
  const current = {
    ...(snapshot ?? {}),
    files: identities.map(({ text, ...identity }) => identity),
    sourceViewKind: 'SELF_HASHED_CURRENT_CONVERSION_INPUT',
    originalArchiveAuthorized: false,
  };
  // Register the private semantic nodes and index their positions on demand.
  // Separately parsed frontend nodes still use attachOriginal.
  const program = new GalaxyProgramContext(identities, current, sha, {
    attachDocuments: true,
    partitionStartup,
  });
  verifiedDocuments.set(program, new WeakSet(program.documents.values()));
  return program;
}
