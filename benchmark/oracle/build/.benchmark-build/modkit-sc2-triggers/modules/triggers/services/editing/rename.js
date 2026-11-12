/**
 * Gamelink rename inside Triggers XML — the pure transform.
 *
 * Consolidated verbatim from `@modkitx/ops`'s `rename-triggers.ts` (canonical architecture
 * Phase D item 4, "`galaxy` and `sc2-triggers`"). `@modkitx/ops` now keeps only a thin
 * delegating re-export; the behaviour, signatures, and in-place `{ xml, patched }` contract are
 * unchanged, because `renameEntities()` still drives this per opaque file and per embedded map
 * trigger file.
 *
 * Old-parser walks loaded trigger libraries with LibrarySchema, where a Param's `<Value>` text is
 * typed dynamically: `'..ValueGameType.Type|..ValueType.Type|string'` (sc-schema.js
 * LibraryElement.Value). Renaming then patches Value text for params whose resolved namespace
 * matches the renamed entity, and rewrites the `"Abil,Cmd"` head for abilcmd-typed params.
 *
 * Here the SEMANTIC layer comes from `@modkitx/triggers` (`parseTriggerXmlSync`): Param elements
 * expose `catalogRefs` (`{ catalog, entry }`) for gamelink/anygamelink values and `valueType` for
 * abilcmd. Patching is done by text splicing inside the matching `<Element Type="Param">` block,
 * so file formatting stays byte-stable — which is why the `edit.content` transaction built on top
 * of this (`./edit.js`) can honestly report `preservesUnknownData: true`.
 */
import { parseTriggerXmlSync } from '../../shared/trigger-document/sax-reader.js';
import { ModkitError } from '@modkit/core';
export const TRIGGER_RENAME_CONFLICT_CODE = 'blizzard/sc2-triggers.gamelink-rename-conflict';
export const TRIGGER_RENAME_UNKNOWN_ENTITY_CODE = 'blizzard/sc2-triggers.gamelink-rename-unknown-entity';
export const TRIGGER_RENAME_NO_CATALOG_CODE = 'blizzard/sc2-triggers.gamelink-rename-no-catalog-context';
export const TRIGGER_RENAME_CUSTOM_SCRIPT_CODE = 'blizzard/sc2-triggers.gamelink-rename-custom-script-not-patched';
export const TRIGGER_RENAME_NO_OP_CODE = 'blizzard/sc2-triggers.gamelink-rename-no-op';
function invalidRenameInput(message, data = {}) {
    throw new ModkitError({
        code: 'blizzard/sc2-triggers.config-invalid',
        message,
        context: { operation: 'edit.content', ...data },
    });
}
function isGamelinkRename(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const { catalog, oldId, newId } = value;
    return (typeof catalog === 'string' &&
        catalog.trim() !== '' &&
        typeof oldId === 'string' &&
        oldId.trim() !== '' &&
        typeof newId === 'string' &&
        newId.trim() !== '');
}
/** Validate the JSON value crossing the operation boundary and detach it from caller mutation. */
export function parseTriggerGamelinkRenameInput(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        invalidRenameInput('edit.content requires an object with a non-empty `renames` array.');
    }
    const renames = input.renames;
    if (!Array.isArray(renames) || renames.length === 0 || !renames.every(isGamelinkRename)) {
        invalidRenameInput('edit.content requires a non-empty `renames` array of ' +
            '{ catalog, oldId, newId } objects with non-empty string fields.');
    }
    return {
        renames: renames.map(rename => ({
            catalog: rename.catalog,
            oldId: rename.oldId,
            newId: rename.newId,
        })),
    };
}
function conflictingRenames(renames) {
    const targets = new Map();
    for (const rename of renames) {
        const key = `${rename.catalog.toLowerCase()}/${rename.oldId}`;
        const values = targets.get(key) ?? new Set();
        values.add(rename.newId.replace('*', rename.oldId));
        targets.set(key, values);
    }
    return [...targets.entries()]
        .filter(([, values]) => values.size > 1)
        .map(([key]) => key);
}
function diagnostic(severity, code, message, data) {
    return { severity, code: code, message, ...(data === undefined ? {} : { data }) };
}
export function noTriggerCatalogContextDiagnostic() {
    return diagnostic('warning', TRIGGER_RENAME_NO_CATALOG_CODE, 'No coordinating catalog was supplied. Typed TriggerData values can still be renamed, but ' +
        'the requested source entities cannot be verified against the resolved dependency catalog.');
}
/**
 * Build a {@link TriggerGamelinkMapper} from a serializable rename list.
 *
 * This is what lets the `edit.content` transaction accept JSON input: a function handle cannot
 * cross an operation-session boundary, but the rename list it was derived from can.
 */
