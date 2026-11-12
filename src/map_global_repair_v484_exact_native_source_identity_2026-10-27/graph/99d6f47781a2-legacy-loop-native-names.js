import { SyntaxKind, tokenToString } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import { legacyLoopAccessorPairs } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v484_exact_native_source_identity_2026-10-27/graph/e0b73db5f3ca-legacy-loop-accessor-binding.js';
import { refKey } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
/** The legacy GUI element name is not necessarily its callable native name.
 * Use actual natives.galaxy ABI input, including in helper functions with no
 * lexical loop ancestor. Never rewrite a benchmark or fabricate a prototype.
 * Receives already parsed sources: no new parse or cache.
 */
export function declaredLegacyLoopNativeNames(sources, libraries) {
    const result = new Map();
    const natives = libraries.filter(l => l.id === 'Ntve');
    if (natives.length !== 1 || sources.some(s => s.parseDiagnostics?.length))
        return result;
    const library = natives[0], definitions = Object.values(library.elementsByType?.FunctionDef ?? {});
    for (const [name, pair] of Object.entries(legacyLoopAccessorPairs)) {
        const modern = definitions.filter(d => d.name === name && !d.disabled && (d.library ?? library.id) === 'Ntve');
        const legacy = definitions.filter(d => d.id === pair.id && d.name === pair.target && !d.disabled && (d.library ?? library.id) === 'Ntve');
        if (modern.length !== 1 || legacy.length !== 1)
            continue;
        const m = modern[0], d = legacy[0];
        if (m.flags?.includes('Native') || !m.flags?.includes('Operator') ||
            !/^\s*#AUTOVAR\([^,]+,\s*ancestor:[^()]+\)\s*$/u.test(m.scriptCode ?? '') ||
            !d.flags?.includes('Native') || d.scriptCode || m.parameters.length || d.parameters.length ||
            m.returnType?.type !== pair.returnType || d.returnType?.type !== pair.returnType)
            continue;
        const found = [];
        let unsafe = false, explicitDeprecated = false;
        for (const source of sources)
            for (const statement of source.statements) {
                if (statement.kind !== SyntaxKind.FunctionDeclaration)
                    continue;
                const n = statement.name?.name;
                const actualNativeFile = /(?:^|\/)natives\.galaxy$/iu.test(source.fileName.replaceAll('\\', '/'));
                if (n === pair.target && actualNativeFile)
                    explicitDeprecated = true;
                if (n !== name)
                    continue;
                if (statement.body)
                    unsafe = true;
                if (actualNativeFile)
                    found.push({ statement, actualNativeFile });
            }
        // If the shipped file explicitly names Deprecated, its normal declaration
        // wins. An authored function/body or contradictory ABI forbids the bridge.
        if (unsafe || explicitDeprecated || !found.length)
            continue;
        if (!found.every(({ statement: s }) => s.modifiers?.some((v) => v.kind === SyntaxKind.NativeKeyword) &&
            (s.parameters?.length ?? 0) === 0 && tokenToString(s.type?.kind) === pair.returnType))
            continue;
        result.set(refKey(d, 'Ntve'), name);
    }
    return result;
}
