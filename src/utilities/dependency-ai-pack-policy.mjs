/** Preserve composed dependency AI multiplicity without adding a second map AI. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { dependencyAiPackPolicy as legacyPolicy } from './dependency-ai-pack-policy-legacy.mjs';
import { readAIData } from '../sdk/array-values/modules/map/shared/format/formats/ai-data.js';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export async function verifiedDependencyAiDocuments(prepared) {
  const documents = [],
    proof = [];
  for (const m of prepared.actualMods ?? []) {
    const bytes = await readFile(m.destination);
    assert.equal(sha(bytes), m.destinationSha256);
    const reader = await openMpqReader(bytes, {
      maxArchiveBytes: 1024 ** 3,
      maxEntries: 100000,
      maxEntryBytes: 256 * 1024 ** 2,
    });
    try {
      const entry = reader.find('CustomAI');
      if (!entry) continue;
      const data = Buffer.from(await reader.read(entry.id)),
        text = data.toString('utf8');
      assert(Buffer.from(text, 'utf8').equals(data));
      const parsed = readAIData(text);
      if (!parsed.definitions.length) continue;
      documents.push(text);
      proof.push({
        mod: m.destination,
        modSha256: m.destinationSha256,
        customAiSha256: sha(data),
        definitionIds: parsed.definitions.map((d) => d.id.toUpperCase()),
        ownership: 'mounted dependency',
      });
    } finally {
      reader.dispose();
    }
  }
  return { documents, proof };
}
export async function dependencyAiPackPolicy(input) {
  const old = await legacyPolicy(input);
  if (
    old.omitRecoveredMapAi ||
    input.originalCustomAi !== undefined ||
    input.mapOwnedAi.length ||
    !input.recoveredCustomAi
  )
    return old;
  const recovered = readAIData(input.recoveredCustomAi.document),
    ids = recovered.definitions.map((d) => d.id.toUpperCase());
  if (new Set(ids).size === ids.length) return old;
  const verifiedIds = new Set(
    input.verifiedDependencyAi.proof.map((p) =>
      /^ai([\da-f]{8})\.galaxy$/iu.exec(p.fileName)?.[1].toUpperCase(),
    ),
  );
  if (ids.some((id) => !verifiedIds.has(id)))
    return { ...old, reason: 'Repeated composed AI has unproved script inputs' };
  const { documents, proof } = await verifiedDependencyAiDocuments(input.prepared);
  const definitionSignatures = new Map(),
    composition = [];
  for (const text of documents) {
    const parsed = readAIData(text),
      docIds = parsed.definitions.map((d) => d.id.toUpperCase());
    if (new Set(docIds).size !== docIds.length)
      return { ...old, reason: 'Repeated ID inside one dependency document' };
    for (const d of parsed.definitions) {
      const id = d.id.toUpperCase(),
        signature = JSON.stringify({ ...d, id }),
        previous = definitionSignatures.get(id);
      if (previous && previous !== signature)
        return { ...old, reason: 'Different dependency definitions share one AI ID' };
      definitionSignatures.set(id, signature);
      composition.push(id);
    }
  }
  if (composition.toSorted().join(',') !== ids.toSorted().join(','))
    return { ...old, reason: 'Source/composed dependency AI multiplicity differs' };
  return {
    omitRecoveredMapAi: true,
    ids: [...new Set(ids)],
    sourceDefinitionOccurrences: ids,
    owners: proof,
    reason:
      'Every repeated source AI is an identical definition from separate exact mounted dependencies; preserve their native multiplicity',
    forwardProjectionRetained: true,
    sourceAndLibrariesChanged: false,
    nativeAcceptance: false,
  };
}
