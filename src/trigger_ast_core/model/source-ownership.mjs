import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// A declaration can be an additional view of the same owned include. Content
// equality alone never proves ownership: the exact logical archive path must agree.
const sha = text => createHash('sha256').update(text).digest('hex');
export function logicalSourcePath(value) {
  assert.equal(typeof value, 'string', 'SOURCE_PATH_REQUIRED');
  const text = value.replaceAll('\\', '/').replace(/^(?:\.\/)+/u, '');
  assert(text && !/^(?:\/|[A-Za-z]:)/u.test(text) && !text.includes('\0'), 'ARCHIVE_RELATIVE_PATH_REQUIRED');
  const parts = text.split('/');
  assert(parts.every(p => p && p !== '.' && p !== '..'), 'UNSAFE_ARCHIVE_SOURCE_PATH');
  return text.toLowerCase();
}

export function partitionDeclarationViews(ownedFiles, declarations) {
  const owned = new Map(), ownViews = [], external = [], conflicts = [];
  for (const file of ownedFiles) {
    assert.equal(typeof file.text, 'string', 'OWNED_SOURCE_TEXT_REQUIRED');
    const owner = logicalSourcePath(file.originalPath ?? file.fileName);
    assert(!owned.has(owner), 'AMBIGUOUS_OWNED_SOURCE_OWNER');
    const digest = sha(file.text);
    if (file.sha256 !== undefined) assert.equal(digest, file.sha256, 'OWNED_SOURCE_SHA_MISMATCH');
    owned.set(owner, {file, sha256: digest});
  }
  for (const declaration of declarations) {
    assert.equal(typeof declaration.text, 'string', 'DECLARATION_SOURCE_TEXT_REQUIRED');
    const owner = logicalSourcePath(declaration.originalPath ?? declaration.fileName);
    const digest = sha(declaration.text), original = owned.get(owner);
    if (declaration.sha256 !== undefined) assert.equal(digest, declaration.sha256, 'DECLARATION_SOURCE_SHA_MISMATCH');
    if (original && original.sha256 === digest) {
      ownViews.push({declaration, owner, sha256: digest});
    } else {
      external.push(declaration);
      if (original) conflicts.push({owner, ownedSha256: original.sha256, declarationSha256: digest});
    }
  }
  return {ownViews, external, conflicts, proof: {
    kind: 'EXACT_LOGICAL_PATH_AND_SHA_OWNED_DECLARATION_VIEWS',
    ownedSources: [...owned].map(([owner, value]) => ({owner, sha256: value.sha256})),
    ownViews: ownViews.map(({owner, sha256}) => ({owner, sha256})), conflicts,
    externalSources: external.map(file => ({owner: logicalSourcePath(file.originalPath ?? file.fileName), sha256: sha(file.text)})),
    pathAliasesInferred: false, contentOnlyOwnership: false, sourceOrCandidateChanged: false,
  }};
}
