/**
 * @module @modkitx/document
 *
 * Parsers and writers for SC2 archive metadata formats:
 *
 * - **DocumentHeader** — the `DocumentHeader` file inside every `.SC2Mod`,
 *   `.SC2Campaign`, and `.SC2Map`. Stores dependencies, entries (DocInfo,
 *   MapInfo, LoadingScreen tips), and SC2 build number.
 *
 * - **VersionFile** — the `<file>.version` sidecar for every named file in an
 *   SC2 archive. Tracks the SC2 build number, schema version, change count,
 *   and a content hash.
 *
 * @example DocumentHeader
 * ```ts
 * import { parseDocumentHeader, getDocumentInfo } from '@modkitx/documents-processing/sc2-metadata'
 * import { MpqReader } from '@modkitx/ext-blizzard-archives/codecs/mpq/src/index.js'
 *
 * const reader = await MpqReader.open(buffer)
 * const header = parseDocumentHeader(reader.read('DocumentHeader'))
 * console.log(getDocumentInfo(header))  // { Name: '...', Author: '...', ... }
 * ```
 *
 * @example VersionFile
 * ```ts
 * import { parseVersionFile, resolveTypeTag, writeVersionFile } from '@modkitx/documents-processing/sc2-metadata'
 *
 * const vf = parseVersionFile(reader.read('Triggers.version'))
 * console.log(resolveTypeTag(vf.typeTag))  // 'Triggers'
 * console.log(vf.buildNumber)              // e.g. 95841
 * console.log(`${vf.majorVersion}.${vf.minorVersion}.${vf.patchVersion}`)
 * console.log(vf.entryCount)               // component entry count
 *
 * const bytes = writeVersionFile({ versionPath: 'MapInfo.version', buildNumber: 95841 })
 * ```
 */
// -- DocumentHeader ----------------------------------------------------------
export { parseDocumentHeader, writeDocumentHeader, getDocumentInfo, getMapInfo, getLoadingScreenInfo, getEntriesByPattern, } from './document-header.js';
export { KNOWN_FLAGS, ENTRY_TYPES } from './types.js';
// -- DocumentInfo ------------------------------------------------------------
export { parseDocumentInfo, writeDocumentInfo, documentInfoDependencies, documentInfoPreloads, documentInfoValues, } from './document-info.js';
// -- VersionFile -------------------------------------------------------------
export { parseVersionFile, writeVersionFile, resolveTypeTag, typeTagFor, typeTagForVersionPath, TYPE_TAG_MAP, } from './version-file.js';
