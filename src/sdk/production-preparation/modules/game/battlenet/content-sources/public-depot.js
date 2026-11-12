/**
 * The public half of Battle.net content, without a native runtime.
 *
 * Reading a published map or mod needs two answers: which archive a publication points at, and
 * the archive's bytes. Both are already determined by data we hold. A publication carries its
 * header's `CacheHandle40` — four bytes of type, four of region, thirty-two of SHA-256 — so the
 * header addresses itself; the header names its archive the same way; and the depot serves both
 * over ordinary HTTPS at `<region>-s2-depot.classic.blizzard.com/<sha256>.<type>`.
 *
 * So this needs no account, no browser and no out-of-process helper. What it cannot do is list an
 * account's own publications or search the catalogue by name: those are answered by the game's
 * service, not by the depot, and they stay with the native backend.
 *
 * The local Battle.net cache is consulted first, which also makes everything the game has already
 * downloaded readable with no network at all.
 */
import { createHash } from 'node:crypto';
import { decodeBlizzardCacheHandle } from '@modkit/blizzard-common-formats/content-address/cache-handle';
import { decodeCacheHeader, field, blob, number, reference } from "./cache-header.js";
import { readBounded } from "./local-files.js";
/** Depot archives are bounded: a published map or mod is not a streaming source. */
const MAXIMUM_HEADER_BYTES = 8 * 1024 * 1024;
const MAXIMUM_ARCHIVE_BYTES = 512 * 1024 * 1024;
const DOWNLOAD_CHUNK_BYTES = 1024 * 1024;
const MAXIMUM_REDIRECTS = 3;
const HEX = /^[a-f0-9]{64}$/u;
/** Depot file types: map parts (s2mh, s2mv, s2ml...) and the files profiles name (unlk, ldpt, wafl...). */
const DEPOT_FILES = /^[A-Za-z0-9]{4}$/u;
/** Cache layout: `<root>/<first two>/<next two>/<sha256>.<type>`. */
function cachePath(file) {
    return `${file.slice(0, 2)}/${file.slice(2, 4)}/${file}`;
}
function depotUrl(region, file) {
    const normalized = region.trim().toLowerCase();
    if (!/^[a-z0-9]{2,4}$/u.test(normalized)) {
        throw new Error(`Battle.net depot region is not usable: ${region}`);
    }
    return `https://${normalized}-s2-depot.classic.blizzard.com/${file}`;
}
/** Decode a hex `CacheHandle40`, as a publication carries for its header and a header for its parts. */
function handleReference(handle) {
    if (!/^[a-f0-9]{80}$/iu.test(handle)) {
        throw new Error('Cache handle is not 40 bytes');
    }
    const bytes = new Uint8Array(40);
    for (let index = 0; index < 40; index += 1) {
        bytes[index] = Number.parseInt(handle.slice(index * 2, index * 2 + 2), 16);
    }
    // A component handle comes from the protocol or a header, not from scanning blobs: any depot type.
    const decoded = decodeBlizzardCacheHandle(bytes, { types: DEPOT_FILES });
    if (decoded === undefined)
        throw new Error('Cache handle does not address a depot component');
    return { region: decoded.region, sha256: decoded.sha256, file: decoded.file, type: decoded.type };
}
function headerReference(headerHandle) {
    const decoded = handleReference(headerHandle);
    if (decoded.type !== 's2mh')
        throw new Error('Publication header handle does not address a map header');
    return decoded;
}
export function createPublicDepotApi(options = {}) {
    const call = options.fetch ?? globalThis.fetch;
    const timeoutMs = options.requestTimeoutMs ?? 120_000;
    const fromCache = async (file, limit) => {
        if (options.cacheDirectory === undefined)
            return undefined;
        try {
            return await readBounded(options.cacheDirectory, cachePath(file), Math.min(limit, 256 * 1024 * 1024), file.slice(0, 64));
        }
        catch {
            return undefined;
        }
    };
    const fromDepot = async (region, file, limit, signal) => {
        if (call === undefined)
            throw new Error('No fetch implementation is available for the depot');
        let url = depotUrl(region, file);
        const origin = new URL(url).hostname;
        for (let redirect = 0; redirect <= MAXIMUM_REDIRECTS; redirect += 1) {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
                ![origin, origin.replace('-s2-depot.', '-s2-depot-storage.')].includes(parsed.hostname)) {
                throw new Error('Unexpected Blizzard depot redirect');
            }
            const response = await call(url, {
                redirect: 'manual',
                signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
            });
            const location = response.headers.get('location');
            if (response.status >= 300 && response.status < 400 && location !== null) {
                await response.body?.cancel();
                url = new URL(location, url).toString();
                continue;
            }
            if (!response.ok) {
                await response.body?.cancel();
                throw new Error(`The Battle.net depot refused ${file}: ${String(response.status)}`);
            }
            const declared = Number(response.headers.get('content-length') ?? '0');
            if (Number.isFinite(declared) && declared > limit) {
                await response.body?.cancel();
                throw new Error(`${file} exceeds the ${String(limit)}-byte depot limit`);
            }
            if (!response.body)
                throw new Error('Empty Blizzard depot response');
            const reader = response.body.getReader();
            const chunks = [];
            let size = 0;
            try {
                while (true) {
                    signal.throwIfAborted();
                    const chunk = await reader.read();
                    if (chunk.done)
                        break;
                    size += chunk.value.byteLength;
                    if (size > limit)
                        throw new Error(`${file} exceeds the ${String(limit)}-byte depot limit`);
                    chunks.push(chunk.value);
                }
            }
            finally {
                await reader.cancel();
                reader.releaseLock();
            }
            const bytes = Buffer.concat(chunks, size);
            if (createHash('sha256').update(bytes).digest('hex') !== file.slice(0, 64))
                throw new Error('Blizzard depot SHA-256 mismatch');
            return bytes;
        }
        throw new Error(`The Battle.net depot redirected ${file} too many times`);
    };
    const read = async (region, file, limit, signal) => (await fromCache(file, limit)) ?? (await fromDepot(region, file, limit, signal));
    return {
        async readComponent(request) {
            request.signal.throwIfAborted();
            const decoded = handleReference(request.handle);
            const region = decoded.region === '' ? request.region : decoded.region;
            const limit = Math.min(request.maximumBytes ?? MAXIMUM_HEADER_BYTES, MAXIMUM_ARCHIVE_BYTES);
            return read(region, decoded.file, limit, request.signal);
        },
        async resolveArchive(request) {
            request.signal.throwIfAborted();
            const header = headerReference(request.publication.headerHandle);
            // The handle states its own region; the request's region is the fallback for old records.
            const region = header.region === '' ? request.region : header.region;
            const bytes = await read(region, header.file, MAXIMUM_HEADER_BYTES, request.signal);
            const identity = field(decodeCacheHeader(bytes), 0);
            const handle = field(identity, 0);
            if (number(field(handle, 0)) !== request.publication.id || number(field(handle, 1)) !== request.publication.version) {
                throw new Error('Map header identity differs from the selected publication');
            }
            const archive = reference(blob(field(identity, 2)));
            if (archive === undefined || archive.type !== 's2ma' || !HEX.test(archive.sha256)) {
                throw new Error('The map header names no archive on the depot');
            }
            const depotRegion = archive.region.toLowerCase();
            return { sha256: archive.sha256, kind: 'mpq',
                ...(depotRegion && depotRegion !== request.region ? { depotRegion } : {}) };
        },
        async *downloadArchive(request) {
            request.signal.throwIfAborted();
            if (!HEX.test(request.archive.sha256))
                throw new Error('Invalid depot archive SHA-256');
            const file = `${request.archive.sha256}.s2ma`;
            const bytes = await read(request.archive.depotRegion ?? request.region, file, MAXIMUM_ARCHIVE_BYTES, request.signal);
            // Chunked so a consumer can cancel between pieces, as the native backend's stream does.
            for (let at = 0; at < bytes.byteLength; at += DOWNLOAD_CHUNK_BYTES) {
                request.signal.throwIfAborted();
                yield bytes.subarray(at, Math.min(at + DOWNLOAD_CHUNK_BYTES, bytes.byteLength));
            }
        },
    };
}
//# sourceMappingURL=public-depot.js.map