/** Own exactly one map operation. Dispose even on conversion/proof failure.
 * No singleton content source, disk cache, or shared state across workers. */
import { createHash } from 'node:crypto';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Sc2DesktopContentSources } from '../../sdk/production-preparation/modules/game/battlenet/content-sources/local-content-sources.js';
import { createTriggerConversionContext } from './index.mjs';
import { parseGalaxySource } from './galaxy-to-trigger-alternate-4.mjs';
import { openMpqReader } from '../../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
const sha = (b) => createHash('sha256').update(b).digest('hex');
async function dependencyStamp(local) {
  if (local.kind === 'file') {
    const s = await stat(local.path);
    return JSON.stringify([s.size, s.mtimeMs]);
  }
  const records = [];
  let count = 0;
  async function visit(folder) {
    for (const e of await readdir(folder, { withFileTypes: true })) {
      if (++count > 100000) throw Error('Physical dependency listing exceeds 100000 entries');
      if (e.isSymbolicLink()) continue;
      const file = path.join(folder, e.name);
      if (e.isDirectory()) await visit(file);
      else if (e.isFile()) {
        const s = await stat(file);
        records.push([path.relative(local.path, file), s.size, s.mtimeMs]);
      }
    }
  }
  await visit(local.path);
  records.sort((a, b) => a[0].localeCompare(b[0]));
  return sha(JSON.stringify(records));
}
export class MapSession {
  constructor({
    installation = 'C:/Program Files (x86)/StarCraft II',
    sources,
    conversionContext,
    parser = parseGalaxySource,
    maxAstBytes = 8 * 1024 ** 2,
    maxAstEntries = 12,
  } = {}) {
    this.installation = installation;
    this.sources = sources ?? new Sc2DesktopContentSources({ installationDirectory: installation });
    this.conversionContext = conversionContext ?? createTriggerConversionContext();
    this.parser = parser;
    this.contexts = new Set();
    this.targets = new WeakMap();
    this.dependencyFiles = new Map();
    this.cache = new Map();
    this.cacheBytes = 0;
    this.maxAstBytes = maxAstBytes;
    this.maxAstEntries = maxAstEntries;
    this.closed = false;
    this.stats = {
      contexts: [],
      parserHits: 0,
      parserMisses: 0,
      parserEvictions: 0,
      scope: 'one map; disposed before another map/process',
    };
  }
  assertOpen() {
    if (this.closed) throw Error('Map session is already disposed');
  }
  async open(request) {
    this.assertOpen();
    const start = performance.now();
    const context = await this.sources.openModContext(request);
    this.contexts.add(context);
    this.targets.set(context, request.target);
    this.stats.contexts.push({
      target: request.target,
      elapsedMs: performance.now() - start,
      chain: context.layers.map((l) => l.sourcePath ?? l.id),
      layers: context.layers,
      unresolved: context.unresolved ?? [],
    });
    // A map opened with omitted dependencies is not a valid conversion baseline.
    // Refuse before the first Trigger/variable lowering, including resource-only mods.
    if (context.unresolved?.length) {
      const error = Error('Unresolved dependency closure: ' + JSON.stringify(context.unresolved));
      error.code = 'SC2_DEPENDENCY_CLOSURE_UNRESOLVED';
      error.context = { target: request.target, unresolved: context.unresolved };
      throw error;
    }
    // CASC is guarded by .build.info. Physical mod/cache containers also get
    // same-session stamps so a dependency edited/downloaded mid-map fails closed.
    for (const layer of context.layers.slice(0, -1)) {
      if (layer.sourceId === 'local:casc') continue;
      const local = await this.sources.resolveLocalPath?.(layer.sourceId, layer.sourcePath);
      if (
        local &&
        ['file', 'directory'].includes(local.kind) &&
        !this.dependencyFiles.has(local.path)
      )
        this.dependencyFiles.set(local.path, { local, stamp: await dependencyStamp(local) });
    }
    return context;
  }
  async release(context) {
    if (this.contexts.has(context)) {
      this.contexts.delete(context);
      await context.dispose();
    }
  }
  async verifyDependencyFiles() {
    for (const [file, before] of this.dependencyFiles)
      if ((await dependencyStamp(before.local)) !== before.stamp)
        throw Error('Dependency container changed during map session: ' + file);
    return true;
  }
  async readPrimary(context, layerId, file, maximum) {
    this.assertOpen();
    if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > 256 * 1024 ** 2)
      throw Error('Invalid primary component read bound');
    try {
      return await context.read(layerId, file, maximum);
    } catch (error) {
      if (error.message !== 'Archive file exceeds the preview limit') throw error;
      const primary = context.layers.at(-1),
        target = this.targets.get(context);
      if (
        primary?.id !== layerId ||
        typeof target !== 'string' ||
        !/^.+\.sc2(?:map|mod)$/i.test(target) ||
        file.split(/[\\/]/).some((p) => !p || p === '..' || p === '.') ||
        path.isAbsolute(file)
      )
        throw error;
      const info = await stat(target);
      if (!info.isFile() || info.size > 1024 ** 3) throw error;
      const reader = await openMpqReader(await readFile(target), {
        maxArchiveBytes: 1024 ** 3,
        maxEntries: 100000,
        maxEntryBytes: 256 * 1024 ** 2,
      });
      try {
        const entry = reader.find(file);
        if (!entry || entry.size > maximum)
          throw Error('Primary component exceeds requested bound: ' + file);
        const bytes = await reader.read(entry.id);
        if (bytes.length > maximum)
          throw Error('Primary component exceeds requested bound: ' + file);
        const after = await stat(target);
        if (after.size !== info.size || after.mtimeMs !== info.mtimeMs)
          throw Error('Primary archive changed during bounded read');
        (this.stats.boundedPrimaryReads ??= []).push({
          path: file,
          bytes: bytes.length,
          sha256: sha(bytes),
          maximum,
          reason:
            'Full conversion component read; original source adapter has a 64 MiB preview limit',
        });
        return bytes;
      } finally {
        reader.dispose();
      }
    }
  }
  parseGalaxy = (text, fileName) => {
    this.assertOpen();
    const size = Buffer.byteLength(text),
      key = fileName + '\0' + sha(text);
    const previous = this.cache.get(key);
    if (previous) {
      this.stats.parserHits++;
      this.cache.delete(key);
      this.cache.set(key, previous);
      return previous.source;
    }
    this.stats.parserMisses++;
    const source = this.parser(text, fileName);
    // Source bytes bound retention; huge scripts are parsed but never retained.
    if (size <= this.maxAstBytes && this.maxAstEntries > 0) {
      while (
        this.cache.size &&
        (this.cache.size >= this.maxAstEntries || this.cacheBytes + size > this.maxAstBytes)
      ) {
        const first = this.cache.keys().next().value;
        this.cacheBytes -= this.cache.get(first).size;
        this.cache.delete(first);
        this.stats.parserEvictions++;
      }
      this.cache.set(key, { size, source });
      this.cacheBytes += size;
    }
    return source;
  };
  async installationStamp() {
    return sha(await readFile(path.join(this.installation, '.build.info')));
  }
  snapshot() {
    return {
      ...this.stats,
      activeContexts: this.contexts.size,
      dependencyStamps: this.dependencyFiles.size,
      astEntries: this.cache.size,
      astSourceBytes: this.cacheBytes,
      conversionCache: this.conversionContext?.stats(),
      disposed: this.closed,
    };
  }
  async dispose() {
    if (this.closed) return;
    this.closed = true;
    const errors = [];
    for (const context of this.contexts)
      try {
        await context.dispose();
      } catch (e) {
        errors.push(e);
      }
    this.contexts.clear();
    try {
      await this.sources.dispose();
    } catch (e) {
      errors.push(e);
    } finally {
      this.cache.clear();
      this.cacheBytes = 0;
      this.conversionContext.clear();
      this.dependencyFiles.clear();
      this.targets = new WeakMap();
      this.sources = undefined;
    }
    if (errors.length) throw new AggregateError(errors, 'Map session cleanup failed');
  }
}
