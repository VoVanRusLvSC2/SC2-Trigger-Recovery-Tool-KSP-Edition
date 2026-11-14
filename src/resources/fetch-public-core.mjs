/** Download a pinned public SC2 core snapshot for offline research and conversion tests.
 * This does not replace a verified installation or a map's dependency closure. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PUBLIC_CORE = Object.freeze({
  repository: 'https://github.com/SC2Mapster/SC2GameData',
  revision: '6dd323aae4209a01f110719a00b4e8f7a88389bc',
  directory: 'mods/core.sc2mod/base.sc2data/TriggerLibs',
  files: [
    {
      name: 'NativeLib.TriggerLib',
      bytes: 7564347,
      gitBlob: 'e13e0c50b1732e4fbc61cd5df52cfe7116e0943e',
    },
    {
      name: 'NativeLib.galaxy',
      bytes: 253857,
      gitBlob: 'faac4dae7c6555aaa57ca9249ca81ad561b1d9e1',
    },
    {
      name: 'NativeLib_h.galaxy',
      bytes: 48698,
      gitBlob: 'e31b6adfeef400f2fc2793ff88db78441dfa215f',
    },
    { name: 'natives.galaxy', bytes: 261737, gitBlob: 'e55ce52f78999d6841b4ca2d7f0f3e049ab70620' },
  ],
});

export async function fetchPublicCore(output, { fetchImpl = fetch } = {}) {
  if (!output) throw new Error('A new output directory is required');
  const target = path.resolve(output);
  await mkdir(target); // exclusive: never overwrite user files
  const files = [];
  for (const entry of PUBLIC_CORE.files) {
    const url = `https://raw.githubusercontent.com/SC2Mapster/SC2GameData/${PUBLIC_CORE.revision}/${PUBLIC_CORE.directory}/${entry.name}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${entry.name}`);
    if (!response.body) throw new Error(`Empty response: ${entry.name}`);
    const chunks = [];
    let received = 0;
    for await (const chunk of response.body) {
      received += chunk.byteLength;
      if (received > entry.bytes) throw new Error(`Download exceeds expected size: ${entry.name}`);
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks, received);
    const blob = createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
    if (body.length !== entry.bytes || blob !== entry.gitBlob)
      throw new Error(`Integrity mismatch: ${entry.name}`);
    await writeFile(path.join(target, entry.name), body, { flag: 'wx' });
    files.push({ ...entry, sha256: createHash('sha256').update(body).digest('hex') });
  }
  const manifest = {
    status: 'PUBLIC_CORE_ONLY_NOT_MAP_READY',
    repository: PUBLIC_CORE.repository,
    revision: PUBLIC_CORE.revision,
    files,
    limitations: [
      'Snapshot version may not match the map or editor.',
      'Other mods, localizations and include dependencies are not included.',
      'Not accepted as a replacement for installed SC2 by the map recovery CLI.',
    ],
  };
  await writeFile(
    path.join(target, 'RESOURCE_MANIFEST.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await fetchPublicCore(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
