/** Offer verified dependency AI code to AI recovery, without treating it as map-owned. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
export async function verifiedDependencyAiInputs(declarations, mapOwnedAi = []) {
  const owned = new Set(mapOwnedAi.map((f) => f.fileName.toLowerCase()));
  const byName = new Map(),
    proof = [];
  for (const declaration of declarations) {
    const match = /(?:^|\/)(ai[0-9A-F]{8}\.galaxy)$/iu.exec(
      (declaration.sourceLabel ?? '').replaceAll('\\', '/'),
    );
    if (!match) continue;
    const name = match[1],
      key = name.toLowerCase();
    if (owned.has(key)) continue; // The source map's own file has filesystem precedence.
    const bytes = await readFile(declaration.path);
    const actual = createHash('sha256').update(bytes).digest('hex');
    assert.equal(actual, declaration.sha256, 'Dependency AI changed');
    const text = bytes.toString('utf8');
    assert(Buffer.from(text, 'utf8').equals(bytes), 'Dependency AI is not lossless UTF-8');
    const previous = byName.get(key);
    assert(!previous || previous.sha256 === actual, 'Ambiguous dependency AI providers');
    if (!previous) {
      byName.set(key, { fileName: name, text, sha256: actual });
      proof.push({
        fileName: name,
        path: declaration.path,
        sha256: actual,
        sourceLabel: declaration.sourceLabel,
        ownership: 'dependency',
        notExpandedAsMapOwned: true,
      });
    }
  }
  return { files: [...byName.values()].map(({ fileName, text }) => ({ fileName, text })), proof };
}
