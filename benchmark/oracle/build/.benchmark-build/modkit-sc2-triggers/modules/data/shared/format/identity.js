/**
 * Shared identity constants for the SC2 data codec.
 *
 * Kept in one module so detection, the document, and the descriptor never disagree about a
 * stable ID, mirroring `mods-processing`'s `sc2-mod/identity.ts`.
 */
/** Stable game codec ID. A display name ("StarCraft II") is never an identity. */
export const SC2_GAME_ID = 'starcraft-2';
/** Stable codec ID of the data artifact codec (`AssetIdentity.pluginId`/`formatId`). */
export const SC2_DATA_CODEC_ID = 'sc2-data';
/** Version reported as `AssetIdentity.pluginVersion`; tracks this package's version. */
export const SC2_DATA_CODEC_VERSION = '0.1.0';
/**
 * Parent artifact codec IDs that make a `Catalog` XML file SC2 GameData rather than an
 * arbitrary `.xml`. Verbatim from the canonical `sc2-data` manifest's
 * `match.parentArtifacts` (architecture section 5.8).
 */
export const SC2_DATA_PARENT_ARTIFACTS = ['sc2-mod', 'sc2-map', 'sc2-campaign'];
/**
 * The manifest's `match.xmlRoots`. Real GameData wraps entities in `<Catalog>`; the
 * structural probe treats this as the primary marker, never the `.xml` extension.
 */
export const SC2_DATA_XML_ROOT = 'Catalog';
/** The manifest's `match.pathGlobs`, expressed as the equivalent test. */
const GAME_DATA_PATH_RE = /(^|\/)gamedata\/[^/]+\.xml$/i;
/** Whether a forward-slashed logical path matches the manifest's `**\/GameData/*.xml` glob. */
export function isGameDataPath(path) {
    return GAME_DATA_PATH_RE.test(path.replace(/\\/g, '/'));
}
/** Basename of a logical path, e.g. `Mods/Core.SC2Mod/GameData/UnitData.xml` -> `UnitData.xml`. */
export function dataBasename(path) {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    return normalized.slice(normalized.lastIndexOf('/') + 1);
}
