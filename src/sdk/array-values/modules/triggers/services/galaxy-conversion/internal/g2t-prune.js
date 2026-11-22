/**
 * g2t-prune — removes speculative orphan elements before serialization.
 *
 * mkParamRef / mkFCRef register elements into ctx.elements immediately; any
 * tryBuild* matcher that creates child params/calls and then bails (returning
 * undefined so the caller falls back to custom script or another pattern)
 * leaves those children behind. Serializing them produces top-level <Element>
 * nodes no parent references — the editor logs
 *   "Orphaned trigger parameter removed ..." /
 *   "Orphaned trigger function call removed ..."
 * and deletes them, which can cascade into real data loss.
 *
 * This pass keeps every non-Param/non-FunctionCall element as a root (Trigger,
 * FunctionDef, Variable, ParamDef, Structure, ...) and drops any Param or
 * FunctionCall element not reachable from a root through element refs.
 */
const PRUNABLE_TYPES = new Set(['Param', 'FunctionCall']);
/** True for objects that look like an element ref: { type, id [, library] }. */
function isElementRefLike(v) {
    return v && typeof v === 'object' && typeof v.type === 'string' && typeof v.id === 'string';
}
/**
 * Mutates `elements`, deleting unreachable Param/FunctionCall elements.
 * Returns the removed ids (useful for diagnostics/tests).
 */
export function pruneUnreachableElements(elements, libId) {
    const reachable = new Set();
    const pending = [];
    // Roots: everything that is not a Param/FunctionCall. Traverse the element
    // graph explicitly; marking an id and scanning its outgoing edges are two
    // separate operations, so a shared/cyclic node cannot suppress its children.
    for (const el of Object.values(elements)) {
        if (PRUNABLE_TYPES.has(el.type))
            continue;
        reachable.add(el.id);
        pending.push(el);
    }
    const enqueue = (ref) => {
        if (ref.library !== undefined && ref.library !== libId) return;
        const target = elements[ref.id];
        if (target?.type === ref.type) {
            reachable.add(target.id);
            pending.push(target);
        }
    };
    const visitField = (value) => {
        if (!value || typeof value !== 'object') return;
        if (!Array.isArray(value) && isElementRefLike(value)) {
            enqueue(value);
            return;
        }
        const work = [value], seen = new Set();
        while (work.length) {
            const child = work.pop();
            if (!child || typeof child !== 'object' || seen.has(child)) continue;
            seen.add(child);
            if (Array.isArray(child)) {
                for (const item of child) work.push(item);
            } else if (isElementRefLike(child)) {
                enqueue(child);
            } else {
                for (const key of Object.keys(child)) {
                    if (key !== 'type' && key !== 'id' && key !== 'library') work.push(child[key]);
                }
            }
        }
    };
    const scanned = new Set();
    while (pending.length) {
        const owner = pending.pop();
        const ownerKey = `${owner.type}:${owner.id}`;
        if (scanned.has(ownerKey))
            continue;
        scanned.add(ownerKey);
        for (const key of Object.keys(owner)) {
            if (key !== 'type' && key !== 'id' && key !== 'library') visitField(owner[key]);
        }
    }
    const removedIds = [];
    for (const id of Object.keys(elements)) {
        const el = elements[id];
        if (PRUNABLE_TYPES.has(el.type) && !reachable.has(id)) {
            removedIds.push(id);
            delete elements[id];
        }
    }
    return { removedIds };
}
//# sourceMappingURL=g2t-prune.js.map