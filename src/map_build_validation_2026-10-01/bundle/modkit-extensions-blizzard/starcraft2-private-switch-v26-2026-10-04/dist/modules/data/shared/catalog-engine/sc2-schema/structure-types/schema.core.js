import { CScalar, CBoolean, CNumber, CString, SchemaValue } from "./schema.primitives.js";
// Re-export primitives for convenience
// export {
//   CScalar,
//   CBoolean,
//   CNumber,
//   CString,
//   CDataOptions,
//   SchemaValue,
//   WalkOptions,
//   WalkTrace,
//   SCData,
//   SCDataScalar,
//   SCDataArray,
//   SCDataArrayItem,
//   SCDataObject
// };
import { isInteger, isNumeric } from "./util.js";
import { getLogger } from "@modkit/codec-kit";
const schemaLog = getLogger(["schema", "enum"]);
export const TypeFlags = {
    JSON: 1,
    Attribute: 2,
    Instruction: 4,
    Default: 8,
    Tag: 16,
    PreventInheritance: 32,
    Use: 64,
};
// --- Core Classes ---
export class CDataFields extends SchemaValue {
    group = true;
    computeField(merged, chain, field, schema, resolve) {
        if (schema.computable) {
            const values = [];
            for (let i = 0; i < chain.length; i++) {
                if (chain[i][field] !== undefined)
                    values.push(chain[i][field]);
            }
            if (values.length === 0)
                return;
            merged[field] = schema.compute(values, resolve);
        }
        else {
            let i = chain.length - 1;
            do {
                if (chain[i][field] !== undefined) {
                    merged[field] = chain[i][field];
                    break;
                }
            } while (i--);
        }
    }
    getChainFields(chain) {
        const keys = new Set();
        for (const item of chain)
            for (const key in item)
                keys.add(key);
        return keys;
    }
}
export class CEnum extends CScalar {
    static enum;
    enum;
    unknown;
    missing;
    constructor(options = {}) {
        super(options);
        if (options.list)
            this.enum = options.list;
        if (options.unknown)
            this.unknown = options.unknown;
    }
    static Ex(e) {
        const keys = Object.keys(e).filter(k => isNaN(Number(k)));
        const cls = class extends this {
            static enum = keys;
            enum = keys;
        };
        return cls;
    }
    static FromArray(list) {
        const cls = class extends this {
            static enum = list;
            enum = list;
        };
        return cls;
    }
    validate(val) {
        const unknown = this.unknown || "Unknown";
        if (val === unknown)
            return true;
        if (!this.enum?.includes(val))
            return false;
        return true;
    }
    fromString(val) {
        if (this.validate(val))
            return val;
        if (isInteger(val)) {
            return (this.getEnumName(+val) ?? val);
        }
        return val;
    }
    getEnumName(value) {
        return value === -1 ? this.unknown : this.enum?.[value];
    }
    log(val, trace, category = "Error", message = "") {
        schemaLog.info(`[${category}] ${message || val} ${trace ? '(' + trace.join('.') + ')' : ''}`);
    }
}
/**
 * List of scalar items, e.g. "a,b,c" or "1;2;3".
 */
export class CList extends CScalar {
    separator = ",";
    itemType;
    constructor(options) {
        super(options);
        if (options.separator)
            this.separator = options.separator;
        this.itemType = this.schema.getType(options.type);
    }
    fromString(str) {
        return str.split(this.separator).filter(Boolean).map(v => this.itemType.fromString(v));
    }
    toString(obj) {
        return obj.map(v => this.itemType.toString(v)).join(this.separator);
    }
}
/**
 * String-based array with factory methods.
 */
export class CStringArray extends CScalar {
    separator = ",";
    itemType;
    size;
    /** Static item type for introspection (relations/rename walkers). */
    static memberType;
    static Ex(type, size) {
        // NB: extend `this` (CSArray/CWArray/CCArray), not CStringArray — the subclass
        // must keep the separator of the class Ex() was called on.
        return class extends this {
            static memberType = type;
            constructor(opts = {}) {
                super({ ...opts });
                this.itemType = this.schema.getType(type);
                if (size !== undefined)
                    this.size = size;
            }
        };
    }
    fromString(str) {
        if (!this.itemType)
            return [];
        return str.split(this.separator).filter(Boolean).map(v => this.itemType.fromString(v));
    }
    toString(obj) {
        if (!this.itemType)
            return "";
        return obj.map(v => this.itemType.toString(v)).join(this.separator);
    }
}
export class CCArray extends CStringArray {
    separator = ',';
}
export class CSArray extends CStringArray {
    separator = ';';
}
export class CWArray extends CStringArray {
    separator = ' ';
}
/**
 * Tuple of fixed types, e.g. "255,128,64".
 */
