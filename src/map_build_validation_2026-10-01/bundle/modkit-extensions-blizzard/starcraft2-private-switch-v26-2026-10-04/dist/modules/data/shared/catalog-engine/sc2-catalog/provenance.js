import { isTombstone, slotKeys } from './merge.js';
const DEFAULT_LIST = { isArray: true, arrayMerge: 'indexed' };
const keyOf = (path) => JSON.stringify(path);
const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const startsWith = (path, prefix) => prefix.length <= path.length && prefix.every((part, index) => path[index] === part);
/** One top-level field's leaves; appended items are recorded as `#n` and read back by position. */
class FieldLeaves {
    source;
    entity;
    leaves = new Map();
    /** Appended lists: path → item ids in order, `undefined` for an item a later slot removed. */
    appended = new Map();
    nextItem = 0;
    constructor(source, entity) {
        this.source = source;
        this.entity = entity;
    }
    clear(prefix) {
        for (const [key, leaf] of this.leaves)
            if (startsWith(leaf.path, prefix))
                this.leaves.delete(key);
    }
    set(path, origin) {
        this.clear(path);
        this.leaves.set(keyOf(path), { path, origin });
    }
    has(prefix) {
        for (const leaf of this.leaves.values())
            if (startsWith(leaf.path, prefix))
                return true;
        return false;
    }
    appendItem(path) {
        const order = this.appended.get(keyOf(path)) ?? [];
        const id = `#${this.nextItem++}`;
        order.push(id);
        this.appended.set(keyOf(path), order);
        return id;
    }
    /** Remove the appended item in running slot `slot`; later items keep their slots until read. */
    removeItem(path, slot) {
        const order = this.appended.get(keyOf(path));
        const id = order?.[slot];
        if (order === undefined || id === undefined)
            return;
        order[slot] = undefined;
        this.clear([...path, id]);
    }
    originAt(path) {
        const recorded = [];
        for (const part of path) {
            const order = this.appended.get(keyOf(recorded));
            if (order !== undefined && /^\d+$/u.test(part)) {
                const id = order.filter((item) => item !== undefined)[Number(part)];
                if (id === undefined)
                    return undefined;
                recorded.push(id);
            }
            else
                recorded.push(part);
        }
        return this.leaves.get(keyOf(recorded))?.origin;
    }
}
function write(value, field, path, writing) {
    if ((field?.isArray === true && field.arrayMerge !== 'replace') || (field === undefined && Array.isArray(value))) {
        writeList(Array.isArray(value) ? value : [value], field ?? DEFAULT_LIST, path, writing);
    }
    else if (isObj(value)) {
        writeRecord(value, field?.fields, path, writing, new Set(['removed']));
    }
    else {
        writing.leaves.set(path, writing.origin);
    }
}
function writeRecord(value, fields, path, writing, ignored) {
    const entries = Object.entries(value).filter(([key]) => !ignored.has(key));
    if (entries.length === 0) {
        if (!writing.leaves.has(path))
            writing.leaves.set(path, writing.origin);
        return;
    }
    for (const [key, item] of entries)
        write(item, fields?.[key], [...path, key], writing);
}
function writeList(items, field, path, writing) {
    const strategy = field.arrayMerge ?? 'indexed';
    const indexAttr = strategy === 'append' ? 'index' : field.indexAttr ?? (strategy === 'named' ? 'id' : 'index');
    const keys = slotKeys(items, indexAttr);
    items.forEach((item, position) => {
        const key = keys[position];
        if (strategy === 'append') {
            if (isTombstone(item)) {
                if (key !== undefined && /^\d+$/u.test(key))
                    writing.leaves.removeItem(path, Number(key));
                return;
            }
            const id = writing.leaves.appendItem(path);
            if (isObj(item))
                writeRecord(item, field.fields, [...path, id], writing, new Set(['index', 'removed']));
            else
                writing.leaves.set([...path, id], writing.origin);
            return;
        }
        const slot = [...path, key ?? writing.leaves.appendItem(path)];
        if (isTombstone(item)) {
            writing.leaves.clear(slot);
            writing.removed?.(slot);
            return;
        }
        if (!isObj(item)) {
            writing.leaves.set(slot, writing.origin);
            return;
        }
        // `{index, value}` is a scalar in its slot; a struct element merges key by key.
        const own = Object.keys(item).filter(name => name !== indexAttr && name !== 'removed');
        if (own.length === 1 && own[0] === 'value' && !isObj(item['value']) && !Array.isArray(item['value'])) {
            writing.leaves.set(slot, writing.origin);
        }
        else {
            writeRecord(item, field.fields, slot, writing, new Set([indexAttr, 'removed']));
        }
    });
}
/**
 * Provenance of `entity` along `chain` (root first, the entity last), merging by the entity's
 * class schema as `resolveEntity` does.
 */
export function entityProvenance(entity, chain, schema) {
    const fields = new Map();
    const own = new Set();
    const tombstones = [];
    for (const link of chain) {
        const declarations = link.declarations ?? (link.source === undefined ? [] : [{ source: link.source, data: link.data }]);
        for (const declaration of declarations) {
            for (const [fieldId, value] of Object.entries(declaration.data)) {
                const origin = { source: declaration.source, entity: link };
                let leaves = fields.get(fieldId);
                if (leaves === undefined) {
                    leaves = new FieldLeaves(declaration.source, link);
                    fields.set(fieldId, leaves);
                }
                else {
                    leaves.source = declaration.source;
                    leaves.entity = link;
                }
                const writing = link === entity
                    ? { leaves, origin, removed: path => tombstones.push({ path: [fieldId, ...path], source: declaration.source }) }
                    : { leaves, origin };
                write(value, schema[fieldId], [], writing);
                if (link === entity)
                    own.add(fieldId);
            }
        }
    }
    return { fields, own, tombstones };
}
//# sourceMappingURL=provenance.js.map