import { ModkitError } from '@modkit/core';
export { functionFlags } from '../../../shared/trigger-document/function-flags.js';
/** Element identity is scoped by both library and type in the Trigger XML format. */
export function refKey(ref, library = '') {
    return JSON.stringify([ref.library || library, ref.type ?? '', ref.id]);
}
const identifierEncoder = new TextEncoder();
/**
 * Make an authored name usable as a Galaxy identifier the way the editor does:
 * an ASCII character that cannot appear in an identifier is dropped, and a
 * character outside ASCII is written as the uppercase hex of its UTF-8 bytes.
 * Verified against paired XML/Galaxy for a library whose authored names are not
 * Latin. The reverse direction deliberately does not decode this: a name may
 * legitimately consist of those same hex digits.
 */
export function sanitizeIdentifier(name) {
    let out = '';
    for (const character of name) {
        if (/^[a-zA-Z0-9_]$/u.test(character)) {
            out += character;
            continue;
        }
        if (character.codePointAt(0) < 0x80)
            continue;
        for (const byte of identifierEncoder.encode(character))
            out += byte.toString(16).toUpperCase().padStart(2, '0');
    }
    // The editor keeps the generated prefix (`gf_`, `gv_`, ...) separate from
    // the authored identifier stem and still makes a digit-leading stem legal.
    // Example: "1x1 Max Count Per Row" becomes `gv__1x1MaxCountPerRow`.
    return /^\d/u.test(out) ? `_${out}` : out;
}
/** The editor writes a variable or parameter name with its first character in
 *  lower case; a function or preset constant keeps the authored case. */
export function lowerInitial(name) {
    return name.charAt(0).toLowerCase() + name.slice(1);
}
/** A map document is not a library: it owns the script's global namespace, so
 *  the editor writes its functions, variables and triggers unprefixed, and gives
 *  its startup functions the names a map's script uses. A mod's library instead
 *  namespaces everything it declares behind `lib<Id>_`. The distinction is a
 *  property of the document, so it is scoped to the conversion of one. */
