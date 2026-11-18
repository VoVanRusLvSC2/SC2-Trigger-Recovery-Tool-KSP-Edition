/** Port-independent per-user preferences. Unknown keys never become CLI options. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

export interface Preferences {
  recoverAttributes: boolean;
  fullGui: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  backgroundOpacity: number;
  musicPath: string;
  libraryRoots: { path: string; enabled: boolean }[];
}
export const preferenceDefaults: Preferences = {
  recoverAttributes: true,
  fullGui: false,
  musicEnabled: false,
  musicVolume: 0.22,
  backgroundOpacity: 0.87,
  musicPath: '',
  libraryRoots: [],
};
export function validatePreferences(value: unknown): Preferences {
  if (!value || typeof value !== 'object') throw Error('Invalid preferences.');
  const data = { ...preferenceDefaults, ...value } as Preferences;
  for (const key of ['recoverAttributes', 'fullGui', 'musicEnabled'] as const)
    if (typeof data[key] !== 'boolean') throw Error('Invalid preference: ' + key);
  for (const [key, min] of [
    ['musicVolume', 0],
    ['backgroundOpacity', 0.05],
  ] as const)
    if (!Number.isFinite(data[key]) || data[key] < min || data[key] > 1)
      throw Error('Invalid preference: ' + key);
  const validPath = (p: unknown): p is string =>
    typeof p === 'string' && p.length < 32768 && !/[\x00-\x1f]/.test(p);
  if (
    !validPath(data.musicPath) ||
    !Array.isArray(data.libraryRoots) ||
    data.libraryRoots.length > 100 ||
    data.libraryRoots.some((r) => !r || !validPath(r.path) || typeof r.enabled !== 'boolean')
  )
    throw Error('Invalid preference paths.');
  return Object.fromEntries(
    Object.keys(preferenceDefaults).map((key) => [key, data[key as keyof Preferences]]),
  ) as unknown as Preferences;
}
export function createPreferenceStore(
  file = process.env.SC2_RECOVERY_SETTINGS ??
    path.join(
      process.env.APPDATA || path.join(os.homedir(), '.config'),
      'SC2 Trigger Recovery KSP',
      'settings.json',
    ),
) {
  let queue = Promise.resolve();
  return {
    async read() {
      try {
        return validatePreferences(JSON.parse(await fs.readFile(file, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          console.error('Preferences reset: ' + (error as Error).message);
        return structuredClone(preferenceDefaults);
      }
    },
    async write(value: unknown) {
      const data = validatePreferences(value);
      const pending = queue.then(async () => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const temporary = file + '.' + randomUUID() + '.tmp';
        await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
        await fs.rename(temporary, file);
      });
      queue = pending.catch(() => {});
      await pending;
      return data;
    },
  };
}
