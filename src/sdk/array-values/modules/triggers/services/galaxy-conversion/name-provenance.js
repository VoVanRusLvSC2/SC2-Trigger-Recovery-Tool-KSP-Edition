/** A fallback identifier is a usable label, not evidence of an authored GUI name. */
export function recoveredNameMessage(item) {
    return item.source === 'galaxy-identifier'
        ? `Derived the display name of ${item.type} ${item.id} from its Galaxy identifier; the authored GUI label is unknown`
        : `Restored the authored name of ${item.type} ${item.id} from TriggerStrings`;
}
/** Distinguish imported API declarations materialized by the converter from
 * definitions actually present in owned Galaxy. This is an audit, not permission
 * to replace Current APIs by similarly named Deprecated functions. */
export function auditLocalNativeDeclarations(library, ownedSources) {
    const natives = Object.values(library.elements ?? {}).filter(e => e.type === 'FunctionDef' && e.flags?.includes('Native'));
    const owned = new Set();
    const sources = natives.length ? (typeof ownedSources === 'function' ? ownedSources() : ownedSources) : [];
    for (const source of sources)
        for (const n of source.statements ?? [])
            if (n.kind === 142 && typeof n.name?.name === 'string')
                owned.add(n.name.name);
    const declarations = [];
    for (const e of natives) {
        const name = e.identifier ?? e.name;
        // Only unprefixed Native API names are directly comparable to source names.
        const unprefixed = e.flags.includes('NoScriptPrefix');
        const sourceOwned = unprefixed && owned.has(name);
        declarations.push({ id: e.id, library: library.id, name, returnType: e.returnType,
            hasBody: !!e.scriptCode || !!e.actions?.length,
            origin: sourceOwned ? 'OWNED_SOURCE_DECLARATION' : unprefixed ? 'CONVERTER_MATERIALIZED_NATIVE_API' : 'SOURCE_IDENTITY_UNRESOLVED',
            guiRecoveryPending: !sourceOwned });
    }
    return { declarations, additionalLocalDeclarations: declarations.filter(d => d.guiRecoveryPending).length,
        guiAccepted: false, rule: 'Native API declarations are not authored GUI functions; unresolved materialization requires review' };
}
