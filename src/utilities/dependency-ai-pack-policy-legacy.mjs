/** Exclude only recovered map AI already proved to belong to mounted dependencies.
 * Keep its generated dispatch as the forward projection, but do not package a
 * second CustomAI document/ai script into a map which originally had neither.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { readAIData } from '../sdk/array-values/modules/map/shared/format/formats/ai-data.js';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export async function dependencyAiPackPolicy({
  prepared,
  recoveredCustomAi,
  originalCustomAi,
  mapOwnedAi,
  verifiedDependencyAi,
}) {
  if (originalCustomAi !== undefined || mapOwnedAi.length || !recoveredCustomAi)
    return { omitRecoveredMapAi: false, reason: 'Original map AI content or no recovered AI' };
  const recovered = readAIData(recoveredCustomAi.document),
    ids = recovered.definitions.map((d) => d.id.toUpperCase());
  if (!ids.length || new Set(ids).size !== ids.length)
    return { omitRecoveredMapAi: false, reason: 'Empty or ambiguous recovered definitions' };
  const verified = new Set(
    verifiedDependencyAi.proof.map((p) =>
      /^ai([0-9A-F]{8})\.galaxy$/iu.exec(p.fileName)?.[1].toUpperCase(),
    ),
  );
  if (ids.some((id) => !verified.has(id)))
    return {
      omitRecoveredMapAi: false,
      reason: 'Recovery includes unproved dependency AI scripts',
    };
  const owners = [];
  for (const m of prepared.actualMods ?? []) {
    const bytes = await readFile(m.destination);
    assert.equal(sha(bytes), m.destinationSha256);
    const reader = await openMpqReader(bytes, {
      maxArchiveBytes: 1024 * 1024 ** 2,
      maxEntries: 100000,
      maxEntryBytes: 256 * 1024 ** 2,
    });
    try {
      const entry = reader.find('CustomAI');
      if (!entry) continue;
      const data = Buffer.from(await reader.read(entry.id)),
        document = readAIData(data.toString('utf8'));
      for (const d of document.definitions)
        if (ids.includes(d.id.toUpperCase()))
          owners.push({
            id: d.id.toUpperCase(),
            mod: m.destination,
            modSha256: m.destinationSha256,
            customAiSha256: sha(data),
          });
    } finally {
      reader.dispose();
    }
  }
  if (ids.some((id) => owners.filter((p) => p.id === id).length !== 1))
    return {
      omitRecoveredMapAi: false,
      reason: 'Missing or ambiguous mounted dependency definition',
      owners,
    };
  return {
    omitRecoveredMapAi: true,
    ids,
    owners,
    reason:
      'Map originally had no AI document/scripts; every recovered AI is owned by one exact mounted dependency',
    forwardProjectionRetained: true,
    sourceAndLibrariesChanged: false,
    nativeAcceptance: false,
  };
}
