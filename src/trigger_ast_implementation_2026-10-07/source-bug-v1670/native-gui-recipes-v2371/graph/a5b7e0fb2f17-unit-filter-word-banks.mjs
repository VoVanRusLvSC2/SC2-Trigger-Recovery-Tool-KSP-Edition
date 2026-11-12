import { SyntaxKind as K } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js";
import { unwrapParens } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js";
import { unitFilterStringFromCall } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/graph/2c14364ae674-g2t-params.mjs";
import { namingIndexes } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js";
/** Preserve the actual four int32 words, rather than the spelling of a flag.
 * Galaxy masks a shift count to five bits. A Stasis shift32 in the LOW word
 * therefore sets low bit0 (Self); calling it Stasis moves it to the high word
 * and changes the filter. All positions/tokens come from loaded declarations
 * and presets. No hard-coded flag table, new cache, or code-field fallback.
 */
export function unitFilterWithWordBanks(call, ctx, resolveFlag) {
    if (call?.kind !== K.CallExpression || unwrapParens(call.expression)?.name !== 'UnitFilter' || call.arguments?.length !== 4 || !ctx.constants)
        return undefined;
    const owned = ctx.funcNameToFuncDef.get('UnitFilter');
    if (owned && (owned.library ?? ctx.libId) === ctx.libId && !owned.flags?.includes('Native'))
        return undefined;
    const flagForBit = (bit) => {
        let result;
        for (const entry of namingIndexes().unitFilterFlags.values()) {
            if (entry.bit !== bit)
                continue;
            const current = ctx.constants.evaluate({ kind: K.Identifier, name: entry.constant });
            const token = resolveFlag(entry.constant);
            if (current !== bit || !token)
                continue;
            if (result && result !== entry.constant)
                return undefined;
            result = entry.constant;
        }
        return result;
    };
    const shift = (absoluteBit, wordBase) => {
        const name = flagForBit(absoluteBit);
        if (!name)
            return undefined;
        const identifier = { kind: K.Identifier, name };
        return { kind: K.BinaryExpression, left: { kind: K.NumericLiteral, text: '1', value: '1' },
            operatorToken: { kind: K.LessThanLessThanToken },
            right: wordBase ? { kind: K.BinaryExpression, left: identifier,
                operatorToken: { kind: K.MinusToken }, right: { kind: K.NumericLiteral, text: '32', value: '32' } } : identifier };
    };
    const normalize = (node, wordBase) => {
        const value = unwrapParens(node);
        if (!value)
            return undefined;
        if (value.kind === K.BinaryExpression && value.operatorToken?.kind === K.BarToken) {
            const left = normalize(value.left, wordBase), right = normalize(value.right, wordBase);
            return left && right ? { ...value, left, right } : undefined;
        }
        if (value.kind === K.BinaryExpression && value.operatorToken?.kind === K.LessThanLessThanToken) {
            const one = ctx.constants.evaluate(value.left), amount = ctx.constants.evaluate(value.right);
            if (one !== 1 || amount === undefined || amount < 0)
                return undefined;
            return shift(wordBase + (amount & 31), wordBase);
        }
        const number = ctx.constants.evaluate(value);
        if (number === undefined)
            return undefined;
        if (number === 0)
            return { kind: K.NumericLiteral, text: '0', value: '0' };
        const terms = [];
        for (let bit = 0; bit < 32; bit++)
            if ((number >>> bit) & 1) {
                const term = shift(wordBase + bit, wordBase);
                if (!term)
                    return undefined;
                terms.push(term);
            }
        return terms.reduce((left, right) => ({ kind: K.BinaryExpression, left, right, operatorToken: { kind: K.BarToken } }));
    };
    const argumentsNormalized = Array.from(call.arguments).map((arg, index) => normalize(arg, index % 2 ? 32 : 0));
    if (argumentsNormalized.some(arg => !arg))
        return undefined;
    return unitFilterStringFromCall({ ...call, arguments: argumentsNormalized }, resolveFlag);
}
