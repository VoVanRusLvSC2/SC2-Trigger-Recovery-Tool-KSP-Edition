import { createHash, randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { openMpqReader } from '@modkit/blizzard-mpq/reader';
import { createMemorySource } from '@modkit/vfs';
import { BattleNetVfsError } from "../shared/errors.js";
export class BattleNetPublishOutcomeUnknownError extends BattleNetVfsError {
    operationId;
    constructor(operationId, cause) {
        super('blizzard.battlenet/publish-outcome-unknown', `Publication may have reached the server. Reconcile operation ${operationId} before retrying.`);
        this.operationId = operationId;
        this.name = 'BattleNetPublishOutcomeUnknownError';
        if (cause !== undefined)
            Object.defineProperty(this, 'cause', { value: cause });
    }
}
export class BattleNetPublishRejectedError extends BattleNetVfsError {
    operationId;
    reason;
    constructor(operationId, reason) {
        super('blizzard.battlenet/publish-rejected', `Publication rejected: ${reason}`);
        this.operationId = operationId;
        this.reason = reason;
        this.name = 'BattleNetPublishRejectedError';
    }
}
const invalid = (message) => {
    throw new BattleNetVfsError('blizzard.battlenet/invalid-publication-input', message);
};
const isU32 = (value) => Number.isInteger(value) && value > 0 && value <= 0xffffffff;
/** Internal orchestration shared by the single-profile and multi-account providers. */
export async function publishBattleNetArchive(options, region, limits, maxArchiveBytes, signal, backend) {
    signal.throwIfAborted();
    const operationId = options.operationId ?? randomUUID();
    if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(operationId))
        invalid('Invalid operationId');
    if (typeof options.filePath !== 'string' || !options.filePath || options.filePath.includes('\0'))
        invalid('A saved archive path is required');
    const extension = extname(options.filePath).toLowerCase();
    if (extension !== '.sc2map' && extension !== '.sc2mod')
        invalid('Choose a .SC2Map or .SC2Mod archive');
    if (typeof options.name !== 'string' || !options.name.trim() || options.name.length > 1024 || /[\u0000-\u001f]/u.test(options.name)) {
        invalid('A non-empty publication name of at most 1024 characters is required');
    }
    const locale = options.locale ?? 'enUS';
    if (!/^[a-z]{2}[A-Z]{2}$/u.test(locale))
        invalid('Locale must have the form enUS');
    if (options.description !== undefined && (typeof options.description !== 'string' ||
        Buffer.byteLength(options.description, 'utf8') > 65536 || options.description.includes('\0'))) {
        invalid('Description exceeds the input limit or contains NUL');
    }
    const target = options.target;
    if (!target || (target.mode !== 'create' && target.mode !== 'update'))
        invalid('Choose an explicit create or update target');
    if (target.mode === 'update' && (!isU32(target.id) || !isU32(target.expectedVersion)))
        invalid('Update requires an id and concrete expectedVersion');
    const visibility = options.visibility ?? 'private';
    const locked = options.locked ?? true;
    if (visibility !== 'private' && visibility !== 'public')
        invalid('Invalid publication visibility');
    if (typeof locked !== 'boolean')
        invalid('locked must be a boolean');
    // Pin caller-owned options before the first asynchronous operation.
    const selection = Object.freeze({
        operationId, region, kind: extension === '.sc2mod' ? 'mod' : 'map',
        name: options.name, locale, ...(options.description === undefined ? {} : { description: options.description }),
        target: Object.freeze(target.mode === 'create' ? { mode: 'create' }
            : { mode: 'update', id: target.id, expectedVersion: target.expectedVersion }),
        visibility, locked, fileName: basename(options.filePath),
        ...(options.packagePath === undefined ? {} : { packagePath: options.packagePath }),
        ...(options.packageSha256 === undefined ? {} : { packageSha256: options.packageSha256 }),
    });
    const filePath = options.filePath;
    const onProgress = options.onProgress;
    const notify = (event) => {
        // UI observers must not turn a confirmed publication into a failed/retried allocation.
        try {
            void Promise.resolve(onProgress?.(Object.freeze(event))).catch(() => undefined);
        }
        catch { /* observer failure is not a publish failure */ }
    };
    notify({ operationId, stage: 'preparing' });
    const maximum = Math.min(maxArchiveBytes, Number(limits.maxMaterializedBytes), Number(limits.maxFileBytes));
    const bytes = await readArchiveSnapshot(filePath, maximum, signal);
    const reader = await openMpqReader(bytes, {
        maxArchiveBytes: maximum, maxEntries: limits.maxEntries,
        maxEntryBytes: Math.min(maximum, 1024 ** 3), signal,
    });
    try {
        if (reader.recovered)
            invalid('A recovered MPQ needs an explicit repaired export before publication');
    }
    finally {
        reader.dispose();
    }
    signal.throwIfAborted();
    const archiveSha256 = createHash('sha256').update(bytes).digest('hex');
    const source = scopedPublishSource(`battlenet-publish:${operationId}`, bytes, limits, signal);
    let invoked = false;
    let reportProgress = true;
    try {
        signal.throwIfAborted();
        invoked = true;
        const reply = await backend(Object.freeze({
            ...selection, source, signal, archiveBytes: bytes.byteLength, archiveSha256,
            onProgress: (event) => {
                if (!reportProgress || signal.aborted || !event || !['allocating', 'uploading', 'verifying'].includes(event.stage))
                    return;
                const counters = [event.uploadedBytes, event.totalBytes];
                if (counters.some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 0)) ||
                    (event.uploadedBytes !== undefined && event.totalBytes !== undefined && event.uploadedBytes > event.totalBytes))
                    return;
                notify({ operationId, stage: event.stage,
                    ...(event.uploadedBytes === undefined ? {} : { uploadedBytes: event.uploadedBytes }),
                    ...(event.totalBytes === undefined ? {} : { totalBytes: event.totalBytes }),
                });
            },
        }));
        if (!reply || reply.operationId !== operationId || reply.region !== region)
            throw new BattleNetPublishOutcomeUnknownError(operationId);
        if (reply.status === 'rejected') {
            if (typeof reply.reason !== 'string' || !reply.reason || reply.reason.length > 4096)
                throw new BattleNetPublishOutcomeUnknownError(operationId);
            throw new BattleNetPublishRejectedError(operationId, reply.reason);
        }
        const item = reply.publication;
        if (reply.status !== 'published' || reply.serverRevisionVerified !== true || reply.archiveSha256 !== archiveSha256 ||
            !item || !isU32(item.id) || !isU32(item.version) || item.name !== selection.name ||
            item.isMod !== (selection.kind === 'mod') || item.private !== (visibility === 'private') || item.locked !== locked ||
            typeof item.headerHandle !== 'string' || !/^73326d68[0-9a-f]{72}$/iu.test(item.headerHandle) ||
            (selection.target.mode === 'update' && (item.id !== selection.target.id || item.version <= selection.target.expectedVersion))) {
            throw new BattleNetPublishOutcomeUnknownError(operationId);
        }
        // A confirmed server receipt wins a late local cancellation; cancellation cannot roll it back.
        const result = Object.freeze({
            status: 'published', operationId, region, archiveSha256, serverRevisionVerified: true,
            publication: Object.freeze({ id: item.id, version: item.version, name: item.name,
                isMod: item.isMod, private: item.private, locked: item.locked, headerHandle: item.headerHandle.toLowerCase() }),
        });
        notify({ operationId, stage: 'published' });
        return result;
    }
    catch (error) {
        if (!invoked || ((error instanceof BattleNetPublishRejectedError || error instanceof BattleNetPublishOutcomeUnknownError) &&
            error.operationId === operationId))
            throw error;
        throw new BattleNetPublishOutcomeUnknownError(operationId, error);
    }
    finally {
        reportProgress = false;
        await source.dispose();
    }
}
function scopedPublishSource(id, bytes, limits, signal) {
    const memory = createMemorySource(id, bytes);
    const size = bytes.byteLength;
    const active = (readSignal) => {
        const result = readSignal === undefined ? signal : AbortSignal.any([signal, readSignal]);
        result.throwIfAborted();
        return result;
    };
    const range = (offset, length) => {
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > size - offset) {
            throw new RangeError('Publication source read range is outside the snapshot');
        }
    };
    const source = {
        id,
        size: readSignal => memory.size(active(readSignal)),
        async readAt(offset, length, readSignal) {
            const current = active(readSignal);
            range(offset, length);
            if (length > limits.maxReadRangeBytes)
                throw new RangeError('Publication source read exceeds maxReadRangeBytes');
            const result = await memory.readAt(offset, length, current);
            current.throwIfAborted();
            return result;
        },
        stream(start = 0, end = size, readSignal) {
            const current = active(readSignal);
            range(start, end - start);
            if (BigInt(end - start) > limits.maxStreamBytes)
                throw new RangeError('Publication source stream exceeds maxStreamBytes');
            let position = start;
            return new ReadableStream({
                async pull(controller) {
                    await memory.size(active(current)); // Also guards streams retained beyond the borrowed source lifetime.
                    if (position === end) {
                        controller.close();
                        return;
                    }
                    const next = Math.min(position + Math.min(64 * 1024, limits.maxReadRangeBytes), end);
                    controller.enqueue(await source.readAt(position, next - position, current));
                    position = next;
                },
            }, { highWaterMark: 0 });
        },
        dispose: () => memory.dispose(),
    };
    return source;
}
async function readArchiveSnapshot(filePath, maximum, signal) {
    signal.throwIfAborted();
    const file = await open(filePath, 'r');
    try {
        const before = await file.stat({ bigint: true });
        signal.throwIfAborted();
        if (!before.isFile() || before.size <= 0n || before.size > BigInt(maximum))
            invalid('Archive must be a non-empty regular file within the configured size limit');
        const bytes = new Uint8Array(Number(before.size));
        let position = 0;
        while (position < bytes.length) {
            signal.throwIfAborted();
            const result = await file.read(bytes, position, Math.min(bytes.length - position, 1024 * 1024), position);
            if (!result.bytesRead)
                invalid('Archive changed while it was being read');
            position += result.bytesRead;
        }
        const after = await file.stat({ bigint: true });
        signal.throwIfAborted();
        if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs)
            invalid('Archive changed while it was being read');
        return bytes;
    }
    finally {
        await file.close();
    }
}
//# sourceMappingURL=publisher.js.map