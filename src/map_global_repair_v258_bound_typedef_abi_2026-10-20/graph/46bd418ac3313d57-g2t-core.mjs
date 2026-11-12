import {memberVarName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/types/c251bff83386-core.mjs';
import { printNode } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/298f67ce7553275e-script-template.mjs';
import {singleCallTemplateAlias} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/c2b8353029e27c34-single-call-template-alias.mjs';
/**
 * g2t-core — shared infrastructure for the Galaxy→trigger reverse conversion.
 *
 * Contains everything that every other g2t-* module depends on:
 *   - GalaxyToTriggerOptions and ReverseCtx interfaces
 *   - ID generator — generateId / resetGalaxyToTriggerIdCounter
 *   - Element creation helpers — mkParamRef, mkFCRef, fdRef
 *   - Name extraction helpers — extractGlobalVarName, extractTriggerName, etc.
 *   - Boilerplate detection — isLibraryBoilerplate, isTriggerInitFunction, etc.
 *   - Reverse lookup map builders — buildFuncNameToFuncDefMap, etc.
 *   - Variable initial-value helpers — defaultValueForType, attachDefaultParam
 *   - AST utility functions — unwrapParens, getIdentifierName, getBlockStatements, etc.
 *   - Type helpers — getTypeName, unwrapArrayType, galaxyTypeToTrigger
 */
import { tokenToString, isKeywordTypeKind, stringToToken } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-literal-native-v173-2026-10-05/dist/modules/galaxy/language-core/index.js';
import { conversionError, libraryPrefix, lookupElementIn, sanitizeIdentifier, startupFunctionName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-literal-native-v173-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
// ---------------------------------------------------------------------------
// ID counter
// ---------------------------------------------------------------------------
let allocation = { counter: 0, used: new Set() };
function generateId() {
    // IDs must be valid 8-char hex for TriggerStrings.txt regex ([A-Fa-f0-9]+).
    // Start at 0xA0000000 to avoid collision with NativeLib's low-value IDs AND with
    // content-derived IDs (which are forced below 0x80000000, see idFromKey).
    // Localized values can preserve an authored Param/Value/A....... identity in
    // this same high range, however, so the sequential allocator must skip every
    // identity already claimed by either path.
    for (;;) {
        const id = (0xA0000000 + allocation.counter++).toString(16).toUpperCase();
        if (allocation.used.has(id))
            continue;
        allocation.used.add(id);
        return id;
    }
}
// ID counter is NOT reset between libraries — keeps IDs unique across all libraries
// in a single conversion session, preventing cross-library ID collisions.
// ---------------------------------------------------------------------------
// Content-derived (deterministic) IDs
// ---------------------------------------------------------------------------
//
// Cross-library references (Variable, FunctionDef) are remapped by a pass1/pass2
// fix-up because order-based counter IDs differ between the two passes. Deriving
// those IDs from stable content (libId + kind + name) makes them identical across
// passes, so the remap is unnecessary and cross-library IDs never collide.
//
// Content IDs occupy the 0x00000000–0x7FFFFFFF range (high bit cleared); the
// counter occupies 0xA0000000+. The two spaces are therefore disjoint by
// construction, so a content ID can never collide with a counter ID. Collisions
// *between* content keys are resolved by deterministic re-hashing.
/** Observational callbacks may synchronously start/reset another converter.
 * Give that call tree its own allocator and restore the outer one on failure
 * as well as success. Keep the legacy session allocator outside callbacks. */
export function withIsolatedGalaxyToTriggerIds(callback) {
    const previous = allocation;
    allocation = { counter: 0, used: new Set() };
    try {
        return callback();
    }
    finally {
        allocation = previous;
    }
}
function fnv1a32(input) {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** Deterministic 8-hex ID for a stable content key (e.g. `${libId}|gf|${name}`). */
function idFromKey(key) {
    let probe = key;
    for (let attempt = 0; attempt < 1000; attempt++) {
        const id = ((fnv1a32(probe) & 0x7fffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
        if (!allocation.used.has(id)) {
            allocation.used.add(id);
            return id;
        }
        probe = key + '~' + attempt;
    }
    // Pathological fallback (effectively unreachable): linear scan.
    let n = 0;
    for (;;) {
        const id = (n++).toString(16).toUpperCase().padStart(8, '0');
        if (!allocation.used.has(id)) {
            allocation.used.add(id);
            return id;
        }
    }
}
export { generateId, idFromKey };
export function reserveGalaxyToTriggerId(id) {
    allocation.used.add(id.toUpperCase());
}
/** The editor names the private variables of a template action after the
 *  action's own element id, `auto<ID>_<name>`, and the compiler regenerates
 *  them from the call id the same way. A call restored from such variables
 *  takes that id back when every bound variable spells it and it is still
 *  free, so a round trip keeps `auto9DE7D937_var` instead of inventing
 *  `autoA00000D8_var`. Claim it before the call's children are built. */
export function claimAutoCallId(autos) {
    let id;
    for (const [name, node] of autos) {
        const auto = extractAutoVarName(node?.name ?? '');
        if (!auto || auto.suffix !== name)
            return undefined;
        const candidate = auto.id.toUpperCase();
        if (id !== undefined && candidate !== id)
            return undefined;
        id = candidate;
    }
    if (id === undefined || allocation.used.has(id))
        return undefined;
    allocation.used.add(id);
    return id;
}
/** claimAutoCallId for an action builder that knows its automatic variables by
 *  their source names (Switch `val`, loop `ae`/`ai`/`var`); names that are not
 *  automatic variables do not take part. */
export function claimAutoCallIdFromNames(names) {
    const autos = new Map();
    for (const name of names) {
        const auto = name === undefined ? undefined : extractAutoVarName(name);
        if (auto && name !== undefined)
            autos.set(auto.suffix, { name });
    }
    return autos.size ? claimAutoCallId(autos) : undefined;
}
/** Give back an id claimed for a call that was then discarded. */
export function releaseAutoCallId(id) {
    if (id !== undefined)
        allocation.used.delete(id);
}
export function resetGalaxyToTriggerIdCounter() {
    allocation = { counter: 0, used: new Set() };
}
// ---------------------------------------------------------------------------
// Name extraction helpers
// ---------------------------------------------------------------------------
/** Extracts global variable name from Galaxy name: lib{LIB}_gv_{NAME} */
export function extractGlobalVarName(galaxyName, libId) {
    const prefix = `${libraryPrefix(libId)}gv_`;
    if (galaxyName.startsWith(prefix)) {
        return galaxyName.slice(prefix.length);
    }
    // MapScript-style globals (SC2Map): gv_name
    if (galaxyName.startsWith('gv_') && galaxyName.length > 3) {
        return galaxyName.slice(3);
    }
    // A map has no Trigger XML library namespace, but its compiled MapScript can
    // retain the linkage prefix of an embedded editor library. Both gv_ and ge_
    // declarations become ordinary map variables; the editor writes its own gv_
    // prefix when it compiles the map again.
    if (libraryPrefix(libId) === '') {
        const match = /^lib[A-Za-z0-9_]+_g[ve]_(.+)$/u.exec(galaxyName);
        if (match?.[1])
            return match[1];
    }
    return undefined;
}
/** Extracts user-function name from Galaxy name: lib{LIB}_gf_{NAME} or plain gf_{NAME} */
export function extractUserFunctionName(galaxyName, libId) {
    const prefix = `${libraryPrefix(libId)}gf_`;
    if (galaxyName.startsWith(prefix)) {
        return galaxyName.slice(prefix.length);
    }
    if (galaxyName.startsWith('gf_') && galaxyName.length > 3) {
        return galaxyName.slice(3);
    }
    // A map has no Trigger XML library namespace, but MapScript.galaxy can be a
    // compiled remnant of a formerly embedded library and retain lib*_gf_.  The
    // document kind proves map ownership; the arbitrary library token itself is
    // linkage syntax, not part of the authored function name.
    if (libraryPrefix(libId) === '') {
        const match = /^lib[A-Za-z0-9_]+_gf_(.+)$/u.exec(galaxyName);
        if (match?.[1])
            return match[1];
    }
    return undefined;
}
/** Extracts local variable name: lv_{NAME} (at least 1 char after prefix) */
export function extractLocalVarName(galaxyName) {
    if (galaxyName.startsWith('lv_') && galaxyName.length > 3) {
        return galaxyName.slice(3);
    }
    return undefined;
}
/** Extracts an editor auto-variable name: auto{8-hex call ID}_{macro name}. The macro
 *  name is whatever the ScriptCode declares (`var`, `ae`, Repeat's `n`, an authored
 *  `cursor`); a fixed suffix list left Repeat's count unrecognized. */
export function extractAutoVarName(galaxyName) {
    const match = galaxyName.match(/^auto([A-Fa-f0-9]{8})_([A-Za-z_]\w*)$/);
    if (match) {
        return { id: match[1], suffix: match[2] };
    }
    return undefined;
}
/** Extracts trigger name from handle or function: lib{LIB}_gt_{NAME}[_Func] */
export function extractTriggerName(galaxyName, libId) {
    const prefix = `${libraryPrefix(libId)}gt_`;
    let name;
    if (galaxyName.startsWith(prefix)) {
        name = galaxyName.slice(prefix.length);
    }
    else if (galaxyName.startsWith('gt_')) {
        // MapScript-style trigger symbol: gt_Name[_Func]
        name = galaxyName.slice(3);
    }
    else if (libId === 'Map') {
        // A map document has no Library wrapper, but an authored MapScript may
        // retain the editor namespace that existed when the script was generated.
        // The namespace is linkage syntax; TriggerCreate/Init validation below is
        // what proves that the declaration is a trigger.
        const match = /^lib[A-Za-z0-9_]+_gt_(.+)$/u.exec(galaxyName);
        if (match)
            name = match[1];
    }
    else {
        return undefined;
    }
    if (name === undefined)
        return undefined;
    if (name.endsWith('_Func')) {
        name = name.slice(0, -5);
    }
    return name;
}
/** Returns true if FunctionDecl is library boilerplate */
export function isLibraryBoilerplate(funcName, libId) {
    return funcName === startupFunctionName(libId, 'InitLibraries')
        || funcName === startupFunctionName(libId, 'InitVariables')
        || funcName === startupFunctionName(libId, 'InitLib');
}
/** Returns true if FunctionDecl is a trigger init function */
export function isTriggerInitFunction(funcName, libId) {
    const prefix = `${libraryPrefix(libId)}gt_`;
    if (funcName.startsWith(prefix) && funcName.endsWith('_Init') && !funcName.endsWith('_Func_Init'))
        return true;
    // MapScript-style trigger init: gt_Name_Init
    if (funcName.startsWith('gt_') && funcName.endsWith('_Init') && !funcName.endsWith('_Func_Init'))
        return true;
    return libId === 'Map' && /^lib[A-Za-z0-9_]+_gt_.+_Init$/u.test(funcName) && !funcName.endsWith('_Func_Init');
}
/** Returns true if FunctionDecl is a trigger body function */
export function isTriggerBodyFunction(funcName, libId) {
    const prefix = `${libraryPrefix(libId)}gt_`;
    if (funcName.startsWith(prefix) && funcName.endsWith('_Func'))
        return true;
    // MapScript-style trigger body: gt_Name_Func
    if (funcName.startsWith('gt_') && funcName.endsWith('_Func'))
        return true;
    return libId === 'Map' && /^lib[A-Za-z0-9_]+_gt_.+_Func$/u.test(funcName);
}
// ---------------------------------------------------------------------------
// Element creation helpers
// ---------------------------------------------------------------------------
export function mkParamRef(data, ctx, reservedId) {
    // A localized text value is keyed in GameStrings by the identity of the
    // parameter that holds it, so recovering the text means recovering that
    // identity rather than inventing a fresh one.
    const id = reservedId !== undefined && !ctx.elements[reservedId] ? reservedId : generateId();
    reserveGalaxyToTriggerId(id);
    const el = { type: 'Param', id, library: ctx.libId, ...data };
    ctx.elements[id] = el;
    return { type: 'Param', library: ctx.libId, id };
}
export function mkFCRef(data, ctx, claimedId) {
    // A ScriptCode template may expose a single #SUBFUNCS slot without usable
    // TriggerStrings for that SubFuncType.  The parsed Galaxy proves which calls
    // belong to the parent, and a sole declared role makes their XML placement
    // unambiguous.  Attach that role here, at the common creation boundary, so
    // specialized expression builders cannot accidentally emit orphaned calls.
    // With multiple roles, only a unique action/condition type match is safe.
    const definitionRef = data.functionDef;
    if (definitionRef && data.subFunctions?.length) {
        const libraryId = definitionRef.library ?? ctx.libId;
        const definition = libraryId === ctx.libId
            ? ctx.elements[definitionRef.id]
            : libraryId === (ctx.nativeLibrary?.id ?? 'Ntve')
                ? ctx.nativeLibrary?.elementsByType?.FunctionDef?.[definitionRef.id] ?? ctx.nativeLibrary?.elements?.[definitionRef.id]
                : ctx.dependencyLibraries?.get(libraryId)?.elementsByType?.FunctionDef?.[definitionRef.id]
                    ?? ctx.dependencyLibraries?.get(libraryId)?.elements?.[definitionRef.id];
        const roles = definition?.type === 'FunctionDef' ? definition.subFunctionTypes ?? [] : [];
        const resolve = (ref) => {
            const owner = ref.library ?? ctx.libId;
            if (owner === ctx.libId)
                return ctx.elements[ref.id];
            const library = owner === ctx.nativeLibrary?.id ? ctx.nativeLibrary : ctx.dependencyLibraries?.get(owner);
            return library ? lookupElementIn(library, ref) : undefined;
        };
        for (const childRef of data.subFunctions) {
            if ((childRef.library ?? ctx.libId) !== ctx.libId)
                continue;
            const child = ctx.elements[childRef.id];
            if (child?.type !== 'FunctionCall' || child.subFunctionType)
                continue;
            let role = roles.length === 1 ? roles[0] : undefined;
            if (!role && child.functionDef) {
                const childDefinition = resolve(child.functionDef);
                if (childDefinition?.type === 'FunctionDef' && typeof childDefinition.isFuncAction === 'boolean') {
                    const matching = roles.filter(candidate => {
                        const resolved = resolve({ ...candidate, type: 'SubFuncType' });
                        return resolved?.type === 'SubFuncType' && (resolved.isAction === true) === childDefinition.isFuncAction;
                    });
                    if (matching.length === 1)
                        role = matching[0];
                }
            }
            if (role)
                child.subFunctionType = { ...role, type: 'SubFuncType' };
        }
    }
    const id = claimedId ?? generateId();
    ctx.elements[id] = { type: 'FunctionCall', id, library: ctx.libId, ...data };
    return { type: 'FunctionCall', library: ctx.libId, id };
}
export function structureMemberKey(structureId, galaxyFieldName) {
    return `${structureId}:${galaxyFieldName}`;
}
// Resolve against the owning loaded library, including own Structure definitions.
// Imported references cannot be read from the map-local elements dictionary.
function reverseElement(ref, ctx) {
    if (!ref) return undefined;
    const owner = ref.library ?? ctx.libId;
    if (owner === ctx.libId) return ctx.elements[ref.id];
    const library = owner === ctx.nativeLibrary?.id ? ctx.nativeLibrary : ctx.dependencyLibraries?.get(owner);
    return library ? lookupElementIn(library, ref) : undefined;
}
export function maybeResolveStructureMember(baseData, memberName, ctx) {
    // A structure path can start at either a Variable or a FunctionDef
    // parameter.  Both carry the declared structure type, but Param encodes the
    // latter with <Parameter Type="ParamDef" .../> rather than <Variable .../>.
    // Treating only variables as owners made assignments through structref
    // parameters silently degrade to <Value>null</Value>.
    let ownerRef = baseData.variable ?? baseData.paramRef;
    let tail;
    if (baseData.structMember?.id) {
        tail = ctx.elements[baseData.structMember.id];
        while (tail?.structMember?.id)
            tail = ctx.elements[tail.structMember.id];
        ownerRef = tail?.variable ?? tail?.paramRef;
    }
    if (!ownerRef)
        return undefined;
    const owner = reverseElement(ownerRef, ctx);
    const ownerType = owner?.type === 'Variable' ? owner.variableType
        : owner?.type === 'ParamDef' ? owner.paramType
            : undefined;
    const structureRef = ownerType?.typeElement;
    if (!structureRef?.id)
        return undefined;
    let memberRef = ctx.structureMemberByKey?.get(structureMemberKey(structureRef.id, memberName));
    if (!memberRef) {
        const declaration = reverseElement(structureRef, ctx);
        const matches = declaration?.type === 'Structure' ? (declaration.variables ?? []).filter(ref => {
            const variable = reverseElement(ref, ctx);
            return variable?.type === 'Variable' && (variable.name === memberName ||
                variable.name === extractLocalVarName(memberName) || memberVarName(variable, ctx.libId) === memberName);
        }) : [];
        if (matches.length === 1) memberRef = matches[0];
    }
    if (!memberRef)
        return undefined;
    const next = mkParamRef({ variable: memberRef }, ctx);
    if (tail) {
        tail.structMember = next;
        return baseData;
    }
    return { ...baseData, structMember: next };
}
export function triggerParamTypeFromGalaxyTypeName(galaxyTypeName, ctx, parameter = false) {
    const normalized = galaxyTypeName || 'int';
    const reference = /^structref<(.+)>$/u.exec(normalized);
    if (reference) {
        const target = ctx.structureByGalaxyTypeName?.get(reference[1]);
        if (!parameter || !target)
            return conversionError('UNSUPPORTED_REFERENCE_TYPE', 'Structure references require a known structure in a function parameter', { type: normalized });
        return { type: 'struct', typeElement: target };
    }
    const structureRef = ctx.structureByGalaxyTypeName?.get(normalized);
    if (structureRef) {
        if (parameter)
            return conversionError('STRUCT_VALUE_PARAMETER', 'A value structure parameter cannot be silently changed to a GUI reference parameter', { type: normalized });
        return { type: 'struct', typeElement: structureRef };
    }
    return { type: galaxyTypeToTrigger(normalized) };
}
export function fdRef(funcDef) {
    return { type: 'FunctionDef', library: funcDef.library ?? 'Ntve', id: funcDef.id };
}
// ---------------------------------------------------------------------------
// Reverse lookup maps
// ---------------------------------------------------------------------------
/** Mirrors the sanitizeName logic in ttg-core.ts — removes non-identifier chars. */
export function sanitizeFuncName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '').replace(/^[^a-zA-Z_]+/, '');
}
export function buildFuncNameToFuncDefMap(nativeLibrary) {
    const map = new Map();
    if (!nativeLibrary?.elementsByType?.FunctionDef)
        return map;
    const libId = nativeLibrary.id ?? 'Ntve';
    for (const funcDef of Object.values(nativeLibrary.elementsByType.FunctionDef)) {
        // Legacy helpers also use this index for editor operators. Keep those
        // entries, but never let one shadow a callable with the same identifier.
        const operatorOnly = funcDef.flags?.includes('Operator') && !funcDef.scriptCode;
        const existing = funcDef.name && map.get(funcDef.name);
        if (operatorOnly && existing && !existing.flags?.includes('Operator'))
            continue;
        if (funcDef.name) {
            // Plain identifier names: register as-is.
            if (/^[a-zA-Z_]\w*$/.test(funcDef.name)) {
                map.set(funcDef.name, funcDef);
            }
            // Sanitized form (e.g. "Get DateTime Year" → "GetDateTimeYear").
            // trigger-to-galaxy uses this form as the lib{Ntve}_gf_ galaxy name.
            const sanitized = sanitizeFuncName(funcDef.name);
            if (sanitized && sanitized !== funcDef.name && !map.has(sanitized)) {
                map.set(sanitized, funcDef);
            }
            // Register the lib{libId}_gf_<sanitized> form for non-native lib-prefixed calls.
            if (!funcDef.flags?.includes('Native') && !funcDef.flags?.includes('NoScriptPrefix')) {
                const prefixed = `${libraryPrefix(libId)}gf_${sanitized || funcDef.name}`;
                if (!map.has(prefixed))
                    map.set(prefixed, funcDef);
            }
        }
        // Also register by Galaxy function name extracted from scriptCode (e.g. "PlayerGroupNextPlayer").
        if (funcDef.scriptCode) {
            const galaxyName = singleCallTemplateAlias(funcDef,nativeLibrary);
            if (galaxyName && !map.has(galaxyName)) {
                map.set(galaxyName, funcDef);
            }
        }
    }
    // Display-name aliases must not shadow functions actually emitted under
    // that name. A native and its library wrapper may have different signatures.
    for (const funcDef of Object.values(nativeLibrary.elementsByType.FunctionDef)) {
        if (funcDef.name && (funcDef.flags?.includes('Native') || funcDef.flags?.includes('NoScriptPrefix'))) {
            map.set(sanitizeFuncName(funcDef.name), funcDef);
        }
    }
    return map;
}
/**
 * Build a reverse map: galaxy constant name (e.g. "c_syncFrameTypeConsolePanel") → PresetValue ref.
 * Used to convert Identifier nodes that are NativeLib constants back to proper Preset references.
 */
export function buildGalaxyConstToPresetMap(nativeLibrary, dependencyLibraries) {
    const map = new Map();
    const mappedValueDefinesDefault = new Map();
    // A campaign map reaches preset values from every library it depends on, not
    // only the native one. Indexing the native library alone leaves each of those
    // constants unbound, and an unbound constant becomes a synthesized template.
    const sources = [nativeLibrary, ...(dependencyLibraries?.values() ?? [])];
    for (const library of sources) {
        if (!library?.elementsByType?.PresetValue)
            continue;
        for (const pv of Object.values(library.elementsByType.PresetValue)) {
            if (pv.value && pv.value !== '') {
                // galaxy constant name → ref to this PresetValue
                // Several editor presets can intentionally share one Galaxy sentinel.
                // Without a formal parameter, the concrete "No value" choice is a
                // better inverse than the wildcard choice marked DefinesDefault.
                const existingIsDefault = mappedValueDefinesDefault.get(pv.value);
                if (!map.has(pv.value) || existingIsDefault === true && pv.definesDefault !== true) {
                    map.set(pv.value, { type: 'PresetValue', library: pv.library ?? library.id, id: pv.id });
                    mappedValueDefinesDefault.set(pv.value, pv.definesDefault === true);
                }
            }
        }
        // A preset that generates constants spells them lib<Id>_ge_<Preset>_<Value>
        // and stores the literal, not that name, in each value. Without this the
        // name is unbound and every use of it becomes a synthesized template.
        for (const preset of Object.values(library.elementsByType?.Preset ?? {})) {
            if (!preset.generateConstants || !preset.name)
                continue;
            const prefix = `${libraryPrefix(library.id)}ge_${sanitizeIdentifier(preset.name)}_`;
            for (const ref of preset.values ?? []) {
                const value = library.elementsByType?.PresetValue?.[ref.id];
                if (!value?.name)
                    continue;
                const key = prefix + sanitizeIdentifier(value.name);
                if (!map.has(key))
                    map.set(key, { type: 'PresetValue', library: value.library ?? library.id, id: value.id });
            }
        }
    }
    return map;
}
export function buildRoleToSubFuncTypeMap(nativeLibrary) {
    const map = new Map();
    const addRole = (roleName, ref, replace = false) => {
        const aliases = new Set([roleName, roleName.toLowerCase(), roleName.slice(0, 1).toUpperCase() + roleName.slice(1).toLowerCase()]);
        const typed = { type: 'SubFuncType', ...ref };
        for (const alias of aliases)
            if (replace || !map.has(alias))
                map.set(alias, typed);
    };
    if (!nativeLibrary)
        return map;
    for (const [key, roleName] of Object.entries(nativeLibrary.subFuncTypeNames ?? {})) {
        // key format: "Ntve_00000003" → roleName: "If"
        const underscoreIdx = key.indexOf('_');
        if (underscoreIdx === -1)
            continue;
        addRole(roleName, { library: key.slice(0, underscoreIdx), id: key.slice(underscoreIdx + 1) });
    }
    // Native libraries are often loaded without their TriggerStrings companion.
    // The SubFuncType Identifier in the XML is still the authoritative role
    // contract and is enough to build the reverse index.
    for (const subFuncType of Object.values(nativeLibrary.elementsByType?.SubFuncType ?? {})) {
        const roleName = subFuncType.identifier ?? subFuncType.name;
        if (typeof roleName === 'string' && roleName)
            addRole(roleName, { library: subFuncType.library ?? nativeLibrary.id, id: subFuncType.id });
    }
    return map;
}
/**
 * Build a role→SubFuncType map specific to a given FunctionDef.
 */
export function buildFuncDefRoleMap(funcDef, nativeLibrary, fallbackMap) {
    const localSFTs = funcDef.subFunctionTypes;
    if (!localSFTs || localSFTs.length === 0)
        return fallbackMap;
    const sftNames = nativeLibrary?.subFuncTypeNames ?? {};
    // Roles are owned by this FunctionDef. Importing unrelated global roles can
    // produce well-formed XML that the editor later removes as an orphan.
    const map = new Map();
    const addRole = (roleName, ref) => {
        const aliases = new Set([roleName, roleName.toLowerCase(), roleName.slice(0, 1).toUpperCase() + roleName.slice(1).toLowerCase()]);
        const typed = { type: 'SubFuncType', ...ref };
        for (const alias of aliases)
            map.set(alias, typed);
    };
    // Override with function-specific SubFuncType IDs (last entry wins for
    // any duplicates within a single FunctionDef — none expected in practice)
    for (const sft of localSFTs) {
        const localSubFunctionType = nativeLibrary
            ? lookupElementIn(nativeLibrary, { type: 'SubFuncType', library: sft.library, id: sft.id })
            : undefined;
        const roleName = sftNames[`${sft.library}_${sft.id}`] ?? localSubFunctionType?.identifier ?? localSubFunctionType?.name;
        if (roleName) {
            addRole(roleName, sft);
        }
    }
    return map;
}
// ---------------------------------------------------------------------------
// Variable initial value helpers
// ---------------------------------------------------------------------------
/** Default literal value for a given trigger type (int, bool, fixed, string, etc.) */
export function defaultValueForType(triggerType) {
    switch (triggerType.toLowerCase()) {
        case 'bool': return { value: 'false', valueType: { type: 'bool' } };
        case 'fixed': return { value: '0.0', valueType: { type: 'fixed' } };
        case 'string': return { value: '', valueType: { type: 'string' } };
        case 'int':
        default: return { value: '0', valueType: { type: triggerType.toLowerCase() === 'int' ? 'int' : triggerType } };
    }
}
/**
 * Attaches a default-value Param element to a VariableJson and stores it in elements.
 * Returns the Param element ref as `initialValue`.
 */
export function attachDefaultParam(variable, elements, libId) {
    const paramId = generateId();
    const { value, valueType } = defaultValueForType(variable.variableType?.type ?? 'int');
    const param = { type: 'Param', id: paramId, library: libId, value, valueType };
    elements[paramId] = param;
    return { type: 'Param', library: libId, id: paramId };
}
// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------
export function unwrapArrayType(typeNode) {
    const sizes = [];
    let cur = typeNode;
    while (cur?.kind === 117 /* SyntaxKind.ArrayType */) {
        sizes.push(cur.size);
        cur = cur.elementType;
    }
    // Parser nests from left to right, so unwrap order is outermost->innermost.
    // Reverse to restore source order: int[a][b] => [a, b].
    return { baseType: cur, sizes: sizes.reverse() };
}
export function parseArraySizeExpr(expr, globalVarByGalaxyName, constants) {
    expr = unwrapParens(expr);
    if (expr?.kind === 2 /* SyntaxKind.NumericLiteral */) {
        const n = Number(expr.value ?? expr.text ?? '0');
        if (Number.isSafeInteger(n) && n > 0) {
            // Galaxy stores size; trigger XML stores inclusive upper bound (size-1).
            return { value: String(n - 1) };
        }
    }
    if (expr?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        const op = expr.operatorToken?.kind;
        const left = unwrapParens(expr.left);
        const right = unwrapParens(expr.right);
        const isPlus = op === 20 /* SyntaxKind.PlusToken */;
        if (isPlus && left?.kind === 113 /* SyntaxKind.Identifier */ && right?.kind === 2 /* SyntaxKind.NumericLiteral */) {
            const rightNum = Number(right.value ?? right.text ?? '0');
            const ref = globalVarByGalaxyName.get(left.name);
            if (ref && rightNum === 1) {
                return { variable: { type: 'Variable', library: ref.library, id: ref.id } };
            }
        }
        if (isPlus && right?.kind === 113 /* SyntaxKind.Identifier */ && left?.kind === 2 /* SyntaxKind.NumericLiteral */) {
            const leftNum = Number(left.value ?? left.text ?? '0');
            const ref = globalVarByGalaxyName.get(right.name);
            if (ref && leftNum === 1) {
                return { variable: { type: 'Variable', library: ref.library, id: ref.id } };
            }
        }
    }
    const length = constants?.evaluate(expr);
    if (length !== undefined && length > 0)
        return { value: String(length - 1) };
    // A bare [N] is a length, whereas XML's Variable means the inclusive
    // upper bound and emits [N + 1]. Do not silently grow the array or emit [].
    return conversionError('ARRAY_DIMENSION', 'Galaxy array length cannot be represented by the loaded Trigger array bound', {
        kind: expr?.kind, identifier: expr?.name, expression: printNode(expr), line: expr?.line, start: expr?.pos, end: expr?.end,
    });
}
export function getTypeName(typeNode) {
    if (!typeNode)
        return 'int';
    if (typeNode.typeArguments && typeNode.returnType) {
        return `${getTypeName(typeNode.returnType)}<${typeNode.typeArguments.map(getTypeName).join(',')}>`;
    }
    if (typeof typeNode.name === 'string' && typeNode.name.length > 0) {
        return typeNode.name;
    }
    if (typeNode.kind === 117 /* SyntaxKind.ArrayType */) {
        return getTypeName(typeNode.elementType);
    }
    if (typeNode.kind === 115 /* SyntaxKind.TypeReference */) {
        if (typeof typeNode.typeName?.name === 'string')
            return typeNode.typeName.name;
        return conversionError('UNSUPPORTED_TYPE', 'Reference type requires structured type resolution', { kind: typeNode.returnType?.kind, arguments: typeNode.typeArguments?.map((type) => type.name) });
    }
    // The language grammar owns its primitive types; an incomplete duplicate
    // table used to silently turn actor/actorscope and other handles into int.
    if (isKeywordTypeKind(typeNode.kind))
        return tokenToString(typeNode.kind);
    return conversionError('UNSUPPORTED_TYPE', 'Unknown Galaxy type node', { kind: typeNode.kind });
}
export function galaxyTypeToTrigger(galaxyType) {
    const lower = galaxyType.toLowerCase();
    const kind = stringToToken(lower);
    return kind !== undefined && isKeywordTypeKind(kind) ? lower : galaxyType;
}
// ---------------------------------------------------------------------------
// AST utility helpers
// ---------------------------------------------------------------------------
export function unwrapParens(expr) {
    let cur = expr;
    while (cur?.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
        cur = cur.expression;
    return cur;
}
export function isTrueExpr(expr) {
    return unwrapParens(expr)?.kind === 67 /* SyntaxKind.TrueKeyword */;
}
export function readSignedIntLiteral(expr) {
    const e = unwrapParens(expr);
    if (!e)
        return undefined;
    if (e.kind === 2 /* SyntaxKind.NumericLiteral */) {
        const n = Number(e.text ?? e.value);
        return Number.isFinite(n) ? n : undefined;
    }
    if (e.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ && e.operator?.kind === 21 /* SyntaxKind.MinusToken */) {
        const op = e.operand;
        if (op?.kind === 2 /* SyntaxKind.NumericLiteral */) {
            const n = Number(op.text ?? op.value);
            return Number.isFinite(n) ? -n : undefined;
        }
    }
    return undefined;
}
export function getAssignSides(stmt) {
    if (stmt?.kind !== 138 /* SyntaxKind.ExpressionStatement */)
        return undefined;
    const expr = stmt.expression;
    if (!expr || expr.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return undefined;
    if (expr.operatorToken?.kind !== 39 /* SyntaxKind.EqualsToken */)
        return undefined;
    return { left: expr.left, right: expr.right };
}
export function getIdentifierName(expr) {
    const e = unwrapParens(expr);
    if (e?.kind === 113 /* SyntaxKind.Identifier */)
        return e.name;
    return undefined;
}
/** Canonical spelling of a side-effect-free variable path: `v`, `v.f`, `v[2]`, `v[i].f`.
 * Editor loop templates write their `#PARAM(var)` target verbatim, so the iterator of a
 * recovered loop may be a record field or an array element as well as a plain variable.
 * Comparing iterators by identifier name only made every such loop fall back to a
 * synthesized `For Statement` template. A plain identifier keeps its name as the key. */
export function lvalueKey(expr) {
    const e = unwrapParens(expr);
    if (e?.kind === 113 /* SyntaxKind.Identifier */)
        return e.name;
    if (e?.kind === 120 /* SyntaxKind.PropertyAccessExpression */) {
        const base = lvalueKey(e.expression);
        return base !== undefined && e.name?.name ? `${base}.${e.name.name}` : undefined;
    }
    if (e?.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
        const base = lvalueKey(e.expression);
        const index = unwrapParens(e.argumentExpression);
        const indexKey = index?.kind === 2 /* SyntaxKind.NumericLiteral */ ? String(index.text ?? index.value) : lvalueKey(index);
        return base !== undefined && indexKey !== undefined ? `${base}[${indexKey}]` : undefined;
    }
    return undefined;
}
/** Recover the Param identity embedded by the editor in
 * StringExternal("Param/Value[/lib_<id>]/<param-id>").  The localized text
 * lives in GameStrings under that identity; keeping StringExternal as an
 * ordinary nested call makes the Trigger editor show an unresolved key. */
export function localizedTextParamId(expr, ctx) {
    const node = unwrapParens(expr);
    if (node?.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    const callee = unwrapParens(node.expression);
    if (callee?.kind !== 113 /* SyntaxKind.Identifier */ || callee.name !== 'StringExternal')
        return undefined;
    const args = Array.from(node.arguments ?? []);
    if (args.length !== 1)
        return undefined;
    const literal = unwrapParens(args[0]);
    if (literal?.kind !== 3 /* SyntaxKind.StringLiteral */)
        return undefined;
    const key = String(literal.value ?? literal.text ?? '');
    const bare = /^Param\/Value\/(?:lib_[A-Za-z0-9]+_)?([0-9A-Fa-f]{8})$/u.exec(key)?.[1]?.toUpperCase();
    return bare && !ctx.elements[bare] ? bare : undefined;
}
const functionSymbolIndexes = new WeakMap();
/** Index lexical symbol use once per parsed function. This is used when
 * generated helper locals can be erased only after proving they have no
 * observable use outside the reconstructed TriggerData template. */
export function functionSymbolIndex(nodes) {
    let cached = functionSymbolIndexes.get(nodes);
    if (cached)
        return cached;
    const uses = new Map();
    const assignments = new Map();
    const declarations = new Map();
    const visit = (node) => {
        if (!node || typeof node !== 'object')
            return;
        if (Array.isArray(node)) {
            for (const child of node)
                visit(child);
            return;
        }
        if (node.kind === 113 /* SyntaxKind.Identifier */) {
            uses.set(node.name, (uses.get(node.name) ?? 0) + 1);
            return;
        }
        if (node.kind === 141 /* SyntaxKind.VariableDeclaration */)
            declarations.set(node.name.name, node);
        if (node.kind === 124 /* SyntaxKind.BinaryExpression */ && node.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */) {
            const name = getIdentifierName(node.left);
            if (name)
                assignments.set(name, (assignments.get(name) ?? 0) + 1);
        }
        for (const [key, child] of Object.entries(node)) {
            if (['parent', 'syntaxTokens', 'pos', 'end'].includes(key))
                continue;
            if (key === 'name' && [141 /* SyntaxKind.VariableDeclaration */, 120 /* SyntaxKind.PropertyAccessExpression */].includes(node.kind))
                continue;
            visit(child);
        }
    };
    visit(nodes);
    cached = { uses, assignments, declarations };
    functionSymbolIndexes.set(nodes, cached);
    return cached;
}
export function isBreakGuardOnNegative(stmt, iteratorKey) {
    if (stmt?.kind !== 129 /* SyntaxKind.IfStatement */)
        return false;
    const cond = unwrapParens(stmt.expression);
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return false;
    if (cond.operatorToken?.kind !== 13 /* SyntaxKind.LessThanToken */)
        return false;
    if (lvalueKey(cond.left) !== iteratorKey)
        return false;
    if (readSignedIntLiteral(cond.right) !== 0)
        return false;
    const thenStmts = getBlockStatements(stmt.thenStatement);
    if (thenStmts.length !== 1)
        return false;
    return thenStmts[0]?.kind === 133 /* SyntaxKind.BreakStatement */;
}
export function isBreakGuardOnNull(stmt, iteratorKey) {
    if (stmt?.kind !== 129 /* SyntaxKind.IfStatement */)
        return false;
    const cond = unwrapParens(stmt.expression);
    if (!cond || cond.kind !== 124 /* SyntaxKind.BinaryExpression */)
        return false;
    if (cond.operatorToken?.kind !== 17 /* SyntaxKind.EqualsEqualsToken */)
        return false;
    if (lvalueKey(cond.left) !== iteratorKey)
        return false;
    return unwrapParens(cond.right)?.kind === 69 /* SyntaxKind.NullKeyword */;
}
export function isGeneratedAutoLoopVarName(name) {
    if (!name)
        return false;
    return /^auto[0-9A-Za-z]+_var$/.test(name);
}
export function getCallExprName(expr) {
    const e = unwrapParens(expr);
    if (!e || e.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    return getIdentifierName(e.expression);
}
export function isCallStmtNamed(stmt, name) {
    return stmt?.kind === 138 /* SyntaxKind.ExpressionStatement */ && getCallExprName(stmt.expression) === name;
}
export function parseWaitCall(stmt) {
    if (stmt?.kind !== 138 /* SyntaxKind.ExpressionStatement */)
        return undefined;
    const call = unwrapParens(stmt.expression);
    if (!call || call.kind !== 121 /* SyntaxKind.CallExpression */)
        return undefined;
    if (getIdentifierName(call.expression) !== 'Wait')
        return undefined;
    const args = Array.from(call.arguments ?? []);
    if (args.length < 2)
        return undefined;
    return { tExpr: args[0], timeTypeExpr: args[1] };
}
export function extractNegatedConditionExpr(expr) {
    const e = unwrapParens(expr);
    if (!e || e.kind !== 122 /* SyntaxKind.PrefixUnaryExpression */)
        return undefined;
    if (e.operator?.kind !== 32 /* SyntaxKind.ExclamationToken */)
        return undefined;
    return unwrapParens(e.operand);
}
export function getBlockStatements(stmt) {
    if (!stmt)
        return [];
    if (stmt.kind === 128 /* SyntaxKind.Block */)
        return Array.from(stmt.statements ?? []);
    return [stmt]; // single statement (rare in practice)
}
export function stmtUsesLoopCounterVar(stmt, varName) {
    if (!stmt)
        return false;
    if (stmt.kind === 132 /* SyntaxKind.ForStatement */) {
        const init = stmt.initializer;
        if (init?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
            init.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */ &&
            init.left?.kind === 113 /* SyntaxKind.Identifier */ &&
            init.left.name === varName) {
            return true;
        }
        return stmtUsesLoopCounterVar(stmt.statement, varName);
    }
    if (stmt.kind === 128 /* SyntaxKind.Block */) {
        for (const s of Array.from(stmt.statements ?? [])) {
            if (stmtUsesLoopCounterVar(s, varName))
                return true;
        }
        return false;
    }
    if (stmt.kind === 129 /* SyntaxKind.IfStatement */) {
        return stmtUsesLoopCounterVar(stmt.thenStatement, varName) ||
            stmtUsesLoopCounterVar(stmt.elseStatement, varName);
    }
    if (stmt.kind === 131 /* SyntaxKind.WhileStatement */ || stmt.kind === 130 /* SyntaxKind.DoStatement */) {
        return stmtUsesLoopCounterVar(stmt.statement, varName);
    }
    return false;
}
export function isLoopCounterDeclaration(stmts, declIndex, varName) {
    for (let i = declIndex + 1; i < stmts.length; i++) {
        if (stmtUsesLoopCounterVar(stmts[i], varName))
            return true;
    }
    return false;
}
export function forStmtUsesCounterVar(forStmt, counterName) {
    if (!forStmt || forStmt.kind !== 132 /* SyntaxKind.ForStatement */)
        return false;
    const cond = forStmt.condition;
    if (cond?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        if (getIdentifierName(cond.left) === counterName)
            return true;
        if (getIdentifierName(cond.right) === counterName)
            return true;
    }
    const incr = forStmt.incrementor;
    if (incr?.kind === 124 /* SyntaxKind.BinaryExpression */) {
        if (getIdentifierName(incr.left) === counterName)
            return true;
    }
    return false;
}
/** Deep-scans an AST subtree for an Identifier with the given name (skips parent links). */
export function exprContainsIdentifier(node, name, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 16)
        return false;
    if (node.kind === 113 /* SyntaxKind.Identifier */ && node.name === name)
        return true;
    for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'pos' || key === 'end' || key === 'kind' || key === 'name')
            continue;
        const v = node[key];
        if (Array.isArray(v)) {
            for (const c of v)
                if (exprContainsIdentifier(c, name, depth + 1))
                    return true;
        }
        else if (v && typeof v === 'object') {
            if (exprContainsIdentifier(v, name, depth + 1))
                return true;
        }
    }
    return false;
}
/**
 * True when one of the next few statements is a ForStatement whose condition or
 * incrementor references `name`. Used to decide whether an `auto*_ae` / `auto*_ai`
 * helper assignment belongs to an upcoming loop (and must be consumed, not emitted
 * as a standalone action).
 */
export function upcomingForStmtUsesName(stmts, index, name, lookahead = 3) {
    for (let j = index + 1; j <= index + lookahead && j < stmts.length; j++) {
        const s = stmts[j];
        if (s?.kind !== 132 /* SyntaxKind.ForStatement */)
            continue;
        if (exprContainsIdentifier(s.condition, name) || exprContainsIdentifier(s.incrementor, name))
            return true;
    }
    return false;
}
//# sourceMappingURL=g2t-core.js.map