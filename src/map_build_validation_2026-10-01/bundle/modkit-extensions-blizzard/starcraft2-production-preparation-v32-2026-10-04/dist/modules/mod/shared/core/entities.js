/** Whether this mod (the last load-order entry) declares or patches `entity`. */
export function isOwnEntity(entity, ownPath) {
    const sources = entity.sources ?? (entity.source ? [entity.source] : []);
    return sources.some(s => s.mod === ownPath);
}
/** The primary mod's own path (the last load-order entry), or `''` when the mod is empty. */
function ownPathOf(mod) {
    const order = mod.loadOrder;
    return order.length ? order[order.length - 1] : '';
}
/** Parse an `EditorCategories` field value (`ObjectType:Unit,ObjectFamily:Melee`) into pairs. */
export function parseEditorCats(value) {
    const raw = typeof value === 'string'
        ? value
        : typeof value?.value === 'string'
            ? value.value
            : undefined;
    if (!raw)
        return undefined;
    const pairs = [];
    for (const part of raw.split(',')) {
        const colon = part.indexOf(':');
        if (colon <= 0)
            continue;
        pairs.push([part.slice(0, colon).trim(), part.slice(colon + 1).trim()]);
    }
    return pairs.length ? pairs : undefined;
}
/** Plain (markup-stripped) localized name for `ns/id`, or `''` — cheap map lookup, no resolution. */
export function plainName(mod, locale, ns, id) {
    const loc = mod.locales.get(locale.toLowerCase()) ?? [...mod.locales.values()][0];
    if (!loc)
        return '';
    for (const file of loc.values()) {
        const v = file.get(`${ns}/Name/${id}`);
        if (v !== undefined)
            return v
                .replace(/<[^>]+>/g, '')
                .replace(/\$[^$]+\$/g, '')
                .trim();
    }
    return '';
}
/**
 * Every namespace the mod has game data in, with own/total entity counts (own = declared or
 * patched by this mod itself). Namespaces with no entities are dropped. The order is
 * {@link SC2Mod.namespaces}'s order (the caller sorts/filters for display).
 */
export function gameDataNamespaceSummaries(mod) {
    const ownPath = ownPathOf(mod);
    return mod
        .namespaces()
        .map(ns => {
        const all = mod.all(ns);
        let own = 0;
        for (const e of all)
            if (isOwnEntity(e, ownPath))
                own++;
        return { ns, own, total: all.length };
    })
        .filter(n => n.total > 0);
}
/**
 * All entities of a namespace as {@link ModEntitySummary} rows — the full set (no cap), each
 * flagged own/inherited and carrying its `EditorCategories` assignment, sorted by id. Callers that
 * only want own entities filter on `own` themselves.
 */
export function collectModEntities(mod, ns, locale) {
    const ownPath = ownPathOf(mod);
    const out = [];
    for (const e of mod.all(ns)) {
        if (!e.id)
            continue;
        const resolved = mod.getResolved(ns, e.id);
        const cats = parseEditorCats(resolved?.['EditorCategories']);
        out.push({
            id: e.id,
            name: plainName(mod, locale, ns, e.id),
            own: isOwnEntity(e, ownPath),
            ...(cats ? { cats } : {}),
        });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
}
//# sourceMappingURL=entities.js.map