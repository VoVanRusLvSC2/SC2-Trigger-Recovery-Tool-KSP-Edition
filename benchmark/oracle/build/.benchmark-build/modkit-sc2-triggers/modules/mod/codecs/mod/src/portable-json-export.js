/** Browser-safe projection of the pinned JSON-mod serializer. */
export function exportJsonMod(mod, options = {}) {
    const { mode = 'raw', namespaces, name, deps = [] } = options;
    const namespaceList = (namespaces ?? mod.namespaces()).filter(namespace => mod.all(namespace).length > 0);
    const entries = {};
    for (const namespace of namespaceList) {
        const baseClass = `C${namespace}`;
        const namespaceEntries = {};
        for (const raw of mod.all(namespace)) {
            const entity = raw;
            const fields = mode === 'full'
                ? mod.getResolved(namespace, entity.id) ?? {}
                : entity.data;
            const output = { ...fields };
            if (entity.class !== baseClass)
                output['class'] = entity.class;
            if (mode === 'raw' && entity.parent !== undefined)
                output['parent'] = entity.parent;
            namespaceEntries[entity.id] = output;
        }
        entries[namespace] = namespaceEntries;
    }
    return {
        manifest: name === undefined ? { format: 'modkit-json-mod@1' } : { format: 'modkit-json-mod@1', name },
        deps,
        entries,
    };
}