export class CTuple extends SchemaValue {
    group = true;
    types;
    separator = ",";
    constructor(options) {
        super(options);
        this.types = options.types.map(t => this.schema.getType(t));
        if (options.separator)
            this.separator = options.separator;
    }
    /** Static member types for introspection (relations/rename walkers). */
    static memberTypes;
    static Ex(...types) {
        const cls = class extends this {
            static memberTypes = types;
            constructor(opts = {}) {
                super({ ...opts, types });
            }
        };
        return cls;
    }
    fromString(str) {
        const parts = str.split(this.separator);
        return this.types.map((t, i) => t.fromString(parts[i] || ''));
    }
    toString(obj) {
        return this.types.map((t, i) => t.toString(obj[i])).join(this.separator);
    }
    _walkNode(object, options) {
        const trace = options.trace;
        const crumb = { object, schema: this, property: '' };
        trace.push(crumb);
        for (let i = 0; i < this.types.length; i++) {
            crumb.property = i;
            const type = this.types[i];
            const result = options.before?.(object, i, object[i], type, trace);
            if (result !== false) {
                if (!type.scalar)
                    type._walkNode(object[i], options);
                options.after?.(object, i, object[i], type, trace);
            }
        }
        trace.pop();
    }
}
export class CWTuple extends CTuple {
    separator = ' ';
}
export class CCTuple extends CTuple {
    separator = ',';
}
export class CSTuple extends CTuple {
    separator = ';';
}
export class CDTuple extends CTuple {
    separator = '.';
}
export class COTuple extends CTuple {
    separator = ':';
}
export class CVariator extends CScalar {
    separator = ",";
    itemType;
    constructor(options = {}) {
        super(options);
        if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
            if (options.type)
                this.itemType = this.schema.getType(options.type);
            if (options.separator)
                this.separator = options.separator;
        }
    }
    static Ex(type) {
        const cls = class extends this {
            constructor(opts = {}) {
                super({ ...opts, type });
            }
        };
        return cls;
    }
    fromString(str) {
        if (!this.itemType)
            return [0];
        const parts = str.split(this.separator).map(v => this.itemType.fromString(v));
        return parts.slice(0, 2);
    }
    toString(obj) {
        if (!this.itemType)
            return "";
        return obj.map(v => this.itemType.toString(v)).join(this.separator);
    }
}
export class CRecord extends CDataFields {
    static index;
    static value;
    indexField = "index";
    computable = true;
    constructor(options) {
        super(options);
        if (options) {
            Object.assign(this, options);
        }
    }
    static Ex(index, value) {
        const cls = class extends this {
            static index = index;
            static value = value;
        };
        return cls;
    }
    toXML(data) {
        const result = [];
        const valueType = this.constructor.value.prototype;
        for (const index in data) {
            const item = data[index];
            const base = valueType.toXML(item);
            result.push({
                ...base,
                attributes: {
                    ...base.attributes,
                    [this.indexField]: index
                }
            });
        }
        return result;
    }
    compute(chain, resolve = false) {
        const keys = this.getChainFields(chain);
        const merged = {};
        const valueType = this.constructor.value.prototype;
        for (const field of keys) {
            this.computeField(merged, chain, field, valueType, resolve);
        }
        return merged;
    }
    _walkNode(object, options) {
        const trace = options.trace;
        const valueType = this.constructor.value.prototype;
        const indexType = this.constructor.index.prototype;
        const keys = Object.keys(object);
        const crumb = { object, schema: this, property: '' };
        trace.push(crumb);
        for (const key of keys) {
            crumb.property = key;
            const item = object[key];
            const recorditem = { [this.indexField]: key };
            const result = options.before?.(recorditem, this.indexField, recorditem[this.indexField], indexType, trace);
            if (recorditem[this.indexField] !== key) {
                delete object[key];
                object[recorditem[this.indexField]] = item;
            }
            if (result !== false) {
                if (!valueType.scalar)
                    valueType._walkNode(item, options);
                options.after?.(recorditem, this.indexField, recorditem[this.indexField], indexType, trace);
            }
        }
        trace.pop();
    }
}
/**
 * Specialized SchemaRecord used in lib_schema.
 */
export class SchemaRecord extends CRecord {
    type;
    list;
    constructor(options) {
        super(options);
        if (options.index)
            this.indexField = options.index;
        this.initTypes(options.type, options.list);
    }
    initTypes(type, list) {
        this.type = typeof type === 'string' ? this.schema.getType(type) : type;
        this.list = this.schema.enums[list];
        this.constructor.value = { prototype: this.type };
        this.constructor.index = { prototype: this.list };
    }
    compute(chain, resolve = false) {
        const keys = this.getChainFields(chain);
        const merged = {};
        for (const field of keys) {
            this.computeField(merged, chain, field, this.type, resolve);
        }
        return merged;
    }
}
/**
 * Flags collection saved as a semicolon-separated string.
 */
