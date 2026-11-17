/** Read-only navigation for the in-app picker; no native dialog or subprocess. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { FileListing, PickerKind } from './contracts.js';

export async function listFiles(kind: PickerKind, requested?: string): Promise<FileListing> {
  if (!['map', 'json', 'folder', 'output'].includes(kind)) throw Error('Unsupported picker.');
  if (
    requested !== undefined &&
    (typeof requested !== 'string' || requested.length > 32767 || /[\x00-\x1f]/.test(requested))
  )
    throw Error('Enter a valid file or folder path.');
  let directory = requested?.trim() || path.join(os.homedir(), 'Downloads');
  if (!requested?.trim()) {
    try {
      await fs.access(directory);
    } catch {
      directory = os.homedir();
    }
  }
  // Pasting a file path navigates to its parent and selects that file.
  const actual = await fs.realpath(directory);
  const stat = await fs.stat(actual);
  const selected = stat.isFile() ? actual : '';
  directory = stat.isFile() ? path.dirname(actual) : actual;
  if (!stat.isDirectory() && !stat.isFile()) throw Error('Choose a regular file or folder.');
  const extension = kind === 'map' ? '.sc2map' : kind === 'json' ? '.json' : '';
  const entries = (await fs.readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        !entry.isSymbolicLink() &&
        (entry.isDirectory() ||
          (entry.isFile() && extension && path.extname(entry.name).toLowerCase() === extension)),
    )
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
      directory: entry.isDirectory(),
    }))
    .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
  return {
    directory,
    parent: path.dirname(directory),
    home: os.homedir(),
    entries: entries.slice(0, 5000),
    truncated: entries.length > 5000,
    selected:
      selected && extension && path.extname(selected).toLowerCase() === extension ? selected : '',
  };
}
