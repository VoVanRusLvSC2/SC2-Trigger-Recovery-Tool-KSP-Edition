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
import { buildEntityCard, entityIconAsset } from "../../../shared/format/wiki/cards.js";
import { findCatalogUnitProducers } from "../../../shared/format/producers.js";
import { buildCatalogRelations, } from "../../../shared/format/relations.js";
import { assetId, createEntitySelectorSource, entityCardFacts, entitySubjectId, localeName, } from "./entity-facts.js";
export { entitySubjectId } from "./entity-facts.js";
import { buildChain, } from "../../../shared/catalog-engine/sc2-catalog/index.js";
import { provenanceOf } from '@modkit/codec-kit';
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
 * A value of the host snapshot in the form the catalog parser writes.
 *
 * The snapshot keeps an indexed item as `{ index, value }` and types its scalars; the parser keeps a
 * struct item's fields beside its `index` and every scalar as the XML spelled it.
 */
function rawOf(value) {
    if (Array.isArray(value)) {
        return value.map(item => {
            const pair = item;
            if (pair === null || typeof pair !== 'object' || Array.isArray(pair) ||
                Object.keys(pair).length !== 2 || pair.index === undefined || pair.value === undefined) {
                return rawOf(item);
            }
            const inner = rawOf(pair.value);
            return inner !== null && typeof inner === 'object' && !Array.isArray(inner)
                ? { index: String(pair.index), ...inner }
                : { index: String(pair.index), value: inner };
        });
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rawOf(item)]));
    }
    return typeof value === 'number' || typeof value === 'boolean' ? String(Number(value)) : value;
}
/** `mods/liberty.sc2mod/base.sc2data/gamedata/unitdata.xml` → the package and the path in it. */
function entitySourceOf(path) {
    const match = /^(.*?\.sc2(?:mod|map|campaign))\/(.*)$/iu.exec(path);
    return match === null ? { mod: '', file: path } : { mod: match[1], file: match[2] };
}
/**
 * The host's resolved-data snapshot as the mod the assembler expects.
 *
 * Its definitions are already resolved along the whole mod chain, so each becomes a parentless raw
 * entity: the assembler's own resolution then answers the snapshot's values rather than inheriting
 * a second time. Numbers go back through the provider's lexemes where it kept them. Style sheets
 * are not part of a Data snapshot, so text constants answer empty, as for a single catalog.
 */
