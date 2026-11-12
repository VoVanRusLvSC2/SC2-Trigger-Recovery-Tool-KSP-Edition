import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: name => ['category', 'value', 'objectUsage', 'usage'].includes(name),
});
function asArray(value) {
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number')
        return String(value);
    if (value !== null && typeof value === 'object' && '#text' in value) {
        return String(value['#text']);
    }
    return '';
}
function parseUsages(node) {
    if (node === null || typeof node !== 'object')
        return [];
    return asArray(node.usage).map(value => {
        const usage = value ?? {};
        const source = String(usage['@_source'] ?? '');
        const category = toText(usage['#text']) || undefined;
        return source === 'External' && category ? { source, category } : { source };
    });
}
export function parseEditorCategories(xml) {
    const categories = new Map();
    const objectUsage = new Map();
    let root;
    try {
        root = parser.parse(xml)?.EditorCategories;
    }
    catch {
        return { categories, objectUsage };
    }
    if (!root || typeof root !== 'object')
        return { categories, objectUsage };
    for (const value of asArray(root.category)) {
        const category = value ?? {};
        const name = String(category['@_name'] ?? '');
        if (!name)
            continue;
        categories.set(name, asArray(category.value).map(toText).filter(Boolean));
    }
    for (const value of asArray(root.objectUsage)) {
        const usage = value ?? {};
        const type = String(usage['@_type'] ?? '');
        if (!type)
            continue;
        objectUsage.set(type, {
            type,
            objects: parseUsages(usage.objects),
            fields: parseUsages(usage.fields),
        });
    }
    return { categories, objectUsage };
}
export function mergeEditorCategories(target, source) {
    const categories = new Map(target.categories);
    for (const [name, values] of source.categories) {
        const existing = categories.get(name);
        if (!existing) {
            categories.set(name, [...values]);
            continue;
        }
        const seen = new Set(existing);
        categories.set(name, [...existing, ...values.filter(value => !seen.has(value))]);
    }
    const objectUsage = new Map(target.objectUsage);
    for (const [type, usage] of source.objectUsage)
        objectUsage.set(type, usage);
    return { categories, objectUsage };
}
export const EMPTY_EDITOR_CATEGORIES = {
    categories: new Map(),
    objectUsage: new Map(),
};
