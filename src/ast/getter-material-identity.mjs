import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const sha = (text) => createHash('sha256').update(text).digest('hex');
export function assertVerifiedGetterMaterials({ sourceText, declarations, documents, provenance }) {
  assert.equal(
    sha(sourceText),
    provenance.originalSourceSha256,
    'Original getter source provenance changed',
  );
  assert.deepEqual(
    declarations.map((d) => ({ fileName: d.fileName, contentSha256: sha(d.text) })),
    provenance.sourceMaterials,
    'Stored declaration material identities changed',
  );
  assert.deepEqual(
    documents.map((d) => ({ sourcePath: d.sourcePath, contentSha256: sha(d.triggerData) })),
    provenance.libraryMaterials,
    'Stored loaded library identities changed',
  );
  assert.equal(provenance.owned, false);
  assert.equal(provenance.rawSourceCallNamesChanged, false);
  assert.equal(provenance.guiDefinitionsCreated, 0);
}