/** One resolved definition's fields as the catalog parser would hold them. */
export function rawFieldsOfDefinition(definition) {
    const lexemes = definition.fieldLexemes ?? {};
    return Object.fromEntries(Object.entries(definition.fields).map(([key, value]) => [key, lexemes[key] ?? rawOf(value)]));
}
export function cardSourceOfSnapshot(snapshot) {
    const byNamespace = new Map();
    for (const definition of snapshot.definitions) {
        const data = rawFieldsOfDefinition(definition);
        const declared = definition.sources[0];
        const entity = {
            id: definition.entityId,
            class: definition.typeId,
            namespace: definition.namespace,
            data,
            ...(definition.defaultTemplate === true ? { default: '1' } : {}),
            ...(declared === undefined ? {} : { source: entitySourceOf(declared.path) }),
        };
        let entities = byNamespace.get(definition.namespace);
        if (entities === undefined)
            byNamespace.set(definition.namespace, (entities = new Map()));
        entities.set(definition.entityId, entity);
    }
    // The host resolved every key in the locale it was asked for, falling back per key; filed under
    // the resolved locale, a fallback key would become a locale of its own that has no names.
    const locales = new Map();
    for (const item of snapshot.localizedStrings) {
        const locale = item.requestedLocale.toLowerCase();
        const file = item.source.path.split('/').pop()?.replace(/\.txt$/iu, '') ?? 'GameStrings';
        let files = locales.get(locale);
        if (files === undefined)
            locales.set(locale, (files = new Map()));
        let strings = files.get(file);
        if (strings === undefined)
            files.set(file, (strings = new Map()));
        if (!strings.has(item.key))
            strings.set(item.key, item.value);
    }
    const get = (namespace, id) => byNamespace.get(namespace)?.get(id);
    return {
        get,
        getResolved: (namespace, id) => get(namespace, id)?.data,
        all: namespace => [...(byNamespace.get(namespace)?.values() ?? [])],
        namespaces: () => [...byNamespace.keys()],
        locales,
        opaqueFiles: new Map(),
        getTextConstant: () => undefined,
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
 * Where each field of a mod context card comes from: the file of the layer that sets the field (its
 * `fieldSources` entry), else of the layer that declares the entity last, as `sourceOf` addresses it.
 */
function chainProvenance(resolved, sourceOf, fallback) {
    return segments => {
        const field = segments[0];
        const declared = (field === undefined ? undefined : resolved.fieldSources?.[field]) ?? resolved.sources.at(-1);
        const source = declared === undefined ? undefined : sourceOf(declared.rootId, entitySourceOf(declared.path).file);
        const provenance = provenanceOf(source ?? fallback, [resolved.namespace, resolved.entityId, ...segments]);
        const range = source === undefined ? undefined : declared?.range;
        return range === undefined ? provenance : provenance.map(item => Object.freeze({ ...item, range }));
    };
}
/** How far a chain card follows references (unit → weapon → effect → …) and how many it asks for. */
const CHAIN_CARD_DEPTH = 3;
const CHAIN_CARD_ENTITIES = 512;
const CATALOG_PORT_BATCH = 1024;
/**
 * One entity as its mod context resolves it, with the entities its card follows, as a snapshot the
 * one card projection (`snapshotEntityFacts`) reads. The references to follow come from the ported
 * relation walker itself: it walks what was fetched over a source that records every entity it
 * looks for and does not have yet, and those are asked of the catalog next, a level at a time.
 * `undefined` when the context does not know the entity.
 */
async function chainCardSnapshot(catalog, namespace, id, signal) {
    const keyOf = (ns, entityId) => `${ns}/${entityId}`;
    const fetched = new Map();
    const asked = new Set();
    const snapshotOf = () => ({ definitions: [...fetched.values()], localizedStrings: [] });
    let wanted = [{ namespace, entityId: id }];
    for (let depth = 0; depth <= CHAIN_CARD_DEPTH && wanted.length > 0; depth += 1) {
        const batch = wanted
            .filter(ref => !asked.has(keyOf(ref.namespace, ref.entityId)))
            .slice(0, CHAIN_CARD_ENTITIES - asked.size);
        for (const ref of batch)
            asked.add(keyOf(ref.namespace, ref.entityId));
        for (let start = 0; start < batch.length; start += CATALOG_PORT_BATCH) {
            for (const entity of await catalog.entities(batch.slice(start, start + CATALOG_PORT_BATCH), signal))
                fetched.set(keyOf(entity.namespace, entity.entityId), entity);
        }
        if (!fetched.has(keyOf(namespace, id)))
            return undefined;
        if (depth === CHAIN_CARD_DEPTH || asked.size >= CHAIN_CARD_ENTITIES)
            break;
        const known = cardSourceOfSnapshot(snapshotOf());
        const next = new Map();
        buildCatalogRelations({
            ...known,
            get: (ns, entityId) => {
                const found = known.get(ns, entityId);
                if (found !== undefined || entityId === '')
                    return found;
                const key = keyOf(ns, entityId);
                if (!asked.has(key))
                    next.set(key, { namespace: ns, entityId });
                return undefined;
            },
        });
        wanted = [...next.values()];
    }
    return snapshotOf();
}
/** A file's strings that note every key the card builder looks up, answering what is known. */
class RecordingStrings extends Map {
    asked;
    known;
    constructor(asked, known) {
        super();
        this.asked = asked;
        this.known = known;
    }
    get(key) {
        this.asked.add(key);
        return this.known.get(key)?.value;
    }
}
/**
 * The localized strings a chain card reads — names, tooltips, hotkeys — asked of the subject's mod
 * context. Which keys a card needs is the card builder's business, so it is run over the snapshot
 * with strings that only note what is looked up, and those keys are asked; a second round asks
 * what the answers themselves name. A context without strings leaves the card to its ids.
 */
async function withContextStrings(catalog, snapshot, namespace, id, signal) {
    if (catalog.strings === undefined)
        return snapshot;
    const answered = new Map();
    const requested = new Set();
    const source = cardSourceOfSnapshot(snapshot);
    const graph = cardGraphOfCatalog(source);
    for (let round = 0; round < 2; round += 1) {
        const asked = new Set();
        const recording = new Map([['enus', new Map([['GameStrings', new RecordingStrings(asked, answered)]])]]);
        localizedCards({ ...source, locales: recording }, graph, namespace, id);
        const missing = [...asked].filter(key => !requested.has(key));
        if (missing.length === 0)
            break;
        for (const key of missing)
            requested.add(key);
        for (const item of await catalog.strings(missing, undefined, signal))
            answered.set(item.key, item);
    }
    return { ...snapshot, localizedStrings: [...answered.values()] };
}
/**
 * Every entity of a source as a subject: a selector that lists them and lends each one's card.
 *
 * The relation graph is built once, on the first card anyone opens, and shared by every card after
 * it; a document nobody opens an entity of pays nothing.
 */
/** The locales a source has strings in, `enUS` first; `enUS` alone when it has none. */
function cardLocales(mod) {
    const locales = [...mod.locales.keys()].sort((left, right) => left.toLowerCase() === 'enus'
        ? -1
        : right.toLowerCase() === 'enus'
            ? 1
            : left.localeCompare(right));
    return locales.length === 0 ? ['enUS'] : locales;
}
/** One entity's card in every locale of its source. */
function localizedCards(mod, graph, namespace, id) {
    return new Map(cardLocales(mod).map(locale => [
        localeName(locale),
        buildEntityCard({ mod: mod, graph, locale }, namespace, id),
    ]));
}
const snapshotSources = new WeakMap();
/**
 * One entity of a host resolved-data snapshot, as the same card a GameData file lends: the one SC2
 * entity projection, over values resolved along the whole mod chain. The snapshot's card source and
 * relation graph are built once and shared by every card opened from it. `undefined` when the
 * snapshot does not define the entity.
 */
export function snapshotEntityFacts(snapshot, namespace, id, options) {
    let cached = snapshotSources.get(snapshot);
    if (cached === undefined)
        snapshotSources.set(snapshot, (cached = { source: cardSourceOfSnapshot(snapshot) }));
    if (cached.source.get(namespace, id) === undefined)
        return undefined;
    cached.graph ??= cardGraphOfCatalog(cached.source);
    return entityCardFacts(localizedCards(cached.source, cached.graph, namespace, id), options);
}
export function entitySubjects(mod, options) {
    let graph;
    return createEntitySelectorSource({
        snapshotId: options.snapshotId,
        // Each namespace by display name, then id: the order a wiki lists a namespace in.
        entities: () => mod.namespaces().flatMap(namespace => mod.all(namespace)
            .filter(entity => entity.id !== '')
            .map(entity => ({
            subjectId: entitySubjectId(namespace, entity.id),
            label: options.nameOf?.(namespace, entity.id) || entity.id,
            kind: namespace,
            ...(entity.class === undefined ? {} : { type: entity.class }),
        }))
            .sort((left, right) => left.label.localeCompare(right.label) || left.subjectId.localeCompare(right.subjectId))),
        // The icon a card shows: the entity's own, else that of a button representing it.
        portraitOf(namespace, id) {
            graph ??= cardGraphOfCatalog(mod);
            return assetId(entityIconAsset(mod, namespace, id, graph), mod.assetAliases);
        },
        async open(namespace, id, signal) {
            if (options.catalog !== undefined) {
                const fetched = await chainCardSnapshot(options.catalog, namespace, id, signal);
                const snapshot = fetched === undefined ? undefined : await withContextStrings(options.catalog, fetched, namespace, id, signal);
                const resolved = snapshot?.definitions.find(item => item.namespace === namespace && item.entityId === id);
                if (snapshot !== undefined && resolved !== undefined) {
                    const { catalog: _catalog, ...card } = options;
                    // Only what this document declares can be written through it.
                    const writable = mod.get(namespace, id) !== undefined;
                    return snapshotEntityFacts(snapshot, namespace, id, {
                        snapshotId: card.snapshotId,
                        source: card.source,
                        ...(writable && card.editOperation !== undefined ? { editOperation: card.editOperation } : {}),
                        ...(mod.assetAliases === undefined ? {} : { assetAliases: mod.assetAliases }),
                        parentChain: resolved.inheritanceChain.map(ref => ({ namespace: ref.namespace, id: ref.entityId })),
                        resolvedParentChain: true,
                        ...(card.sourceOf === undefined ? {} : { provenanceOf: chainProvenance(resolved, card.sourceOf, card.source) }),
                    });
                }
            }
            const entity = mod.get(namespace, id);
            if (entity === undefined)
                return undefined;
            const chain = buildChain(entity, (ns, entityId) => mod.get(ns, entityId));
            graph ??= cardGraphOfCatalog(mod);
            return entityCardFacts(localizedCards(mod, graph, namespace, id), {
                ...options,
                ...(mod.assetAliases === undefined ? {} : { assetAliases: mod.assetAliases }),
                parentChain: chain.map(item => ({ namespace: item.namespace, id: item.id })),
                partialParentChain: chain[0]?.parent !== undefined,
            });
        },
    });
}
//# sourceMappingURL=entity-cards.js.map