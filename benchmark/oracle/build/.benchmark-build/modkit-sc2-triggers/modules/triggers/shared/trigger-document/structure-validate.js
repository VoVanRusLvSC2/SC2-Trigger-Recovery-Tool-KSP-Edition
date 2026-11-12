/**
 * structure-validate — Layer-0 structural validator for generated trigger
 * libraries.
 *
 * Re-implements the SC2 editor's load-time cleanup rules as failing checks so
 * CI catches everything the editor would silently delete:
 *
 *   E_DUP_ID        duplicate element id (editor: "Duplicate trigger element removed")
 *   E_ORPHAN        Param/FunctionCall unreachable from any root
 *                   (editor: "Orphaned trigger parameter/function call removed")
 *   E_BAD_REF       ref to a missing same-library element or type mismatch
 *   E_PARAMDEF      FunctionCall actual Param lacks or mismatches its formal
 *                   ParameterDef (editor: "Orphaned trigger parameter removed")
 *   E_TYPE          FunctionCall actual Param type does not match its formal
 *                   ParameterDef (editor: compile-time type mismatch)
 *   E_SUBFUNC_ROLE  child sub-function call lacks a role accepted by its parent
 *                   FunctionDef (editor: "Orphaned trigger sub-function call removed")
 *   E_NAME_REF      FunctionDef/local ref whose id is not 8-char hex (name leaked as id)
 *   E_ARITY         FunctionCall has more parameters than its FunctionDef declares
 *   E_PLACEHOLDER   internal placeholder (__mx_raw_script) leaked into output
 *   E_RAW_INIT      synthetic __InitVariablesRaw FunctionDef present (must be
 *                   folded into Variable initial values)
 *
 * Works on the in-memory TriggerLibraryJson model — the exact model
 * bridge-triggers serializes — and equally on libraries parsed back from a
 * serialized Triggers file via parseTriggerXmlSync (see scripts/validate-triggers.ts).
 */