let implicitLibraryScope;
export function withImplicitLibrary(libraryId, run) {
    const previous = implicitLibraryScope;
    implicitLibraryScope = libraryId;
    try {
        return run();
    }
    finally {
        implicitLibraryScope = previous;
    }
}
export function libraryPrefix(libraryId) {
    return implicitLibraryScope !== undefined && implicitLibraryScope === libraryId ? '' : `lib${libraryId}_`;
}
const MAP_STARTUP_NAMES = {
    InitLib: 'InitMap',
    InitLibraries: 'InitLibs',
    InitVariables: 'InitGlobals',
};
/** The name of one of the four startup functions of `libraryId`. */
export function startupFunctionName(libraryId, role) {
    if (libraryPrefix(libraryId) !== '')
        return `lib${libraryId}_${role}`;
    return MAP_STARTUP_NAMES[role] ?? role;
}
export function globalVariableName(libraryId, variable) {
    const authoredIdentifier = variable.identifier !== undefined;
    const stem = sanitizeIdentifier(variable.identifier ?? variable.name ?? variable.id);
    // A canonical TriggerCreate handle kept as a Variable after an unrecovered
    // initializer must retain its original Galaxy ABI name, not acquire gv_.
    if (variable.variableType?.type === 'trigger' && variable.flags?.includes('NoScriptPrefix'))
        return stem;
    // Explicit upper-snake identifiers are authored Galaxy ABI spellings and are
    // kept verbatim. Ordinary GUI identifiers (including explicit UpperCamel
    // names) still receive the editor's lower-initial transform. Internal and
    // Constant do not decide this distinction: shipped libraries contain both.
    const preserveStem = authoredIdentifier && /^[A-Z][A-Z0-9_]*$/u.test(stem);
    const prefix = libraryPrefix(libraryId);
    return `${prefix}gv_${preserveStem ? stem : lowerInitial(stem)}`;
}
export function globalVariableNames(libraryId, variables) {
    const counts = new Map();
    for (const variable of variables) {
        const name = globalVariableName(libraryId, variable);
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return new Map(variables.map(variable => {
        const name = globalVariableName(libraryId, variable);
        const suffix = variable.id.replace(/[^a-zA-Z0-9]/gu, '').toUpperCase().slice(0, 8);
        return [variable.id, counts.get(name) > 1 ? `${name}_${suffix}` : name];
    }));
}
export function globalVariables(library) {
    const local = new Set();
    for (const element of Object.values(library.elements)) {
        const variables = element.localVariables ?? (element.type === 'Structure' ? element.variables : []);
        for (const ref of variables)
            if ((ref.library ?? library.id) === library.id)
                local.add(ref.id);
    }
    return Object.values(library.elements).filter((element) => element.type === 'Variable' && !local.has(element.id));
}
/** Find a reference inside one library it is known to belong to. */
export function lookupElementIn(library, ref) {
    if (ref.type) {
        const typed = library.elementsByType?.[ref.type]?.[ref.id];
        const element = typed ?? library.elements?.[`${ref.type}:${ref.id}`] ?? library.elements?.[ref.id];
        return element?.type === ref.type ? element : undefined;
    }
    const candidates = Object.values(library.elements ?? {}).filter(element => element.id === ref.id);
    return candidates.length === 1 ? candidates[0] : undefined;
}
export function lookupElement(libraries, ref, currentLibrary) {
    if (!ref)
        return undefined;
    // Read the iterable directly: this runs once per reference, and materialising
    // it into an array allocated a copy of the whole library list every time.
    const wanted = ref.library || currentLibrary;
    for (const library of libraries)
        if (library.id === wanted)
            return lookupElementIn(library, ref);
    return undefined;
}
export function conversionError(code, message, context = {}) {
    throw new ModkitError({
        code: 'blizzard/sc2-triggers.parse-failed',
        message,
        context: { conversionCode: code, ...context },
    });
}
export function encodePayload(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary);
}
export function decodePayload(text) {
    const binary = atob(text);
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}
/** Validate references before lowering can omit a node or follow an expansion cycle. */
export function assertConversionReferences(library, dependencies) {
    const libraries = new Map(dependencies);
    libraries.set(library.id, library);
    const edges = new Map();
    // Flat TriggerData keeps a disabled definition's implementation nodes as
    // ordinary sibling Elements. Find that inactive closure up front, so stale
    // references retained only by disabled editor content do not become roots
    // merely because the XML is flat. If an active element shares/reaches one
    // of these nodes, the normal walk below still validates it.
    const inactive = new Set();
    const inactivePending = Object.values(library.elements).filter(element => element.disabled);
    while (inactivePending.length) {
        const owner = inactivePending.pop();
        if (inactive.has(owner))
            continue;
        inactive.add(owner);
        const values = Object.entries(owner)
            .filter(([field]) => !['id', 'library', 'type', 'catalogRefs'].includes(field));
        while (values.length) {
            const [field, value] = values.pop();
            if (!value || typeof value !== 'object')
                continue;
            if (Array.isArray(value)) {
                for (const item of value)
                    values.push([field, item]);
                continue;
            }
            if (typeof value.id !== 'string') {
                values.push(...Object.entries(value));
                continue;
            }
            const ref = field === 'subFunctionType' || field === 'subFunctionTypes' ? { ...value, type: 'SubFuncType' } : value;
            const target = lookupElement(libraries.values(), ref, owner.library ?? library.id);
            if (target && (target.library ?? ref.library ?? library.id) === library.id && !inactive.has(target))
                inactivePending.push(target);
        }
    }
    const pending = Object.values(library.elements).filter(element => !element.disabled && !inactive.has(element));
    const seen = new Set();
    while (pending.length) {
        const owner = pending.pop();
        const key = refKey(owner, library.id);
        if (seen.has(key))
            continue;
        seen.add(key);
        // Disabled editor elements are retained as document metadata but do not
        // contribute declarations or executable code. Older campaign documents
        // can therefore contain stale references inside them (for example to a
        // preset removed from a later TriggerLib revision). Active parents are
        // still validated before they can reach any such element.
        if (owner.disabled) {
            edges.set(key, []);
            continue;
        }
        const children = [];
        const values = Object.entries(owner).filter(([key]) => !['id', 'library', 'type', 'catalogRefs'].includes(key));
        while (values.length) {
            const [field, value] = values.pop();
            if (!value || typeof value !== 'object')
                continue;
            if (Array.isArray(value)) {
                for (const item of value)
                    values.push([field, item]);
                continue;
            }
            if (typeof value.id !== 'string') {
                // A declared type's typeElement is read only for struct and preset. For
                // any other declared type the editor keeps it as stale metadata — the
                // target can be long deleted — so it is not a conversion dependency.
                const declared = typeof value.type === 'string' ? value.type.toLowerCase() : undefined;
                const inert = declared !== undefined && declared !== 'struct' && declared !== 'preset';
                values.push(...Object.entries(value).filter(([name]) => !(inert && name === 'typeElement')));
                continue;
            }
            const ref = field === 'subFunctionType' || field === 'subFunctionTypes' ? { ...value, type: 'SubFuncType' } : value;
            // Comment placement is checked against its parent's declared roles when
            // rendered. An obsolete editor role is not an executable dependency.
            if (owner.type === 'Comment' && field === 'subFunctionType')
                continue;
            const target = lookupElement(libraries.values(), ref, owner.library ?? library.id);
            if (!target)
                conversionError('UNRESOLVED_REFERENCE', 'Trigger reference cannot be resolved in the loaded libraries', { owner: key, reference: ref });
            const targetLibrary = target.library ?? ref.library ?? owner.library ?? library.id;
            // Dependency documents are trusted input contracts. Verify that the
            // referenced external element exists, but do not recursively validate its
            // implementation as if it belonged to the document being generated.
            // This is essential for cyclic libraries reconstructed to new element
            // identities: a dependency can still point back to the preceding
            // generation until the package-level fixed-point pass updates it.
            if (targetLibrary !== library.id)
                continue;
            pending.push(target);
            // Calls between definitions may recurse legitimately; expansion trees may not.
            if (target.type === 'Param' || target.type === 'FunctionCall') {
                children.push(refKey(target, owner.library));
            }
        }
        edges.set(key, children);
    }
    const done = new Set();
    for (const key of edges.keys()) {
        const active = new Set();
        const stack = [{ key, leave: false }];
        while (stack.length) {
            const current = stack.pop();
            if (current.leave) {
                active.delete(current.key);
                done.add(current.key);
                continue;
            }
            if (done.has(current.key))
                continue;
            if (active.has(current.key))
                conversionError('REFERENCE_CYCLE', 'Cyclic Trigger parameter or action expansion', { reference: current.key });
            // This is an iterative graph validation, not recursive XML parsing. Real
            // editor-authored expression trees can exceed 256 nodes while remaining
            // acyclic, especially after associative expressions are expanded into
            // Params/FunctionCalls. Keep a finite abuse bound without rejecting those
            // documents merely because their flat reference graph is large.
            if (active.size >= 1024)
                conversionError('DEPTH_LIMIT', 'Trigger expansion exceeds the conversion nesting limit');
            active.add(current.key);
            stack.push({ ...current, leave: true });
            for (const child of edges.get(current.key) ?? [])
                stack.push({ key: child, leave: false });
        }
    }
}
