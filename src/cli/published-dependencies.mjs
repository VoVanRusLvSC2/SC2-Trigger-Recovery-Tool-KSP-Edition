import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { openSc2Package } from './sc2-package.mjs';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';

const publication = /^bnet:(.+)\/\d+\.\d+\/\d+$/iu;
const libraryFile = /(?:^|\/)Lib([a-z0-9]+)(?:_h)?\.galaxy$/iu;
const localKey = (name) =>
  name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.sc2mod$/u, '')
    .replace(/(?<=[a-z])а/gu, 'a')
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
    .replace(/mod$/u, '');
const orderPaths = (items) => [...new Set(items)];

function references(xml) {
  if (!xml) return [];
  const root = xmlTree(xml);
  const dependencies = root.children.find(({ tag }) => tag === 'Dependencies');
  return (dependencies?.children ?? []).flatMap((node) => {
    if (node.tag !== 'Value') return [];
    // The scope reader uses the raw value to match the same declaration at mount time.
    const raw = xml.slice(node.openEnd, node.closeStart).trim();
    const match = publication.exec(raw);
    return match ? [{ reference: raw, title: localKey(match[1]) }] : [];
  });
}

async function modEntries(roots) {
  const packages = [];
  for (const root of roots) {
    const children = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (!(child.isFile() || child.isDirectory()) || !/\.sc2mod$/iu.test(child.name)) continue;
      packages.push({ file: path.join(root, child.name), name: localKey(child.name) });
    }
  }
  return packages;
}

async function packageDigest(reader) {
  if (reader.archiveSha256) return reader.archiveSha256;
  const digest = createHash('sha256');
  for (const entry of [...reader.entries].sort((a, b) => a.path.localeCompare(b.path))) {
    const component = createHash('sha256')
      .update(await reader.read(entry.id))
      .digest('hex');
    digest.update(JSON.stringify([entry.path, component]));
  }
  return digest.digest('hex');
}

async function packageFacts(file) {
  const info = await fs.stat(file);
  if ((!info.isFile() && !info.isDirectory()) || info.size > 1024 ** 3) return;
  const reader = await openSc2Package(file);
  try {
    const doc = reader.find('DocumentInfo');
    const bytes = doc && (doc.size ?? 0) <= 1024 ** 2 ? await reader.read(doc.id) : undefined;
    const xml =
      bytes && bytes.length <= 1024 ** 2 ? Buffer.from(bytes).toString('utf8') : undefined;
    return {
      sha256: await packageDigest(reader),
      owners: new Set(
        reader.entries.flatMap(
          ({ path }) => libraryFile.exec(path ?? '')?.[1]?.toLowerCase() ?? [],
        ),
      ),
      references: references(xml),
    };
  } finally {
    reader.dispose();
  }
}

/** Locate local analogues only in the supplied roots, the map's folder, and Mods.
 * A similar filename needs evidence from a library actually included by the map. */
export async function findPublishedBindings({
  xml,
  script,
  original,
  libraryRoots,
  libraryInputs = [],
  installation,
}) {
  const pending = references(xml);
  if (!pending.length) return [];
  const explicit = [];
  for (const input of libraryInputs)
    if (/\.sc2mod$/iu.test(input)) explicit.push(await fs.realpath(input));
  const roots = orderPaths([
    ...libraryRoots,
    path.dirname(original),
    path.join(installation, 'Mods'),
  ]);
  const packages = await modEntries(roots);
  const requested = new Set(
    [
      ...script.matchAll(/^\s*include\s+"(?:[^"\r\n]*\/)?Lib([a-z0-9]+)(?:_h)?(?:\.galaxy)?"/gimu),
    ].map(([, id]) => id.toLowerCase()),
  );
  const facts = new Map();
  const bindings = [];
  const seen = new Set();
  const matchingPackage = async (candidates, exact, requireOwner) => {
    if (candidates.length > 8) return;
    const matches = [];
    for (const { file } of candidates) {
      if (!facts.has(file)) facts.set(file, await packageFacts(file).catch(() => undefined));
      const fact = facts.get(file);
      if (!fact) continue;
      if (
        requireOwner &&
        !exact.some((pkg) => pkg.file === file) &&
        ![...fact.owners].some((id) => requested.has(id))
      )
        continue;
      matches.push({ file, fact });
    }
    if (matches.length && matches.every(({ fact }) => fact.sha256 === matches[0].fact.sha256))
      return matches[0];
  };
  for (const { reference, title } of pending) {
    if (seen.has(reference)) continue;
    if (seen.size >= 64) break;
    seen.add(reference);
    const exact = packages.filter(({ name }) => name === title);
    const named = exact.length
      ? exact
      : packages.filter(({ name }) => name.length >= 4 && title.startsWith(name));
    const chosen =
      pending.length === 1 && explicit.length
        ? await matchingPackage(
            explicit.map((file) => ({ file })),
            exact,
            true,
          )
        : undefined;
    const selected = chosen ?? (await matchingPackage(named, exact, !exact.length));
    if (!selected) continue;
    const { file, fact } = selected;
    bindings.push({
      reference,
      file,
      sha256: fact.sha256,
      localReference: 'Mods/' + path.basename(file),
      libraryIds: [...fact.owners],
      match: chosen
        ? 'EXPLICIT_LOCAL_PACKAGE'
        : exact.length
          ? 'LOCAL_PACKAGE_NAME'
          : 'LOCAL_NAME_AND_REFERENCED_LIBRARY',
    });
    pending.push(...fact.references);
  }
  return bindings;
}

export function publishedSourceOptions(bindings, libraryRoots) {
  const roots = orderPaths([...bindings.map(({ file }) => path.dirname(file)), ...libraryRoots]);
  return {
    sources: roots.map((folder) => ({ type: 'mods', path: folder, priority: -100 })),
    publishedDependencies: new Map(
      bindings.map(({ reference, localReference }) => [reference, localReference]),
    ),
  };
}

export async function verifyPublishedBindings(sources, layers, bindings) {
  const checked = new Map();
  for (const binding of bindings) {
    const layer = layers.find(
      (item) =>
        item.role !== 'primary' &&
        item.sourcePath.toLowerCase() === binding.localReference.toLowerCase(),
    );
    assert(layer, 'Local analogue was not mounted: ' + binding.reference);
    const local = await sources.resolveLocalPath(layer.sourceId, layer.sourcePath);
    assert(
      local && ['file', 'directory'].includes(local.kind),
      'Local analogue has no physical package: ' + binding.reference,
    );
    if (!checked.has(local.path)) checked.set(local.path, await fingerprint(local.path));
    assert.equal(
      checked.get(local.path),
      binding.sha256,
      'Local analogue differs from the selected archive: ' + binding.reference,
    );
  }
}

async function fingerprint(file) {
  const reader = await openSc2Package(file);
  try {
    return await packageDigest(reader);
  } finally {
    reader.dispose();
  }
}

export async function verifyPublishedFiles(bindings) {
  for (const { file, sha256 } of bindings)
    assert.equal(await fingerprint(file), sha256, 'Local dependency changed: ' + file);
}