const HEX_ID_RE = /^[0-9A-Fa-f]{1,8}$/;
const PRUNABLE = new Set(['Param', 'FunctionCall']);
const PLACEHOLDER = '__mx_raw_script';
function isRefLike(v) {
    return v && typeof v === 'object' && !Array.isArray(v)
        && typeof v.type === 'string' && typeof v.id === 'string'
        && Object.keys(v).every(k => k === 'type' || k === 'id' || k === 'library');
}
function* iterRefs(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 64)
        return;
    if (Array.isArray(node)) {
        for (const item of node)
            yield* iterRefs(item, depth + 1);
        return;
    }
    if (isRefLike(node)) {
        yield node;
        return;
    }
    for (const [k, v] of Object.entries(node)) {
        if (k === 'type' || k === 'id' || k === 'library')
            continue;
        if (v && typeof v === 'object')
            yield* iterRefs(v, depth + 1);
    }
}
/** Element lookup tolerant to both keying schemes: plain id and "Type:Id" (prebuilt NativeLib). */
function getLibElement(lib, type, id) {
    const direct = lib.elements?.[id];
    if (direct?.type === type)
        return direct;
    const prefixed = lib.elements?.[`${type}:${id}`];
    if (prefixed)
        return prefixed;
    const byType = lib.elementsByType?.[type]?.[id];
    return byType;
}
function normType(t) {
    return t?.toLowerCase();
}
function areTriggerTypesCompatible(expected, actual) {
    const e = normType(expected);
    const a = normType(actual);
    if (!e || !a)
        return true;
    if (e === a)
        return true;
    // TriggerLib uses symbolic polymorphic types for generic assignments,
    // comparisons and collection helpers.  They are constraints between
    // parameters, not concrete Galaxy types that can be compared in isolation.
    if (e === 'any' || e === 'anycompare' || e === 'anyvariable' || e === 'sameas' || e === 'sameasparent' || e === 'return'
        || a === 'any' || a === 'anycompare' || a === 'anyvariable' || a === 'sameas' || a === 'sameasparent' || a === 'return')
        return true;
    return false;
}
function inferConcreteParamType(param, lib, libsById, depth = 0) {
    if (depth > 64)
        return undefined;
    const declaredType = (type, owner) => {
        if (!type?.type)
            return undefined;
        if (normType(type.type) !== 'preset' || !type.typeElement?.id)
            return type.type;
        const presetRef = type.typeElement;
        const presetLib = libsById.get(presetRef.library || owner.id) ?? owner;
        const preset = getLibElement(presetLib, 'Preset', presetRef.id);
        return preset?.baseType ?? type.type;
    };
    // A structured variable Param stores the root in Variable/Parameter and the
    // selected member as a nested Param. The member is the value supplied to the
    // call, so inspect it before the root struct domain.
    const memberRef = param.structMember;
    if (memberRef?.id) {
        const memberLib = libsById.get(memberRef.library || lib.id) ?? lib;
        const member = getLibElement(memberLib, 'Param', memberRef.id);
        if (member)
            return inferConcreteParamType(member, memberLib, libsById, depth + 1);
    }
    const explicit = param.valueType?.type;
    if (normType(explicit) === 'preset') {
        // Preset-backed values carry the editor domain on the owning Preset, not
        // on ValueType (which is literally just "preset"). Depending on the XML
        // shape, the Param points either at the Preset itself through ValueElement
        // or at one of its PresetValue children. Resolve both without relying on a
        // display name or on element order.
        const presetElement = param.valueElement;
        if (presetElement?.type === 'Preset' && presetElement.id) {
            const presetLib = libsById.get(presetElement.library || lib.id) ?? lib;
            const preset = getLibElement(presetLib, 'Preset', presetElement.id);
            if (preset?.baseType)
                return preset.baseType;
        }
        const presetValue = param.preset;
        if (presetValue?.id) {
            const valueLibrary = presetValue.library || lib.id;
            for (const candidateLibrary of libsById.values()) {
                for (const element of Object.values(candidateLibrary.elements ?? {})) {
                    if (element.type !== 'Preset')
                        continue;
                    const preset = element;
                    if ((preset.values ?? []).some((ref) => ref.id === presetValue.id && (ref.library || candidateLibrary.id) === valueLibrary)) {
                        if (preset.baseType)
                            return preset.baseType;
                    }
                }
            }
        }
    }
    if (explicit)
        return explicit;
    if (param.functionCall?.id) {
        const fcRef = param.functionCall;
        const fcLib = libsById.get(fcRef.library || lib.id) ?? lib;
        const fc = getLibElement(fcLib, 'FunctionCall', fcRef.id);
        const fdRef = fc?.functionDef;
        if (fdRef?.id) {
            const fdLib = libsById.get(fdRef.library || fcLib.id) ?? fcLib;
            const fd = getLibElement(fdLib, 'FunctionDef', fdRef.id);
            return fd?.returnType?.type;
        }
    }
    if (param.variable?.id) {
        const varRef = param.variable;
        const varLib = libsById.get(varRef.library || lib.id) ?? lib;
        const variable = getLibElement(varLib, 'Variable', varRef.id);
        return declaredType(variable?.variableType, varLib);
    }
    if (param.paramRef?.id) {
        const pdRef = param.paramRef;
        const pdLib = libsById.get(pdRef.library || lib.id) ?? lib;
        const pd = getLibElement(pdLib, 'ParamDef', pdRef.id);
        return declaredType(pd?.paramType, pdLib);
    }
    return undefined;
}
export function validateLibraryStructure(libraries, options = {}) {
    const findings = [];
    const libsById = new Map();
    for (const lib of libraries)
        libsById.set(lib.id, lib);
    for (const dep of options.dependencyLibraries ?? []) {
        if (!libsById.has(dep.id))
            libsById.set(dep.id, dep);
    }
    const externals = options.allowExternalLibraryIds ?? new Set();
    // --- E_DUP_ID: duplicate identities within each generated library ------
    for (const lib of libraries) {
        // items array can carry duplicates even when the elements record cannot.
        const itemIds = new Set();
        for (const item of lib.items ?? []) {
            const itemKey = `${item.type}:${item.id}`;
            if (itemIds.has(itemKey)) {
                findings.push({ code: 'E_DUP_ID', library: lib.id, elementId: item.id,
                    message: `duplicate item entry for element ${item.id}` });
            }
            itemIds.add(itemKey);
        }
    }
    for (const lib of libraries) {
        const elements = lib.elements;
        // --- per-element checks ------------------------------------------------
        for (const el of Object.values(elements)) {
            // E_PLACEHOLDER
            const scriptCode = el.scriptCode;
            if (typeof scriptCode === 'string' && scriptCode.includes(PLACEHOLDER)) {
                findings.push({ code: 'E_PLACEHOLDER', library: lib.id, elementId: el.id,
                    message: `internal placeholder ${PLACEHOLDER} leaked into scriptCode of ${el.type} ${el.id}` });
            }
            // E_RAW_INIT
            if (el.type === 'FunctionDef' && el.name === '__InitVariablesRaw') {
                findings.push({ code: 'E_RAW_INIT', library: lib.id, elementId: el.id,
                    message: `synthetic __InitVariablesRaw FunctionDef present — fold inits into Variable initial values` });
            }
            // refs
            for (const ref of iterRefs(el)) {
                // Parsed implicit-map references have library="" because the XML
                // intentionally omits Library=.  Treat the empty value as same-library.
                const targetLibId = ref.library || lib.id;
                const targetLib = libsById.get(targetLibId);
                if (!targetLib) {
                    if (!externals.has(targetLibId)) {
                        findings.push({ code: 'E_BAD_REF', library: lib.id, elementId: el.id,
                            message: `${el.type} ${el.id} references unknown library ${targetLibId} (${ref.type} ${ref.id})` });
                    }
                    continue;
                }
                const target = getLibElement(targetLib, ref.type, ref.id);
                if (!target) {
                    if (!HEX_ID_RE.test(ref.id)) {
                        findings.push({ code: 'E_NAME_REF', library: lib.id, elementId: el.id,
                            message: `${el.type} ${el.id} references ${ref.type} by NAME "${ref.id}" in library ${targetLibId}` });
                    }
                    else {
                        findings.push({ code: 'E_BAD_REF', library: lib.id, elementId: el.id,
                            message: `${el.type} ${el.id} references missing ${ref.type} ${targetLibId}:${ref.id}` });
                    }
                    continue;
                }
                if (target.type !== ref.type) {
                    findings.push({ code: 'E_BAD_REF', library: lib.id, elementId: el.id,
                        message: `${el.type} ${el.id} ref type mismatch: expected ${ref.type}, ${targetLibId}:${ref.id} is ${target.type}` });
                }
            }
            // E_ARITY
            if (el.type === 'FunctionCall') {
                const fc = el;
                const fdRef = fc.functionDef;
                if (fdRef) {
                    const fdLib = libsById.get(fdRef.library || lib.id);
                    const fd = (fdLib ? getLibElement(fdLib, 'FunctionDef', fdRef.id) : undefined);
                    if (fd && fd.type === 'FunctionDef') {
                        const declared = fd.parameters?.length ?? 0;
                        const declaredParameterDefs = new Map((fd.parameters ?? []).map(ref => [
                            `${ref.library || fdLib?.id || lib.id}:${ref.id}`,
                            ref,
                        ]));
                        for (let i = 0; i < (fc.parameters ?? []).length; i++) {
                            const paramRef = fc.parameters[i];
                            const param = getLibElement(libsById.get(paramRef.library || lib.id) ?? lib, 'Param', paramRef.id);
                            if (!param)
                                continue;
                            const actual = param.parameterDef;
                            if (!actual?.id) {
                                findings.push({ code: 'E_PARAMDEF', library: lib.id, elementId: param.id,
                                    message: `Param ${param.id} passed to FunctionCall ${fc.id} has no ParameterDef declared by FunctionDef ${fdRef.library}:${fdRef.id}` });
                                continue;
                            }
                            // FunctionCall parameters are associated with formals by their
                            // explicit ParameterDef reference. TriggerData does not require
                            // the call's <Parameter> elements to follow FunctionDef order;
                            // stock NativeLib and editor-authored documents routinely use a
                            // different order. Positional matching therefore reports valid
                            // documents as orphaned and compares values against the wrong
                            // types. Validate set membership and then use the referenced
                            // formal as the type contract.
                            const actualLibrary = actual.library || fdLib?.id || lib.id;
                            const actualKey = `${actualLibrary}:${actual.id}`;
                            const expected = declaredParameterDefs.get(actualKey);
                            if (!expected) {
                                findings.push({ code: 'E_PARAMDEF', library: lib.id, elementId: param.id,
                                    message: `Param ${param.id} passed to FunctionCall ${fc.id} uses ParameterDef ${actualLibrary}:${actual.id}, which is not declared by FunctionDef ${fdRef.library}:${fdRef.id}` });
                                continue;
                            }
                            if (options.checkConcreteTypes) {
                                const expectedPdLib = libsById.get(expected.library || fdLib?.id || lib.id) ?? fdLib ?? lib;
                                const expectedPd = getLibElement(expectedPdLib, 'ParamDef', expected.id);
                                let expectedType = expectedPd?.paramType?.type;
                                if (normType(expectedType) === 'preset' && expectedPd?.paramType?.typeElement?.id) {
                                    const presetRef = expectedPd.paramType.typeElement;
                                    const presetLib = libsById.get(presetRef.library || expectedPdLib.id) ?? expectedPdLib;
                                    const preset = getLibElement(presetLib, 'Preset', presetRef.id);
                                    expectedType = preset?.baseType ?? expectedType;
                                }
                                const actualType = inferConcreteParamType(param, lib, libsById);
                                if (!areTriggerTypesCompatible(expectedType, actualType)) {
                                    findings.push({ code: 'E_TYPE', library: lib.id, elementId: param.id,
                                        message: `Param ${param.id} passed to FunctionCall ${fc.id} has type ${actualType}, expected ${expectedType} from ParameterDef ${expected.library}:${expected.id}` });
                                }
                            }
                        }
                        const got = (fc.parameters ?? [])
                            .map(ref => getLibElement(libsById.get(ref.library || lib.id) ?? lib, 'Param', ref.id))
                            .filter(param => !!param?.parameterDef?.id)
                            .length;
                        // Variadic "Multiple" templates (e.g. ArithmeticIntMult) repeat the
                        // declared param group N times — exact multiples are valid.
                        const isRepeatedGroup = declared > 0 && got > declared && got % declared === 0;
                        const isInfixArithmeticMultiple = declared === 2 &&
                            got > declared &&
                            got % 2 === 1 &&
                            /Arithmetic(?:Int|Real)Mult/.test(fd.name ?? '');
                        if (got > declared && !isRepeatedGroup && !isInfixArithmeticMultiple) {
                            findings.push({ code: 'E_ARITY', library: lib.id, elementId: el.id,
                                message: `FunctionCall ${el.id} passes ${got} params but FunctionDef ${fdRef.library}:${fdRef.id} declares ${declared}` });
                        }
                        const allowedSubFuncTypes = new Set((fd.subFunctionTypes ?? []).map(sft => `${sft.library}:${sft.id}`));
                        if (allowedSubFuncTypes.size > 0) {
                            for (const subRef of fc.subFunctions ?? []) {
                                const sub = getLibElement(libsById.get(subRef.library || lib.id) ?? lib, 'FunctionCall', subRef.id);
                                if (!sub)
                                    continue;
                                const actual = sub.subFunctionType;
                                if (!actual?.id) {
                                    findings.push({ code: 'E_SUBFUNC_ROLE', library: lib.id, elementId: sub.id,
                                        message: `SubFunction ${sub.id} under FunctionCall ${fc.id} is missing a role accepted by FunctionDef ${fdRef.library}:${fdRef.id}` });
                                }
                                else if (!allowedSubFuncTypes.has(`${actual.library}:${actual.id}`)) {
                                    findings.push({ code: 'E_SUBFUNC_ROLE', library: lib.id, elementId: sub.id,
                                        message: `SubFunction ${sub.id} under FunctionCall ${fc.id} uses role ${actual.library}:${actual.id}, not accepted by FunctionDef ${fdRef.library}:${fdRef.id}` });
                                }
                            }
                        }
                    }
                }
            }
        }
        // --- E_ORPHAN ------------------------------------------------------------
        if (!options.skipOrphanCheck) {
            // Index by type:id — element records may be keyed by plain id (generated
            // model) or by "Type:Id" (parseTriggerXmlSync), so never trust the keys.
            const byTypeId = new Map();
            for (const el of Object.values(elements))
                byTypeId.set(`${el.type}:${el.id}`, el);
            const reachable = new Set();
            const visit = (type, id) => {
                const key = `${type}:${id}`;
                if (reachable.has(key))
                    return;
                reachable.add(key);
                const target = byTypeId.get(key);
                if (!target)
                    return;
                for (const ref of iterRefs(target)) {
                    const sameLib = (ref.library || lib.id) === lib.id;
                    if (sameLib)
                        visit(ref.type, ref.id);
                }
            };
            for (const el of Object.values(elements)) {
                if (!PRUNABLE.has(el.type))
                    visit(el.type, el.id);
            }
            for (const el of Object.values(elements)) {
                if (PRUNABLE.has(el.type) && !reachable.has(`${el.type}:${el.id}`)) {
                    findings.push({ code: 'E_ORPHAN', library: lib.id, elementId: el.id,
                        message: `${el.type} ${el.id} is unreachable from any root element (editor would delete it)` });
                }
            }
        }
    }
    return findings;
}
export function formatFindings(findings) {
    if (findings.length === 0)
        return 'structure OK — 0 findings';
    const byCode = new Map();
    for (const f of findings)
        byCode.set(f.code, (byCode.get(f.code) ?? 0) + 1);
    const summary = [...byCode.entries()].map(([c, n]) => `${c}=${n}`).join(' ');
    const lines = findings.slice(0, 200).map(f => `  [${f.code}] lib ${f.library}${f.elementId ? ` el ${f.elementId}` : ''}: ${f.message}`);
    return `structure FAILED — ${findings.length} finding(s) (${summary})\n${lines.join('\n')}`;
}
