import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalizeSourceBoundTriggerAliases as lexical } from '../passes/source-bound-trigger-aliases.preserve-identities.mjs';
import { Parser } from '../sdk/array-values/modules/galaxy/language-core/index.js';
import { getTypeName } from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const sha = (s) => createHash('sha256').update(s).digest('hex');
// The archive capability belongs to the original bytes, not a printed/lowered
// view. Re-establish its permission on those bytes, then bind the same roles.
export function createArchiveBoundRootViewQualifier({
  qualifyArchiveBoundRootRoles,
  projectPrivateRootCallbackAlpha,
}) {
  assert(
    typeof qualifyArchiveBoundRootRoles === 'function' &&
      typeof projectPrivateRootCallbackAlpha === 'function',
    'ROOT_VIEW_QUALIFIER_DEPENDENCIES',
  );
  return function qualifyArchiveBoundRootView(scope, { sourceRoot, view, externalSources = [] }) {
    const raw = qualifyArchiveBoundRootRoles(scope, sourceRoot, externalSources);
    if (!raw.proof.edits) return { text: view, proof: raw.proof };
    const proposed = lexical({
      text: view,
      parse: (t, n) => new Parser().parseFile(n, t),
      typeName: getTypeName,
      otherSources: externalSources.map((f) => ({ name: f.fileName, text: f.text })),
    });
    assert.deepEqual(
      proposed.proof.bindings,
      raw.proof.bindings,
      'ROOT_VIEW_BOUND_ROLE_IDENTITIES_CHANGED',
    );
    projectPrivateRootCallbackAlpha(view, proposed.text, {
      scope,
      sourceRoot,
      candidateRoot: proposed.text,
      externalSources,
    });
    return {
      text: proposed.text,
      proof: {
        ...raw.proof,
        rootView: {
          sourceRootSha256: sha(sourceRoot),
          inputViewSha256: sha(view),
          outputViewSha256: sha(proposed.text),
          sameBoundRoleRecords: true,
          aliasPermissionOnly: true,
          viewBusinessEquivalenceProved: false,
        },
        viewAliasEdits: proposed.proof.edits,
        nativeAcceptance: false,
        wholeMapAccepted: false,
      },
    };
  };
}
