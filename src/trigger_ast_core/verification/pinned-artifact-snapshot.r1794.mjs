import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const decoder = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true});

/** Hash pins establish byte identity, not the authority or meaning of evidence.
 * Parse exactly the authenticated bytes; never check a path and reread it later.
 * Each snapshot is invocation-local, with no persistent cache. */
export function createPinnedArtifactSnapshot({maxFileBytes=32*1024**2, maxTotalBytes=256*1024**2, maxFiles=2048, readBytes=readFile}={}) {
  for (const value of [maxFileBytes,maxTotalBytes,maxFiles]) assert(Number.isSafeInteger(value) && value>0, 'PIN_SNAPSHOT_POSITIVE_LIMIT_REQUIRED');
  assert(typeof readBytes==='function', 'PIN_SNAPSHOT_READER_REQUIRED');
  const files=new Map(); let total=0;
  const identify = pin => {
    assert(pin && typeof pin.path==='string' && path.isAbsolute(pin.path), 'PIN_SNAPSHOT_ABSOLUTE_PATH_REQUIRED');
    assert(typeof pin.sha256==='string' && /^[a-f0-9]{64}$/.test(pin.sha256), 'PIN_SNAPSHOT_SHA256_REQUIRED');
    const file=path.resolve(pin.path), key=process.platform==='win32' ? file.toLowerCase() : file;
    return Object.freeze({path:file,key,sha256:pin.sha256});
  };
  const load = pin => {
    const wanted=identify(pin), previous=files.get(wanted.key);
    if (previous) { assert.equal(previous.pin.sha256,wanted.sha256,'PIN_SNAPSHOT_CONFLICTING_PATH'); return previous.bytes; }
    assert(files.size<maxFiles,'PIN_SNAPSHOT_FILE_LIMIT');
    // Capture pin before the first await; retain failure as a failed transaction.
    const bytes=Promise.resolve().then(()=>readBytes(wanted.path)).then(input=>{
      assert(input instanceof Uint8Array,'PIN_SNAPSHOT_BYTES_REQUIRED');
      const copy=Buffer.from(input);
      assert(copy.length<=maxFileBytes,'PIN_SNAPSHOT_FILE_BYTE_LIMIT');
      assert.equal(digest(copy),wanted.sha256,'PIN_SNAPSHOT_HASH_MISMATCH');
      assert(total+copy.length<=maxTotalBytes,'PIN_SNAPSHOT_TOTAL_BYTE_LIMIT');
      total+=copy.length; return copy;
    });
    files.set(wanted.key,{pin:wanted,bytes}); return bytes;
  };
  return Object.freeze({
    async bytes(pin) { return Buffer.from(await load(pin)); },
    async text(pin) { return decoder.decode(await load(pin)); },
    async json(pin) { return JSON.parse(decoder.decode(await load(pin))); },
    async verifyCurrent() {
      // This is a new observation, never a replacement of authenticated bytes.
      const entries=[...files.values()];
      for (const entry of entries) {
        await entry.bytes;
        assert.equal(digest(await readBytes(entry.pin.path)),entry.pin.sha256,'PIN_SNAPSHOT_CURRENT_BYTES_CHANGED');
      }
      assert.equal(files.size,entries.length,'PIN_SNAPSHOT_INVENTORY_CHANGED_DURING_RECHECK');
      return Object.freeze({files:entries.length,bytes:total,currentBytesMatch:true});
    },
    async receipt() {
      const entries=[...files.values()]; await Promise.all(entries.map(entry=>entry.bytes));
      assert.equal(files.size,entries.length,'PIN_SNAPSHOT_INVENTORY_CHANGED_DURING_RECEIPT');
      return Object.freeze({kind:'AUTHENTICATED_BYTE_SNAPSHOT',files:Object.freeze(entries.map(({pin})=>Object.freeze({path:pin.path,sha256:pin.sha256}))),bytes:total,authorityEstablished:false});
    },
  });
}
