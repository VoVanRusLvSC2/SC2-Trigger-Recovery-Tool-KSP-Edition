/**
 * Парсит TriggerStrings.txt и возвращает мапу elementId → localized name.
 *
 * Формат строк:
 *   FunctionDef/Name/lib_Ntve_11EB5EB1=UnitCreate
 *   ParamDef/Name/lib_Ntve_D7C08249=Player
 *   PresetValue/Name/lib_Ntve_2999701E=Terr
 *
 * Ключ результата: `{type}:{libraryId}_{elementId}` (например `Ntve_11EB5EB1`)
 */
export function parseTriggerStrings(content) {
    const names = new Map();
    for (const rawLine of content.split(/\r?\n/)) {
        // Leading layout whitespace is not part of a key, but whitespace after
        // '=' is localized content. In particular, the editor distinguishes an
        // empty Param/Value from a one-space Param/Value when generating Galaxy.
        const line = rawLine.trimStart();
        if (!line || line.startsWith('#'))
            continue;
        if (line.startsWith('Param/Value/')) {
            const valueMatch = /^Param\/Value\/(?:lib_(.+)_)?([A-Fa-f0-9]+)=(.*)$/.exec(line);
            if (valueMatch) {
                const [, libId, elementId, value] = valueMatch;
                names.set(`ParamValue:${libId === undefined ? 'Root:' : libId + '_'}${elementId}`, value);
            }
            continue;
        }
        // Named strings can use a qualified library key or a map-root key.
        const match = /^(FunctionDef|ParamDef|PresetValue|Preset|Variable|Trigger|Category|Label|SubFuncType|Structure|CustomScript)\/(Name|Grammar)\/(?:lib_([A-Za-z0-9_]+)_)?([A-Fa-f0-9]+)=(.*)$/.exec(line);
        if (match) {
            const [, type, field, libId, elementId, name] = match;
            names.set(`${field === 'Grammar' ? 'Grammar:' : ''}${type}:${libId === undefined ? 'Root:' : libId + '_'}${elementId}`, name.trim());
            continue;
        }
        // Format: Library/Name/{LibraryId}=Name (library-level name)
        const libMatch = line.match(/^Library\/Name\/([A-Za-z0-9_]+)=(.+)$/);
        if (libMatch) {
            const [, libId, name] = libMatch;
            names.set(`Library:${libId}`, name.trim());
        }
    }
    return names;
}
/**
 * Применяет локализованные имена из TriggerStrings к элементам библиотеки.
 */
export function applyTriggerStrings(libraryId, elements, strings) {
    for (const [keyId, el] of Object.entries(elements)) {
        const id = el.id ?? keyId;
        if (el.type === 'Param') {
            const valueKey = `ParamValue:${libraryId}_${id}`;
            const rootValueKey = `ParamValue:Root:${id}`;
            if (strings.has(valueKey))
                el.localizedValue = strings.get(valueKey);
            else if (strings.has(rootValueKey))
                el.localizedValue = strings.get(rootValueKey);
        }
        // Never overwrite names already set from <Identifier> tag (Galaxy native names).
        // For Ntve native FunctionDefs, Identifier IS the Galaxy function name
        // (e.g. "TriggerAddEventMapInit", "SetVariable"). TriggerStrings contains
        // display names ("Map Initialization", "Set Variable") — useful for UI,
        // but NOT for code generation.
        const key = `${el.type}:${libraryId}_${id}`;
        const grammar = strings.get(`Grammar:${key}`) ?? strings.get(`Grammar:${el.type}:Root:${id}`);
        if (el.grammar === undefined && grammar !== undefined) {
            el.grammar = grammar;
            el.grammarSource = 'strings';
        }
        const localized = strings.get(key) ?? strings.get(`${el.type}:Root:${id}`);
        if (localized) {
            el.displayName = localized;
            el.name ??= localized;
        }
    }
}
export function applyTriggerStringsByType(libraryId, elementsByType, strings) {
    for (const [type, typeMap] of Object.entries(elementsByType)) {
        const scopedPrefix = `${type}:${libraryId}_`;
        const rootPrefix = `${type}:Root:`;
        const scopedGrammar = `Grammar:${scopedPrefix}`;
        const rootGrammar = `Grammar:${rootPrefix}`;
        for (const id of Object.keys(typeMap)) {
            const el = typeMap[id];
            if (type === 'Param') {
                const valueKey = `ParamValue:${libraryId}_${id}`;
                const rootValueKey = `ParamValue:Root:${id}`;
                if (strings.has(valueKey))
                    el.localizedValue = strings.get(valueKey);
                else if (strings.has(rootValueKey))
                    el.localizedValue = strings.get(rootValueKey);
            }
            // Keep authored identifiers independent of localized labels.
            if (el.grammar === undefined) {
                const grammar = strings.get(scopedGrammar + id) ?? strings.get(rootGrammar + id);
                if (grammar !== undefined) {
                    el.grammar = grammar;
                    el.grammarSource = 'strings';
                }
            }
            const localized = strings.get(scopedPrefix + id) ?? strings.get(rootPrefix + id);
            if (localized) {
                el.displayName = localized;
                el.name ??= localized;
            }
        }
    }
}
//# sourceMappingURL=trigger-strings.js.map
