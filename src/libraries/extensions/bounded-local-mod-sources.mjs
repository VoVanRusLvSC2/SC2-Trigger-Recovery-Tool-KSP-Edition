/** Session-local large MPQ containers. Component preview limits remain unchanged.
 * The SDK folder and package adapters retain their confinement and identity rules.
 * Only the archive reader is replaced for configured local mod folders; no global
 * SDK changes or cache survives this sources instance. One reader per folder,
 * serialized operations and eviction prevent disposing an in-flight read.
 */
import { open, lstat } from 'node:fs/promises';
import { openMpqReader } from '../../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import {
  confined,
  MAX_FILE,
} from '../../sdk/private-switch/modules/game/battlenet/content-sources/local-files.js';
import { LocalDependencySources } from '../../archive/local-dependency-sources.mjs';
import { createHash } from 'node:crypto';
export const MAX_MOD_ARCHIVE_BYTES = 1024 ** 3;
export class BoundedModArchives {
  current;
  queue = Promise.resolve();
  closed = false;
  use(root, path, hash, action) {
    const task = this.queue.then(async () => {
      if (this.closed) throw Error('Local source is closed');
      const location = await confined(root, path),
        info = await lstat(location);
      const key = `${location}:${info.size}:${info.mtimeMs}:${hash ?? ''}`;
      if (this.current?.key !== key) {
        this.current?.reader.dispose();
        this.current = undefined;
        const file = await open(location, 'r');
        let bytes;
        try {
          const before = await file.stat();
          if (!before.isFile() || before.size > MAX_MOD_ARCHIVE_BYTES)
            throw Error('Local mod exceeds the bounded archive limit');
          bytes = new Uint8Array(before.size);
          let offset = 0;
          while (offset < bytes.length) {
            const r = await file.read(bytes, offset, bytes.length - offset, offset);
            if (!r.bytesRead) throw Error('Local mod changed during reading');
            offset += r.bytesRead;
          }
          const after = await file.stat();
          if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw Error('Local mod changed during reading');
          if (hash && createHash('sha256').update(bytes).digest('hex') !== hash)
            throw Error('Local mod SHA-256 mismatch');
        } finally {
          await file.close();
        }
        const reader = await openMpqReader(bytes, {
          maxArchiveBytes: MAX_MOD_ARCHIVE_BYTES,
          maxEntries: 100000,
          maxEntryBytes: MAX_FILE,
        });
        this.current = { key, reader };
      }
      try {
        return await action(this.current.reader);
      } finally {
        if (this.current.reader.retainedBytes > MAX_MOD_ARCHIVE_BYTES) {
          this.current.reader.dispose();
          this.current = undefined;
        }
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  async refresh() {
    await this.queue;
    this.current?.reader.dispose();
    this.current = undefined;
  }
  async dispose() {
    this.closed = true;
    await this.refresh();
  }
}
export class BoundedLocalModSources extends LocalDependencySources {
  constructor(options) {
    super(options);
    for (const [id, source] of this.locals) {
      if (!/^local:mods:\d+$/u.test(id)) continue;
      // Constructor has not opened any archive. The package storage captures this
      // same source, so replacing its reader also fixes all loader storage reads.
      source.archives = new BoundedModArchives();
    }
  }
}
