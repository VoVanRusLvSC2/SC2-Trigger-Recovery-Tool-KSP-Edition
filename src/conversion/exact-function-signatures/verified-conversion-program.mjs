import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GalaxyProgramContext } from './galaxy-program-context.lazy-carriers.mjs';
const sha = (text) => createHash('sha256').update(text).digest('hex');

// Type facts belong to the exact current conversion view. Self-hashing these
// inputs establishes AST identity; it never certifies an original archive,
// unchanged payload, Editor compilation, or permission to preserve raw code.
// Those independent origin/ownership/packing gates remain mandatory.
export function createVerifiedConversionProgram(files, snapshot, hashText) {
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
  const program = new GalaxyProgramContext(identities, current, sha);
  // Bound declarations belong to the private semantic AST. Give that exact
  // verified copy provenance as well as any separately parsed frontend AST.
  for (const document of program.documents.values()) program.attachOriginal(document);
  return program;
}
