import { isInteger, isNumeric, isValidNumber } from "./util.js";
export class SchemaValue {
    name;
    path;
    schema;
    group;
    array;
    scalar;
    computable;
    preventinheritance;
    attribute;
    saveAsString;
    writeAsString;
    keepAsString;
    constructor(options = {}) {
        this.name = options.name || this.constructor.name;
        if (options.path !== undefined)
            this.path = options.path;
        this.schema = options.schema;
    }
    init() { }
    validate(value) { return true; }
    fromString(str) { return str; }
    toString(obj) { return String(obj); }
    toXML(obj) {
        return {
            tag: this.name,
            attributes: {
                value: this.toString(obj)
            }
        };
    }
    compute(chain, resolve = false) {
        return chain[chain.length - 1];
    }
    _walkNode(value, options) { }
    makeObject(attributes) {
        return attributes;
    }
}
/**
 * Base class for all scalar-like types.
 */
export class CScalar extends SchemaValue {
    scalar = true;
    constructor(options = {}) {
        if (typeof options === "object" && options !== null) {
            super(options);
            if ("value" in options)
                this.value = options.value;
        }
        else {
            super();
            this.value = options;
        }
    }
    toString(obj) {
        return String(obj);
    }
    static Dyn(resolverOrType) {
        if (typeof resolverOrType === 'function' && resolverOrType.length > 0) {
            const cls = class extends this {
                static resolver = resolverOrType;
                constructor(options = {}) {
                    super(options);
                }
            };
            return cls;
        }
        else {
            const cls = class extends this {
                static type = resolverOrType;
                constructor(options = {}) {
                    super(options);
                }
            };
            return cls;
        }
    }
    static Union(...types) {
        const cls = class extends this {
            static types = types;
            constructor(options = {}) {
                super(options);
            }
        };
        return cls;
    }
}
export class CBoolean extends CScalar {
    constructor(options = {}) {
        super(options);
    }
    fromString(str) { return str === "1"; }
    toString(obj) { return obj ? '1' : '0'; }
}
export class CNumber extends CScalar {
    min;
    max;
    float;
    constructor(options = {}) {
        super(options);
        if (typeof options === "object") {
            if (options.min !== undefined)
                this.min = options.min;
            if (options.max !== undefined)
                this.max = options.max;
            if (options.float !== undefined)
                this.float = options.float;
        }
    }
    validate(val) {
        if (!isValidNumber(val))
            return false;
        const num = typeof val === "string" ? Number(val) : val;
        if (typeof num !== "number" || !isFinite(num))
            return false;
        if (!this.float && !Number.isInteger(num))
            return false;
        if (this.min !== undefined && num < this.min)
            return false;
        if (this.max !== undefined && num > this.max)
            return false;
        return true;
    }
    fromString(str) { return +str; }
    toString(obj) { return String(obj); }
    static Int(min, max, extraOpts) {
        const cls = class extends this {
            constructor(opts = {}) {
                super(typeof opts === 'number' ? { value: opts, min, max, float: false, ...extraOpts } : { ...opts, min, max, float: false, ...extraOpts });
            }
        };
        return cls;
    }
    static Real(min, max, extraOpts) {
        const cls = class extends this {
            constructor(opts = {}) {
                super(typeof opts === 'number' ? { value: opts, min, max, float: true, ...extraOpts } : { ...opts, min, max, float: true, ...extraOpts });
            }
        };
        return cls;
    }
    static UInt(max, extraOpts) {
        const cls = class extends this {
            constructor(opts = {}) {
                super(typeof opts === 'number' ? { value: opts, min: 0, max, float: false, ...extraOpts } : { ...opts, min: 0, max, float: false, ...extraOpts });
            }
        };
        return cls;
    }
    static UReal(max) {
        return class extends this {
            constructor(opts = {}) {
                const maxOpt = max !== undefined ? { max } : {};
                super(typeof opts === 'number' ? { value: opts, min: 0, ...maxOpt, float: true } : { ...opts, min: 0, ...maxOpt, float: true });
            }
        };
    }
}
export class CString extends CScalar {
    regexp;
    maxlength = 0;
    constructor(options = {}) {
        super(options);
        if (typeof options === "object") {
            if (options.regexp)
                this.regexp = options.regexp;
            if (options.maxlength)
                this.maxlength = options.maxlength;
        }
    }
    validate(str) {
        if (typeof str !== "string")
            return false;
        if (this.maxlength && str.length > this.maxlength)
            return false;
        if (this.regexp && !this.regexp.test(str))
            return false;
        return true;
    }
    fromString(str) {
        return str.replace(/"|&/g, s => s === '"' ? "&quot;" : "&amp;");
    }
    toString(obj) {
        return obj;
    }
    static Len(length) {
        const cls = class extends this {
            constructor(opts = {}) {
                super(typeof opts === 'string' ? { value: opts, maxlength: length } : { ...opts, maxlength: length });
            }
        };
        return cls;
    }
}
export class CFile extends CScalar {
    extensions;
    regexp;
    constructor(options = {}) {
        super(options);
        if (options.extensions)
            this.extensions = options.extensions;
        this.regexp = new RegExp(`^[a-z_#'0-9-]+[\\/a-z_#'0-9-. ]+.(${this.extensions?.join("|") || "[a-z0-9]+"})$`, "i");
    }
    validate(value) {
        return this.regexp.test(value);
    }
}
export class CLink1 extends CScalar {
    catalog = "Unknown";
    constructor(options = { catalog: "Unknown" }) {
        super(options);
        if (options.catalog)
            this.catalog = options.catalog;
    }
    validate(val) {
        return /^[^\s]+$/.test(val);
    }
}
export class CLink extends CScalar {
    static link;
    static Ex(link) {
        return class extends this {
            static link = link;
            constructor(value) {
                super(value);
            }
        };
    }
    static FromNamespace(nameSpace) {
        if (!this.Links[nameSpace]) {
            this.Links[nameSpace] = CLink.Ex(nameSpace);
        }
        return this.Links[nameSpace];
    }
    static Links = {};
}
export class CWord extends CString {
    constructor(options = {}) {
        super(options);
        this.regexp = /^\S+$/;
    }
}
export class CDynamic extends CScalar {
    field;
    constructor(options) {
        super(options);
        this.field = options.field;
    }
}
export class CInstruction extends CScalar {
    keepAsString = true;
    writeAsString = true;
}
export class CSObject extends CScalar {
    constructor(options = {}) {
        super(options);
        if (typeof options === "object" && options !== null && !options.schema) {
            Object.assign(this, options);
        }
    }
}
