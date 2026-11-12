/** A map's own trigger libraries inside its script.
 *
 * A map can define trigger libraries of its own (`<Library Id="1">` in its
 * Triggers, `Library/Name/1=...` in its TriggerStrings). The editor compiles
 * each of them into MapScript.galaxy -- its code under the prefix `lib<Id>_`,
 * with its own guarded startup -- ahead of the map's startup, whose InitLibs
 * initializes it. Converting that code as map content loses the library: every
 * name changes. It is converted as the library it is instead, and the map's
 * rest as the map. */
import { embeddedLibraryIds } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/800025dbdb0e-d20791ce555-ab8fb63df2ca-d6a728ba9727-cd304b162913-01ca7a97ced53f6f-g2t-initialization.mjs';
import { SyntaxKind as K } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
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
// Infer no ownership from labels or arbitrary identifier spelling. The exact
// generated top-level Custom Script banner must follow a declaration already
// bound to the same library, and its InitCustomScript must close the section.
function declaredCustomSectionAnchor(text, statements, ids, id, end) {
    const finish = statements[end];
    if (finish.type?.kind !== K.VoidKeyword || finish.parameters?.length !== 0) return;
    const belongs = name => typeof name === 'string' && (name.startsWith(`lib${id}_`) || name.startsWith(`auto_lib${id}_`));
    for (let i = end - 1; i >= 1; i--) {
        const previous = statements[i - 1], node = statements[i];
        if (!belongs(previous.name?.name)) continue;
        const gap = text.slice(codeEnd(text, previous), node.pos);
        if (!/^[ \t]*\/\/[ \t]*Custom Script[ \t]*\r?$/mu.test(gap)) continue;
        let safe = true;
        for (let j = i; j < end; j++) {
            const current = statements[j], name = current.name?.name;
            if (name && ((/^(?:auto_)?lib[A-Za-z0-9]+_/u.test(name) && !belongs(name)) || /^(?:gf|gv|gt|gs|ge)_/u.test(name) || /^(?:InitMap|InitLibs|InitGlobals|InitTriggers|InitCustomScript)$/u.test(name))) { safe = false; break; }
            const between = text.slice(codeEnd(text, statements[j - 1]), current.pos);
            if (/^[ \t]*\/\/[ \t]*Library:/mu.test(between)) { safe = false; break; }
        }
        if (!safe) continue;
        return { start: i - 1, proof: { library: id, anchorDeclaration: previous.name.name, firstStatement: i, endStatement: end, customScriptInitializer: finish.name.name, bannerBoundToTopLevelGap: true, foreignAndMapSymbolsExcluded: true, originalBytesPreserved: true } };
    }
}
export function splitEmbeddedLibraries(text, source) {
    const ids = embeddedLibraryIds(source);
    if (!ids.length)
        return undefined;
    const statements = Array.from(source.statements);
    // A library's custom script sits between its InitVariables (or InitLibraries) and
    // its InitCustomScript, under whatever names its author chose (Rainbow Arena's MD5
    // functions in library 1, Cold expedition's Starcode in library 2).
    const definition = (id, role) => statements.findIndex((node) => node.body && node.name?.name === `lib${id}_${role}`);
    const customOwnershipProof = [];
    const customScripts = ids.map(id => {
        const end = definition(id, 'InitCustomScript');
        let start = Math.max(definition(id, 'InitVariables'), definition(id, 'InitLibraries'));
        if (start < 0 && end > 0) {
            const anchor = declaredCustomSectionAnchor(text, statements, ids, id, end);
            if (anchor) { start = anchor.start; customOwnershipProof.push(anchor.proof); }
        }
        return { id, start, end };
    })
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
        customOwnershipProof,
        libraries: ids.map(id => ({ id, script: parts.get(id).join('') })).filter(library => library.script.trim() !== ''),
        map: parts.get('').join(''),
    };
}
//# sourceMappingURL=embedded-libraries.js.map