export function createTriggerGamelinkMapper(renames) {
    const byCatalog = new Map();
    for (const rename of renames) {
        const key = rename.catalog.toLowerCase();
        let entries = byCatalog.get(key);
        if (entries === undefined) {
            entries = new Map();
            byCatalog.set(key, entries);
        }
        entries.set(rename.oldId, rename.newId.replace('*', rename.oldId));
    }
    return (catalog, id) => byCatalog.get(catalog.toLowerCase())?.get(id);
}
const IMPLICIT_MAP_LIBRARY = '<Standard Id="Map"/>';
function semanticTriggerDocument(xml) {
    const direct = parseTriggerXmlSync(xml);
    if (direct.size > 0)
        return { xml, libraries: direct, implicitMap: false };
    const root = /<TriggerData(?:\s[^>]*)?>/u.exec(xml);
    if (root === null)
        return { xml, libraries: direct, implicitMap: false };
    const offset = root.index + root[0].length;
    const semanticXml = `${xml.slice(0, offset)}${IMPLICIT_MAP_LIBRARY}${xml.slice(offset)}`;
    return { xml: semanticXml, libraries: parseTriggerXmlSync(semanticXml), implicitMap: true };
}
/**
 * Rewrite gamelink/abilcmd Param values in one Triggers XML document.
 *
 * @param xml    Triggers XML text (a map `Triggers` file or a `*.SC2Lib` library)
 * @param mapped (catalog, id) → new id, or undefined when not renamed.
 *               `catalog` comes verbatim from <ValueGameType Type="..."> —
 *               implementations should match namespaces case-insensitively
 *               (old-parser lowercases it).
 */
export function renameTriggerGamelinks(xml, mapped) {
    // 1. Semantic pass — let @modkitx/triggers identify typed Param values.
    //    key "paramId value" → { old, next }
    const targets = new Map();
    let document;
    try {
        document = semanticTriggerDocument(xml);
    }
    catch {
        return { xml, patched: 0 }; // not a triggers document
    }
    for (const lib of document.libraries.values()) {
        for (const [pid, param] of Object.entries(lib.elementsByType.Param)) {
            if (!param.value)
                continue;
            let next;
            // gamelink / anygamelink — catalog comes from ValueGameType
            for (const ref of param.catalogRefs ?? []) {
                if (!ref.entry)
                    continue;
                const r = mapped(ref.catalog, ref.entry);
                if (r !== undefined)
                    next = r;
            }
            // abilcmd — "AbilId,CmdIndex" or bare "AbilId" (old-parser 'abilcmd' case)
            if (next === undefined && param.valueType?.type?.toLowerCase() === 'abilcmd') {
                const comma = param.value.indexOf(',');
                const head = comma < 0 ? param.value : param.value.slice(0, comma);
                const r = mapped('Abil', head);
                if (r !== undefined)
                    next = comma < 0 ? r : r + param.value.slice(comma);
            }
            if (next !== undefined && next !== param.value) {
                targets.set(`${pid} ${param.value}`, { old: param.value, next });
            }
        }
    }
    if (targets.size === 0)
        return { xml, patched: 0 };
    // 2. Text pass — splice new ids into the matching Param blocks only.
    let patched = 0;
    const out = document.xml.replace(/(<Element\s+Type="Param"\s+Id="([^"]+)"[^>]*>)([\s\S]*?)(<\/Element>)/g, (whole, open, id, body, close) => {
        // find a target registered for this param id (value must match too)
        for (const [key, t] of targets) {
            if (!key.startsWith(`${id} `))
                continue;
            const valueTag = `<Value>${t.old}</Value>`;
            if (!body.includes(valueTag))
                continue;
            patched++;
            return open + body.replace(valueTag, `<Value>${t.next}</Value>`) + close;
        }
        return whole;
    });
    return {
        xml: document.implicitMap ? out.replace(IMPLICIT_MAP_LIBRARY, '') : out,
        patched,
    };
}
/**
 * Validate and prepare one MK3 gamelink edit without mutating the source document.
 *
 * Catalog verification is optional because the standalone TriggerData codec is allowed to open a
 * document without the surrounding mod. The warning makes that reduced proof explicit. A caller
 * with a dependency-merged catalog should pass it and receives per-entity stale-reference warnings.
 */
