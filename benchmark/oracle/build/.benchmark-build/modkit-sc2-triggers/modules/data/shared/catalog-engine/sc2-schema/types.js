/**
 * Runtime schema registry — holds all catalog type schemas.
 * Used for merge, rename reference discovery, typed walk, and subtree extraction.
 */
export class SchemaRegistry {
    types = new Map();
    register(schema) {
        this.types.set(schema.name, schema);
    }
    get(typeName) {
        return this.types.get(typeName);
    }
    has(typeName) {
        return this.types.has(typeName);
    }
    /**
     * Returns all fields for a type including inherited fields from parent chain.
     * Later entries (child) win over earlier (parent) for field definitions.
     */
    resolveFields(typeName) {
        const chain = this.inheritanceChain(typeName);
        const merged = {};
        for (const type of chain) {
            Object.assign(merged, type.fields);
        }
        return merged;
    }
    /**
     * Returns the full inheritance chain from root → leaf (CBase first, CUnit last).
     */
    inheritanceChain(typeName) {
        const chain = [];
        let current = typeName;
        const seen = new Set();
        while (current && !seen.has(current)) {
            seen.add(current);
            const schema = this.types.get(current);
            if (!schema)
                break;
            chain.unshift(schema); // prepend so root is first
            current = schema.parent;
        }
        return chain;
    }
    /** Walk all fields of a type (resolved + inherited) via callback */
    walkFields(typeName, data, cb) {
        const fields = this.resolveFields(typeName);
        walkObject(fields, data, cb, []);
    }
    all() {
        return this.types.values();
    }
}
function walkObject(fields, data, cb, path) {
    for (const [fieldName, fieldSchema] of Object.entries(fields)) {
        const value = data[fieldName];
        if (value === undefined)
            continue;
        const location = {
            typeName: path[0] ?? '',
            fieldName,
            path: [...path, fieldName],
        };
        if (fieldSchema.isArray && Array.isArray(value)) {
            for (const item of value) {
                cb(item, fieldSchema, location);
                if (fieldSchema.fields && typeof item === 'object' && item !== null) {
                    walkObject(fieldSchema.fields, item, cb, [...path, fieldName]);
                }
            }
        }
        else {
            cb(value, fieldSchema, location);
            if (fieldSchema.fields && typeof value === 'object' && value !== null) {
                walkObject(fieldSchema.fields, value, cb, [...path, fieldName]);
            }
        }
    }
}
