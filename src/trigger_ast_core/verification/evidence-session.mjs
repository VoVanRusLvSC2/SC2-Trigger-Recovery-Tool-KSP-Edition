// One bounded verification transaction. Shared JSON is immutable; every input
// is hashed again at seal. No state or verdict survives the session.
import assert from 'node:assert/strict';
import {stat, readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
const snapshot = async file => identity(await stat(file, {bigint: true}));
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export class EvidenceSession {
  #entries = new Map();
  #loading = new Map();
  #active = new Set();
  #closed = false;
  #failure;
  #maxEntries;
  #sealConcurrency;
  #metrics = {requests: 0, physicalHashes: 0, jsonParses: 0, reused: 0,
    sharedLoads: 0, sealHashes: 0, persistentCache: false};

  constructor({maxEntries = 16384, sealConcurrency = 4} = {}) {
    assert(Number.isSafeInteger(maxEntries) && maxEntries > 0);
    assert(Number.isSafeInteger(sealConcurrency) && sealConcurrency > 0 && sealConcurrency <= 16);
    this.#maxEntries = maxEntries;
    this.#sealConcurrency = sealConcurrency;
  }

  get metrics() { return {...this.#metrics}; }
  get maxEntries() { return this.#maxEntries; }
  get sealConcurrency() { return this.#sealConcurrency; }

  async #hash(file) {
    if ((await stat(file)).size <= 512 * 1024) return digest(await readFile(file));
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(file, {highWaterMark: 1024 ** 2})) hash.update(bytes);
    return hash.digest('hex');
  }

  #track(action) {
    assert(!this.#closed, 'VERIFICATION_SESSION_CLOSED');
    const pending = action();
    this.#active.add(pending);
    pending.then(() => this.#active.delete(pending), error => {
      this.#failure ??= error;
      this.#active.delete(pending);
    });
    return pending;
  }

  async #read(file, json, before, known) {
    const bytes = json ? await readFile(file) : undefined;
    const sha256 = bytes ? digest(bytes) : await this.#hash(file);
    this.#metrics.physicalHashes++;
    assert.equal(await snapshot(file), before, 'INPUT_CHANGED_WHILE_READING');
    if (known) assert.equal(sha256, known.sha256, 'INPUT_SHA_MISMATCH');
    const record = {identity: before, sha256, hasJson: json};
    if (json) {
      record.json = freeze(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, '')));
      this.#metrics.jsonParses++;
    }
    this.#entries.set(file, record);
    return record;
  }

  async #record(file, json) {
    for (;;) {
      const loading = this.#loading.get(file);
      if (loading) {
        this.#metrics.sharedLoads++;
        await loading;
        continue;
      }
      const before = await snapshot(file);
      // Another request may have reserved this file while stat was pending.
      if (this.#loading.has(file)) continue;
      const known = this.#entries.get(file);
      if (known) {
        assert.equal(before, known.identity, 'INPUT_METADATA_CHANGED_DURING_AUDIT');
        if (!json || known.hasJson) {
          this.#metrics.reused++;
          return known;
        }
      } else {
        assert(this.#entries.size + this.#loading.size < this.maxEntries, 'EVIDENCE_LIMIT_EXCEEDED');
      }
      const pending = this.#read(file, json, before, known);
      this.#loading.set(file, pending);
      try { return await pending; }
      finally { this.#loading.delete(file); }
    }
  }

  async #verify(file, expected, json) {
    if (expected !== undefined) assert.match(expected, /^[a-f0-9]{64}$/u);
    this.#metrics.requests++;
    const record = await this.#record(path.resolve(file), json);
    if (expected !== undefined) assert.equal(record.sha256, expected, 'INPUT_SHA_MISMATCH');
    return json ? record.json : record.sha256;
  }

  verify(file, expected) {
    return this.#track(async () => {
      assert.match(expected, /^[a-f0-9]{64}$/u);
      return this.#verify(file, expected, false);
    });
  }

  json(file, expected) { return this.#track(() => this.#verify(file, expected, true)); }

  async seal() {
    assert(!this.#closed, 'VERIFICATION_SESSION_CLOSED');
    this.#closed = true;
    try {
      await Promise.allSettled([...this.#active]);
      if (this.#failure) throw this.#failure;
      const entries = [...this.#entries];
      let next = 0;
      const workers = Array.from({length: Math.min(this.sealConcurrency, entries.length)}, async () => {
        while (next < entries.length) {
          const [file, saved] = entries[next++];
          assert.equal(await snapshot(file), saved.identity, 'SEALED_INPUT_METADATA_CHANGED');
          assert.equal(await this.#hash(file), saved.sha256, 'SEALED_INPUT_CHANGED');
          assert.equal(await snapshot(file), saved.identity, 'SEALED_INPUT_CHANGED_WHILE_HASHING');
          this.#metrics.sealHashes++;
        }
      });
      const results = await Promise.allSettled(workers);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      return {...this.#metrics, sealed: true, uniqueInputs: entries.length,
        sealConcurrency: this.sealConcurrency};
    } finally {
      this.#entries.clear();
      this.#loading.clear();
    }
  }
}
