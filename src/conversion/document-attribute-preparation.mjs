// Prepare source-bound attribute identity before either GUI recovery path.
// A later GUI refusal must not hide whether the original attributes are known.
import assert from 'node:assert/strict';
import { readAttributes } from '../sdk/array-values/modules/map/shared/format/formats/attributes.js';
import { readAttributeArchiveInputs } from '../verification/attribute-archive-inputs.mjs';
import { describeAttributeSourcePolicy } from '../verification/attribute-source-policy.mjs';
import { originalAttributePresence } from '../utilities/original-attribute-presence.mjs';
import { createVerifiedDocumentAttributeContext } from '../utilities/attribute-identity-context.mjs';

/**
 * Establish attribute provenance before either fresh or incremental recovery.
 * Keep the original archive distinct from the prepared working archive, and
 * expose a document namespace only for an exact, verified source match.
 * The returned evidence describes inputs; it does not certify map equivalence.
 */
export async function prepareDocumentAttributes({
  row,
  localizedStrings,
  originalGalaxy,
  expandedScript,
  parseGalaxy,
  verifiedSource,
  emptySourceEvidence,
  indexPath,
  extractedAttributes,
  checkExtractedAttributes = false,
}) {
  const original = await readAttributeArchiveInputs(row.original, row.originalSha256);
  const prepared =
    row.archive === row.original && row.archiveSha256 === row.originalSha256
      ? original
      : await readAttributeArchiveInputs(row.archive, row.archiveSha256);
  if (checkExtractedAttributes)
    assert.equal(
      extractedAttributes,
      original.attributes,
      'Extracted Attributes differ from original archive',
    );
  const originalModel =
    original.attributes === undefined ? undefined : readAttributes(original.attributes);
  const source = await verifiedSource({
    indexPath,
    originalSha256: row.originalSha256,
    localizedStrings,
    row,
    originalGalaxy,
  });
  const policy = describeAttributeSourcePolicy(source);
  const context =
    source.used && source.proof.exactArchiveMatch === true
      ? await createVerifiedDocumentAttributeContext({
          source,
          sourceArchiveSha256: row.originalSha256,
          model: originalModel ?? source.model,
        })
      : undefined;
  const presence = originalAttributePresence({
    expandedScript,
    parseGalaxy,
    attributeModel: originalModel,
    exactAttributeSource: source,
  });
  const empty = await emptySourceEvidence({
    indexPath,
    originalSha256: row.originalSha256,
    source: expandedScript,
    ast: parseGalaxy(expandedScript, 'exact-empty-attributes.galaxy'),
    originalDefinitions: originalModel?.attributes.length ?? 0,
  });
  // Queries against stock/dependency attributes do not authorize inventing own
  // definitions. They remain visible even when the own header is exactly empty.
  const model = originalModel ?? (source.used ? source.model : undefined);
  return {
    original,
    prepared,
    originalModel,
    source,
    policy,
    context,
    presence,
    empty,
    model,
    usesAttributes: presence.present && !empty.applicable,
    proof: {
      kind: 'SOURCE_ATTRIBUTE_PREPARATION_BEFORE_GUI',
      sourceArchiveSha256: row.originalSha256,
      originalDefinitions: originalModel?.attributes.length ?? 0,
      recoveredDefinitions: source.used ? (source.model?.attributes.length ?? 0) : 0,
      effectiveDefinitions: model?.attributes.length ?? 0,
      sourceKind: originalModel
        ? 'ORIGINAL_DOCUMENT'
        : source.used
          ? policy.kind
          : 'NO_VERIFIED_RECOVERY_SOURCE',
      queriesPresent: presence.originalGalaxyCalls.length > 0,
      exactOwnHeaderEmpty: empty.applicable,
      namespaceVerified: context !== undefined,
      usesNewTestDefaults: policy.usesNewTestDefaults,
      guiRecoveryRequired: true,
      wholeMapAccepted: false,
      editorVerified: false,
      sourceFilesChanged: false,
      runtimeCodeChanged: false,
    },
  };
}
