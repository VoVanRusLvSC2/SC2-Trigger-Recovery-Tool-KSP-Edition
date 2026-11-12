import {hasVerifiedSelectorMetadata} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/selector-value-metadata.mjs';
import {decodeAttributeSelectorScalar} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/6a0bcf09d962-attribute-selector-scalar.mjs';
import {shouldEmitPresetConstantByOrigin,shouldInlineCustomPresetByOrigin} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/23be55620b26-initializer-origins.local-array-entry.qualified.mjs";
import {qualifyDocumentAttributeSelector} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_attributes/attribute_identity_context.mjs";
import {editorObjectReferenceTypes,editorObjectConstructor} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/editor-object-reference-codecs.mjs";
import {parameterScriptName} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/parameter-script-name.mjs";
import { applyParamAccessors, lowerInitial } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/c7fb2b544860-f5647e66d7da-701ab5fdb888-189652cc1dc7-core.mjs";
import { memoExpression, expressionKey, namingIndexes } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/c7fb2b544860-f5647e66d7da-701ab5fdb888-189652cc1dc7-core.mjs";
import { refKey, conversionError, libraryPrefix } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/explicit-numeric-global-model.mjs";
/**
 * ttg-params — Trigger XML parameter → Galaxy expression conversion.
 *
 * Converts a ParamJson (which may hold a literal value, a variable reference,
 * a preset constant, a nested FunctionCall, or a struct-member access) into a
 * Galaxy AST Expression node.  Also provides argument-ordering helpers used
 * when building Galaxy call expressions from FunctionDef parameter lists.
 *
 * Depends on: ttg-core (context + naming), ttg-convert (for nested calls).
 */
import { Parser } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js";
import { createIdentifier, createStringLiteral, createNumericLiteral, createCallExpression, createVariableDeclaration, createBinaryExpression, createExpressionStatement, createParenthesizedExpression, } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js";
import { resolve, sanitizeName, normalizeGalaxyStringScalar, shouldEmitIdentifierFromUntypedValue, resolveVariableGalaxyName, triggerHandleName, mapParameterTypeToGalaxy, presetValueConstantName, STRING_BACKED_TRIGGER_TYPES, isDeclaredGalaxySymbol, declaredPresetValueName, } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/c7fb2b544860-f5647e66d7da-701ab5fdb888-189652cc1dc7-core.mjs";
import { convertFunctionCallExpr } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v532_selector_metadata_private_handles_2026-10-29/graph/d859692ec500-c23-41510e4e53a5-d4958be41033ae-db130379512036cf-1d30eb8c2d75-117a3a020d17-ttg-convert.mjs";
import { parseTemplateFragment, printTemplateExpression } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs";
/** Which Preset owns each of its values, built once per library.
 *  Both callers used to scan every Preset and every value of the library and
 *  build a key per comparison; on a Blizzard library that is the dominant cost
 *  of the whole forward direction. The library object is the key, so a reparsed
 *  library indexes afresh. */
