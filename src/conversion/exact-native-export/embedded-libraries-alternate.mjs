/** A map's own trigger libraries inside its script.
 *
 * A map can define trigger libraries of its own (`<Library Id="1">` in its
 * Triggers, `Library/Name/1=...` in its TriggerStrings). The editor compiles
 * each of them into MapScript.galaxy -- its code under the prefix `lib<Id>_`,
 * with its own guarded startup -- ahead of the map's startup, whose InitLibs
 * initializes it. Converting that code as map content loses the library: every
 * name changes. It is converted as the library it is instead, and the map's
 * rest as the map. */
import { embeddedLibraryIds } from "./g2t-initialization-alternate-2.mjs";
/** Where a statement's code ends: its text may run on over the comment lines
 *  that follow it, which introduce the next statement. */
function codeEnd(text, node) {
    let end = node.end;
    for (;;) {
        const lineStart = text.lastIndexOf('\n', end - 1) + 1;
        if (lineStart <= node.pos)
            return end;
        const line = text.slice(lineStart, end).trim();
        if (line !== '' && !line.startsWith('//'))
            return end;
        end = lineStart - 1;
        if (end > 0 && text[end - 1] === '\r')
            end--;
    }
}
/** The script cut into the code of each library the map defines and the map's
 *  rest. A statement belongs to the library whose linkage prefix its name
 *  carries (lib<Id>_, and auto_lib<Id>_ for the thread helpers of its
 *  functions) or whose custom script section it is in; an unnamed statement
 *  (the `;` after a struct, an include) stays with the one before it. The cut follows the text exactly, and the comment lines ahead of a
 *  statement go with it, so each library keeps the banner the editor writes
 *  over its code. */
export function splitEmbeddedLibraries(text, source) {
    const ids = embeddedLibraryIds(source);
    if (!ids.length)
        return undefined;
    const statements = Array.from(source.statements);
    // A library's custom script sits between its InitVariables (or InitLibraries) and
    // its InitCustomScript, under whatever names its author chose (Rainbow Arena's MD5
    // functions in library 1, Cold expedition's Starcode in library 2).
    const definition = (id, role) => statements.findIndex((node) => node.body && node.name?.name === `lib${id}_${role}`);
    const customScripts = ids.map(id => ({ id, start: Math.max(definition(id, 'InitVariables'), definition(id, 'InitLibraries')), end: definition(id, 'InitCustomScript') }))
        .filter(section => section.start >= 0 && section.end > section.start);
    const owner = (node, index) => {
        const name = node.name?.name;
        if (typeof name !== 'string' || name === '')
            return undefined;
        return ids.find(id => name.startsWith(`lib${id}_`) || name.startsWith(`auto_lib${id}_`)) ??
            customScripts.find(section => index > section.start && index < section.end)?.id ?? '';
    };
    const parts = new Map([['', []], ...ids.map(id => [id, []])]);
    let previous = '';
    statements.forEach((node, index) => {
        const start = index === 0 ? 0 : codeEnd(text, statements[index - 1]);
        const end = index + 1 < statements.length ? codeEnd(text, node) : text.length;
        const group = owner(node, index) ?? previous;
        parts.get(group).push(text.slice(start, end));
        previous = group;
    });
    return {
        libraries: ids.map(id => ({ id, script: parts.get(id).join('') })).filter(library => library.script.trim() !== ''),
        map: parts.get('').join(''),
    };
}
//# sourceMappingURL=embedded-libraries.js.map