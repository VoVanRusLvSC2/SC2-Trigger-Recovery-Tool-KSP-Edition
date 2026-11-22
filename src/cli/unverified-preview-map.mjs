/** Make an inspection copy after a strict GUI refusal. It cannot become PASS. */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const hashFile = async (file) => sha(await readFile(file));
const options = { maxArchiveBytes: 1024 ** 3, maxEntries: 100000, maxEntryBytes: 256 * 1024 ** 2 };

export async function createUnverifiedPreviewMap({ row, preview, triggerData, names }) {
  const config = JSON.parse(await readFile(row.config, 'utf8'));
  const guiInput = JSON.parse(await readFile(path.join(row.job, 'SOURCE_GUI_INPUT.json'), 'utf8'));
  // Never replace authored Triggers in an existing map as a diagnostic fallback.
  assert.equal(guiInput.present, false, 'Draft map requires an original without Triggers');
  assert.equal(await hashFile(row.original), row.originalSha256, 'Original archive changed');
  const building = path.join(preview, 'BUILDING-UNVERIFIED.tmp');
  const candidate = path.join(preview, 'UNVERIFIED-' + row.name);
  await copyFile(row.original, building, constants.COPYFILE_EXCL);
  assert.equal(await hashFile(building), row.originalSha256, 'Draft copy differs from original');
  const original = await openMpqReader(await readFile(row.original), options);
  const additions = [
    {
      file: path.join(preview, 'Triggers'),
      archivePath: 'Triggers',
      bytes: Buffer.from(triggerData),
    },
  ];
  try {
    const locales = [
      ...new Set(
        config.entries.flatMap((entry) => {
          const match = /^([^/\\]+\.SC2Data)[/\\]LocalizedData[/\\]GameStrings\.txt$/iu.exec(
            entry.path,
          );
          return match ? [match[1]] : [];
        }),
      ),
    ];
    for (let index = 0; index < locales.length; index++) {
      const archivePath = `${locales[index]}/LocalizedData/TriggerStrings.txt`;
      const entry = original.find(archivePath);
      const existing = entry ? Buffer.from(await original.read(entry.id)).toString('utf8') : '';
      const keys = new Set(
        existing
          .replace(/^\ufeff/u, '')
          .split(/\r?\n/u)
          .map((line) => line.split('=')[0]),
      );
      const extra = names.filter((line) => !keys.has(line.split('=')[0]));
      const merged =
        existing + (existing && !existing.endsWith('\n') ? '\n' : '') + extra.join('\n') + '\n';
      const file = path.join(preview, `localized-trigger-strings-${index}.txt`);
      await writeFile(file, merged, { flag: 'wx' });
      additions.push({ file, archivePath, bytes: Buffer.from(merged) });
    }
    for (const item of additions)
      await execute(
        row.mpq,
        [
          'add',
          path.basename(building),
          path.relative(preview, item.file),
          '--path',
          item.archivePath.replaceAll('/', '\\'),
          '--overwrite',
          '--game',
          'starcraft2',
        ],
        { cwd: preview, windowsHide: true, maxBuffer: 8 * 1024 ** 2 },
      );
    const packed = await openMpqReader(await readFile(building), options);
    try {
      const changed = new Set(additions.map((item) => item.archivePath.toLowerCase()));
      let preserved = 0;
      for (const entry of config.entries) {
        const name = entry.path.replaceAll('\\', '/');
        if (
          changed.has(name.toLowerCase()) ||
          ['(listfile)', '(attributes)'].includes(name.toLowerCase())
        )
          continue;
        const present = packed.find(name);
        assert(present, 'Original component missing from preview: ' + name);
        assert.equal(
          sha(Buffer.from(await packed.read(present.id))),
          entry.sha256,
          'Original component changed: ' + name,
        );
        preserved++;
      }
      for (const item of additions) {
        const entry = packed.find(item.archivePath);
        assert(entry, 'Preview component missing: ' + item.archivePath);
        assert.equal(
          sha(Buffer.from(await packed.read(entry.id))),
          sha(item.bytes),
          'Preview component mismatch',
        );
      }
      assert.equal(
        await hashFile(row.original),
        row.originalSha256,
        'Original changed during preview',
      );
      await copyFile(building, candidate, constants.COPYFILE_EXCL);
      await unlink(building);
      return {
        path: candidate,
        sha256: await hashFile(candidate),
        originalPayloadsPreserved: preserved,
        changedComponents: additions.map((item) => item.archivePath),
        originalGalaxyPreserved: true,
        editorVerified: false,
        accepted: false,
      };
    } finally {
      packed.dispose();
    }
  } finally {
    original.dispose();
  }
}
