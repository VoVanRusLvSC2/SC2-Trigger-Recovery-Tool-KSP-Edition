import { decodeBlizzardCacheHandle } from '@modkit/blizzard-common-formats/content-address/cache-handle';
import { decodeReplayHeaderPayload, decodeReplayInitData, loadProtocol, } from '@modkit/blizzard-common-formats/s2protocol';
import { openMpqReader } from '@modkit/blizzard-mpq/reader';
const GAME_ID = 'blizzard/starcraft-2';
const SOURCE_PATH = 'replay.initData.m_syncLobbyState.m_gameDescription.m_cacheHandles';
const MAX_HANDLES = 256;
function recordOf(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}
function replayCacheHandles(initData) {
    const root = recordOf(initData);
    const lobby = recordOf(root?.m_syncLobbyState);
    const description = recordOf(lobby?.m_gameDescription);
    return description?.m_cacheHandles;
}
/** Convert exact replay cache handles into host-resolvable, source-independent dependencies. */
export function replayDependencySet(initData) {
    const values = replayCacheHandles(initData);
    if (values === undefined) {
        return Object.freeze({
            schemaVersion: 1,
            gameId: GAME_ID,
            source: SOURCE_PATH,
            complete: false,
            dependencies: Object.freeze([]),
            diagnostics: Object.freeze([Object.freeze({
                    code: 'blizzard/sc2-replay-cache-handles-unavailable',
                    severity: 'warning',
                    message: 'Decoded replay initialization data has no cache-handle list.',
                })]),
        });
    }
    if (!Array.isArray(values))
        throw new TypeError('replay cache handles must be an array');
    if (values.length > MAX_HANDLES)
        throw new RangeError(`replay cache handles exceed ${MAX_HANDLES}`);
    const dependencies = [];
    const diagnostics = [];
    const seen = new Set();
    for (let index = 0; index < values.length; index += 1) {
        const handle = decodeBlizzardCacheHandle(values[index]);
        if (handle === undefined) {
            diagnostics.push(Object.freeze({
                code: 'blizzard/sc2-replay-cache-handle-invalid',
                severity: 'warning',
                index,
                message: `Replay cache handle ${index} is malformed or unsupported.`,
            }));
            continue;
        }
        const id = `${handle.type}:${handle.region.toLowerCase()}:${handle.sha256}`;
        if (seen.has(id))
            continue;
        seen.add(id);
        dependencies.push(Object.freeze({
            id,
            kind: 'content-archive',
            required: true,
            order: index,
            state: 'unresolved',
            handle,
        }));
    }
    return Object.freeze({
        schemaVersion: 1,
        gameId: GAME_ID,
        source: SOURCE_PATH,
        complete: diagnostics.length === 0,
        dependencies: Object.freeze(dependencies),
        diagnostics: Object.freeze(diagnostics),
    });
}
const REPLAY_LIMITS = Object.freeze({
    maxArchiveBytes: 256 * 1024 * 1024,
    maxEntries: 64,
    maxEntryBytes: 64 * 1024 * 1024,
});
const DECODE_LIMITS = Object.freeze({
    maxDepth: 64,
    maxNodes: 1_000_000,
    maxEvents: 1_000_000,
    maxScalarBytes: 64 * 1024 * 1024,
});
/**
 * The cache archives a replay file depends on, read from its bytes: the MPQ header's replay
 * version selects the protocol that decodes `replay.initdata`. The replay codec answers the same
 * set from its own decoded streams; the mod loader uses this to open a replay inside its archives.
 */
export async function readReplayDependencySet(bytes, signal) {
    const reader = await openMpqReader(bytes, { ...REPLAY_LIMITS, ...(signal === undefined ? {} : { signal }) });
    try {
        if (reader.preamble === undefined)
            throw new TypeError('not a StarCraft II replay: the MPQ has no user data');
        const options = { ...DECODE_LIMITS, ...(signal === undefined ? {} : { signal }) };
        const header = decodeReplayHeaderPayload(reader.preamble, options);
        const entry = reader.entries.find(item => item.path.toLowerCase() === 'replay.initdata');
        if (entry === undefined)
            return replayDependencySet(undefined);
        const { protocol } = await loadProtocol(header.version.baseBuild, options);
        return replayDependencySet(decodeReplayInitData(await reader.read(entry.id, signal), protocol, options));
    }
    finally {
        reader.dispose();
    }
}
//# sourceMappingURL=cache-handles.js.map