export class CFlags extends SchemaValue {
    group = true;
    list;
    constructor(options) {
        // If it's a schema definition
        if (typeof options === 'object' && 'list' in options && typeof options.list === 'string') {
            super(options);
            if (this.schema?.enums) {
                this.list = this.schema.enums[options.list];
            }
        }
        else {
            // If it's a data instance
            super();
            Object.assign(this, options);
        }
    }
    static Ex(list) {
        const keys = (typeof list === "function" && "enum" in list) ? list.enum : (list instanceof CEnum ? list.enum : (Array.isArray(list) ? list : []));
        const cls = class extends CFlags {
            static list = keys;
            constructor(init) {
                super({ list: keys });
                for (const key of (keys || [])) {
                    this[key] = false;
                }
                if (init) {
                    for (const key in init) {
                        this[key] = init[key];
                    }
                }
            }
        };
        return cls;
    }
    fromString(str) {
        const result = {};
        str.split(";").filter(Boolean).forEach(p => {
            result[p] = true;
        });
        return result;
    }
    toString(obj) {
        return Object.keys(obj).filter(k => obj[k]).join(";");
    }
    _walkNode(object, options) {
        const trace = options.trace;
        const crumb = { object, schema: this, property: '' };
        trace.push(crumb);
        for (const key in object) {
            crumb.property = key;
            const result = options.before?.(object, key, object[key], this.list, trace);
            if (result !== false)
                options.after?.(object, key, object[key], this.list, trace);
        }
        trace.pop();
    }
}
/**
 * Array of items. Supports index/removed tags for SC2 diffing.
 */
export class CArray extends SchemaValue {
    array = true;
    type;
    constructor(options) {
        super(options);
        this.type = typeof options.type === 'string' ? this.schema.getType(options.type) : options.type;
    }
    compute(chain, resolve = false) {
        return chain.flat();
    }
    _walkNode(object, options) {
        const trace = options.trace, type = this.type;
        const crumb = { object, schema: this, property: '' };
        trace.push(crumb);
        for (let i = 0; i < object.length; i++) {
            crumb.property = i;
            const item = object[i];
            const result = options.before?.(object, i, item, type, trace);
            if (result !== false) {
                if (!type.scalar)
                    type._walkNode(item, options);
                options.after?.(object, i, item, type, trace);
            }
        }
        trace.pop();
    }
}
// --- CObject with Proper Typings ---
export class CObject extends CDataFields {
    static schema = {};
    static Ex;
    computable = true;
    constructor(options) {
        super(options);
        if (options) {
            Object.assign(this, options);
        }
    }
    static getMergedSchema() {
        const merged = {};
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current = this;
        while (current && current.schema) {
            Object.assign(merged, current.schema);
            current = Object.getPrototypeOf(current);
        }
        return merged;
    }
    toXML(data) {
        const schema = this.constructor.getMergedSchema();
        const node = {
            tag: data.class || this.name,
            attributes: {},
            children: []
        };
        for (const [field, value] of Object.entries(data)) {
            const fType = schema[field];
            if (!fType)
                continue;
            const fschema = fType.prototype;
            if (fschema.attribute) {
                node.attributes[field] = fschema.toXML(value);
            }
            else {
                const childNode = fschema.toXML(value);
                if (Array.isArray(childNode)) {
                    node.children.push(...childNode);
                }
                else if (childNode) {
                    node.children.push(childNode);
                }
            }
        }
        return node;
    }
}
// Add the Ex method to CObject after class definition
CObject.Ex = function (schema) {
    const base = this;
    const baseSchema = base.schema || {};
    const mergedSchema = { ...baseSchema, ...schema };
    const NewClass = class extends base {
        static schema = mergedSchema;
        constructor(options) {
            super(options);
            // Process each field according to its type with validation
            for (const key in mergedSchema) {
                if (!options || !(key in options))
                    continue;
                const type = mergedSchema[key];
                const val = options[key];
                if (type && type.prototype instanceof CScalar) {
                    const scalar = new type({ schema: this.schema, value: val });
                    if (!scalar.validate(scalar.value)) {
                        throw new TypeError(`Validation failed for field "${key}": ${val}`);
                    }
                    this[key] = scalar.value;
                }
                else if (Array.isArray(type)) {
                    const inner = type[0];
                    this[key] = val.map((v) => {
                        if (inner.prototype instanceof CScalar) {
                            const s = new inner({ schema: this.schema, value: v });
                            if (!s.validate(s.value))
                                throw new TypeError(`Validation failed for field "${key}": ${v}`);
                            return s.value;
                        }
                        if (inner.prototype instanceof CObject)
                            return new inner(v);
                        return v;
                    });
                }
                else if (type && type.prototype instanceof CRecord) {
                    this[key] = new type({ schema: this.schema, ...val });
                }
                else if (type && (type.prototype instanceof CObject || type.prototype instanceof CRecord)) {
                    this[key] = new type({ schema: this.schema, ...val });
                }
                else {
                    this[key] = val;
                }
            }
        }
    };
    NewClass.Ex = CObject.Ex;
    return NewClass;
};
// Re-export primitives already exported at the top
//# sourceMappingURL=schema.core.js.map