const presetOwners = new WeakMap();
/** The loaded library of an id, with the document and the natives winning their own. */
function libraryById(id, ctx) {
    if (id === ctx.libId)
        return ctx.library;
    if (id === ctx.nativeLibrary?.id)
        return ctx.nativeLibrary;
    return ctx.allLibraries?.get(id);
}
function presetOwnerIndex(library) {
    const cached = presetOwners.get(library);
    if (cached)
        return cached;
    const index = new Map();
    for (const preset of Object.values(library.elementsByType?.Preset ?? {})) {
        for (const ref of preset.values ?? []) {
            const key = refKey(ref, preset.library);
            if (!index.has(key))
                index.set(key, preset);
        }
    }
    presetOwners.set(library, index);
    return index;
}
/** Infer from the actual operand, never from an abstract formal's int fallback. */
export function actualParameterType(param, ctx, visiting = new Set()) {
    if (visiting.has(param))
        return undefined;
    visiting.add(param);
    try {
        if (param.structMember) {
            const member = resolve(param.structMember, ctx);
            return member && actualParameterType(member, ctx, visiting);
        }
        if (param.variable)
            return resolve(param.variable, ctx)?.variableType;
        if (param.paramRef)
            return resolve(param.paramRef, ctx)?.paramType;
        if (param.preset) {
            const value = resolve(param.preset, ctx);
            const library = libraryById(value?.library ?? param.preset.library ?? ctx.libId, ctx);
            const owner = library && presetOwnerIndex(library).get(refKey(param.preset, ctx.libId));
            if (owner)
                return { type: 'preset', typeElement: { type: 'Preset', library: owner.library, id: owner.id } };
        }
        if (param.functionCall) {
            const call = resolve(param.functionCall, ctx);
            const definition = call && resolve(call.functionDef, ctx);
            return definition?.returnType;
        }
        return param.valueType ?? (param.expressionType ? { type: param.expressionType } : undefined);
    }
    finally {
        visiting.delete(param);
    }
}
/** Shared by action parameters and nested expression calls, including dependencies. */
export function convertPresetValue(param, ctx) {
    const value = resolve(param.preset, ctx);
    if (!value)
        return conversionError('UNRESOLVED_REFERENCE', 'Preset value is unavailable', { reference: param.preset });
    const library = libraryById(value.library ?? param.preset.library ?? ctx.libId, ctx);
    const owner = library && presetOwnerIndex(library).get(refKey(value, ctx.libId));
    const scalar = value.value;
    // PresetGenConstVar is an explicit promise that the symbolic Galaxy constant
    // exists. Preserve that editor choice instead of flattening it to the equal
    // numeric/bool scalar; the latter compiles but loses GUI semantics.
    // PresetInteger libraries shipped by Blizzard sometimes omit
    // PresetGenConstVar even though their generated header declares the ge_*
    // constants.  A computed name is accepted only when that exact symbol is in
    // the loaded declarations; otherwise the ordinal fallback below remains.
    const mayHaveDeclaredConstant = !!owner && (!!owner.generateConstants || !!owner.integer);
    const generatedName = mayHaveDeclaredConstant ? presetValueConstantName(owner, value) : undefined;
    const declaredName = declaredPresetValueName(value, ctx.libId);
 const sourceInline=!!owner&&!!generatedName&&shouldInlineCustomPresetByOrigin(owner,value,{libraryId:ctx.libId,name:generatedName});
    const ownerLibrary = owner?.library ?? ctx.libId;
    // The current document's header is produced by this same conversion and
    // declares every enabled PresetGenConstVar value. No external declaration is
    // needed to use that symbol in the generated script.
    if (!sourceInline && generatedName && (owner?.generateConstants || owner?.integer) && owner.name && value.name && !owner.disabled && ownerLibrary === ctx.libId) {
        return createIdentifier(generatedName);
    }
    if (declaredName && (!sourceInline || declaredName !== generatedName))
        return createIdentifier(declaredName);
    if (!sourceInline && generatedName && isDeclaredGalaxySymbol(generatedName))
        return createIdentifier(generatedName);
    if (owner?.integer) {
        const index = owner.values.findIndex(ref => refKey(ref, owner.library) === refKey(value, ctx.libId));
        if (index >= 0)
            return createNumericLiteral(index);
    }
    // Explicit values are already the declared Galaxy expression. In particular,
    // a dependency need not export an alias for its literal-valued presets.
    if (scalar !== undefined && scalar !== '') {
        if (/^-?\d+(\.\d+)?$/.test(scalar))
            return createNumericLiteral(scalar.includes('.') ? scalar : Number(scalar));
        if (/^[A-Za-z_]\w*$/u.test(scalar))
            return createIdentifier(scalar);
        const expression = parseTemplateFragment(scalar, true)?.[0];
        if (expression)
            return expression;
        // Operator presets are syntax tokens. Prove their binary role through the
        // grammar rather than accepting arbitrary unparsed text as an identifier.
        const binary = parseTemplateFragment(`leftOperand ${scalar} rightOperand`, true)?.[0];
        if (binary?.kind === 124 /* SyntaxKind.BinaryExpression */ && binary.left?.name === 'leftOperand' && binary.right?.name === 'rightOperand')
            return createIdentifier(scalar);
        return conversionError('PRESET_VALUE', 'Preset value is not a Galaxy expression or operator', { reference: param.preset, value: scalar });
    }
    if (generatedName)
        return createIdentifier(generatedName);
    if (scalar === '' && owner?.baseType === 'string')
        return createStringLiteral('');
    return conversionError('PRESET_VALUE', 'Preset has neither a scalar value nor generated constants', { reference: param.preset });
}
// ---------------------------------------------------------------------------
// Parameter → Expression
// ---------------------------------------------------------------------------
/** Trigger types that compile to galaxy `string` — their values stay literal. */
const STRING_LIKE_VALUE_TYPES = new Set([...STRING_BACKED_TRIGGER_TYPES, 'text']);
function colorValueToExpr(value) {
    const bytes = value.trim().split(',').map(part => part.trim());
    if (bytes.length === 4 && bytes.every(part => /^\d+$/.test(part) && Number(part) <= 255)) {
        const [alpha, ...rgb] = bytes.map(Number);
        const percent = (byte) => createNumericLiteral((byte * 100 / 255).toFixed(2));
        return createCallExpression(alpha === 255 ? 'Color' : 'ColorWithAlpha', (alpha === 255 ? rgb : [...rgb, alpha]).map(percent));
    }
    const match = /^(Color(?:WithAlpha)?)\((.*)\)$/.exec(value.trim());
    if (!match)
        return undefined;
    const args = match[2]
        .split(',')
        .map(part => part.trim())
        .filter(part => part.length > 0);
    if (args.length !== 3 && args.length !== 4)
        return undefined;
    if (!args.every(arg => /^-?\d+(?:\.\d+)?$/.test(arg)))
        return undefined;
    return createCallExpression(match[1], args.map(arg => createNumericLiteral(arg.includes('.') ? arg : Number(arg))));
}
export const _dbgParams = { calls: 0, hits: 0 };
export function _dbgParamsReset() { _dbgParams.calls = 0; _dbgParams.hits = 0; }
function hasAutoVarDeclaration(ctx, name) {
    return ctx.autoVarDeclarations.some((stmt) => stmt?.kind === 141 /* SyntaxKind.VariableDeclaration */ && stmt.name?.name === name);
}
function addAutoIdentifierDeclaration(param, ctx) {
    const name = param.value;
    if (!name || !/^auto[0-9A-Fa-f]+_[A-Za-z0-9]+$/.test(name))
        return;
    if (hasAutoVarDeclaration(ctx, name))
        return;
    const paramDef = resolve(param.parameterDef, ctx);
    const galaxyType = mapParameterTypeToGalaxy(paramDef?.paramType, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
    if (galaxyType === 'string' || galaxyType === 'text' || galaxyType === 'void')
        return;
    ctx.autoVarDeclarations.push(createVariableDeclaration(galaxyType, name));
}
/** `required;excluded` as the editor writes it: four bit masks over the
 *  `c_targetFilter*` constants, low word then high word for each half. */
function unitFilterExpression(scalar) {
    const flags = namingIndexes().unitFilterFlags;
    if (flags.size === 0)
        return undefined;
    const halves = scalar.split(';');
    if (halves.length !== 2)
        return undefined;
    const words = [[], [], [], []];
    for (const [half, text] of halves.entries()) {
        for (const name of text.split(',')) {
            const flag = name.trim();
            if (!flag || flag === '-')
                continue;
            const resolved = flags.get(flag);
            if (!resolved)
                return undefined;
            const shift = resolved.bit < 32
                ? createIdentifier(resolved.constant)
                : createParenthesizedExpression(createBinaryExpression(createIdentifier(resolved.constant), 21 /* SyntaxKind.MinusToken */, createNumericLiteral(32)));
            words[half * 2 + (resolved.bit < 32 ? 0 : 1)].push(createParenthesizedExpression(createBinaryExpression(createNumericLiteral(1), 27 /* SyntaxKind.LessThanLessThanToken */, shift)));
        }
    }
    return createCallExpression('UnitFilter', words.map(terms => terms.length === 0
        ? createNumericLiteral(0)
        : terms.reduce((left, right) => createBinaryExpression(left, 30 /* SyntaxKind.BarToken */, right))));
}
export function convertParamExpr(param, ctx) {
    // Compound literals use the editor's value encoding, independently of the
    // consuming function's name. Do not discard an unrecognized extra component.
    const valueType = param.valueType?.type?.toLowerCase();
    const hasOperand = param.variable || param.paramRef || param.functionCall || param.preset || param.valueElement ||
        param.scriptCode !== undefined || param.expressionText !== undefined || !!param.expressionParams?.length || !!param.valueParams?.length;
    // These two editor selectors carry a resource/command category in
    // ValueTypeInfo. The runtime operands are the path, or ability + ValueId.
    // Keep the metadata in the XML model; never use it as the command index.
    if (param.valueTypeInfo !== undefined && (!hasVerifiedSelectorMetadata(param,valueType,hasOperand))) {
        return conversionError('PARAM_VALUE_COMPONENT', 'ValueTypeInfo requires a verified value codec', { parameter: refKey(param), valueType: param.valueType, valueTypeInfo: param.valueTypeInfo });
    }
    if (!hasOperand && valueType === 'abilcmd') {
        const index = param.valueId ?? '0';
        if (param.value === undefined || !/^\d+$/u.test(index) || !Number.isSafeInteger(Number(index)) || Number(index) > 2147483647) {
            return conversionError('PARAM_VALUE_COMPONENT', 'Ability command requires a catalog value and nonnegative command index', { parameter: refKey(param) });
        }
        return createCallExpression('AbilityCommand', [createStringLiteral(normalizeGalaxyStringScalar(param.value)), createNumericLiteral(Number(index))]);
    }
    if (!hasOperand && valueType === 'filepath' && param.valueTypeInfo !== undefined && param.value === undefined) {
        return conversionError('PARAM_VALUE_COMPONENT', 'File selector is missing its path', { parameter: refKey(param) });
    }
    // The difficulty picker stores its selection in ValueId and the Galaxy literal
    // is that number. Paired XML/Galaxy shows the editor emitting the ValueId even
    // where a stale <Value> scalar disagrees with it, so ValueId decides here too;
    // the scalar stays in the XML model and survives the round trip untouched.
    if (!hasOperand && valueType === 'difficulty' && param.valueId !== undefined) {
        const rawId = param.valueId;
        if (!/^\d+$/u.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) > 2147483647) {
            return conversionError('PARAM_VALUE_COMPONENT', 'Editor value ID must be a nonnegative Galaxy integer', { parameter: refKey(param), valueId: rawId });
        }
        return createNumericLiteral(Number(rawId));
    }
    // Catalog links are string-valued Galaxy operands.  TriggerData may also
    // retain the editor's selection index in ValueId (UINT32_MAX is commonly
    // used for a catalog value selected by name).  The paired editor output
    // emits the <Value> text and does not expose that index in Galaxy, so keep
    // ValueId as selection metadata and let the scalar path below quote Value.
    if (!hasOperand && valueType === 'gamelink' && param.value !== undefined) {
        return createStringLiteral(normalizeGalaxyStringScalar(param.value));
    }
    const editorObjectTypes = editorObjectReferenceTypes;
    if (!hasOperand && (valueType === 'playercolor' || valueType === 'soundlink' ||
        (editorObjectTypes.includes(valueType ?? '') && param.valueId !== undefined))) {
        const rawId = param.valueId ?? '0';
        if (!/^\d+$/u.test(rawId) || !Number.isSafeInteger(Number(rawId)) || Number(rawId) > 2147483647) {
            return conversionError('PARAM_VALUE_COMPONENT', 'Editor value ID must be a nonnegative Galaxy integer', { parameter: refKey(param), valueId: rawId });
        }
        const id = Number(rawId);
        if (valueType === 'soundlink') {
            // XML selects assets starting at 1; Galaxy uses 0-based indices and -1
            // for the default selection (XML omits ValueId or stores zero).
            if (param.value === undefined)
                return conversionError('PARAM_VALUE_COMPONENT', 'Sound link is missing its catalog value', { parameter: refKey(param) });
            return createCallExpression('SoundLink', [createStringLiteral(normalizeGalaxyStringScalar(param.value)), createNumericLiteral(id - 1)]);
        }
        if (valueType === 'playercolor')
            return createNumericLiteral(id);
        // For editor objects ValueId is the runtime operand. TriggerData can retain
        // an unrelated scalar Value beside it (observed as both booleans and
        // integers), while the editor-generated Galaxy consistently emits only the
        // *FromId(ValueId) expression. Keep the scalar in the XML model for a
        // lossless XML round trip, but do not reinterpret it as a second operand.
        // These constructors are SC2 API contracts, not inferred from signatures.
        const constructor = editorObjectConstructor(valueType);
        if (!constructor)
            return conversionError('PARAM_VALUE_COMPONENT', 'Editor object reference has no supported value codec', { parameter: refKey(param), valueId: param.valueId, valueType: param.valueType });
        return createCallExpression(constructor, [createNumericLiteral(id)]);
    }
    // An int selector repeats its own scalar in ValueId; every occurrence in the
    // corpus agrees, so the scalar path handles it. A disagreement would mean the
    // two components carry different values and is still refused.
    const repeatedIntId = !hasOperand && valueType === 'int' && param.value !== undefined && param.valueId === param.value;
    // Old editor documents can retain a numeric object-selection ID beside a
    // fully specified boolean literal. Paired TriggerData/MapScript examples use
    // both true and false with the same ID, proving that the ID is stale editor
    // selection metadata rather than a second runtime operand.
    const booleanWithSelectionId = !hasOperand && valueType === 'bool' && /^(?:true|false)$/iu.test(param.value ?? '') &&
        /^\d+$/u.test(param.valueId ?? '') && Number.isSafeInteger(Number(param.valueId));
    if (param.valueId !== undefined && !repeatedIntId && !booleanWithSelectionId) {
        return conversionError('PARAM_VALUE_COMPONENT', 'Editor object reference has no supported value codec', { parameter: refKey(param), valueId: param.valueId, valueType: param.valueType });
    }
    _dbgParams.calls++;
    // Tokenized localized text has required TextExpressionSetToken side effects.
    // Do not memoize it: every use must replay those setters immediately before
    // TextExpressionAssemble.
    if ((param.expressionType ?? '').toLowerCase() === 'text' && (param.expressionParams?.length ?? 0) > 0) {
        return _convertParamExprInner(param, ctx);
    }
    return memoExpression(param, ctx, () => _convertParamExprInner(param, ctx));
}
function _convertParamExprInner(param, ctx) {
    if (param.expressionText !== undefined) {
        return convertEditorExpression(param, ctx);
    }
    if ((param.expressionType ?? '').toLowerCase() === 'text') {
        return convertLocalizedTextExpression(param, ctx);
    }
    if (param.scriptCode !== undefined) {
        const parsed = new Parser().parseFile('parameter.galaxy', `void parameterExpression() { return ${param.scriptCode.trim()}\n; }`);
        const statements = parsed.statements[0]?.body?.statements;
        const expression = statements?.[0]?.expression;
        // The authored expression may already end in a semicolon, so the wrapper's own
        // terminator parses as a further empty statement. An empty statement carries no
        // behaviour: accept it from the AST rather than editing the source text.
        const trailingAreEmpty = !!statements && statements.slice(1).every(statement => statement.kind === 139 /* SyntaxKind.EmptyStatement */);
        if (parsed.parseDiagnostics?.length || parsed.statements.length !== 1 || !statements?.length || !trailingAreEmpty ||
            statements[0].kind !== 137 /* SyntaxKind.ReturnStatement */ || !expression) {
            return conversionError('PARAM_SCRIPT_SYNTAX', 'Parameter ScriptCode must contain one Galaxy expression', { parameter: refKey(param), source: param.scriptCode });
        }
        return expression;
    }
    // Function parameter reference: <Parameter Type="ParamDef"> → emit lp_xxx
    if (param.paramRef) {
        const paramDef = resolve(param.paramRef, ctx);
        if (paramDef?.name) {
            // Must match the name the signature declares, which lower-cases the first
            // character the way the editor does.
            return applyParamAccessors(createIdentifier(parameterScriptName(paramDef, paramDef.id)), param, ctx, convertParamExpr);
        }
    }
    // Variable reference (possibly array access via param.array)
    if (param.variable) {
        const variable = resolve(param.variable, ctx);
        if (variable) {
            const galaxyVarName = resolveVariableGalaxyName(variable, param.variable, ctx);
            return applyParamAccessors(createIdentifier(galaxyVarName), param, ctx, convertParamExpr);
        }
        // Variable ref that couldn't be resolved — synthesise a best-effort name
        const fallbackLib = param.variable.library ?? ctx.libId;
        const fallbackId = param.variable.id;
        if (fallbackId) {
            return createIdentifier(`${libraryPrefix(fallbackLib)}gv_${fallbackId}`);
        }
    }
    // ValueParam slots substitute numbered placeholders in an explicit <Value>
    // template. Some editor documents retain those slots beside a complete
    // FunctionCall operand after changing the parameter representation. The
    // call is the runtime value; the unbound slots are non-executable metadata.
    if (param.functionCall) {
        const fc = resolve(param.functionCall, ctx);
        if (fc)
            return convertFunctionCallExpr(fc, ctx);
    }
    if (param.valueParams?.length) {
        const valueType = (param.valueType?.type ?? param.customType ?? '').toLowerCase();
        if (valueType !== 'catalogfieldpath' || param.value === undefined) {
            return conversionError('PARAM_VALUE_COMPONENT', 'ValueParam requires a supported typed value template', {
                parameter: refKey(param), valueType: param.valueType, customType: param.customType,
            });
        }
        const components = param.valueParams.map(ref => {
            const value = resolve(ref, ctx);
            const expression = value && convertParamExpr(value, ctx);
            if (!expression)
                conversionError('PARAM_VALUE_COMPONENT', 'ValueParam component is unavailable', { parameter: refKey(param), component: refKey(ref) });
            return expression;
        });
        const used = new Set();
        const token = /\[(\d+)\]/gu;
        let cursor = 0;
        let expression;
        const append = (part) => {
            expression = expression === undefined ? part : createBinaryExpression(expression, 20 /* SyntaxKind.PlusToken */, part);
        };
        for (let match = token.exec(param.value); match; match = token.exec(param.value)) {
            const index = Number(match[1]);
            if (index >= components.length)
                continue;
            append(createStringLiteral(param.value.slice(cursor, match.index + 1)));
            append(createCallExpression('IntToString', [components[index]]));
            used.add(index);
            cursor = match.index + match[0].length - 1;
        }
        if (used.size !== components.length) {
            return conversionError('PARAM_VALUE_COMPONENT', 'ValueParam template does not bind every component', {
                parameter: refKey(param), template: param.value, components: components.length, bound: [...used],
            });
        }
        append(createStringLiteral(param.value.slice(cursor)));
        return expression;
    }
    // Literal value — emit the appropriate Galaxy literal or identifier
    if (param.value !== undefined) {
        const vt = param.valueType?.type?.toLowerCase() ?? '';
        // Attribute selectors retain the attribute ID beside the selected value
        // in TriggerData (for example 16|0013). Galaxy compares the value only.
        if(vt==='attributegame'||vt==='attributeplayer')return createStringLiteral(qualifyDocumentAttributeSelector(vt,decodeAttributeSelectorScalar(param.value),{library:ctx.libId,id:param.id}));
        if (vt === 'attributevalue') {
            const value = normalizeGalaxyStringScalar(param.value);
            const separator = value.indexOf('|');
            return createStringLiteral(separator < 0 ? value : value.slice(separator + 1));
        }
        if (vt === 'int' || vt === 'byte') {
          if (/^-?(?:0[xX][0-9A-Fa-f]+|0[0-7]+)$/u.test(param.value)) {
            const literal = parseTemplateFragment(param.value, true)?.[0];
            if (literal) return literal;
            return conversionError('PARAM_NUMERIC_LITERAL', 'Exact integer token could not be parsed', {value:param.value});
          }
          return createNumericLiteral(Number(param.value));
        }
        if (vt === 'fixed')
            return createNumericLiteral(/^-?\d+$/u.test(param.value) ? `${param.value}.0` : param.value);
        if (vt === 'bool')
            return createIdentifier(param.value === 'true' ? 'true' : 'false');
        if (vt === 'color') {
            const colorExpr = colorValueToExpr(param.value);
            if (colorExpr)
                return colorExpr;
            return conversionError('COLOR_VALUE', 'Color must be an ARGB byte tuple or a supported color expression', { value: param.value });
        }
        // Unlike ordinary string-backed editor domains, modelanim stores the
        // complete Galaxy string expression in <Value> (including its quotes).
        // Parse that expression so a valid &quot;Talk&quot; becomes "Talk", without
        // adding a second layer of quotation or accepting a bare identifier.
        if (vt === 'modelanim' || vt === 'convstateindex') {
            const expression = parseTemplateFragment(param.value, true)?.[0];
            if (expression?.kind === 3 /* SyntaxKind.StringLiteral */)
                return expression;
            return conversionError('PARAM_VALUE_COMPONENT', 'Editor domain value must be a Galaxy string literal expression', { parameter: refKey(param), value: param.value });
        }
        // The engine owns target-filter names and masks: the flag names, their constants
        // and bit positions all come from the loaded libraries and headers. Without them
        // the scalar still goes out through the string form, which the engine accepts but
        // the editor never writes.
        if (vt === 'unitfilter')
            return unitFilterExpression(param.value) ?? createCallExpression('UnitFilterStr', [createStringLiteral(param.value)]);
        // UnitRefFromVariable stores authored Galaxy l-value text as a scalar. It
        // is neither a document Unit ID nor a string-valued unit operand.
        if (vt === 'unitref')
            return createCallExpression('UnitRefFromVariable', [createStringLiteral(normalizeGalaxyStringScalar(param.value))]);
        if (vt === '' && param.value === 'null')
            return createIdentifier('null');
        // Editor encoding: handle-typed scalars store their null default as "0".
        // Emitting the string "0" would change the type — galaxy null is correct.
        if (param.value === '0' && vt !== '' && !STRING_LIKE_VALUE_TYPES.has(vt)) {
            return createIdentifier('null');
        }
        if ((vt === '' || vt === 'string') && shouldEmitIdentifierFromUntypedValue(param.value, param, ctx)) {
            addAutoIdentifierDeclaration(param, ctx);
            return createIdentifier(param.value);
        }
        return createStringLiteral(vt === 'string' ? param.value : normalizeGalaxyStringScalar(param.value));
    }
    // PresetAsBits stores every selected flag as a ValuePreset child. Rebuild
    // the bitwise expression from those declared preset values; an empty set is
    // handled by valueElement below and becomes numeric zero.
    if (param.valuePresets?.length) {
        const values = param.valuePresets.map(preset => convertPresetValue({ ...param, preset, valuePresets: undefined, valueElement: undefined }, ctx));
        return values.reduce((left, right) => createBinaryExpression(left, 30 /* SyntaxKind.BarToken */, right));
    }
    // Preset value — resolve to its scalar constant or symbolic identifier
    if (param.preset) {
        return convertPresetValue(param, ctx);
    }
    // valueElement: a Preset type reference — emit the default value for that preset
    // (int/bits presets default to 0; non-int presets fall back to the preset ID string)
    if (param.valueElement) {
        const valueElement = param.valueElement;
        if (valueElement.type === 'Trigger' || param.valueType?.type?.toLowerCase() === 'trigger') {
            const trigger = resolve(valueElement, ctx);
            if (trigger)
                return createIdentifier(triggerHandleName(valueElement.library ?? ctx.libId, trigger));
        }
        const preset = resolve(param.valueElement, ctx);
        if (preset && preset.baseType && preset.baseType !== 'int') {
            return createStringLiteral(param.valueElement.id);
        }
        return createNumericLiteral(0);
    }
    // valueType-only param
    if (param.valueType?.type) {
        const vt = param.valueType.type.toLowerCase();
        if (vt === 'string')
            return createStringLiteral('');
        if (vt === 'bool')
            return createIdentifier('false');
        if (vt === 'fixed')
            return createNumericLiteral(0.0);
        if (vt === 'int' || vt === 'byte')
            return createNumericLiteral(0);
        if (vt === 'preset') {
            const parameterDef = resolve(param.parameterDef, ctx);
            const presetRef = param.valueElement ?? parameterDef?.paramType?.typeElement ?? parameterDef?.preset;
            const preset = resolve(presetRef, ctx);
            const baseType = preset?.baseType?.toLowerCase();
            // An empty PresetAsBits selection has no ValuePreset child.  The editor
            // still emits the neutral value of the preset's declared base type.
            if (baseType === 'int')
                return createNumericLiteral(0);
            if (baseType === 'fixed')
                return createNumericLiteral(0.0);
            if (baseType === 'bool')
                return createIdentifier('false');
            if (baseType === 'string')
                return createStringLiteral('');
            return conversionError('PARAM_VALUE_COMPONENT', 'Empty preset requires a resolved scalar base type', {
                parameter: refKey(param),
                preset: presetRef,
                baseType: preset?.baseType,
            });
        }
        // A map owns its TriggerStrings directly, so its key has no lib_Map_
        // segment. Library documents use the qualified form to avoid collisions.
        if (vt === 'text') {
            const libId = param.library ?? ctx.library.id ?? '';
            const paramId = param.id ?? '';
            const owner = libId === ctx.library.id ? ctx.library : ctx.allLibraries?.get(libId);
            const parameterDef = resolve(param.parameterDef, ctx);
            // An absent key means empty text only when both editor string tables
            // were loaded. With a partial locale, preserve the external reference.
            // A present empty value (`key=`) is contract-dependent.  Raw text
            // parameters without a declared Preset keep an external key even while
            // empty; text parameters whose ParamDef offers a Preset (for example a
            // dedicated "none" value) compile to an empty literal. Whitespace content
            // (`key= `) remains external/localizable. parseTriggerStrings preserves
            // all three states.
            const presetBackedEmpty = param.localizedValue === '' && parameterDef?.preset !== undefined;
            const missingDeclaredTextValue = owner?.completeLocalizedValues && param.localizedValue === undefined;
            if (presetBackedEmpty || missingDeclaredTextValue) {
                return createCallExpression('StringToText', [createStringLiteral('')]);
            }
            return createCallExpression('StringExternal', [
                createStringLiteral(ctx.library.implicit === true
                    ? `Param/Value/${paramId}`
                    : `Param/Value/lib_${libId}_${paramId}`),
            ]);
        }
    }
    return createIdentifier('null');
}
function convertEditorExpression(param, ctx) {
    const expressionText = param.expressionText;
    if (expressionText === undefined)
        return conversionError('PARAM_VALUE_COMPONENT', 'ExpressionText is missing', { parameter: refKey(param) });
    const bindings = new Map();
    for (const ref of param.expressionParams ?? []) {
        const child = resolve(ref, ctx);
        if (!child)
            return conversionError('UNRESOLVED_REFERENCE', 'Expression parameter is unavailable', { parameter: refKey(param), reference: ref });
        const code = child.expressionCode;
        // An ExpressionParam without ExpressionCode cannot be addressed by any
        // ~code~ placeholder. Editor documents can retain these stale children
        // after an expression is edited; ignore them without evaluating the value.
        if (!code)
            continue;
        if (bindings.has(code))
            return conversionError('PARAM_VALUE_COMPONENT', 'Expression has duplicate ExpressionCode bindings', { parameter: refKey(param), expressionCode: code });
        bindings.set(code, child);
    }
    // Shipped editor documents can retain stale ExpressionParam children after
    // their placeholders are removed from ExpressionText.  The editor ignores
    // those children entirely. Resolve lazily so an unused binding is neither
    // evaluated nor allowed to leak expression setup side effects.
    const substitutions = new Map();
    const parts = [];
    const placeholder = /~([^~]+)~/gu;
    let offset = 0;
    let match;
    while ((match = placeholder.exec(expressionText)) !== null) {
        if (match.index > offset)
            parts.push(expressionText.slice(offset, match.index));
        const code = match[1];
        let expression = substitutions.get(code);
        if (!expression) {
            const child = bindings.get(code);
            if (!child)
                return conversionError('PARAM_VALUE_COMPONENT', 'ExpressionText references an unbound placeholder', { parameter: refKey(param), expressionCode: code, expressionText });
            expression = convertParamExpr(child, ctx);
            if (!expression)
                return conversionError('PARAM_VALUE_COMPONENT', 'Expression parameter has no Galaxy value', { parameter: refKey(param), reference: refKey(child), expressionCode: code });
            substitutions.set(code, expression);
        }
        parts.push(expression);
        offset = match.index + match[0].length;
    }
    if (offset < expressionText.length)
        parts.push(expressionText.slice(offset));
    if ((param.expressionType ?? '').toLowerCase() === 'string') {
        const expressions = parts
            .filter(part => typeof part !== 'string' || part.length > 0)
            .map(part => typeof part === 'string' ? createStringLiteral(part) : part);
        if (expressions.length === 0)
            return createStringLiteral('');
        return expressions.slice(1).reduce((left, right) => createBinaryExpression(left, 20 /* SyntaxKind.PlusToken */, right), expressions[0]);
    }
    const source = parts.map(part => typeof part === 'string' ? part : printTemplateExpression(part)).join('');
    const parsed = parseTemplateFragment(source, true);
    if (parsed?.length === 1)
        return parsed[0];
    return conversionError('PARAM_SCRIPT_SYNTAX', 'ExpressionText is not one Galaxy expression after parameter substitution', {
        parameter: refKey(param), expressionType: param.expressionType, expressionText, source,
    });
}
function localizedExpressionKey(param, ctx) {
    const owner = param.library ?? ctx.library.id;
    return ctx.library.implicit === true && owner === ctx.library.id
        ? `Param/Expression/${param.id}`
        : `Param/Expression/lib_${owner}_${param.id}`;
}
function convertLocalizedTextExpression(param, ctx) {
    const key = localizedExpressionKey(param, ctx);
    const setters = [];
    const codes = new Set();
    for (const ref of param.expressionParams ?? []) {
        const child = resolve(ref, ctx);
        if (!child)
            return conversionError('UNRESOLVED_REFERENCE', 'Localized text expression parameter is unavailable', { parameter: refKey(param), reference: ref });
        const code = child.expressionCode;
        // Only coded children can bind a token in Param/Expression. TriggerData
        // may retain uncoded children that are no longer part of the localized
        // expression, and evaluating them could introduce unused side effects.
        if (!code)
            continue;
        if (codes.has(code))
            return conversionError('PARAM_VALUE_COMPONENT', 'Localized text expression has duplicate token bindings', { parameter: refKey(param), expressionCode: code });
        codes.add(code);
        const value = convertParamExpr(child, ctx);
        if (!value)
            return conversionError('PARAM_VALUE_COMPONENT', 'Localized text expression token has no Galaxy value', { parameter: refKey(param), reference: ref, expressionCode: code });
        setters.push(createExpressionStatement(createCallExpression('TextExpressionSetToken', [
            createStringLiteral(key), createStringLiteral(code), value,
        ])));
    }
    if (setters.length)
        (ctx.expressionPrelude ??= []).push(...setters);
    return createCallExpression('TextExpressionAssemble', [createStringLiteral(key)]);
}
/** Builds a name → ParamJson map keyed by each param's ParameterDef name (or ref id). */
export function buildParamNameMap(callParams, ctx) {
    const map = new Map();
    for (const paramRef of callParams) {
        const param = resolve(paramRef, ctx);
        if (!param)
            continue;
        const paramDef = resolve(param.parameterDef, ctx);
        const name = paramDef?.name ?? paramRef.id;
        map.set(name, param);
    }
    return map;
}
/** Reads the string value of an operator param ("+", "-", "==", etc.). */
export function resolveOperatorString(opParam, ctx) {
    if (!opParam)
        return undefined;
    if (opParam.value)
        return opParam.value;
    if (opParam.preset) {
        const pv = resolve(opParam.preset, ctx);
        return pv?.value;
    }
    return undefined;
}
export function buildOrderedArgs(call, funcDef, ctx) {
    const rawParams = call.parameters ?? [];
    if (rawParams.length === 0)
        return [];
    // Local cache: prevents converting the same Param element more than once per call.
    // Without this, the hasDuplicateDefIds and fallback paths re-convert params,
    // causing 3^depth exponential blowup in deeply-nested trigger code.
    const localCache = new Map();
    function getExpr(param) {
        const cached = localCache.get(expressionKey(param, ctx));
        if (cached)
            return cached;
        const expr = convertParamExpr(param, ctx);
        if (expr)
            localCache.set(expressionKey(param, ctx), expr);
        return expr;
    }
    const paramByDefId = new Map();
    const seenDefIds = new Set();
    let hasDuplicateDefIds = false;
    const positional = [];
    const resolvedInOrder = [];
    for (const paramRef of rawParams) {
        const param = resolve(paramRef, ctx);
        if (!param)
            continue;
        resolvedInOrder.push(param);
        const expr = getExpr(param);
        if (!expr)
            continue;
        const defId = param.parameterDef ? refKey(param.parameterDef, ctx.libId) : undefined;
        if (defId) {
            if (seenDefIds.has(defId))
                hasDuplicateDefIds = true;
            seenDefIds.add(defId);
            paramByDefId.set(defId, expr);
        }
        else {
            positional.push(expr);
        }
    }
    // Variadic calls — reuse already-computed exprs in XML order
    if (hasDuplicateDefIds) {
        return resolvedInOrder.map(p => getExpr(p)).filter((e) => !!e);
    }
    // Re-order by FunctionDef's declared parameter sequence
    if (funcDef && funcDef.parameters && funcDef.parameters.length > 0) {
        const ordered = [];
        for (const paramDefRef of funcDef.parameters) {
            const defId = refKey(paramDefRef, funcDef.library ?? ctx.libId);
            if (defId) {
                const expr = paramByDefId.get(defId);
                if (expr)
                    ordered.push(expr);
            }
        }
        return ordered.length > 0 ? [...ordered, ...positional] : positional;
    }
    // Fallback: XML order — reuse already-computed exprs
    return resolvedInOrder.map(p => getExpr(p)).filter((e) => !!e);
}
//# sourceMappingURL=ttg-params.js.map