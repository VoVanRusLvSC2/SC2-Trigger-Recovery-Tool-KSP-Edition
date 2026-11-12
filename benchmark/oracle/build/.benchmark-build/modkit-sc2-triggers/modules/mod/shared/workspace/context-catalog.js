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
/** A catalog entity's lookup key. */
export const catalogKey = (namespace, entityId) => `${namespace}\u0000${entityId}`;
const MAXIMUM_DOCUMENT_BYTES = 64 * 1024 * 1024;
const decoder = new TextDecoder();
export async function buildContextCatalog(options) {
    const wanted = new Map(STARCRAFT2_CATALOG_FILES.map((file, order) => [`base.sc2data/gamedata/${file.toLowerCase()}`, order]));
    const documents = [];
    for (const layer of options.layers) {
        const catalogs = (await options.files(layer.id))
            .filter(file => wanted.has(file.toLowerCase()))
            .sort((left, right) => wanted.get(left.toLowerCase()) - wanted.get(right.toLowerCase()));
        for (const file of catalogs) {
            const bytes = await options.read(layer.id, file, MAXIMUM_DOCUMENT_BYTES);
            documents.push({ rootId: layer.id, path: `${layer.sourcePath}/${file}`, text: decoder.decode(bytes) });
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
