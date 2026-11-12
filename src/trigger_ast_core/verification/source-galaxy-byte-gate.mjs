import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** The dataset is an externally pinned provenance audit, never inferred from
 * an "original" filename or from the converter's own output. */
export function selectAuthenticatedSourceWitness(dataset, archiveSha256) {
  const candidates = dataset.rows.filter(row => row.archiveSha256 === archiveSha256);
  assert(candidates.length, 'SOURCE_ORIGIN_WITNESS_MISSING');
  const authenticated = candidates.filter(row => row.sourceScriptAuthentic === true);
  assert(authenticated.length, 'SOURCE_ORIGIN_UNPROVEN');
  assert.equal(new Set(candidates.map(row => row.scriptSha256)).size, 1,
    'SOURCE_ORIGIN_WITNESS_AMBIGUOUS');
  return {
    archiveSha256,
    scriptSha256: authenticated[0].scriptSha256,
    origins: [...new Set(authenticated.map(row => row.origin))],
    wholeArchiveIsDepotObject: authenticated.every(row => row.wholeArchiveIsDepotObject === true),
  };
}

/** Compare bytes before any AST normalization. This cannot promote an oracle
 * verdict, authenticate dependencies, or claim Editor/whole-program success. */
export async function verifyOriginalGalaxyBytes({archiveBytes, expectedArchiveSha256, witness, baselineBytes}) {
  assert(Buffer.isBuffer(archiveBytes), 'SOURCE_ARCHIVE_BYTES_REQUIRED');
  assert.equal(sha(archiveBytes), expectedArchiveSha256, 'SOURCE_ARCHIVE_CHANGED');
  assert.equal(witness.archiveSha256, expectedArchiveSha256, 'SOURCE_WITNESS_ARCHIVE_MISMATCH');
  const reader = await openMpqReader(archiveBytes, {
    maxArchiveBytes: 1024 ** 3, maxEntries: 100000, maxEntryBytes: 256 * 1024 ** 2,
  });
  let scriptSha256;
  try {
    const entry = reader.find('MapScript.galaxy');
    assert(entry, 'SOURCE_ARCHIVE_HAS_NO_MAP_SCRIPT');
    scriptSha256 = sha(Buffer.from(await reader.read(entry.id)));
  } finally {
    reader.dispose();
  }
  assert.equal(scriptSha256, witness.scriptSha256, 'SOURCE_SCRIPT_DIFFERS_FROM_AUTHENTICATED_INPUT');
  if (baselineBytes !== undefined) {
    assert(Buffer.isBuffer(baselineBytes), 'BASELINE_BYTES_REQUIRED');
    assert.equal(sha(baselineBytes), scriptSha256, 'BENCHMARK_BASELINE_IS_NOT_ORIGINAL_GALAXY');
  }
  return {
    archiveSha256: expectedArchiveSha256, scriptSha256,
    baselineCompared: baselineBytes !== undefined,
    baselineByteExact: baselineBytes !== undefined,
    origins: witness.origins, wholeArchiveIsDepotObject: witness.wholeArchiveIsDepotObject,
    actualEditor: false, accepted: false, wholeProgramEquivalent: false,
  };
}