export function prepareTriggerGamelinkRename(xml, scriptBlocks, input, catalogContext) {
    const { renames } = parseTriggerGamelinkRenameInput(input);
    const diagnostics = [];
    const conflicts = conflictingRenames(renames);
    if (conflicts.length > 0) {
        diagnostics.push(diagnostic('error', TRIGGER_RENAME_CONFLICT_CODE, `${conflicts.length} catalog ${conflicts.length === 1 ? 'entity is' : 'entities are'} ` +
            'listed with different target ids. Each (catalog, oldId) must resolve to one new id.', { entities: conflicts.slice(0, 10), count: conflicts.length }));
        return { xml, patched: 0, diagnostics: Object.freeze(diagnostics) };
    }
    if (catalogContext === undefined) {
        diagnostics.push(noTriggerCatalogContextDiagnostic());
    }
    else {
        const unknown = renames
            .filter(rename => !catalogContext.hasEntity(rename.catalog, rename.oldId))
            .map(rename => `${rename.catalog}/${rename.oldId}`);
        if (unknown.length > 0) {
            diagnostics.push(diagnostic('warning', TRIGGER_RENAME_UNKNOWN_ENTITY_CODE, `${unknown.length} requested source ${unknown.length === 1 ? 'entity is' : 'entities are'} ` +
                'absent from the coordinating catalog. Dependency mods may still provide them.', { entities: unknown.slice(0, 10), count: unknown.length }));
        }
    }
    const result = renameTriggerGamelinks(xml, createTriggerGamelinkMapper(renames));
    if (result.patched > 0 && scriptBlocks > 0) {
        diagnostics.push(diagnostic('warning', TRIGGER_RENAME_CUSTOM_SCRIPT_CODE, `${scriptBlocks} custom ScriptCode ${scriptBlocks === 1 ? 'block was' : 'blocks were'} not ` +
            'searched. Only typed TriggerData Param values were renamed.', { blocks: scriptBlocks }));
    }
    if (result.patched === 0) {
        diagnostics.push(diagnostic('information', TRIGGER_RENAME_NO_OP_CODE, 'No typed gamelink or abilcmd Param references any requested source entity.'));
    }
    return { ...result, diagnostics: Object.freeze(diagnostics) };
}
/**
 * Trigger-bearing file paths inside a mod (map Triggers file or trigger libs).
 *
 * Re-exported so this codec's API is unchanged. The predicate itself is path identity and lives
 * in the SC2 shared scripts boundary, where callers that hold no codec can reach it.
 */
export { isTriggerFilePath } from '../../../../shared/scripts/identity.js';
