/** Old Galaxy getters read the native iterator, including calls in a helper
 * function. A modern #AUTOVAR getter reads an editor-generated local instead.
 * Bind only the three observed build-97563 native pairs to their loaded Ntve
 * declarations. This is NOT a general suffix alias or a loop modernization.
 * Runtime evidence: runtime-native-probe-v1577/ACTUAL_RUNTIME_RESULT.json.
 * The primary comparison benchmark is deliberately left unchanged.
 */
export const legacyLoopAccessorPairs = {
    IntLoopCurrent: { target: 'IntLoopCurrentDeprecated', returnType: 'int', id: 'A66EFCA4' },
    PlayerGroupLoopCurrent: { target: 'PlayerGroupLoopCurrentDeprecated', returnType: 'int', id: '36ABE390' },
    UnitGroupLoopCurrent: { target: 'UnitGroupLoopCurrentDeprecated', returnType: 'unit', id: '61C49CC4' },
};
export function bindLegacyLoopAccessor(index, name, declaration, loaded, ownedBody) {
    const pair = legacyLoopAccessorPairs[name];
    if (!index || !pair || ownedBody || declaration.parameters.length || declaration.returnType !== pair.returnType)
        return undefined;
    // A same-spelling authored/library function must never be redirected.
    if (!loaded || (loaded.library ?? 'Ntve') !== 'Ntve' || loaded.flags?.includes('Native') ||
        !/^\s*#AUTOVAR\([^,]+,\s*ancestor:[^()]+\)\s*$/u.test(loaded.scriptCode ?? '') ||
        (loaded.parameters?.length ?? 0) !== 0)
        return undefined;
    const resolution = index.resolve({ name: pair.target, libraryId: 'Ntve', declaration });
    const d = resolution.definition;
    if (resolution.status !== 'RESOLVED' || !d || d.id !== pair.id || !d.flags?.includes('Native') ||
        d.scriptCode || d.disabled || (d.library ?? 'Ntve') !== 'Ntve')
        return undefined;
    return d;
}
