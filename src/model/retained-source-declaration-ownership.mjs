import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { logicalSourcePath, partitionDeclarationViews } from './source-ownership.mjs';
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** Preserve ownership when retained includes also enter the binder as declaration
 * views. Exact archive path and source bytes are both required. This describes
 * current conversion inputs; it does not certify archive origin or GUI ABI. */
export function bindRetainedSourceDeclarationOwnership(files, retained) {
  if (!retained.length) return files;
  const views = partitionDeclarationViews(retained, files);
  assert.equal(views.conflicts.length, 0, 'RETAINED_DECLARATION_REVISION_CONFLICT');
  const matches = new Map(views.ownViews.map((v) => [v.declaration, v]));
  return files.map((file) => {
    const match = matches.get(file);
    if (!match) return file;
    const digest = sha(file.text);
    assert(
      file.contentSha256 === undefined || file.contentSha256 === digest,
      'RETAINED_DECLARATION_SNAPSHOT_SHA',
    );
    assert.equal(logicalSourcePath(file.originalPath ?? file.fileName), match.owner);
    return {
      ...file,
      owned: true,
      sourceId: 'retained-source:' + match.owner,
      contentSha256: digest,
    };
  });
}
