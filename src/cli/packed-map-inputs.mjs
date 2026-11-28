import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Read the actual packed assets consumed by Galaxy regeneration and bind the
 * localization proof to the candidate's hash. */
export async function readPackedMapInputs({
  candidate,
  verifiedArchive,
  directory,
  locale,
  cfgEntries,
  manifest,
  additionalScripts,
}) {
  const packedBytes = verifiedArchive?.bytes ?? (await readFile(candidate));
  const packedInputSha256 = verifiedArchive?.sha256 ?? sha(packedBytes);
  const reader = await openMpqReader(packedBytes, {
    maxArchiveBytes: 1024 ** 3,
    maxEntries: 100000,
    maxEntryBytes: 256 * 1024 ** 2,
  });

  let packedXml, packedCustomAi, packedAttributes, packedDocumentInfo;
  const packedAi = [];
  const packedLocalized = [];
  const packedLocalizedEvidence = [];

  try {
    packedXml = Buffer.from(await reader.read(reader.find('Triggers').id)).toString('utf8');
    const packedAttributeEntry = reader.find('Attributes');
    if (packedAttributeEntry)
      packedAttributes = Buffer.from(await reader.read(packedAttributeEntry.id)).toString('utf8');
    const packedInfoEntry = reader.find('DocumentInfo');
    if (packedInfoEntry)
      packedDocumentInfo = Buffer.from(await reader.read(packedInfoEntry.id)).toString('utf8');
    // The packed archive, not source tables or staging fallback, supplies every
    // locale consulted by the forward compiler. Missing keys stay missing.
    const localeNames = new Set(
      [...cfgEntries, ...manifest.components, ...reader.entries]
        .map(
          (e) =>
            /^([a-z]{2}[A-Z]{2})\.SC2Data[\\/]LocalizedData[\\/](?:GameStrings|TriggerStrings)\.txt$/iu.exec(
              e.path ?? '',
            )?.[1],
        )
        .filter((l) => l && l.toLowerCase() !== 'base')
        .map((l) => l.slice(0, 2).toLowerCase() + l.slice(2).toUpperCase()),
    );
    for (const ownLocale of localeNames) {
      const item = { locale: ownLocale };
      for (const [field, file] of [
        ['triggerStrings', 'TriggerStrings.txt'],
        ['gameStrings', 'GameStrings.txt'],
      ]) {
        const p = ownLocale + '.SC2Data/LocalizedData/' + file,
          e = reader.find(p);
        if (!e) continue;
        const b = Buffer.from(await reader.read(e.id));
        item[field] = new TextDecoder('utf-8', { fatal: true }).decode(b);
        packedLocalizedEvidence.push({ path: p, sha256: sha(b), bytes: b.length });
      }
      packedLocalized.push(item);
    }
    const proof = {
      candidateSha256: packedInputSha256,
      tables: packedLocalizedEvidence,
      primaryLocale: locale,
      sourceTablesUsedAsPackedFallback: false,
      actualEditor: false,
    };
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, 'PACKED_LOCALIZED_TEXT_INPUT_PROOF.json'),
      JSON.stringify(proof, null, 2) + '\n',
    );

    const aiDocument = reader.find('CustomAI');
    if (aiDocument) packedCustomAi = Buffer.from(await reader.read(aiDocument.id)).toString('utf8');

    for (const file of additionalScripts) {
      const entry = reader.find(file.originalPath);
      assert(entry, 'Owned script lost from candidate');
      packedAi.push({
        fileName: file.fileName,
        text: Buffer.from(await reader.read(entry.id)).toString('utf8'),
      });
    }

    for (const e of reader.entries)
      if (
        /^ai[0-9a-f]{8}\.galaxy$/iu.test(e.path ?? '') &&
        !packedAi.some((f) => f.fileName.toLowerCase() === e.path.toLowerCase())
      )
        packedAi.push({
          fileName: e.path,
          text: Buffer.from(await reader.read(e.id)).toString('utf8'),
        });
  } finally {
    reader.dispose();
  }

  return {
    packedXml,
    packedCustomAi,
    packedAttributes,
    packedDocumentInfo,
    packedAi,
    packedLocalized,
    packedInputSha256,
  };
}
