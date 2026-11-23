import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readOwnedGuiLibraries } from '../verification/read-owned-gui-libraries.mjs';
import { recoveryTextSha256 as sha } from '../utilities/recovery-parse-scope.mjs';
import { blizzardPackageIndex } from './blizzard-package-index.mjs';

const stockPackage = /^(?:mods|campaigns)\/[^/]+\.sc2(?:mod|campaign)(?:\/|$)/iu;
const libraryFile =
  /^(?:triggers|base\.sc2data\/(?:.+\.galaxy|triggerlibs\/(?:librarylist\.xml|.+\.(?:triggerlib|sc2lib)))|[a-z]{4}\.sc2data\/localizeddata\/(?:trigger|game)strings\.txt)$/iu;
const maxLibraryBytes = 24 * 1024 ** 2;
const documentKey = (path, digest) => JSON.stringify([path, digest]);

/** Reuse only installed Blizzard data. Each job still mounts its own map. */
export class BlizzardLibraryCache {
  #source;
  #identity;
  #files = new Map();
  #fileBytes = 0;
  #verificationEpoch = 0;
  #verifying = false;
  #directories = new Map();
  #directoryEntries = 0;
  #owners = new Map();
  #validatedMountedOwners = new Map();
  #pendingMountedOwners = new Map();
  #emptyDocuments = new Map();
  #compilerInitializers;
  #catalogAnalysis;
  #expectedBuild;

  constructor({ expectedBuild } = {}) {
    this.#expectedBuild = expectedBuild;
  }

