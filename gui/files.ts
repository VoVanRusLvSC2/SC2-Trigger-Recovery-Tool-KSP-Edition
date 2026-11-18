/** Read-only navigation for the in-app picker; no native dialog or subprocess. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { FileListing, PickerKind, FilePlace } from './contracts.js';

export async function listFiles(kind: PickerKind, requested?: string): Promise<FileListing> {
  if (!['map', 'json', 'folder', 'output', 'audio', 'library'].includes(kind))
    throw Error('Unsupported picker.');
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
  const packageMode = kind === 'map' || kind === 'library';
  const componentPackage = (name: string) => packageMode && /\.sc2(map|mod)$/i.test(name);
  const selectable = stat.isFile() || (stat.isDirectory() && componentPackage(actual));
  const selected = selectable ? actual : '';
  directory = selectable ? path.dirname(actual) : actual;
  if (!stat.isDirectory() && !stat.isFile()) throw Error('Choose a regular file or folder.');
  const extensions: Record<PickerKind, string[]> = {
    map: ['.sc2map', '.sc2mod'],
    json: ['.json'],
    folder: [],
    output: [],
    audio: ['.wav', '.mp3', '.ogg', '.m4a'],
    library: ['.sc2mod', '.sc2map'],
  };
  const accepted = (name: string) => extensions[kind].includes(path.extname(name).toLowerCase());
  const entries = (await fs.readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        !entry.isSymbolicLink() &&
        (entry.isDirectory() || (entry.isFile() && accepted(entry.name))),
    )
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
      directory: entry.isDirectory(),
      ...(entry.isDirectory() && componentPackage(entry.name) ? { package: true } : {}),
    }))
    .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
  return {
    directory,
    parent: path.dirname(directory),
    home: os.homedir(),
    entries: entries.slice(0, 5000),
    truncated: entries.length > 5000,
    selected: selected && accepted(selected) ? selected : '',
  };
}

/** The same places offered by the Localization Editor: Home, user folders, disks. */
export async function filePlaces(): Promise<FilePlace[]> {
  const home = os.homedir();
  const candidates = [
    { name: 'Home', path: home },
    ...['Desktop', 'Documents', 'Downloads'].map((name) => ({ name, path: path.join(home, name) })),
    ...(process.platform === 'win32'
      ? Array.from({ length: 26 }, (_, index) => {
          const drive = String.fromCharCode(65 + index) + ':\\';
          return { name: drive, path: drive };
        })
      : [{ name: 'File system', path: '/' }]),
  ];
  const checked = await Promise.all(
    candidates.map(async (place) => {
      try {
        return (await fs.stat(place.path)).isDirectory() ? place : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  return checked.filter((place): place is FilePlace => place !== undefined);
}
