/**
 * Create a TypedNamespace proxy over a resolver function.
 * Property access (ns.Marine) and method access (ns.get('Marine')) both call resolver.
 * The ids set determines namespace.size and iteration.
 */
export function createTypedNamespace(ids, resolve) {
    const methods = {
        get(id) {
            return resolve(id);
        },
        all() {
            const result = [];
            for (const id of ids) {
                const value = resolve(id);
                if (value !== undefined)
                    result.push(value);
            }
            return result;
        },
        find(fn) {
            return methods.all().filter(fn);
        },
        keys() {
            return ids.values();
        },
        *values() {
            for (const id of ids) {
                const value = resolve(id);
                if (value !== undefined)
                    yield value;
            }
        },
        get size() {
            return ids.size;
        },
    };
    return new Proxy(methods, {
        get(target, prop) {
            if (typeof prop === 'symbol')
                return undefined;
            if (prop in methods)
                return methods[prop];
            return resolve(prop);
        },
    });
}
//# sourceMappingURL=namespace.js.map