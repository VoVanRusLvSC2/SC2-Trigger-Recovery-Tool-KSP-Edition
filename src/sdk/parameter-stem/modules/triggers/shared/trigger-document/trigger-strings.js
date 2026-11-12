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
        if (!line.trim() || line.startsWith('#'))
            continue;
        const qualifiedValue = line.match(/^Param\/Value\/lib_(.+)_([A-Fa-f0-9]+)=(.*)$/);
        if (qualifiedValue) {
            const [, libId, elementId, value] = qualifiedValue;
            names.set(`ParamValue:${libId}_${elementId}`, value);
            continue;
        }
        const rootValue = line.match(/^Param\/Value\/([A-Fa-f0-9]+)=(.*)$/);
        if (rootValue) {
            const [, elementId, value] = rootValue;
            names.set(`ParamValue:Root:${elementId}`, value);
            continue;
        }
        // Format: Type/Name/lib_{Library}_{Id}=Name (element names)
        const match = line.match(/^(FunctionDef|ParamDef|PresetValue|Preset|Variable|Trigger|Category|Label|SubFuncType|Structure|CustomScript)\/(Name|Grammar)\/lib_([A-Za-z0-9_]+)_([A-Fa-f0-9]+)=(.*)$/);
        if (match) {
            const [, type, field, libId, elementId, name] = match;
            names.set(`${field === 'Grammar' ? 'Grammar:' : ''}${type}:${libId}_${elementId}`, name.trim());
            continue;
        }
        // Root-only SC2Map format: Type/Name/{Id}=Name
        const rootMatch = line.match(/^(FunctionDef|ParamDef|PresetValue|Preset|Variable|Trigger|Category|Label|SubFuncType|Structure|CustomScript)\/(Name|Grammar)\/([A-Fa-f0-9]+)=(.*)$/);
        if (rootMatch) {
            const [, type, field, elementId, name] = rootMatch;
            names.set(`${field === 'Grammar' ? 'Grammar:' : ''}${type}:Root:${elementId}`, name.trim());
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
        for (const [id, el] of Object.entries(typeMap)) {
            if (type === 'Param') {
                const valueKey = `ParamValue:${libraryId}_${id}`;
                const rootValueKey = `ParamValue:Root:${id}`;
                if (strings.has(valueKey))
                    el.localizedValue = strings.get(valueKey);
                else if (strings.has(rootValueKey))
                    el.localizedValue = strings.get(rootValueKey);
            }
            // Keep authored identifiers independent of localized labels.
            const key = `${type}:${libraryId}_${id}`;
            const grammar = strings.get(`Grammar:${key}`) ?? strings.get(`Grammar:${type}:Root:${id}`);
            if (el.grammar === undefined && grammar !== undefined) {
                el.grammar = grammar;
                el.grammarSource = 'strings';
            }
            const localized = strings.get(key) ?? strings.get(`${type}:Root:${id}`);
            if (localized) {
                el.displayName = localized;
                el.name ??= localized;
            }
        }
    }
}
//# sourceMappingURL=trigger-strings.js.map