/** Additional SC2 package locations use the same SDK resolver in preparation and
 * conversion. They never turn an unrelated Galaxy file into a dependency. */
import fs from 'node:fs/promises';
import path from 'node:path';
export async function normalizeLibraryRoots(inputs = []) {
  if (!Array.isArray(inputs) || inputs.length > 100) throw Error('Invalid local library roots');
  const roots = [];
  for (const input of inputs) {
    if (
      typeof input !== 'string' ||
      !input.trim() ||
      input.length > 32767 ||
      /[\x00-\x1f]/u.test(input)
    )
      throw Error('Invalid local library path');
    const actual = await fs.realpath(input);
    const info = await fs.stat(actual);
    const packagePath = /\.(sc2mod|sc2map|sc2campaign)$/iu.test(actual);
    if (!info.isDirectory() && !(info.isFile() && packagePath))
      throw Error('Choose an SC2 package or a folder containing packages');
    const root = packagePath ? path.dirname(actual) : actual;
    if (!roots.includes(root)) roots.push(root);
  }
  return roots;
}
