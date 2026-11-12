import {resolveFormalPresetScalar} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/formal-preset-domain.mjs';
import {editorObjectReferenceTypes,editorObjectConstructor,editorObjectType} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/editor-object-reference-codecs.mjs";
import { lookupElement } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-literal-native-v173-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
/**
 * g2t-params — standalone parameter helpers for the Galaxy→trigger reverse conversion.
 *
 * These helpers are independent of callExprToFCRef and can therefore live in a
 * separate module without creating circular dependencies:
 *   - resolveParamDefByRef — looks up a ParamDef by ref in elements or NativeLib
 *   - resolvePresetValueForParamScalar — matches a scalar string to a PresetValue ref
 *   - coerceStringDomainType — upgrades a "string" valueType to a specific domain
 *     type (soundlink, filepath, color, …) when the ParamDef or a hint says so
 *   - tryBuildEncodedScalarParamFromCall — handles Color(...) / UnitFilter(...) calls
 *     that SC2 stores as raw scalar strings rather than function call trees
 *   - inferStringValueTypeWithoutParamDef — guesses "filepath" for asset path literals
 *
 * Depends on: g2t-core.
 * Consumed by: g2t-call.
 */
import { getKindName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import { unwrapParens, } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';
// ---------------------------------------------------------------------------
// Helpers exported for use in galaxy-to-trigger.ts
// ---------------------------------------------------------------------------
export function simpleCallArgToScalarToken(expr) {
    const e = unwrapParens(expr);
    if (!e)
        return undefined;
    if (e.kind === 113 /* SyntaxKind.Identifier */)
        return e.name;
    if (e.kind === 3 /* SyntaxKind.StringLiteral */)
        return String(e.value ?? e.text ?? '');
    if (e.kind === 2 /* SyntaxKind.NumericLiteral */)
        return String(e.text ?? e.value ?? '0');
    if (e.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ && e.operator?.kind === 21 /* SyntaxKind.MinusToken */) {
        const op = e.operand;
        if (op?.kind === 2 /* SyntaxKind.NumericLiteral */) {
            return `-${String(op.text ?? op.value ?? '0')}`;
        }
    }
    return undefined;
}
export function tryBuildEncodedScalarParamFromCall(expr, expectedType) {
    if (!expr || expr.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    const callee = expr.expression;
    if (!callee || callee.kind !== 113 /* SyntaxKind.Identifier */)
        return undefined;
    const name = callee.name;
    if (name !== 'Color' && name !== 'ColorWithAlpha' && !editorObjectType(name) && name !== 'UnitRefFromUnit' && name !== 'UnitRefFromVariable' && name !== 'SoundLink') {
        return undefined;
    }
    const args = Array.from(expr.arguments ?? []);
    if (args.length === 0)
        return undefined;
    const fromIdType = { ...Object.fromEntries(editorObjectReferenceTypes.map(type=>[editorObjectConstructor(type),type])), UnitRefFromVariable:'unitref' };
    const expectedFromIdType = fromIdType[name];
    if (expectedFromIdType) {
        if (args.length !== 1)
            return undefined;
        // `any*` / `sameas*` are matching placeholders in a FunctionDef, not a
        // concrete serialized selector type.  Persisting one beside ValueId loses
        // the fact that UnitFromId, RegionFromId, etc. selected a document object
        // and makes the forward pass reject it as an unknown object codec.
        const concreteExpected = expectedType && !/^(?:any|sameas)/u.test(expectedType)
            ? expectedType
            : undefined;
        if (concreteExpected && concreteExpected !== expectedFromIdType && name !== 'UnitFromId' && name !== 'UnitRefFromVariable') {
            return undefined;
        }
        const token = simpleCallArgToScalarToken(args[0]);
        if (token === undefined)
            return undefined;
        // SC2 stores document-object selectors in ValueId, not Value.  Keeping the
        // constructor argument in Value used to make the forward pass quote units,
        // points and cameras instead of rebuilding their *FromId(...) expression.
        // UnitRefFromVariable is different: its operand is authored expression text,
        // rather than a document object id.
        if (name !== 'UnitRefFromVariable') {
            if (!/^\d+$/u.test(token) || !Number.isSafeInteger(Number(token)))
                return undefined;
            return { valueId: token, valueType: { type: concreteExpected ?? expectedFromIdType } };
        }
        // This constructor is itself the proof that the scalar is authored
        // variable-expression text for a unit reference. A reference formal is
        // encoded as Type=unit + ParamFlagReference, so copying that apparent
        // `unit` type would later produce UnitRefFromUnit("expression").
        return { value: token, valueType: { type: 'unitref' } };
    }
    if (name === 'UnitRefFromUnit') {
        if (args.length !== 1)
            return undefined;
        const inner = unwrapParens(args[0]);
        if (inner?.kind !== 121 /* SyntaxKind.CallExpression */ || inner.expression?.kind !== 113 /* SyntaxKind.Identifier */ || inner.expression.name !== 'UnitFromId') {
            return undefined;
        }
        const innerArgs = Array.from(inner.arguments ?? []);
        if (innerArgs.length !== 1)
            return undefined;
        const token = simpleCallArgToScalarToken(innerArgs[0]);
        if (token === undefined)
            return undefined;
        // The editor stores document-unit selectors in ValueId even when Galaxy
        // wraps the selector in UnitRefFromUnit.  A plain Value is interpreted as
        // authored text and the editor silently replaces it with UnitFromId(0).
        if (!/^\d+$/u.test(token) || !Number.isSafeInteger(Number(token)))
            return undefined;
        const concreteExpected = expectedType && !/^(?:any|sameas)/u.test(expectedType)
            ? expectedType
            : undefined;
        // Only a unit reference formal gets its wrapper back from a unit ValueId in the
        // forward pass; `unitref` is no value type it can emit. Any other formal (a
        // template slot, the callee of a missing dependency) keeps the call itself.
        if (expectedType && concreteExpected !== 'unit')
            return undefined;
        return { valueId: token, valueType: { type: concreteExpected ?? 'unitref' } };
    }
    // The editor stores a sound link as its catalog name. Galaxy adds a 0-based
    // asset index, with -1 for the default selection that the XML simply omits.
    if (name === 'SoundLink') {
        if (args.length !== 2 || (expectedType && expectedType !== 'soundlink'))
            return undefined;
        const link = unwrapParens(args[0]);
        if (link?.kind !== 3 /* SyntaxKind.StringLiteral */)
            return undefined;
        let index = unwrapParens(args[1]);
        let sign = 1;
        if (index?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ && index.operator?.kind === 21 /* SyntaxKind.MinusToken */) {
            sign = -1;
            index = unwrapParens(index.operand);
        }
        if (index?.kind !== 2 /* SyntaxKind.NumericLiteral */)
            return undefined;
        const asset = sign * Number(index.text ?? index.value);
        if (!Number.isSafeInteger(asset) || asset < -1)
            return undefined;
        return {
            value: String(link.value ?? ''),
            valueType: { type: 'soundlink' },
            ...(asset === -1 ? {} : { valueId: String(asset + 1) }),
        };
    }
    if (name === 'Color' || name === 'ColorWithAlpha') {
        const tokens = [];
        for (const a of args) {
            const t = simpleCallArgToScalarToken(a);
            if (t === undefined)
                return undefined;
            tokens.push(t);
        }
        // An unknown or placeholder formal still takes the editor's colour value; a formal of
        // another concrete domain does not, or `lv_c == Color(100,100,100)` would come back as
        // a comparison against the text "Color(100.00,100.00,100.00)" (Deity Wasp mod).
        const colourFormal = expectedType === undefined || expectedType === 'color' || /^(?:any|sameas)/u.test(expectedType);
        if (colourFormal && (name === 'Color' ? tokens.length === 3 : tokens.length === 4)) {
            const percentages = tokens.map(Number);
            if (percentages.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) {
                const bytes = percentages.map(value => Math.round(value * 255 / 100));
                // GUI color values store bytes and emit two-decimal percentages.
                // Do not silently quantize authored Galaxy (50 becomes 50.20),
                // or change ColorWithAlpha's native call/argument contract.
                if (name === 'ColorWithAlpha' || bytes.some((byte, i) =>
                    Number((byte * 100 / 255).toFixed(2)) !== percentages[i]))
                    return undefined;
                const [red, green, blue, alpha = 255] = bytes;
                return { value: `${alpha},${red},${green},${blue}`, valueType: { type: 'color' } };
            }
        }
        // Anything else -- a colour built from variables (ARC2 mod: `Color(lv_r,lv_g,lv_b)`)
        // or a colour compared against a non-colour formal (Deity Wasp mod: `lv_c ==
        // Color(100,100,100)`) -- is not a value the editor stores in <Value>. Storing it as
        // a string turned the comparison into `lv_c == "Color(100.00,100.00,100.00)"`, so the
        // call is left to the structured path, which preserves it.
        return undefined;
    }
    // Preserve mask expressions as ordinary call arguments. Inferring filter
    // names from identifier prefixes loses unknown bits, shift operands and words.
    return undefined;
}
export function resolveParamDefByRef(paramDefRef, ctx) {
    const libraries = new Map(ctx.dependencyLibraries);
    if (ctx.nativeLibrary)
        libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
    libraries.set(ctx.libId, { id: ctx.libId, elements: ctx.elements, items: [], elementsByType: {} });
    return lookupElement(libraries.values(), { ...paramDefRef, type: 'ParamDef' }, ctx.libId);
}
export function resolvePresetValueForParamScalar(paramDefRef, scalar, ctx) {
    const formal = resolveParamDefByRef(paramDefRef, ctx);
    if (!formal || typeof scalar !== 'string') return undefined;
    const libraries = new Map(ctx.dependencyLibraries);
    if (ctx.nativeLibrary) libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
    libraries.set(ctx.libId, {id: ctx.libId, elements: ctx.elements, items: [], elementsByType: {}});
    return resolveFormalPresetScalar(formal, scalar, formal.library ?? paramDefRef.library ?? ctx.libId,
        (ref, owner, type) => lookupElement(libraries.values(), {...ref, type}, owner));
}

export function coerceStringDomainType(data, expected) {
    if (!expected)
        return;
    // An integer literal in a fixed slot stays an int value: the editor stores it so
    // (<ValueType Type="int"/>, CameraApplyInfo's velocity -1) and writes it without
    // `.0`; made fixed, KeyStone's `-1` and TTosh1's `10` came back as `-1.0`, `10.0`.
    if (data.valueType?.type !== 'string')
        return;
    const known = new Set(['gamelink', 'anygamelink', 'soundlink', 'filepath', 'modelanim', 'catalogentry', 'color', 'actormsg', 'convline', 'userinstance', 'timeofday', 'convstateindex']);
    if (!known.has(expected))
        return;
    // modelanim is string-backed in Galaxy, but its Trigger XML scalar is a
    // Galaxy expression rather than decoded string contents. Paired editor
    // documents store a literal such as "Talk" as <Value>&quot;Talk&quot;</Value>.
    // Retaining only Talk makes the editor regenerate a bare identifier.
    if (expected === 'modelanim' && typeof data.value === 'string') {
        data.value = JSON.stringify(data.value);
    }
    data.valueType = { type: expected };
}
/** Convert Galaxy's four bit-field UnitFilter arguments back to the editor's
 * required;excluded scalar.  Flag meanings are supplied by the loaded preset
 * definitions so this never relies on a numerical mask table. */
export function unitFilterStringFromCall(call, resolveFlag) {
    if (call?.kind !== 121 /* SyntaxKind.CallExpression */ || unwrapParens(call.expression)?.name !== 'UnitFilter')
        return undefined;
    const args = Array.from(call.arguments ?? []);
    if (args.length !== 4)
        return undefined;
    const collect = (node, bias, out) => {
        const value = unwrapParens(node);
        if (!value)
            return false;
        if (value.kind === 2 /* SyntaxKind.NumericLiteral */)
            return Number(value.text ?? value.value ?? '0') === 0;
        if (value.kind !== 124 /* SyntaxKind.BinaryExpression */)
            return false;
        const operator = getKindName(value.operatorToken?.kind);
        if (operator === 'BarToken')
            return collect(value.left, bias, out) && collect(value.right, bias, out);
        if (operator !== 'LessThanLessThanToken')
            return false;
        const one = unwrapParens(value.left);
        if (one?.kind !== 2 /* SyntaxKind.NumericLiteral */ || Number(one.text ?? one.value ?? '0') !== 1)
            return false;
        let flag = unwrapParens(value.right);
        let offset = 0;
        if (flag?.kind === 124 /* SyntaxKind.BinaryExpression */ && getKindName(flag.operatorToken?.kind) === 'MinusToken') {
            const amount = unwrapParens(flag.right);
            if (amount?.kind !== 2 /* SyntaxKind.NumericLiteral */)
                return false;
            offset = Number(amount.text ?? amount.value ?? '0');
            flag = unwrapParens(flag.left);
        }
        if (offset !== bias || flag?.kind !== 113 /* SyntaxKind.Identifier */)
            return false;
        const name = resolveFlag(flag.name);
        if (!name)
            return false;
        out.push(name);
        return true;
    };
    const required = [];
    const excluded = [];
    if (!collect(args[0], 0, required) || !collect(args[1], 32, required))
        return undefined;
    if (!collect(args[2], 0, excluded) || !collect(args[3], 32, excluded))
        return undefined;
    return `${required.length ? required.join(',') : '-'};${excluded.length ? excluded.join(',') : '-'}`;
}
export function inferStringValueTypeWithoutParamDef(value) {
    // Common SC2 asset/file path forms.
    if (/^Assets\\.+\.[A-Za-z0-9]{2,6}$/i.test(value))
        return 'filepath';
    if (/^[A-Za-z]:\\.+\.[A-Za-z0-9]{2,6}$/i.test(value))
        return 'filepath';
    if (/\\/.test(value) && /\.[A-Za-z0-9]{2,6}$/.test(value))
        return 'filepath';
    return undefined;
}
//# sourceMappingURL=g2t-params.js.map