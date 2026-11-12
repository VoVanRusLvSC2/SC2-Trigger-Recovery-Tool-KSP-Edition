/**
 * The resolved data catalog of a mod context, built where the context lives and handed out a few
 * entities at a time.
 *
 * It is the Data language's own analysis (`analyzeStarcraft2ResolvedData`) over the GameData files
 * of the context's layers, in load order — the same catalogs the Data provider plans — so an entity
 * reads the same here as in a card or a table. Whole, it is ~48k entities and a quarter of a
 * gigabyte as JSON for a melee map: never a message, only an index kept in this process.
 */
import { analyzeStarcraft2ResolvedData } from '../../../data/services/catalog/provider.js';
import { STARCRAFT2_CATALOG_FILES } from '../../../data/services/schema/full-data-schema.js';
import { gameDataIncludePaths } from '../../../data/shared/catalog-engine/gamedata-order.js';
/** A catalog entity's lookup key. */
export const catalogKey = (namespace, entityId) => `${namespace}\u0000${entityId}`;
const MAXIMUM_DOCUMENT_BYTES = 64 * 1024 * 1024;
const decoder = new TextDecoder();
const GAME_DATA_INCLUDES = 'base.sc2data/gamedata.xml';
/**
 * Catalogs a package names in its `Base.SC2Data/GameData.xml` (`<Includes><Catalog path=…/>`),
 * beyond the standard catalog files, in declared order. The game loads a map's or mod's own
 * catalog files only through this list, so a custom `GameData/*.xml` exists for it exactly when
 * the package includes it; a named file the layer does not hold is skipped.
 */
async function includedCatalogs(layerId, files, standard, read) {
    const slash = (value) => value.split(String.fromCharCode(92)).join('/');
    const byPath = new Map(files.map(file => [slash(file).toLowerCase(), file]));
    const declaration = byPath.get(GAME_DATA_INCLUDES);
    if (declaration === undefined)
        return [];
    const text = decoder.decode(await read(layerId, declaration, MAXIMUM_DOCUMENT_BYTES));
    const included = [];
    const seen = new Set();
    for (const path of gameDataIncludePaths(text)) {
        const key = `base.sc2data/${path}`.toLowerCase();
        const file = byPath.get(key);
        if (file === undefined || standard.has(key) || seen.has(key))
            continue;
        seen.add(key);
        included.push(file);
    }
    return included;
}
export async function buildContextCatalog(options) {
    const wanted = new Map(STARCRAFT2_CATALOG_FILES.map((file, order) => [`base.sc2data/gamedata/${file.toLowerCase()}`, order]));
    const documents = [];
    for (const layer of options.layers) {
        const files = await options.files(layer.id);
        const catalogs = files
            .filter(file => wanted.has(file.toLowerCase()))
            .sort((left, right) => wanted.get(left.toLowerCase()) - wanted.get(right.toLowerCase()));
        const included = await includedCatalogs(layer.id, files, wanted, options.read);
        for (const file of [...catalogs, ...included]) {
            const bytes = await options.read(layer.id, file, MAXIMUM_DOCUMENT_BYTES);
            documents.push({ rootId: layer.rootId, path: `${layer.sourcePath}/${file}`, text: decoder.decode(bytes) });
        }
    }
    const snapshot = (await analyzeStarcraft2ResolvedData({
        workspaceId: options.workspaceId,
        gameId: 'blizzard/starcraft-2',
        documents,
        queries: [],
        plannedDocumentCount: Math.max(1, documents.length),
        unresolvedRequirementIds: [],
        maxDocuments: 16_384,
        maxTextBytes: 536_870_912,
        maxEntities: 100_000,
        maxDepth: 64,
    }));
    // ponytail: every definition of the chain stays in memory for the context's life (~48k for a
    // melee map); an analyzer-level parse index would let a context hold only what was asked.
    return new Map((snapshot.definitions ?? snapshot.entities).map(entity => [
        catalogKey(entity.namespace, entity.entityId),
        entity,
    ]));
}
//# sourceMappingURL=context-catalog.js.map