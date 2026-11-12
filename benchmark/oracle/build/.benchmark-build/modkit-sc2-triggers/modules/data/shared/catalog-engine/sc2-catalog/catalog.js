import { typeToNamespace } from '../sc2-schema/index.js';
import { resolveEntity } from './inheritance.js';
import { mergeFields } from './merge.js';
import { buildTokenMap, substituteTokens } from './tokens.js';
import { createTypedNamespace } from './namespace.js';
/**
 * Single-mod entity store with inheritance resolution and token substitution.
 * Load one or more ParsedCatalogFile lists, then query via get/getResolved/namespace.
 */
export class TypedCatalog {
    store = new Map();
    resolvedCache = new Map();
    tokenMap = new Map();
    structureDefaults = new Map();
    /** Path-scoped `<const id path value/>` aliases: path → ids. Kept per path, not merged by id. */
    constAliases = new Map();
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
            ? buildSource(entry.source.file, entry.source.line, mod)
            : { mod: mod ?? '', file: '' };
        const existing = nsMap.get(entry.id);
        if (existing !== undefined) {
            const schemaFields = this.schema.resolveFields(existing.class);
            const merged = mergeFields(existing.data, entry.fields, schemaFields);
            const parent = existing.parent ?? entry.parent;
            const tokens = mergeTokens(existing.tokens, entry.tokens);
            // Keep the FIRST declaration as `source`, but record every later patch site too
            // (same mod re-declaring in another file, or a dependency chain override).
            const sources = appendSource(existing.sources ?? (existing.source ? [existing.source] : []), source);
            nsMap.set(entry.id, buildEntity(existing.id, existing.class, ns, merged, parent, existing.default ?? entry.default, existing.source, tokens, sources));
            return;
        }
        nsMap.set(entry.id, buildEntity(entry.id, entry.type, ns, entry.fields, entry.parent, entry.default, source, entry.tokens, [source]));
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
        let resolved = resolveEntity(entity, (ns, eid) => this.get(ns, eid), this.schema);
        const defaults = this.structureDefaults.get(namespace);
        if (defaults !== undefined && this.structureDefaultRules !== undefined) {
            resolved = this.structureDefaultRules.apply(entity.class, entity.id, resolved, type => defaults.get(type));
        }
        // Build the per-entity token map:
        //  1. global CConst tokens;
        //  2. `<?token id=… value=…?>` declarations along the parent chain (leaf
        //     overrides root) — SC2 actor/sound templating;
        //  3. a like-named plain field supplies/overrides the token value (the
        //     `<CActorUnit id="NodMilitant" icon="Militant" parent="NodInfantry"/>`
        //     pattern: the parent declares `<?token id="icon"?>` and references
        //     `##icon##`; each child sets the value via an `icon` attribute);
        //  4. `##id##` is a built-in referring to the entity's own id.
        const entityTokens = new Map(this.tokenMap);
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
                    entityTokens.set(t.id, t.value);
            }
        }
        for (const link of chain) {
            for (const t of link.tokens ?? []) {
                const supplied = resolved[t.id];
                if (typeof supplied === 'string')
                    entityTokens.set(t.id, supplied);
            }
        }
        entityTokens.set('id', entity.id);
        resolved = substituteTokens(resolved, entityTokens);
        if (!this.resolvedCache.has(namespace)) {
            this.resolvedCache.set(namespace, new Map());
        }
        this.resolvedCache.get(namespace).set(id, resolved);
        return resolved;
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
    }
    /** Remove all loaded data. */
    clear() {
        this.store.clear();
        this.resolvedCache.clear();
        this.structureDefaults.clear();
        this.constAliases.clear();
        this.tokenMap = new Map();
    }
}
function buildEntity(id, cls, namespace, data, parent, defaultValue, source, tokens, sources) {
    const base = { id, class: cls, namespace, data };
    const withParent = parent !== undefined ? { ...base, parent } : base;
    const withDefault = defaultValue !== undefined ? { ...withParent, default: defaultValue } : withParent;
    const withTokens = tokens !== undefined && tokens.length > 0 ? { ...withDefault, tokens } : withDefault;
    const withSource = source !== undefined ? { ...withTokens, source } : withTokens;
    return sources !== undefined && sources.length > 0 ? { ...withSource, sources } : withSource;
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
function buildSource(file, line, mod) {
    const base = { mod: mod ?? '', file };
    return line !== undefined ? { ...base, line } : base;
}
