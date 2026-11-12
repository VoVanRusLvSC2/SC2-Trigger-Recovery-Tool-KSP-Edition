/**
 * Data-driven resolution of `<?token?>` link types.
 *
 * SC2 catalog XML declares tokens via `<?token id="..." type="..." value="..."?>`
 * processing instructions; the `type` attribute names a CLink subclass whose
 * target namespace is the entity class the token links to
 * (e.g. `type="CUnitLink"` → namespace `Unit`). The default type is a plain
 * string (`type` absent), which is not an entity link.
 *
 * Earlier code carried a hardcoded `TOKEN_LINK_TYPES` table mapping well-known
 * token *names* (unitName, effectImpact, …) to candidate namespaces. That
 * duplicated information already present in the data and could not cover tokens
 * it didn't know about. Consumers now read each entity's declared token types
 * instead, and use this helper to turn a declared `type` into a namespace.
 */
import { CATALOG_NAMESPACES } from './namespaces.js';
import { LINK_CLASS_NAMESPACES } from './structure-types/schema.links.js';
const CATALOG_NS_SET = new Set(CATALOG_NAMESPACES);
/**
 * Resolve a `<?token?>` declared `type` to its target catalog namespace.
 *
 * Returns `undefined` when:
 *  - `type` is absent — the token is a plain string (the default), not a link;
 *  - `type` is not a known CLink subclass; or
 *  - the link targets a non-catalog namespace (String/Asset/File/Hotkey/Token/…).
 *
 * The `type` is matched exactly: SC2 type names are case-sensitive (`CUnitLink`,
 * not `cunitlink`).
 */
export function tokenTypeNamespace(type) {
    if (!type)
        return undefined;
    const ns = LINK_CLASS_NAMESPACES[type];
    return ns !== undefined && CATALOG_NS_SET.has(ns) ? ns : undefined;
}
