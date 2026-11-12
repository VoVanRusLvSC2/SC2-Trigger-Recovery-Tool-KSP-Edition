/**
 * ttg-core — shared infrastructure for the trigger→Galaxy forward conversion.
 *
 * Contains everything that every other ttg-* module depends on:
 *   - ConversionContext and GalaxyOutput interfaces
 *   - resolveRefFull / resolve<T> — element lookup across multi-library trees
 *   - Naming helpers — globalVarName, localVarName, triggerFuncName, etc.
 *   - Type mapping — Trigger XML types → Galaxy type strings
 *   - Array dimension helpers — getVariableArrayDims, buildGalaxyArrayTypeSuffix
 *   - toGalaxyFunctionName — maps FunctionDef to the emitted Galaxy identifier
 *   - findElementsOfType — typed element scan with fast elementsByType path
 *   - buildSubFuncTypeNamesMap — builds the sub-function role name lookup
 *   - detectDependencies — finds cross-library refs without recursive scanning
 */
import { Printer, Parser, isKeywordTypeKind, tokenToString, stringToToken } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-thread-analysis-v158-2026-10-05/dist/modules/galaxy/language-core/index.js';
import { lookupElement, lookupElementIn, refKey, conversionError, globalVariableName, globalVariableNames, globalVariables, sanitizeIdentifier, lowerInitial, libraryPrefix, startupFunctionName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-thread-analysis-v158-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { dependencyFunctionNames as buildDependencyFunctionNames, dependencyVariableNames as buildDependencyVariableNames } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-thread-analysis-v158-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/dependency-functions.js';
import { createIdentifier, createNumericLiteral, createBinaryExpression, createElementAccessExpression, createPropertyAccessExpression, } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-thread-analysis-v158-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';
// ---------------------------------------------------------------------------
// Singleton Printer (used internally by buildGalaxyArrayTypeSuffix)
// ---------------------------------------------------------------------------
const _printer = new Printer();
// ---------------------------------------------------------------------------
// Element lookup
// ---------------------------------------------------------------------------
/**
 * Resolves an ElementRefJson using elementsByType (correct key scheme).
 * Routes to nativeLibrary when ref.library matches its id.
 * Falls back to allLibraries for cross-library refs.
 */
/** The set of libraries a reference may name is the same for a whole conversion,
 *  yet it was rebuilt for every reference resolved. Keyed by the three inputs
 *  that define it, and rebuilt when the caller's library list grows. */
const mergedLibrariesByList = new WeakMap();
function mergedLibraries(library, nativeLibrary, allLibraries) {
    const root = allLibraries ?? library;
    let byLibrary = mergedLibrariesByList.get(root);
    if (!byLibrary)
        mergedLibrariesByList.set(root, byLibrary = new WeakMap());
    const entry = byLibrary.get(library);
    if (entry && entry.size === (allLibraries?.size ?? 0) && entry.native === nativeLibrary)
        return entry.merged;
    const merged = new Map(allLibraries);
    merged.set(library.id, library);
    if (nativeLibrary)
        merged.set(nativeLibrary.id, nativeLibrary);
    byLibrary.set(library, { size: allLibraries?.size ?? 0, native: nativeLibrary, merged });
    return merged;
}
export function resolveRefFull(ref, library, nativeLibrary, allLibraries) {
    if (!ref)
        return undefined;
    const merged = mergedLibraries(library, nativeLibrary, allLibraries);
    const target = merged.get(ref.library || library.id);
    // The map is keyed by library id, so a hit is the same library the scan below
    // would have found; the scan stays for a list keyed inconsistently with it.
    return target ? lookupElementIn(target, ref) : lookupElement(merged.values(), ref, library.id);
}
export function expressionKey(element, ctx) {
    return JSON.stringify([refKey(element, ctx.libId), ctx.pickEachIntegerVarName,
        ctx.pickEachPlayerVarName, ctx.pickEachUnitVarName, ctx.returnType, ctx.eventRegistrationTarget, [...(ctx.templateAutoVars ?? [])],
        ctx.templateSubfunctionIndex, ctx.templateScopes?.map(scope => [refKey(scope.definition, ctx.libId), [...scope.variables]])]);
}
export function memoExpression(element, ctx, convert) {
    const key = expressionKey(element, ctx);
    const cached = ctx.exprCache?.get(key);
    if (cached)
        return cached;
    const visiting = ctx.activeExpressions ??= new Set();
    if (visiting.has(key))
        conversionError('REFERENCE_CYCLE', 'Cyclic Trigger expression reference', { library: element.library, type: element.type, id: element.id });
    if (visiting.size >= 256)
        conversionError('DEPTH_LIMIT', 'Trigger expression nesting exceeds the conversion budget');
    visiting.add(key);
    try {
        const result = convert();
        if (result)
            ctx.exprCache?.set(key, result);
        return result;
    }
    finally {
        visiting.delete(key);
    }
}
/** Collect external libraries referenced by enabled flat XML elements.
 *
 * TriggerData stores a Trigger and its FunctionCall/Param children as sibling
 * elements. The editor's dependency scan respects `<Disabled/>` on each flat
 * element, but it does not remove an otherwise-enabled child merely because
 * its owning Trigger is disabled. This distinction is observable in paired
 * editor XML/Galaxy and differs from ordinary executable reachability.
 */
export function detectDependencies(library, allLibraries) {
    const deps = referencedLibraries(library);
    deps.delete('Ntve');
    if (!allLibraries)
        return [...deps];
    // The editor emits dependency includes and initialization calls in the
    // document's library order, not in the order references happen to appear
    // inside one library's element map.  Keep unknown/external libraries after
    // the document-owned ones in their original discovery order.
    const ordered = [];
    for (const id of allLibraries.keys()) {
        if (deps.delete(id))
            ordered.push(id);
    }
    ordered.push(...deps);
    return ordered;
}
/** Every other library the enabled elements of `library` reference, the native library included. */
export function referencedLibraries(library) {
    const libId = library.id;
    const deps = new Set();
    const allElements = Object.values(library.elements);
    const scanElement = (element) => {
        const pending = Object.entries(element)
            .filter(([field]) => !['id', 'library', 'type', 'catalogRefs'].includes(field));
        while (pending.length) {
            const [field, value] = pending.pop();
            if (!value || typeof value !== 'object')
                continue;
            if (Array.isArray(value)) {
                for (const item of value)
                    pending.push([field, item]);
                continue;
            }
            const object = value;
            if (typeof object['id'] === 'string') {
                const ref = (field === 'subFunctionType' || field === 'subFunctionTypes')
                    ? { ...object, type: 'SubFuncType' }
                    : object;
                const ownerLibrary = element.library ?? libId;
                const targetLibrary = ref.library || ownerLibrary;
                if (targetLibrary !== libId)
                    deps.add(targetLibrary);
                continue;
            }
            // Match reference validation: most TriggerData TypeElement values are
            // stale editor metadata. Only struct and preset types make them semantic.
            const declared = typeof object['type'] === 'string' ? object['type'].toLowerCase() : undefined;
            const inertTypeElement = declared !== undefined && declared !== 'struct' && declared !== 'preset';
            for (const entry of Object.entries(object)) {
                if (inertTypeElement && entry[0] === 'typeElement')
                    continue;
                pending.push(entry);
            }
        }
    };
    for (const element of allElements)
        if (!element.disabled)
            scanElement(element);
    return deps;
}
/** The libraries a document initializes and includes. A map that defines libraries of its own
 *  (`embedded`) also needs what their elements reference, since their code is compiled into its
 *  script; its own libraries come after the external ones, in document order. */
export function documentDependencies(library, allLibraries, embedded = []) {
    if (!embedded.length)
        return detectDependencies(library, allLibraries);
    const referenced = new Set([library, ...embedded.map(id => allLibraries?.get(id))]
        .flatMap(owner => owner ? detectDependencies(owner, allLibraries) : []));
    const external = [...referenced].filter(id => id !== library.id && !embedded.includes(id));
    const order = [...(allLibraries?.keys() ?? [])];
    const rank = (id) => { const index = order.indexOf(id); return index < 0 ? order.length : index; };
    return [...external.sort((left, right) => rank(left) - rank(right)), ...embedded];
}
/**
 * Shorthand for resolveRefFull that unpacks a ConversionContext.
 * Replaces the verbose four-argument pattern used throughout conversion code:
 *   resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries) as T
 * becomes:
 *   resolve<T>(ref, ctx)
 */
export function resolve(ref, ctx) {
    return resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
}
/** Apply array indices and nested member references equally to variables and function parameters. */
export function applyParamAccessors(base, param, ctx, convert) {
    let result = base;
    const indices = Array.isArray(param.array) ? param.array : param.array ? [param.array] : [];
    for (const ref of indices) {
        const index = resolve(ref, ctx);
        const expression = index && convert(index, ctx);
        if (!expression)
            conversionError('ARRAY_INDEX', 'Array index is unavailable', { reference: ref });
        result = createElementAccessExpression(result, expression);
    }
    if (param.structMember) {
        const member = resolve(param.structMember, ctx);
        const variable = member?.variable && resolve(member.variable, ctx);
        if (!member || !variable)
            conversionError('STRUCT_MEMBER', 'Structure member is unavailable', { reference: param.structMember });
        result = applyParamAccessors(createPropertyAccessExpression(result, memberVarName(variable, ctx.libId)), member, ctx, convert);
    }
    return result;
}
export function getSubFuncRole(fc, ctx) {
    if (!fc.subFunctionType)
        return 'Actions';
    const key = `${fc.subFunctionType.library}_${fc.subFunctionType.id}`;
    return ctx.subFuncTypeNames.get(key) ?? 'Actions';
}
export function normalizeGalaxyStringScalar(raw) {
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
        return raw.slice(1, -1);
    }
    return raw;
}
export function shouldEmitIdentifierFromUntypedValue(value, param, ctx) {
    if (!/^[A-Za-z_]\w*$/.test(value))
        return false;
    // An explicit string ValueType ALWAYS quotes — even when the ParamDef slot
    // is numeric (e.g. string concat mapped onto Arithmetic val1:int).
    const vt = param.valueType?.type?.toLowerCase() ?? '';
    if (vt === 'string')
        return false;
    // Common Galaxy identifier forms that should not be forced into string literals.
    if (value.startsWith('c_'))
        return true;
    if (value.startsWith('lv_'))
        return true;
    if (/^lib[A-Za-z0-9]+_gv_[A-Za-z0-9_]+$/.test(value))
        return true;
    if (/^auto[0-9A-Fa-f]{8}_[A-Za-z0-9_]+$/.test(value))
        return true;
    if (/^init_[A-Za-z0-9_]+$/.test(value))
        return true;
    // Prefer an identifier when the ParamDef is not string-like. The editor often
    // stores trigger handles or comparison operands as untyped scalar text.
    // String-like trigger types still compile to galaxy string and must stay quoted.
    const paramDef = resolveRefFull(param.parameterDef, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
    const expectedType = paramDef?.paramType?.type?.toLowerCase() ?? '';
    if (!expectedType)
        return false;
    if (mapTriggerTypeToGalaxy(expectedType) === 'string')
        return false;
    return true;
}
// ---------------------------------------------------------------------------
// Naming helpers (exported for use in tests and galaxy-to-trigger)
// ---------------------------------------------------------------------------
/** The editor's identifier encoding lives beside the naming helpers that need
 *  it in both directions; this is the same function under the forward name. */
export const sanitizeName = sanitizeIdentifier;
export { lowerInitial };
export function globalVarName(libId, variable) {
    return globalVariableName(libId, variable);
}
/**
 * Build a map from variable.id → disambiguated Galaxy name for an entire
 * library.  When two variables share the same display name (and would thus
 * generate the same galaxy identifier), the colliding ones get their element
 * ID appended as a suffix: e.g. `libDPAN_gv_upgrade_2B2BBBA4`.
 */
export function buildGlobalVarNamesMap(libId, variables) {
    return globalVariableNames(libId, variables);
}
export function localVarName(variable) {
    const raw = variable.name ?? variable.id;
    const n = sanitizeName(raw);
    // lv_* locals already carry trigger function scope naming.
    if (n.startsWith('lv_'))
        return n;
    // Preserve a reconstructed bare editor auto-local across XML roundtrips.
    // The same display name can also belong to an authored lv_auto* local, so
    // only provenance from Galaxy permits omitting the ordinary lv_ prefix.
    if (variable.flags?.includes('NoScriptPrefix') && /^[Aa]uto[0-9A-Fa-f]{8}_[A-Za-z_]\w*$/.test(n)) {
        return `auto${n.slice(4)}`;
    }
    // The PickEachUnit iterator is a unit Variable in the recovered GUI action,
    // but its Galaxy declaration is autoXXXXXXXX_var, not lv_autoXXXXXXXX_var.
    if (variable.variableType?.type === 'unit' && /^[Aa]uto[0-9A-Fa-f]{8}_var$/.test(n)) {
        return `auto${n.slice(4)}`;
    }
    // Other local Variable elements use lv_, including editor locals named after
    // automatic iterators (for example, int lv_auto2812FAE7_n).
    // TriggerStrings roundtrips capitalize the first letter ("Auto…"); keep the
    // canonical lowercase 'auto' spelling after the prefix.
    if (/^[Aa]uto[0-9A-Fa-f]{8}_[A-Za-z0-9]+$/.test(n))
        return `lv_auto${n.slice(4)}`;
    // An explicit script identifier is written as authored (EditorTest's
    // lv_SoundIndex); only a name gets the lower-case initial.
    const authored = variable.identifier !== undefined ? sanitizeName(variable.identifier) : '';
    if (authored)
        return authored.startsWith('lv_') ? authored : `lv_${authored}`;
    return `lv_${n.charAt(0).toLowerCase() + n.slice(1)}`;
}
/** A structure member's script name. A member of a structure another library
 *  declares keeps the lower-case initial its compiled declaration has: shipped
 *  libraries were compiled by editor versions that lowered an explicit
 *  identifier too (HeroUnitsData.ReviverUnit is `lv_reviverUnit`). */
export function memberVarName(variable, documentLibraryId) {
    if (variable.flags?.includes('NoScriptPrefix') && variable.identifier !== undefined)
        return sanitizeName(variable.identifier);
    if (variable.library === undefined || variable.library === documentLibraryId || variable.identifier === undefined)
        return localVarName(variable);
    const { identifier: _identifier, ...named } = variable;
    return localVarName(named);
}
export function structureTypeName(typeRef, library, nativeLibrary, allLibraries) {
    const structure = resolveRefFull(typeRef, library, nativeLibrary, allLibraries);
    if (!structure)
        return undefined;
    if (structure.flags?.includes('NoScriptPrefix'))
        return sanitizeName(structure.identifier ?? structure.name ?? structure.id);
    const raw = structure.name ?? structure.id;
    const n = sanitizeName(raw);
    if (!n)
        return undefined;
    const owner = structure.library ?? typeRef?.library ?? library.id;
    return `${libraryPrefix(owner)}gs_${n.charAt(0).toUpperCase() + n.slice(1)}`;
}
export function triggerFuncName(libId, trigger) {
    return `${libraryPrefix(libId)}gt_${sanitizeName(trigger.name ?? trigger.id)}_Func`;
}
export function triggerHandleName(libId, trigger) {
    return `${libraryPrefix(libId)}gt_${sanitizeName(trigger.name ?? trigger.id)}`;
}
export function triggerInitFuncName(libId, trigger) {
    return `${libraryPrefix(libId)}gt_${sanitizeName(trigger.name ?? trigger.id)}_Init`;
}
// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------
export function findElementsOfType(library, type) {
    if (library.elementsByType) {
        const typeMap = library.elementsByType[type];
        // Only use elementsByType when the type-specific map actually exists (has been built).
        // galaxy-to-trigger outputs set elementsByType:{} — the typeMap is then undefined,
        // so we fall through to the element scan below.
        if (typeMap !== undefined)
            return Object.values(typeMap);
    }
    // Fallback: scan the flat elements map (covers galaxy-to-trigger output libraries)
    return Object.values(library.elements).filter(e => e.type === type);
}
export function mapTriggerTypeToGalaxy(triggerType) {
    const normalized = triggerType.toLowerCase();
    const kind = stringToToken(normalized);
    if (kind !== undefined && isKeywordTypeKind(kind))
        return normalized;
    if (STRING_BACKED_TRIGGER_TYPES.has(normalized))
        return 'string';
    const mapping = {
        playercolor: 'int',
        preset: 'int',
        anycompare: 'int',
        anyvariable: 'int',
        sameas: 'int',
        sameasparent: 'int',
        any: 'int',
        void: 'void',
    };
    return mapping[normalized] ?? normalized;
}
/** Editor-only type aliases; Galaxy primitives retain their grammar spelling. */
export const STRING_BACKED_TRIGGER_TYPES = new Set([
    'string', 'gamelink', 'anygamelink', 'catalogfieldpath', 'catalogentry', 'catalogfieldname',
    'catalogscope', 'filepath', 'actormsg', 'animname', 'attributevalue',
    'gameoption', 'gameoptionvalue', 'layoutframe', 'layoutframerel', 'userfield', 'userinstance',
]);
/** Derived editor-type → Galaxy-type pairings, keyed by the native library they
 * were read from. Populated once per library; see deriveNativeTypeMapping. */
const nativeTypeEvidence = new WeakMap();
/** Galaxy return type per declared function name, from the same declarations. */
const declaredResults = new WeakMap();
const GALAXY_PRIMITIVE_TYPES = new Set(['void', 'bool', 'byte', 'int', 'fixed', 'string', 'text']);
/** The declared Galaxy return type of a function the caller supplied a
 *  declaration for. Used where a trigger model alone cannot say what an
 *  expression evaluates to. */
export function declaredReturnType(nativeLibrary, name) {
    return nativeLibrary && name ? declaredResults.get(nativeLibrary)?.get(name) : undefined;
}
function declaredTypeName(node) {
    const typeNode = node;
    if (!typeNode)
        return undefined;
    if (typeof typeNode.name === 'string' && typeNode.name.length > 0)
        return typeNode.name;
    const named = typeNode.name;
    if (typeof named?.name === 'string' && named.name.length > 0)
        return named.name;
    if (typeNode.kind !== undefined && isKeywordTypeKind(typeNode.kind))
        return tokenToString(typeNode.kind) ?? undefined;
    return undefined;
}
/**
 * Editor-only trigger types such as the dialog-control type have no Galaxy
 * keyword, and naming them here would be a guess dressed as a contract. Read the
 * pairing out of the loaded data instead: a FunctionDef flagged Native names a
 * Galaxy function, and its ParamDefs line up positionally with that function's
 * declared parameters, so every such definition observes an editor type against
 * a declared Galaxy type. Only a type whose observations all agree is used — a
 * polymorphic one disagrees with itself and is left to its own handling.
 */
export function deriveNativeTypeMapping(nativeLibrary, declarations) {
    if (!nativeLibrary || !declarations?.length || nativeTypeEvidence.has(nativeLibrary))
        return;
    const signatures = new Map();
    // The service prepends declarations synthesized from TriggerData and keeps
    // caller-supplied Galaxy declarations after them.  Walk backwards so an
    // authoritative native/header signature wins over the editor-type spelling
    // inferred for the same symbol by modelDeclarations().
    for (const declaration of [...declarations].reverse()) {
        const parsed = new Parser().parseFile('declarations.galaxy', declaration.text);
        for (const statement of [...parsed.statements]) {
            const name = statement?.name?.name;
            if (statement?.kind !== 142 /* SyntaxKind.FunctionDeclaration */ || typeof name !== 'string' || signatures.has(name))
                continue;
            signatures.set(name, {
                result: declaredTypeName(statement.type),
                parameters: [...(statement.parameters ?? [])].map(parameter => declaredTypeName(parameter.type)),
            });
        }
    }
    const votes = new Map();
    const vote = (triggerType, galaxyType) => {
        if (!triggerType || !galaxyType)
            return;
        const normalized = triggerType.toLowerCase();
        const kind = stringToToken(normalized);
        // Loaded declarations may use editor aliases in their own signatures, but
        // can never redefine a primitive Galaxy keyword such as int or bool.
        if (GALAXY_PRIMITIVE_TYPES.has(normalized) || kind !== undefined && isKeywordTypeKind(kind))
            return;
        const counts = votes.get(normalized) ?? new Map();
        counts.set(galaxyType, (counts.get(galaxyType) ?? 0) + 1);
        votes.set(normalized, counts);
    };
    for (const definition of Object.values(nativeLibrary.elementsByType?.FunctionDef ?? {})) {
        if (!definition.name)
            continue;
        const declaredName = definition.flags?.includes('Native')
            ? definition.name
            : `${libraryPrefix(definition.library ?? nativeLibrary.id)}gf_${sanitizeName(definition.name)}`;
        const signature = signatures.get(declaredName);
        if (!signature)
            continue;
        vote(definition.returnType?.type, signature.result);
        const formals = (definition.parameters ?? []).map(ref => lookupElement([nativeLibrary], ref, nativeLibrary.id));
        if (formals.length !== signature.parameters.length)
            continue;
        for (const [index, formal] of formals.entries())
            vote(formal?.paramType?.type, signature.parameters[index]);
    }
    // TriggerData also declares explicit unary conversion operators. A concrete
    // operator return type is authoritative evidence for its editor-only input
    // type even when that helper has no standalone Galaxy declaration.
    for (const definition of Object.values(nativeLibrary.elementsByType?.FunctionDef ?? {})) {
        if (!definition.flags?.includes('Operator') || !definition.returnType?.type)
            continue;
        const formals = (definition.parameters ?? []).map(ref => lookupElement([nativeLibrary], ref, nativeLibrary.id));
        if (formals.length !== 1)
            continue;
        const input = formals[0]?.paramType?.type;
        const output = definition.returnType.type;
        if (!input || /^(?:any|sameas)/iu.test(input) || /^(?:any|sameas)/iu.test(output))
            continue;
        // A positional pairing with an actual Galaxy declaration is stronger than
        // a conversion operator (one editor type may expose several conversions).
        if (votes.has(input.toLowerCase()))
            continue;
        const mappedOutput = mapTriggerTypeToGalaxy(output);
        if (!GALAXY_PRIMITIVE_TYPES.has(mappedOutput))
            continue;
        const inputKind = stringToToken(input.toLowerCase());
        if (inputKind !== undefined && isKeywordTypeKind(inputKind))
            continue;
        vote(input, mappedOutput);
    }
    const mapping = new Map();
    for (const [triggerType, counts] of votes) {
        if (counts.size !== 1)
            continue;
        const [galaxyType] = [...counts.keys()];
        if (galaxyType !== triggerType)
            mapping.set(triggerType, galaxyType);
    }
    nativeTypeEvidence.set(nativeLibrary, mapping);
    declaredResults.set(nativeLibrary, new Map([...signatures]
        .filter(([, signature]) => signature.result !== undefined)
        .map(([name, signature]) => [name, signature.result])));
}
/**
 * Whether the loaded data says what Galaxy type an editor type is. A type the
 * language declares, the table maps, or the native declarations pair up is
 * resolved; anything else is an editor name we have no evidence about.
 */
export function isResolvedGalaxyType(triggerType, nativeLibrary, allLibraries) {
    if (!triggerType)
        return false;
    const normalized = triggerType.toLowerCase();
    const kind = stringToToken(normalized);
    if (kind !== undefined && isKeywordTypeKind(kind))
        return true;
    if (mapTriggerTypeToGalaxy(normalized) !== normalized)
        return true;
    for (const candidate of [nativeLibrary, ...(allLibraries?.values() ?? [])]) {
        if (candidate && nativeTypeEvidence.get(candidate)?.has(normalized))
            return true;
    }
    return false;
}
export function mapParameterTypeToGalaxy(paramType, library, nativeLibrary, allLibraries) {
    const triggerType = paramType?.type ?? 'int';
    if (/^(any|sameas)/u.test(triggerType) && paramType?.variableType && !/^(any|sameas)/u.test(paramType.variableType)) {
        return mapTriggerTypeToGalaxy(paramType.variableType);
    }
    if (triggerType.toLowerCase() === 'struct') {
        return structureTypeName(paramType?.typeElement, library, nativeLibrary, allLibraries) ?? 'struct';
    }
    if (triggerType.toLowerCase() === 'preset' && paramType?.typeElement) {
        const preset = resolveRefFull(paramType.typeElement, library, nativeLibrary, allLibraries);
        if (preset?.type === 'Preset' && preset.baseType)
            return mapTriggerTypeToGalaxy(preset.baseType);
    }
    const mapped = mapTriggerTypeToGalaxy(triggerType);
    // Only fill a gap: a type the table already resolves is left exactly as it was.
    if (mapped !== triggerType.toLowerCase())
        return mapped;
    // The derivation is keyed by the library it was read from. A caller that does
    // not single the native library out still passes it among the loaded ones.
    for (const candidate of [nativeLibrary, ...(allLibraries?.values() ?? [])]) {
        const derived = candidate && nativeTypeEvidence.get(candidate)?.get(mapped);
        if (derived)
            return derived;
    }
    return isResolvedGalaxyType(triggerType, nativeLibrary, allLibraries) ? mapped : triggerType;
}
/** Unary operators whose concrete editor and Galaxy types collapse to the same
 * declared type are compile-time adapters, not runtime functions. */
export function isIdentityConversionOperator(definition, library, nativeLibrary, allLibraries) {
    if (!definition.flags?.includes('Operator') || definition.flags.includes('Native'))
        return false;
    if ((definition.parameters ?? []).length !== 1 || !definition.returnType)
        return false;
    const formal = resolveRefFull(definition.parameters[0], library, nativeLibrary, allLibraries);
    if (!formal)
        return false;
    const input = formal.paramType.type;
    const output = definition.returnType.type;
    if (!input || !output)
        return false;
    if (mapParameterTypeToGalaxy(definition.returnType, library, nativeLibrary, allLibraries) !==
        mapParameterTypeToGalaxy(formal.paramType, library, nativeLibrary, allLibraries))
        return false;
    const actions = definition.actions ?? [];
    if (actions.length === 0 && !definition.scriptCode?.trim())
        return true;
    // FlagInternal conversion operators are editor type-system adapters. Their
    // XML implementation may call a native representation helper, while the SC2
    // generator erases the operator once both loaded types use one Galaxy type.
    if (definition.flags.includes('Internal'))
        return true;
    // A non-internal authored operator is removable only when its complete body
    // is structurally a return of its sole formal parameter.
    if (actions.length !== 1 || definition.scriptCode?.trim())
        return false;
    const action = resolveRefFull(actions[0], library, nativeLibrary, allLibraries);
    const actionDefinition = action?.functionDef
        ? resolveRefFull(action.functionDef, library, nativeLibrary, allLibraries)
        : undefined;
    if (!action || !actionDefinition?.scriptCode || !/^\s*return\s+#PARAM\([^)]+\)\s*;?\s*$/u.test(actionDefinition.scriptCode))
        return false;
    if ((action.parameters ?? []).length !== 1)
        return false;
    const argument = resolveRefFull(action.parameters[0], library, nativeLibrary, allLibraries);
    if (!argument)
        return false;
    if (argument.paramRef?.id === formal.id && (argument.paramRef.library ?? definition.library) === (formal.library ?? definition.library))
        return true;
    const expectedName = `lp_${lowerInitial(sanitizeIdentifier(formal.name ?? formal.id))}`;
    return argument.scriptCode?.trim() === expectedName;
}
export function presetValueConstantName(preset, value) {
    const stem = sanitizeName(value.name ?? value.id);
    return `${libraryPrefix(preset.library ?? '')}ge_${sanitizeName(preset.name ?? preset.id)}_${stem}`;
}
export function presetIdentifierFunctionName(preset, fallbackLibrary) {
    return `${libraryPrefix(preset.library ?? fallbackLibrary)}ge_${sanitizeName(preset.name ?? preset.id)}_Ident`;
}
export function getVariableArrayDims(variable) {
    const dims = (variable.arraySizes ?? [])
        .filter((d) => d && typeof d.dim === 'number')
        .map((d) => ({ dim: d.dim, value: d.value, variable: d.variable }));
    return dims.sort((a, b) => a.dim - b.dim);
}
export function resolveVariableGalaxyName(variable, variableRef, ctx) {
    const varLibId = variableRef?.library ?? ctx.libId;
    if (varLibId === ctx.libId && ctx.localVarIds.has(variable.id))
        return localVarName(variable);
    if (varLibId === ctx.libId && ctx.globalVarNames?.has(variable.id)) {
        return ctx.globalVarNames.get(variable.id);
    }
    const library = varLibId === ctx.libId ? ctx.library : ctx.allLibraries?.get(varLibId);
    if (!library)
        return globalVarName(varLibId, variable);
    if (varLibId !== ctx.libId) {
        const declaredName = namingIndexes().dependencyVariableNames.get(refKey(variable, varLibId));
        if (declaredName)
            return declaredName;
    }
    const names = globalVariableNamesFor(library, varLibId, ctx.globalVariableNamesByLibrary);
    const generated = names.get(variable.id) ?? globalVarName(varLibId, variable);
    if (varLibId !== ctx.libId) {
        // TriggerStrings stores the GUI stem, while an installed dependency header
        // is the authoritative ABI spelling.  Internal variables are not uniform
        // across shipped libraries: some preserve the initial, others still apply
        // the editor's lowerInitial transform.  Select the alternative only when
        // the loaded Galaxy declarations prove that exact symbol exists.
        const stem = sanitizeIdentifier(variable.name ?? variable.id);
        const lower = `${libraryPrefix(varLibId)}gv_${lowerInitial(stem)}`;
        const preserved = `${libraryPrefix(varLibId)}gv_${stem}`;
        const declared = namingIndexes().declaredSymbols;
        if (declared.has(generated))
            return generated;
        if (declared.has(lower))
            return lower;
        if (declared.has(preserved))
            return preserved;
        // Without its declarations, a loaded library's explicit identifier keeps the
        // lower-case initial most shipped libraries were compiled with.
        if (variable.identifier !== undefined && generated === `${libraryPrefix(varLibId)}gv_${sanitizeIdentifier(variable.identifier)}`) {
            return `${libraryPrefix(varLibId)}gv_${lowerInitial(sanitizeIdentifier(variable.identifier))}`;
        }
    }
    return generated;
}
export function resolveArraySizeUpperBoundExpr(dim, ctx) {
    if (dim.variable) {
        const variable = resolveRefFull(dim.variable, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
        if (variable) {
            return createIdentifier(resolveVariableGalaxyName(variable, dim.variable, ctx));
        }
    }
    if (dim.value !== undefined) {
        const n = Number(dim.value);
        if (!Number.isNaN(n))
            return createNumericLiteral(n);
    }
    return undefined;
}
export function buildGalaxyArrayTypeSuffix(variable, ctx) {
    const dims = getVariableArrayDims(variable);
    if (dims.length === 0)
        return '';
    return dims.map((dim) => {
        const upperBoundExpr = resolveArraySizeUpperBoundExpr(dim, ctx);
        if (!upperBoundExpr)
            return '[]';
        if (dim.value !== undefined) {
            const n = Number(dim.value);
            if (!Number.isNaN(n))
                return `[${n + 1}]`;
        }
        const sizeExpr = createBinaryExpression(upperBoundExpr, 20 /* SyntaxKind.PlusToken */, createNumericLiteral(1));
        return `[${_printer.printNode(sizeExpr).trim()}]`;
    }).join('');
}
let activeNamingIndexes;
/**
 * Both indexes are derived from the library alone, so one conversion shares them
 * across every context it builds: rebuilding them per trigger, per function and
 * per event turns naming into a quadratic scan on a large library. The scope
 * ends with the conversion, so a library edited between conversions is read
 * afresh.
 */
export function withNamingIndexes(run) {
    // Full conversion calls the public AST conversion helper internally. Keep
    // the already-populated per-conversion indexes across that nested call;
    // only the outermost conversion owns their lifetime.
    if (activeNamingIndexes)
        return run();
    const previous = activeNamingIndexes;
    activeNamingIndexes = {
        functionNameGroups: new Map(),
        globalVariableNamesByLibrary: new Map(),
        constantGlobalNamesByLibrary: new Map(),
        templateGlobalTypes: new Map(),
        templateReturnTypes: new Map(),
        dependencyFunctionNames: new Map(),
        dependencyVariableNames: new Map(),
        declaredSymbols: new Set(),
        presetValueNames: new Map(),
        unitFilterFlags: new Map(),
    };
    try {
        return run();
    }
    finally {
        activeNamingIndexes = previous;
    }
}
/** The indexes of the conversion in progress, or a private pair for a caller
 *  that converts outside one. */
export function namingIndexes() {
    return activeNamingIndexes ?? {
        functionNameGroups: new Map(),
        globalVariableNamesByLibrary: new Map(),
        constantGlobalNamesByLibrary: new Map(),
        templateGlobalTypes: new Map(),
        templateReturnTypes: new Map(),
        dependencyFunctionNames: new Map(),
        dependencyVariableNames: new Map(),
        declaredSymbols: new Set(),
        presetValueNames: new Map(),
        unitFilterFlags: new Map(),
    };
}
export function indexDeclaredGalaxySymbols(declarations, libraryInput = []) {
    // Read twice below (filter flags, then presets): the forward converter passes `Map.values()`, and a
    // second pass over a spent iterator saw no library, so every dependency preset constant came out as
    // its number in Triggers -> Galaxy (AerialEvacuation: 76 of 82 libCOMI_ge_* constants).
    const libraries = [...libraryInput];
    const indexes = namingIndexes();
    const target = indexes.declaredSymbols;
    target.clear();
    indexes.presetValueNames.clear();
    indexes.unitFilterFlags.clear();
    const statements = [];
    for (const file of declarations ?? []) {
        const source = new Parser().parseFile(file.fileName ?? 'declarations.galaxy', file.text);
        if (source.parseDiagnostics.length)
            continue;
        for (const declaration of source.statements) {
            statements.push(declaration);
            const name = declaration.name?.name;
            if (typeof name === 'string' && name)
                target.add(name);
        }
    }
    // A unit filter is written by the editor as four bit masks over the
    // `c_targetFilter*` constants, so the flag names a document stores need both
    // the constant and its position. The position comes from the loaded headers,
    // never from a table of our own.
    const constantValues = new Map();
    for (const declaration of statements) {
        const node = declaration;
        const name = node.name?.name;
        const text = String(node.initializer?.text ?? node.initializer?.value ?? '');
        if (typeof name === 'string' && /^c_targetFilter/u.test(name) && /^\d+$/u.test(text))
            constantValues.set(name, Number(text));
    }
    for (const library of libraries) {
        for (const element of Object.values(library.elements ?? {})) {
            if (element.type !== 'PresetValue')
                continue;
            const constant = element.value;
            const identifier = element.identifier ?? element.name;
            if (!constant || !identifier || !constantValues.has(constant))
                continue;
            if (!indexes.unitFilterFlags.has(identifier)) {
                indexes.unitFilterFlags.set(identifier, { constant, bit: constantValues.get(constant) });
            }
        }
    }
    // Some packages retain native filter constants but omit their PresetValue
    // declarations. The constant name still supplies the editor's flag name.
    for (const [constant, bit] of constantValues) {
        const flag = constant.slice('c_targetFilter'.length);
        if (flag && Number.isInteger(bit) && bit >= 0 && bit < 64 && !indexes.unitFilterFlags.has(flag)) {
            indexes.unitFilterFlags.set(flag, { constant, bit });
        }
    }
    // A stripped dependency can lose every localized preset/value name and may
    // even omit PresetGenConstVar although its shipped header still declares the
    // generated constants. The header remains authoritative.
    // PresetInteger always emits 0..N-1 in XML order. Some editor documents
    // retain stale per-value scalars (including booleans); they do not override
    // the ordinal integer contract.
    // Align those complete groups only when the ordered match is unambiguous.
    for (const library of libraries) {
        const prefix = `${libraryPrefix(library.id)}ge_`;
        const constants = statements.flatMap(statement => {
            const node = statement;
            const name = node.name?.name;
            const raw = node.initializer?.text ?? node.initializer?.value;
            const text = String(raw ?? '');
            if (typeof name !== 'string' || !name.startsWith(prefix) || !/^(?:\d+|0x[\da-f]+)$/iu.test(text))
                return [];
            return [{ name, value: Number(text), hex: /^0x/iu.test(text) }];
        });
        const sequentialGroups = (hex, first, next) => {
            const groups = [];
            let current;
            for (const constant of constants) {
                if (constant.hex !== hex) {
                    current = undefined;
                    continue;
                }
                if (!current || constant.value !== next(current.length)) {
                    current = constant.value === first ? [constant] : undefined;
                    if (current)
                        groups.push(current);
                }
                else
                    current.push(constant);
            }
            return groups;
        };
        const matchGroups = (presets, completeGroups) => {
            // Order-preserving maximum matching by group length. A value is indexed
            // only if its preset/group pair can occur in exactly one optimal alignment.
            const n = presets.length, m = completeGroups.length;
            const forward = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
            for (let i = 0; i < n; i++)
                for (let j = 0; j < m; j++) {
                    forward[i + 1][j + 1] = Math.max(forward[i][j + 1], forward[i + 1][j], forward[i][j] + (presets[i].values.length === completeGroups[j].length ? 1 : -n - m));
                }
            const backward = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
            for (let i = n - 1; i >= 0; i--)
                for (let j = m - 1; j >= 0; j--) {
                    backward[i][j] = Math.max(backward[i + 1][j], backward[i][j + 1], backward[i + 1][j + 1] + (presets[i].values.length === completeGroups[j].length ? 1 : -n - m));
                }
            const optimum = forward[n][m];
            const optimumWithoutPreset = (excluded) => {
                const score = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
                for (let pi = 0; pi < n; pi++)
                    for (let gj = 0; gj < m; gj++) {
                        const matched = pi === excluded || presets[pi].values.length !== completeGroups[gj].length
                            ? -n - m
                            : score[pi][gj] + 1;
                        score[pi + 1][gj + 1] = Math.max(score[pi][gj + 1], score[pi + 1][gj], matched);
                    }
                return score[n][m];
            };
            for (let i = 0; i < n; i++) {
                const candidates = [];
                for (let j = 0; j < m; j++) {
                    if (presets[i].values.length === completeGroups[j].length &&
                        forward[i][j] + 1 + backward[i + 1][j + 1] === optimum)
                        candidates.push(j);
                }
                if (candidates.length !== 1 || optimumWithoutPreset(i) === optimum)
                    continue;
                const group = completeGroups[candidates[0]];
                for (let valueIndex = 0; valueIndex < presets[i].values.length; valueIndex++) {
                    const value = lookupElementIn(library, presets[i].values[valueIndex]);
                    if (value)
                        indexes.presetValueNames.set(refKey(value, library.id), group[valueIndex].name);
                }
            }
        };
        const presets = Object.values(library.elements).filter((element) => element.type === 'Preset' && !element.disabled &&
            element.values.every(ref => lookupElementIn(library, ref)?.type === 'PresetValue'));
        matchGroups(presets.filter(preset => !!preset.integer), sequentialGroups(false, 0, length => length));
        // PresetAsBits constants are emitted as a contiguous hexadecimal
        // 0x1,0x2,0x4... group. Requiring the hex spelling prevents an unrelated
        // decimal integer preset from being mistaken for a bit preset.
        matchGroups(presets.filter(preset => !!preset.asBits), sequentialGroups(true, 1, length => 2 ** length));
    }
}
export function isDeclaredGalaxySymbol(name) {
    return namingIndexes().declaredSymbols.has(name);
}
export function declaredPresetValueName(value, currentLibrary) {
    return namingIndexes().presetValueNames.get(refKey(value, currentLibrary));
}
export function indexDependencyFunctionNames(declarations, libraries) {
    const target = namingIndexes().dependencyFunctionNames;
    target.clear();
    for (const [key, name] of buildDependencyFunctionNames(declarations, libraries))
        target.set(key, name);
}
export function indexDependencyVariableNames(declarations, libraries) {
    const target = namingIndexes().dependencyVariableNames;
    target.clear();
    for (const [key, name] of buildDependencyVariableNames(declarations, libraries))
        target.set(key, name);
}
function functionNameGroups(library, ctx, mirror) {
    const cached = mirror?.get(library);
    if (cached)
        return cached;
    const groups = new Map();
    for (const other of findElementsOfType(library, 'FunctionDef')) {
        const name = baseGalaxyFunctionName(other, ctx);
        let ids = groups.get(name);
        if (!ids)
            groups.set(name, ids = new Set());
        ids.add(other.id);
    }
    mirror?.set(library, groups);
    return groups;
}
function globalVariableNamesFor(library, libraryId, mirror) {
    const cached = mirror?.get(library);
    if (cached)
        return cached;
    const names = globalVariableNames(libraryId, globalVariables(library));
    mirror?.set(library, names);
    return names;
}
export function toGalaxyFunctionName(funcDef, ctx, fallbackRef) {
    const base = baseGalaxyFunctionName(funcDef, ctx, fallbackRef);
    if (!funcDef || funcDef.flags?.includes('Native') || !ctx.library)
        return base;
    const library = funcDef.library === ctx.library.id ? ctx.library : ctx.allLibraries?.get(funcDef.library ?? ctx.libId);
    // Without the owning library there is nothing to compare the name against.
    if (!library)
        return base;
    const groups = functionNameGroups(library, ctx, ctx.functionNameGroups);
    const ids = groups.get(base);
    const collision = !!ids && ids.size > (ids.has(funcDef.id) ? 1 : 0);
    return collision ? base + '_' + funcDef.id : base;
}
/** Allocate generated startup symbols without changing any user-declared function. */
export function libraryInitializationNames(library, nativeLibrary, allLibraries) {
    const ctx = { library, nativeLibrary, allLibraries, libId: library.id, ...namingIndexes() };
    const occupied = new Set(Object.values(library.elements).filter((element) => element.type === 'FunctionDef')
        .map(definition => toGalaxyFunctionName(definition, ctx)));
    // Startup guards share Galaxy global scope with authored variables.
    // Reserve real emitted names too, including original preserved ABI names.
    for (const name of globalVariableNames(library.id, globalVariables(library)).values()) occupied.add(name);
    for (const element of Object.values(library.elements)) {
        if (element.type !== 'CustomScript' || element.disabled || !element.scriptCode)
            continue;
        const source = new Parser().parseFile('custom.galaxy', element.scriptCode);
        for (const declaration of source.statements)
            if (declaration.name?.name)
                occupied.add(declaration.name.name);
    }
    const allocate = (suffix) => {
        const base = startupFunctionName(library.id, suffix);
        let name = base, index = 0;
        while (occupied.has(name))
            name = `${base}_${++index}`;
        occupied.add(name);
        return name;
    };
    return {
        libraries: allocate('InitLibraries'), variables: allocate('InitVariables'), triggers: allocate('InitTriggers'),
        library: allocate('InitLib'), variablesCompleted: allocate('InitVariables_completed'), libraryCompleted: allocate('InitLib_completed'),
        customScript: allocate('InitCustomScript'),
    };
}
function baseGalaxyFunctionName(funcDef, ctx, fallbackRef) {
    if (!funcDef) {
        const raw = fallbackRef?.id ?? '';
        // Preserve unresolved cross-library references in reversible wrapped form.
        // Example: { library: "1926661B", id: "A074708F" } -> lib1926661B_gf_A074708F
        if (fallbackRef?.library &&
            fallbackRef.library !== ctx.libId &&
            /^[A-Za-z0-9_]+$/.test(raw)) {
            return `${libraryPrefix(fallbackRef.library)}gf_${raw}`;
        }
        // Preserve unresolved but already-valid galaxy identifiers
        // (e.g. PlayerGroupNextPlayer) instead of degrading to null(...).
        if (/^[A-Za-z_]\w*$/.test(raw))
            return raw;
        // Preserve unresolved FunctionDef references in a reversible wrapper form.
        // This avoids semantic loss like `null(x)` for unknown native IDs.
        if (fallbackRef?.library && /^[A-Za-z0-9_]+$/.test(raw)) {
            return `${libraryPrefix(fallbackRef.library)}gf_${raw}`;
        }
        return 'null';
    }
    // Preserve the actual native descriptor symbol. A template ancestor or
    // Deprecated suffix is not executable alias evidence.
    const declaredName = ctx.dependencyFunctionNames?.get(refKey(funcDef, funcDef.library ?? ctx.libId));
    if (declaredName)
        return declaredName;
    const libId = funcDef.library ?? ctx.libId;
    if ((funcDef.flags?.includes('NoScriptPrefix') || funcDef.flags?.includes('Native') || funcDef.flags?.includes('CustomAI')) && funcDef.name)
        return sanitizeName(funcDef.name);
    if (libId === 'Ntve' && funcDef.name) {
        // For Ntve functions, derive the galaxy identifier from the name.
        // Names may contain spaces (e.g. "Get DateTime Month") — sanitize first.
        const n = /^[a-zA-Z_]\w*$/.test(funcDef.name) ? funcDef.name : sanitizeName(funcDef.name);
        if (n) {
            if (funcDef.flags?.includes('NoScriptPrefix')) {
                return n;
            }
            // NativeLib functions that are NOT pure natives and have a GUI-composed
            // body (FunctionCall actions, no inline ScriptCode template) get a
            // lib{Ntve}_gf_ wrapper generated by the SC2 Editor — both FlagAction
            // and FlagCall variants (e.g. ConvertPlayerColorToColor,
            // ConvertUnitToUnitGroup). Defs without a body (pure natives, operator
            // templates) keep their bare Galaxy identifier.
            const hasBody = (funcDef.actions?.length ?? 0) > 0 || (funcDef.localVariables?.length ?? 0) > 0;
            const isInlineDefinition = funcDef.flags?.some(flag => ['Template', 'Inline', 'SubFunctions', 'Operator'].includes(flag));
            if (!funcDef.flags?.includes('Native') && hasBody && !isInlineDefinition) {
                return `${libraryPrefix(libId)}gf_${n}`;
            }
            if (funcDef.isFuncAction && !funcDef.flags?.includes('Native') && !funcDef.scriptCode) {
                // Actions are always wrapped by the editor even when bodiless.
                return `${libraryPrefix(libId)}gf_${n}`;
            }
            return n;
        }
    }
    // Custom function: lib{Lib}_gf_{Name} (spaces removed, case preserved). The
    // editor prefixes every such name, one that already starts with gf_ included.
    if (funcDef.name) {
        const n = sanitizeName(funcDef.name);
        if (n)
            return `${libraryPrefix(libId)}gf_${n}`;
    }
    return `${libraryPrefix(libId)}gf_${funcDef.id}`;
}
export function buildSubFuncTypeNamesMap(nativeLibrary) {
    const map = new Map();
    if (nativeLibrary?.subFuncTypeNames) {
        for (const [k, v] of Object.entries(nativeLibrary.subFuncTypeNames)) {
            map.set(k, v);
        }
    }
    return map;
}
function normalizeScriptCode(scriptCode) {
    return scriptCode.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}
function scriptCodeHas(code, ...tokens) {
    return tokens.every(token => code.includes(token));
}
function scriptCodeHasAny(code, tokens) {
    return tokens.some(token => code.includes(token));
}
/**
 * Identify structured action families by their scriptCode template instead of
 * hardcoding function names. This lets dependency-library functions reuse the
 * same Galaxy emission path when they share the same structural template.
 */
export function classifyScriptCodeAction(funcDef) {
    const code = funcDef?.scriptCode ? normalizeScriptCode(funcDef.scriptCode) : '';
    if (!code)
        return undefined;
    if (scriptCodeHas(code, 'CatalogEntryCount(', 'CatalogEntryGet(', '#AUTOVAR(catalog, int) = #PARAM(catalog);') &&
        scriptCodeHas(code, '#PARAM(entry) = CatalogEntryGet(')) {
        return 'forEachCatalogEntryInCatalog';
    }
    if (scriptCodeHas(code, 'UserDataInstanceCount(', 'UserDataInstance(', '#AUTOVAR(userType, string) = #PARAM(userType);') &&
        scriptCodeHas(code, '#PARAM(instance) = UserDataInstance(')) {
        return 'forEachUserDataInstanceInUserType';
    }
    if (scriptCodeHas(code, 'c_syncFrameTypeFirst', 'c_syncFrameTypeLast', '#PARAM(var) = c_syncFrameTypeFirst;')) {
        return 'forEachUIFrame';
    }
    if (scriptCodeHas(code, 'PlayerGroupLoopBegin(', 'PlayerGroupLoopStep()', 'PlayerGroupLoopEnd()')) {
        return 'pickEachPlayerInGroup';
    }
    if (scriptCodeHas(code, 'PlayerGroupNextPlayer(') &&
        scriptCodeHasAny(code, ['#PARAM(var) = -1;', '#AUTOVAR(var) = -1;']) &&
        scriptCodeHasAny(code, ['if (#PARAM(var) < 0) { break; }', 'if (#AUTOVAR(var) < 0) { break; }'])) {
        return 'pickEachPlayerInGroup';
    }
    if (scriptCodeHas(code, 'UnitGroupLoopBegin(', 'UnitGroupLoopStep()', 'UnitGroupLoopEnd()')) {
        return 'pickEachUnitInGroup';
    }
    if (scriptCodeHas(code, 'UnitGroupUnitFromEnd(') &&
        scriptCodeHasAny(code, ['#PARAM(var) == null', '#AUTOVAR(var) == null']) &&
        scriptCodeHasAny(code, ['if (#PARAM(var) == null) { break; }', 'if (#AUTOVAR(var) == null) { break; }'])) {
        return 'pickEachUnitInGroup';
    }
    if (scriptCodeHas(code, 'IntLoopBegin(', 'IntLoopStep()', 'IntLoopEnd()')) {
        return 'pickEachInteger';
    }
    if (scriptCodeHas(code, '#AUTOVAR(var) = #PARAM(s);', 'for ( ; #AUTOVAR(var) <= #AUTOVAR(ae); #AUTOVAR(var) += 1 )')) {
        return 'pickEachInteger';
    }
    if (scriptCodeHas(code, '#INITAUTOVAR(ae,e)', '#INITAUTOVAR(ai,increment)', '#PARAM(var) = #PARAM(s);')) {
        return 'forEachInteger';
    }
    if (scriptCodeHas(code, '#AUTOVAR(ae) = #PARAM(e);', '#AUTOVAR(ai) = #PARAM(increment);', '#PARAM(var) = #PARAM(s);')) {
        return 'forEachInteger';
    }
    if (scriptCodeHas(code, '#AUTOVAR(ae,fixed) = #PARAM(e);', '#AUTOVAR(ai,fixed) = #PARAM(increment);', '#PARAM(var) = #PARAM(s);')) {
        return 'forEachInteger';
    }
    return undefined;
}
//# sourceMappingURL=ttg-core.js.map