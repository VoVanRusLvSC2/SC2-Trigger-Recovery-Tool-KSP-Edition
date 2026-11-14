/** Package the converter's recovered CustomAI alongside Triggers.
 * Authored CustomAI remains authoritative. New records are explicitly marked
 * as candidate metadata for the installed Editor, never recovered originals.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  parseVersionFile,
  writeVersionFile,
} from '../../sdk/core/modules/mod/codecs/document-metadata/core/version-file.js';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function customAiComponentPlan({
  originalDocument,
  originalVersion,
  recoveredDocument,
  report,
  parseXml,
  version,
}) {
  const components = [];
  const existing = originalDocument?.length > 0;
  if (!existing && !recoveredDocument?.length)
    return { components, registrationNeeded: false, policy: { present: false } };
  const policy = {
    present: true,
    originalDocumentPreserved: existing,
    recoveredDocumentPackaged: !existing,
    editorVerified: false,
  };
  if (!existing) {
    assert(
      report.files?.includes('CustomAI'),
      'Recovered CustomAI is not an observed conversion output',
    );
    assert(
      report.command === 'roundtrip' && report.roundtrip,
      'CustomAI requires the completed full roundtrip',
    );
    assert(
      ![...(report.diagnostics ?? []), ...(report.roundtrip.diagnostics ?? [])].some(
        (d) => d.severity === 'error',
      ),
      'CustomAI roundtrip has errors',
    );
    const tree = parseXml(recoveredDocument.toString('utf8'));
    assert(
      tree.tag === 'AIData' && tree.children.some((n) => n.tag === 'Definition'),
      'Recovered CustomAI requires an AIData definition',
    );
    const ids = tree.children.filter((n) => n.tag === 'Definition').map((n) => n.attributes.Id);
    assert(
      ids.every((id) => /^[0-9A-F]{8}$/iu.test(id)) && new Set(ids).size === ids.length,
      'Ambiguous recovered AI definition identities',
    );
    assert(
      ids.every((id) =>
        report.files.some(
          (file) => file.toLowerCase() === `roundtrip/ai${id}.galaxy`.toLowerCase(),
        ),
      ),
      'Recovered AI lacks roundtrip Galaxy evidence',
    );
    components.push({ path: 'CustomAI', bytes: Buffer.from(recoveredDocument) });
    policy.definitionIds = ids;
    policy.documentSha256 = sha(recoveredDocument);
  }
  if (originalVersion?.length) {
    const record = parseVersionFile(originalVersion);
    assert(record?.typeTag === 'iaia', 'Conflicting CustomAI.version type');
    policy.versionPolicy = 'Original CustomAI.version retained byte-for-byte';
  } else {
    assert(version && Number.isInteger(version.build), 'Installed Editor version is required');
    const bytes = Buffer.from(
      writeVersionFile({
        typeTag: 'iaia',
        formatVersion: 2,
        buildNumber: version.build,
        buildNumber2: version.build,
        majorVersion: version.major,
        minorVersion: version.minor,
        patchVersion: version.patch,
        entryCount: 0,
        timestamp: Math.floor(Date.now() / 1000),
        terminal: 1,
      }),
    );
    assert(Buffer.from(writeVersionFile(parseVersionFile(bytes))).equals(bytes));
    components.push({ path: 'CustomAI.version', bytes });
    policy.versionPolicy =
      'New candidate iaia v2 record for installed Editor; original missing; acceptance pending';
  }
  return { components, registrationNeeded: true, policy };
}
