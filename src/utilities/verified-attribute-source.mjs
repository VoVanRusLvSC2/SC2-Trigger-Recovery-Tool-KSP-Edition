import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readOptionalS2mh, attributesFromS2mh } from './s2mh-source.mjs';
import {
  decodeCacheHeader,
  field,
  reference,
  blob,
} from '../sdk/core/modules/game/battlenet/content-sources/cache-header.js';
import {
  writeAttributes,
  readAttributes,
} from '../sdk/lossless-colors/modules/map/shared/format/formats/attributes.js';
const sha = (b) => createHash('sha256').update(b).digest('hex');
/** Optional exact source. No map change, no guessing by publication title or ID. */
export async function verifiedAttributeSource({ indexPath, originalSha256, localizedStrings }) {
  if (!indexPath) return { used: false, reason: 'Optional exact header index omitted' };
  const indexBytes = await readFile(indexPath),
    index = JSON.parse(indexBytes),
    matches = index.exact.filter(
      (r) => r.sourceArchiveSha256 === originalSha256 && r.customCount && r.xmlProfileSupported,
    );
  if (!matches.length)
    return { used: false, reason: 'No exact supported attribute header for this archive' };
  const models = [];
  for (const e of matches) {
    assert(e.exactArchiveMatch && e.archive.sha256 === originalSha256);
    const raw = await readFile(e.header);
    assert.equal(sha(raw), e.headerSha256, 'Exact header changed');
    const address = reference(blob(field(field(decodeCacheHeader(raw), 0), 2)));
    assert.equal(address?.sha256, originalSha256, 'Header does not address original archive');
    const decoded = await readOptionalS2mh({ s2mh: e.header, namespace: e.namespace });
    const labels = localizedStrings
      .filter((l) => typeof l.gameStrings === 'string')
      .map((l) => ({ locale: l.locale, values: l.gameStrings.split(/\r?\n/u) }));
    const model = attributesFromS2mh(decoded, labels),
      xml = writeAttributes(model),
      reparsed = readAttributes(xml);
    // The canonical writer validates its complete retained definition/default XML.
    assert.equal(writeAttributes(reparsed), xml, 'Attribute document does not roundtrip');
    assert.equal(reparsed.attributes.length, decoded.attributes.length, 'Definitions lost');
    models.push({
      xml,
      model: reparsed,
      namespace: e.namespace,
      proof: {
        indexPath,
        indexSha256: sha(indexBytes),
        header: e.header,
        headerSha256: e.headerSha256,
        sourceArchiveSha256: originalSha256,
        exactArchiveMatch: true,
        namespace: e.namespace,
        definitionCount: reparsed.attributes.length,
        selectedVariant: decoded.defaultVariantIndex,
        defaultOverrides: decoded.overrides,
        sourceRevisionDefaultsRecovered: true,
        fullLobbyRecovered: false,
        unknownRequirementsAndOtherVariantsRetainedInRawHeader: true,
        editorVerified: false,
      },
    });
  }
  assert(
    models.every((m) => m.xml === models[0].xml && m.namespace === models[0].namespace),
    'Exact headers disagree on attribute definitions/defaults',
  );
  return { used: true, ...models[0] };
}
