import { typeToNamespace } from "../sc2-schema/index.js";
import { buildChain, resolveEntity } from "./inheritance.js";
import { entityProvenance } from "./provenance.js";
import { mergeFields } from "./merge.js";
import { buildTokenMap, substituteTokens } from "./tokens.js";
import { createTypedNamespace } from "./namespace.js";
/**
 * Single-mod entity store with inheritance resolution and token substitution.
 * Load one or more ParsedCatalogFile lists, then query via get/getResolved/namespace.
 */
export class TypedCatalog {
    store = new Map();
    resolvedCache = new Map();
    chainPrefixes = new Map();
    tokenMap = new Map();
    structureDefaults = new Map();
    /** Path-scoped `<const id path value/>` aliases: path → ids. Kept per path, not merged by id. */
    constAliases = new Map();
    /** Anonymous `default="1"` templates by class, their declarations merged in load order. */
    classDefaults = new Map();
    structureDefaultRules;
    schema;
    constructor(options) {
        this.schema = options.schema;
        this.structureDefaultRules = options.structureDefaults;
    }
    /** Register a root-level structure default for one catalog namespace, in load order. */
    addStructureDefault(namespace, structureType, fields) {
        const rules = this.structureDefaultRules;
        if (rules === undefined)
            return;
        const byType = this.structureDefaults.get(namespace) ?? new Map();
        byType.set(structureType, rules.merge(byType.get(structureType), fields));
        this.structureDefaults.set(namespace, byType);
        this.resolvedCache.clear();
        this.chainPrefixes.clear();
    }
    /** Effective structure defaults of one Data space, after all loaded layers merge. */
    getStructureDefaults(namespace) {
        return this.structureDefaults.get(namespace) ?? new Map();
    }
    /**
     * Load entries from parsed XML files. Merges duplicate ids within the same namespace
     * using schema-driven array strategies (second definition patches the first).
     */
    loadFromFiles(files, options) {
        for (const file of files) {
            for (const [, entries] of file.entries) {
                for (const entry of entries) {
                    this.addEntry(entry, options?.mod);
                }
            }
        }
        this.rebuildTokenMap();
        this.resolvedCache.clear();
        this.chainPrefixes.clear();
    }
    /** Whether `id` is a `<const>` alias declared for field `path` (`CUnit.Collide.index`). */
    hasConstAlias(path, id) {
        return this.constAliases.get(path)?.has(id) === true;
    }
    addEntry(entry, mod) {
        const ns = typeToNamespace(entry.type) ?? entry.type.slice(1);
        // One constant id may alias several paths (warcoop `air` for every TargetFilters field), so
        // record aliases before the id-keyed merge below collapses the declarations.
        const constPath = entry.type === 'CConst' ? entry.fields['path'] : undefined;
        if (typeof constPath === 'string' && entry.id) {
            const ids = this.constAliases.get(constPath) ?? new Set();
            ids.add(entry.id);
            this.constAliases.set(constPath, ids);
        }
        if (!this.store.has(ns)) {
            this.store.set(ns, new Map());
        }
        const nsMap = this.store.get(ns);
        // Always record at least the mod path; file/line only when XML trackSource was enabled
        const source = entry.source !== undefined
            ? buildSource(entry.source.file, entry.source.line, mod, entry.source.span)
            : { mod: mod ?? '', file: '' };
        nsMap.set(entry.id, this.patched(nsMap.get(entry.id), entry, ns, source));
        // An anonymous template belongs to its class. The namespace entry above merges every class's
        // template and stays for callers that write the '' entry back; inheritance reads these.
        // Only `default="1"` makes one: Liberty's id-less `<CLight parent="default">` (NoLight with
        // its id missing) is no template, or Core's DefaultLight map lighting would inherit HDR gain 0.
        if (entry.id === '' && (entry.default === '1' || entry.default === 'true')) {
            this.classDefaults.set(entry.type, this.patched(this.classDefaults.get(entry.type), entry, ns, source));
        }
    }
    /** One declaration merged onto what earlier ones of the same entity built, in load order. */
    patched(existing, entry, ns, source) {
        const declaration = { source, data: entry.fields };
        if (existing === undefined) {
            return buildEntity(entry.id, entry.type, ns, entry.fields, entry.parent, entry.default, source, entry.tokens, [source], writtenBy(entry.fields, source), [declaration]);
        }
        const schemaFields = this.schema.resolveFields(existing.class);
        const merged = mergeFields(existing.data, entry.fields, schemaFields);
        const parent = existing.parent ?? entry.parent;
        const tokens = mergeTokens(existing.tokens, entry.tokens);
        // Keep the FIRST declaration as `source`, but record every later patch site too
        // (same mod re-declaring in another file, or a dependency chain override).
        const sources = appendSource(existing.sources ?? (existing.source ? [existing.source] : []), source);
        return buildEntity(existing.id, existing.class, ns, merged, parent, existing.default ?? entry.default, existing.source, tokens, sources, { ...existing.fieldSources, ...writtenBy(entry.fields, source) }, [...(existing.declarations ?? []), declaration]);
    }
    /**
     * The template an entity without a parent inherits: its own class's, else the nearest schema
     * ancestor class's. A template itself continues with its class's parent — so a `CActorModel`
     * gets `CActorModel`'s template and then `CActor`'s, never a `CActorSound` one.
     */
    classDefaultOf(entity) {
        const ancestry = this.schema.inheritanceChain(entity.class).map(type => type.name).reverse();
        const classes = ancestry.length === 0 ? [entity.class] : ancestry;
        for (const type of entity.id === '' ? classes.slice(1) : classes) {
            const template = this.classDefaults.get(type);
            if (template !== undefined && template !== entity)
                return template;
        }
        return undefined;
    }
    rebuildTokenMap() {
        const constNs = this.store.get('Const');
        if (constNs === undefined)
            return;
        this.tokenMap = buildTokenMap(constNs.values());
    }
    /** Raw entity, before inheritance resolution. */
    get(namespace, id) {
        return this.store.get(namespace)?.get(id);
    }
    /**
     * Resolved entity fields: parent chain merged + tokens substituted.
     * Result is cached; cleared on next loadFromFiles call.
     */
    getResolved(namespace, id) {
        const cached = this.resolvedCache.get(namespace)?.get(id);
        if (cached !== undefined)
            return cached;
        const entity = this.get(namespace, id);
        if (entity === undefined)
            return undefined;
        const resolved = this.resolveEntityFields(entity);
        if (!this.resolvedCache.has(namespace)) {
            this.resolvedCache.set(namespace, new Map());
        }
        this.resolvedCache.get(namespace).set(id, resolved);
        return resolved;
    }
    /**
     * One entity's resolved fields, uncached: its chain merged, the catalog's structure defaults under
     * it, tokens substituted. A `default="1"` template is abstract and keeps its `##token##`
     * placeholders — they name what each inheriting entity supplies, not values of the template.
     */
    resolveEntityFields(entity) {
        const namespace = entity.namespace;
        let resolved = resolveEntity(entity, (ns, eid) => this.get(ns, eid), this.schema, template => this.classDefaultOf(template), this.chainPrefixes);
        const template = entity.default === '1' || entity.default === 'true';
        const defaults = this.structureDefaults.get(namespace);
        if (defaults !== undefined && this.structureDefaultRules !== undefined) {
            // A template's own id is the placeholder its inheritors fill in.
            resolved = this.structureDefaultRules.apply(entity.class, template ? '##id##' : entity.id, resolved, type => defaults.get(type));
        }
        if (template)
            return substituteTokens(resolved, this.tokenMap, { constantsOnly: true });
        // Build the per-entity token map:
        //  1. global CConst tokens;
        //  2. `<?token id=… value=…?>` declarations along the parent chain (leaf
        //     overrides root) — SC2 actor/sound templating;
        //  3. a like-named plain field supplies/overrides the token value (the
        //     `<CActorUnit id="NodMilitant" icon="Militant" parent="NodInfantry"/>`
        //     pattern: the parent declares `<?token id="icon"?>` and references
        //     `##icon##`; each child sets the value via an `icon` attribute);
        //  4. `##id##` is a built-in referring to the entity's own id.
        const own = new Map();
        const entityTokens = { get: (name) => own.get(name) ?? this.tokenMap.get(name) };
        const chain = [];
        let cursor = entity;
        const chainGuard = new Set();
        while (cursor !== undefined && !chainGuard.has(cursor.id)) {
            chainGuard.add(cursor.id);
            chain.unshift(cursor);
            cursor = cursor.parent !== undefined ? this.get(namespace, cursor.parent) : undefined;
        }
        for (const link of chain) {
            for (const t of link.tokens ?? []) {
                if (t.value !== undefined)
                    own.set(t.id, t.value);
            }
        }
        for (const link of chain) {
            for (const t of link.tokens ?? []) {
                const supplied = resolved[t.id];
                if (typeof supplied === 'string')
                    own.set(t.id, supplied);
            }
        }
        own.set('id', entity.id);
        return substituteTokens(resolved, entityTokens);
    }
    /**
     * The declaration that supplied each field `getResolved` returns: the same chain, root first,
     * the last writer of a top-level field winning. A field only structure defaults supply has none.
     */
    getResolvedSources(namespace, id) {
        const entity = this.get(namespace, id);
        return entity === undefined ? undefined : this.resolvedSourcesOf(entity);
    }
    /** {@link getResolvedSources} for an entity in hand (a class template included). */
    resolvedSourcesOf(entity) {
        const sources = {};
        for (const link of this.chainOf(entity))
            Object.assign(sources, link.fieldSources);
        return sources;
    }
    /**
     * The inheritance chain `getResolved` merges, root first and the entity last: explicit parents,
     * then its class's `default="1"` template (id `''`) and that template's own chain.
     */
    getChain(namespace, id) {
        const entity = this.get(namespace, id);
        return entity === undefined ? undefined : this.chainOf(entity);
    }
    /** {@link getChain} for an entity in hand (a class template included). */
    chainOf(entity) {
        return buildChain(entity, (ns, eid) => this.get(ns, eid), template => this.classDefaultOf(template));
    }
    /** Which declaration wrote each leaf of an entity's resolved fields (the authoring index). */
    provenanceOf(entity) {
        return entityProvenance(entity, this.chainOf(entity), this.schema.resolveFields(entity.class));
    }
    /** The `default="1"` template of one class (id `''`), its declarations merged in load order. */
    getClassDefault(className) {
        return this.classDefaults.get(className);
    }
    /**
     * TypedNamespace proxy for a given namespace.
     * Property access and get() both return resolved fields cast to T.
     * Should be obtained after all loadFromFiles calls.
     */
    namespace(ns) {
        const nsMap = this.store.get(ns) ?? new Map();
        const ids = new Set(nsMap.keys());
        return createTypedNamespace(ids, id => this.getResolved(ns, id));
    }
    /** All raw entities for a namespace. */
    all(namespace) {
        const nsMap = this.store.get(namespace);
        return nsMap !== undefined ? Array.from(nsMap.values()) : [];
    }
    /** All loaded namespace keys. */
    namespaces() {
        return Array.from(this.store.keys());
    }
    /**
     * Re-key an entity in the store: delete the old id entry and insert under newId.
     * Also updates the entity's id field and clears the resolved cache for the namespace.
     * No-op if the entity does not exist.
     */
    renameEntry(namespace, oldId, newId) {
        const nsMap = this.store.get(namespace);
        if (nsMap === undefined)
            return;
        const entity = nsMap.get(oldId);
        if (entity === undefined)
            return;
        nsMap.delete(oldId);
        entity.id = newId;
        nsMap.set(newId, entity);
        this.resolvedCache.get(namespace)?.delete(oldId);
        this.chainPrefixes.clear();
    }
    /** Remove all loaded data. */
    clear() {
        this.store.clear();
        this.resolvedCache.clear();
        this.chainPrefixes.clear();
        this.structureDefaults.clear();
        this.constAliases.clear();
        this.classDefaults.clear();
        this.tokenMap = new Map();
    }
}
function buildEntity(id, cls, namespace, data, parent, defaultValue, source, tokens, sources, fieldSources, declarations) {
    const base = { id, class: cls, namespace, data };
    const withParent = parent !== undefined ? { ...base, parent } : base;
    const withDefault = defaultValue !== undefined ? { ...withParent, default: defaultValue } : withParent;
    const withTokens = tokens !== undefined && tokens.length > 0 ? { ...withDefault, tokens } : withDefault;
    const withSource = source !== undefined ? { ...withTokens, source } : withTokens;
    const withSources = sources !== undefined && sources.length > 0 ? { ...withSource, sources } : withSource;
    const withFieldSources = fieldSources !== undefined ? { ...withSources, fieldSources } : withSources;
    return declarations !== undefined ? { ...withFieldSources, declarations } : withFieldSources;
}
/** Every top-level field one declaration writes, attributed to that declaration. */
function writtenBy(fields, source) {
    return Object.fromEntries(Object.keys(fields).map(field => [field, source]));
}
/** Append a declaration site, skipping consecutive duplicates (same mod+file). */
function appendSource(sources, next) {
    const last = sources[sources.length - 1];
    if (last && last.mod === next.mod && last.file === next.file && last.line === next.line)
        return [...sources];
    return [...sources, next];
}
/** Union token declarations from two entity definitions of the same id (later wins per token id). */
function mergeTokens(a, b) {
    if (!a)
        return b;
    if (!b)
        return a;
    const byId = new Map();
    for (const t of a)
        byId.set(t.id, t);
    for (const t of b)
        byId.set(t.id, t);
    return [...byId.values()];
}
function buildSource(file, line, mod, span) {
    const base = { mod: mod ?? '', file, ...(span === undefined ? {} : { span }) };
    return line !== undefined ? { ...base, line } : base;
}
//# sourceMappingURL=catalog.js.map