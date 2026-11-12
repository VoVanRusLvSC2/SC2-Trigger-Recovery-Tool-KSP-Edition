/**
 * Parser + model for SC2 editor categories (`Base.SC2Data/EditorData/EditorCategories.xml`).
 *
 * The file is editor-only metadata that defines the category dropdowns used by the
 * `EditorCategories` catalog field (e.g. `ObjectType:Unit,Race:Terr`):
 *
 *   <category name="ObjectType"><value>Unit</value>…</category>     — category → values
 *   <objectUsage type="Abil">                                       — which categories apply
 *     <objects><usage source="External">Race</usage>…</objects>     to a namespace's objects…
 *     <fields><usage source="External">FieldType</usage></fields>   …and to its fields
 *   </objectUsage>
 *
 * A `source="External"` usage points at a named category whose `<value>`s are the
 * allowed options; `EntryType`/`Parent` usages are derived dynamically by the editor
 * and are surfaced here as sourced usages without a category (callers can ignore them).
 *
 * It lives in any mod (base game, dependency, or map) and merges down the dependency
 * chain, so this module exposes a `merge` to compose the loaded chain.
 */
import { EMPTY_EDITOR_CATEGORIES as EMPTY_RUNTIME_EDITOR_CATEGORIES, mergeEditorCategories as mergeRuntimeEditorCategories, parseEditorCategories as parseRuntimeEditorCategories, } from './editor-categories-runtime.js';
/** Parse one EditorCategories.xml document. Never throws — returns empty on malformed input. */
export function parseEditorCategories(xml) {
    return parseRuntimeEditorCategories(xml);
}
/**
 * Merge `source` onto `target` (later mods in the dependency chain win): category
 * value lists are unioned (preserving order, base first); `objectUsage` is replaced
 * per type. Returns a new object; inputs are not mutated.
 */
export function mergeEditorCategories(target, source) {
    return mergeRuntimeEditorCategories(target, source);
}
export const EMPTY_EDITOR_CATEGORIES = EMPTY_RUNTIME_EDITOR_CATEGORIES;
/**
 * Categories (with their allowed values) applicable to a catalog namespace's objects
 * (default) or fields. Only `source="External"` usages resolve to a value list;
 * dynamic `EntryType`/`Parent` usages are skipped.
 */
export function categoriesForType(data, type, scope = 'objects') {
    const usage = data.objectUsage.get(type);
    if (!usage)
        return [];
    const out = [];
    for (const u of usage[scope]) {
        if (u.source !== 'External' || !u.category)
            continue;
        out.push({ name: u.category, values: data.categories.get(u.category) ?? [] });
    }
    return out;
}
//# sourceMappingURL=editor-categories.js.map