  confirmBuild(digest) {
    if (this.#expectedBuild)
      assert.equal(
        digest,
        this.#expectedBuild,
        'Installed Blizzard libraries changed before recovery',
      );
  }

  attach(sources) {
    const current = sources.locals.get('local:casc');
    if (!current) return;
    const { storageOf, revision } = current.root;
    if (!revision) return;
    const identity = JSON.stringify([storageOf, revision]);
    this.#identity ??= identity;
    assert.equal(identity, this.#identity, 'Installed Blizzard libraries changed during recovery');
    const source = (this.#source ??= current);
    const cachedSource = {
      get root() {
        return source.root;
      },
      list: async (name) => {
        if (!stockPackage.test(name)) return source.list(name);
        const cached = this.#directories.get(name);
        if (cached) return cached.map((entry) => ({ ...entry }));
        const entries = await source.list(name);
        if (
          !this.#directories.has(name) &&
          this.#directories.size < 512 &&
          this.#directoryEntries + entries.length <= 24000
        ) {
          this.#directories.set(
            name,
            entries.map((entry) => ({ ...entry })),
          );
          this.#directoryEntries += entries.length;
        }
        return entries;
      },
      read: async (name, maximum) => {
        const match = stockPackage.exec(name);
        if (!match || !libraryFile.test(name.slice(match[0].length)))
          return source.read(name, maximum);
        const key = JSON.stringify([name, maximum]);
        const cached = this.#files.get(key);
        if (cached && (!this.#verifying || cached.epoch === this.#verificationEpoch))
          return cached.bytes.slice();
        const bytes = await source.read(name, maximum);
        const previous = this.#files.get(key);
        if (previous && this.#verifying && previous.epoch === this.#verificationEpoch) return bytes;
        if (previous) {
          this.#files.delete(key);
          this.#fileBytes -= previous.bytes.byteLength;
        }
        if (this.#files.size < 512 && this.#fileBytes + bytes.byteLength <= maxLibraryBytes) {
          this.#files.set(key, { bytes: Uint8Array.from(bytes), epoch: this.#verificationEpoch });
          this.#fileBytes += bytes.byteLength;
        }
        return bytes;
      },
      files: (...args) => source.files(...args),
      packageIndex: (name) =>
        typeof source.open === 'function' &&
        /^(?:mods|campaigns)\/[^/]+\.sc2(?:mod|campaign)$/iu.test(name)
          ? blizzardPackageIndex(source, name, cachedSource.read)
          : undefined,
      resolveLocalPath: (...args) => source.resolveLocalPath(...args),
      refresh: (...args) => source.refresh(...args),
      dispose: async () => {},
    };
    sources.locals.set('local:casc', cachedSource);
  }

  beginPreparation() {
    this.#verifying = false;
    this.#pendingMountedOwners.clear();
  }

  beginVerification() {
    // The authority check must observe live installed library bytes.
    this.#verifying = true;
    this.#verificationEpoch++;
  }

  catalogOwners(digest, xml) {
    const previous = this.#owners.get(digest);
    if (previous) return previous;
    const owners = [...readOwnedGuiLibraries(xml, 'Map', { retainSource: false }).keys()];
    if (this.#owners.size >= 128) this.#owners.delete(this.#owners.keys().next().value);
    this.#owners.set(digest, owners);
    return owners;
  }

  classifyInstalledDocument(digest, classify) {
    const entry = this.#emptyDocuments.get(digest);
    if (entry) return entry.installed;
    const installed = classify();
    if (this.#emptyDocuments.size >= 128)
      this.#emptyDocuments.delete(this.#emptyDocuments.keys().next().value);
    this.#emptyDocuments.set(digest, { installed });
    return installed;
  }

  classifyPreparedDocument(document, classify) {
    const { triggerData } = document;
    const entry = triggerData.isWellFormed() && this.#emptyDocuments.get(sha(triggerData));
    if (!entry) return classify();
    // Preparation and authority use different XML readers.
    return (entry.prepared ??= classify());
  }

  #verifiedInitializerIdentity(metadata, authority) {
    const stock = new Set(authority.files.map(({ path, sha256 }) => documentKey(path, sha256)));
    const keys = metadata.map(({ fileName, sha256 }) => documentKey(fileName, sha256));
    if (keys.every((key) => stock.has(key)))
      return JSON.stringify([authority.buildIdentity.buildInfoSha256, ...keys]);
  }

  compilerInitializers(metadata, authority, analyze) {
    const identity = this.#verifiedInitializerIdentity(metadata, authority);
    return identity === undefined ? analyze() : this.#initializersFor(identity, analyze);
  }

  preloadCompilerInitializers(metadata, analyze) {
    if (!this.#expectedBuild) return;
    const keys = metadata.map(({ fileName, sha256 }) => documentKey(fileName, sha256));
    this.#initializersFor(JSON.stringify([this.#expectedBuild, ...keys]), analyze);
  }

  #initializersFor(identity, analyze) {
    if (this.#compilerInitializers?.identity !== identity)
      this.#compilerInitializers = { identity, value: analyze() };
    return this.#compilerInitializers.value;
  }

  startCompilerInitializers(metadata, authority) {
    const identity = this.#verifiedInitializerIdentity(metadata, authority);
    if (!identity || this.#compilerInitializers?.identity === identity) return;
    let worker;
    try {
      worker = new Worker(new URL('./stock-initializers-worker.mjs', import.meta.url), {
        workerData: metadata,
      });
    } catch {
      return;
    }
    const analyzed = Promise.withResolvers();
    const native = Promise.withResolvers();
    worker.on('message', (message) => {
      if (message.type === 'native-catalog') native.resolve(message);
      if (message.type === 'native-finished') native.resolve(undefined);
      if (message.type === 'initializers') analyzed.resolve(message.value);
    });
    const finish = () => {
      native.resolve(undefined);
      analyzed.resolve(undefined);
    };
    worker.once('error', finish);
    worker.once('exit', finish);
    return {
      nativeCatalog: async (sha256) => {
        const message = await native.promise;
        if (message?.sha256 === sha256) return message.catalog;
      },
      ready: async () => {
        const value = await analyzed.promise;
        if (value) this.#compilerInitializers = { identity, value };
      },
      dispose: () => worker.terminate(),
    };
  }

  mountedOwners(document) {
    const strings = document.triggerStrings ?? '';
    if (!strings.isWellFormed() || !document.triggerData.isWellFormed()) return;
    const stockKey = JSON.stringify([document.sourcePath, sha(document.triggerData)]);
    const key = JSON.stringify([stockKey, sha(strings)]);
    return {
      owners: this.#validatedMountedOwners.get(key),
      remember: (owners) => {
        if (this.#pendingMountedOwners.size < 128 && owners.length <= 2048)
          this.#pendingMountedOwners.set(key, { stockKey, owners });
      },
    };
  }

  confirmMountedOwners(verifiedCatalogs) {
    const stock = new Set(
      verifiedCatalogs.map(({ path, sha256 }) => JSON.stringify([path, sha256])),
    );
    for (const [key, row] of this.#pendingMountedOwners) {
      if (!stock.has(row.stockKey)) continue;
      if (this.#validatedMountedOwners.size >= 128)
        this.#validatedMountedOwners.delete(this.#validatedMountedOwners.keys().next().value);
      this.#validatedMountedOwners.set(key, row.owners);
    }
    this.#pendingMountedOwners.clear();
  }

  analyzeStockCatalogs(identity, part, analyze) {
    if (this.#catalogAnalysis?.identity !== identity)
      this.#catalogAnalysis = { identity, parts: new Map() };
    const { parts } = this.#catalogAnalysis;
    if (!parts.has(part)) parts.set(part, analyze());
    return parts.get(part);
  }

  async dispose() {
    this.#files.clear();
    this.#fileBytes = 0;
    this.#directories.clear();
    this.#owners.clear();
    this.#validatedMountedOwners.clear();
    this.#pendingMountedOwners.clear();
    this.#catalogAnalysis = undefined;
    this.#emptyDocuments.clear();
    this.#compilerInitializers = undefined;
    this.#directoryEntries = 0;
    await this.#source?.dispose();
    this.#source = undefined;
    this.#identity = undefined;
  }
}
