/**
 * Entity cards, from the ported wiki assembler.
 *
 * `wiki/cards.ts` is 943 lines that turn a catalog entity into what a reader wants to see about it:
 * its costs, its weapons and abilities with their resolved numbers, its localized name and tooltip,
 * what produces it and what it produces. It was carried across and had no way in — the codec even
 * declared `blizzard/sc2-data.entity-cards` in its operation table and then skipped the handler, so
 * the operation existed and did nothing.
 *
 * Nothing here decides what belongs on a card. What this module does is bridge two shapes: the
 * assembler wants an `SC2Mod`, and MK3 has the `TypedCatalog` that an `SC2Mod` mostly wraps.
 *
 * It supplies the nine members the assembler actually reaches for rather than constructing the real
 * class, and that is a decision worth stating. `SC2Mod` is a whole-mod object: importing it pulls in
 * the layout parser, the document-metadata reader and the archive loader, none of which a GameData
 * session has or needs, and two of which are Node-only — the codec is declared portable, so that
 * import would break the claim. The nine members are listed below and checked against the port, so
 * the day the assembler reaches for a tenth this file fails to compile rather than answering wrong.
 *
 * The relation graph is built from the catalog directly rather than through `wiki/mod-relations`,
 * which composes catalog and SC2Layout references: layouts are a different codec's documents and
 * are not in a GameData session, so asking for them would add a dependency for an empty answer.
 * Producers come from `producers.ts` for the same reason — `wiki/mod-producers` adds the triggers
 * that *also* build a unit, and trigger documents are not in this session either. What that costs
 * is stated on the card rather than hidden: `triggers` is empty, meaning "not visible from here".
 */
import { buildEntityCard } from '../../../shared/format/wiki/cards.js';
import { findCatalogUnitProducers } from '../../../shared/format/producers.js';
import { buildCatalogRelations, } from '../../../shared/format/relations.js';
import { createEntitySelectorSource, entityCardFacts, entitySubjectId, localeName, } from './entity-facts.js';
export { entitySubjectId } from './entity-facts.js';
import { buildChain, } from '../../../shared/catalog-engine/sc2-catalog/index.js';
/**
 * Present a catalog as the mod the assembler expects.
 *
 * The members past the catalog answer empty for a good reason: a GameData session holds catalog XML
 * and nothing else. A card built from it is complete about the data and silent about the rest,
 * which is honest; inventing files or styles would make a partial card look finished.
 */
export function modOfCatalog(catalog, options = {}) {
    const constants = options.textConstants ?? {};
    return {
        get: (namespace, id) => catalog.get(namespace, id),
        getResolved: (namespace, id) => catalog.getResolved(namespace, id),
        all: namespace => catalog.all(namespace),
        namespaces: () => catalog.namespaces(),
        locales: options.locales ?? new Map(),
        opaqueFiles: new Map(),
        getTextConstant: name => constants[name],
        getTextStyle: () => undefined,
    };
}
/**
 * The graph a card needs: what an entity points at, what points at it, and what builds it.
 *
 * `incoming` flips the edge, because the raw graph keeps orientation and every consumer of a card
 * asks for "the other end". Getting that backwards is silent — the card renders with empty sections
 * rather than failing — which is why the ported `collect.ts` states it too.
 */
export function cardGraphOfCatalog(catalog) {
    const relations = buildCatalogRelations(catalog);
    return {
        outgoing: (namespace, id) => relations.outgoing(namespace, id).map(ref => ({ to: ref.to, path: ref.path })),
        incoming: (namespace, id) => relations.incoming(namespace, id).map(ref => ({ to: ref.from, path: ref.path })),
        unitProducers: id => findCatalogUnitProducers(catalog, id, { graph: relations }).map(producer => ({
            kind: producer.kind,
            category: producer.category,
            creator: producer.creator,
            path: producer.path,
            routes: producer.routes,
            // A GameData session has no trigger documents; an empty list says so without guessing.
            triggers: [],
        })),
    };
}
/** One entity, assembled into a card. */
export function entityCard(catalog, namespace, entityId, options = {}) {
    if (catalog.get(namespace, entityId) === undefined) {
        throw new TypeError(`no entity ${namespace}/${entityId} in this catalog`);
    }
    const mod = modOfCatalog(catalog, options);
    return buildEntityCard({
        mod: mod,
        locale: options.locale ?? 'enUS',
        graph: cardGraphOfCatalog(catalog),
    }, namespace, entityId);
}
/**
 * Every entity of a source as a subject: a selector that lists them and lends each one's card.
 *
 * The relation graph is built once, on the first card anyone opens, and shared by every card after
 * it; a document nobody opens an entity of pays nothing.
 */
export function entitySubjects(mod, options) {
    let graph;
    const locales = [...mod.locales.keys()].sort((left, right) => left.toLowerCase() === 'enus'
        ? -1
        : right.toLowerCase() === 'enus'
            ? 1
            : left.localeCompare(right));
    return createEntitySelectorSource({
        snapshotId: options.snapshotId,
        entities: () => mod.namespaces().flatMap(namespace => mod.all(namespace)
            .filter(entity => entity.id !== '')
            .map(entity => ({
            subjectId: entitySubjectId(namespace, entity.id),
            label: entity.id,
            kind: namespace,
            ...(entity.class === undefined ? {} : { type: entity.class }),
        }))),
        open(namespace, id) {
            const entity = mod.get(namespace, id);
            if (entity === undefined)
                return undefined;
            const chain = buildChain(entity, (ns, entityId) => mod.get(ns, entityId));
            graph ??= cardGraphOfCatalog(mod);
            const context = { mod: mod, graph };
            const cards = new Map((locales.length === 0 ? ['enUS'] : locales).map(locale => [
                localeName(locale),
                buildEntityCard({ ...context, locale }, namespace, id),
            ]));
            return entityCardFacts(cards, {
                ...options,
                parentChain: chain.map(item => ({ namespace: item.namespace, id: item.id })),
                partialParentChain: chain[0]?.parent !== undefined,
            });
        },
    });
}
