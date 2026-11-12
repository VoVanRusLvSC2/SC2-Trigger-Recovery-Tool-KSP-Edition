/**
 * Converts a loaded TriggerLibraryJson into EngineAst nodes.
 *
 * ## Entry points
 *
 *   triggerLibraryToEngineProgram(lib, options)   → EngineProgram  (single library)
 *   triggerLibrariesToEngineProgram(libs, options) → EngineProgram  (multiple libraries)
 *   triggerLibraryToEngineModule(lib, options)    → EngineModule   (internal building block)
 *
 * ## Options
 *
 *   nativeLibraries   Libraries this library depends on (NativeLib, core-mod libs, …).
 *                     Required for cross-library FunctionDef resolution and
 *                     control-flow lowering when the CF functions live in Ntve.
 *                     Pass the loaded NativeLib at minimum: `{ nativeLibraries: [ntveLib] }`.
 *
 *   includeRawFallbacks  When true (default), FunctionCalls with subFunctions that
 *                        could not be lowered emit an EngineRawStatement as a fallback
 *                        so the sub-block data is preserved in the AST for analysis tools.
 *                        Set to false when building programs for the runtime interpreter.
 *
 * ## Control-flow lowering
 *
 * The SC2 editor encodes control-flow as FunctionCalls with sub-blocks.
 * tryLowerControlFlow() detects these by resolving the callee FunctionDef's
 * *name* (from TriggerStrings) and dispatching by name — no hardcoded element IDs:
 *
 *   'IfThenElse'      → EngineIfStatement  (AND-folds multiple If-block conditions)
 *   'While'           → EngineWhileStatement
 *   'Repeat'          → EngineVariableStatement + EngineWhileStatement
 *   'RepeatForever'   → EngineWhileStatement(true)
 *   'ForEachInteger'        → EngineVariableStatement + EngineWhileStatement
 *   'ForEachInteger2'       → same, with explicit step from params[2]
 *   'Switch'                → EngineSwitchStatement (Cases sub-blocks → cases[], Default sub-blocks → default body)
 *   'ForEachPlayerInGroup'  → EngineForEachStatement (iterable = player-group expr, variable = loop var)
 *   'ForEachUnitInGroup'    → EngineForEachStatement (iterable = unit-group expr)
 *   'ForEachUnitInGroup2'   → EngineForEachStatement (same)
 *
 * Sub-block roles (If / Then / Else / Actions / Conditions / Cases / Default) are looked up from
 * ctx.subfuncRoles, which is built at context-creation time by merging
 * TriggerLibraryJson.subFuncTypeNames from the library itself and nativeLibraries.
 * The reader populates subFuncTypeNames from TriggerStrings XML, so no role
 * strings are hardcoded in this file.
 *
 * ## Cross-library resolution
 *
 * resolveElement() searches ctx.library first, then iterates ctx.nativeLibMap
 * (indexed by library id). This allows user-library FunctionCalls to reference
 * Ntve FunctionDefs for name-based CF dispatch.
 */
// ── Public API ───────────────────────────────────────────────────────────────
export function triggerLibraryToEngineProgram(library, options = {}) {
    return {
        kind: 'EngineProgram',
        modules: [triggerLibraryToEngineModule(library, options)],
    };
}
export function triggerLibrariesToEngineProgram(libraries, options = {}) {
    return {
        kind: 'EngineProgram',
        modules: libraries.map((library) => triggerLibraryToEngineModule(library, options)),
    };
}
export function triggerLibraryToEngineModule(library, options = {}) {
    const nativeDeps = options.nativeLibraries ?? [];
    // Build native lib index
    const nativeLibMap = new Map();
    for (const dep of nativeDeps)
        nativeLibMap.set(dep.id, dep);
    // Merge subFuncTypeNames: own library first so deps can supplement but not override
    const subfuncRoles = new Map();
    for (const dep of nativeDeps) {
        for (const [key, role] of Object.entries(dep.subFuncTypeNames ?? {})) {
            subfuncRoles.set(key, role);
        }
    }
    // Own library's subFuncTypeNames take priority
    for (const [key, role] of Object.entries(library.subFuncTypeNames ?? {})) {
        subfuncRoles.set(key, role);
    }
    const ctx = {
        library,
        nativeLibMap,
        fileName: options.fileName,
        includeRawFallbacks: options.includeRawFallbacks ?? true,
        subfuncRoles,
    };
    const localVariableIds = new Set();
    for (const trigger of Object.values(library.elementsByType.Trigger)) {
        for (const ref of trigger.localVariables)
            localVariableIds.add(ref.id);
    }
    for (const func of Object.values(library.elementsByType.FunctionDef)) {
        for (const ref of func.localVariables ?? [])
            localVariableIds.add(ref.id);
    }
    return {
        kind: 'EngineModule',
        id: library.id,
        name: library.name,
        globals: Object.values(library.elementsByType.Variable)
            .filter((variable) => !localVariableIds.has(variable.id))
            .map((variable) => variableToEngine(variable, 'global', ctx)),
        functions: Object.values(library.elementsByType.FunctionDef)
            .filter((func) => !func.isSubFunction)
            .map((func) => functionDefToEngine(func, ctx)),
        triggers: Object.values(library.elementsByType.Trigger)
            .map((trigger) => triggerToEngine(trigger, ctx)),
        structs: Object.values(library.elementsByType.Structure).map((structure) => structureToEngine(structure, ctx)),
        presets: Object.values(library.elementsByType.Preset).map((preset) => presetToEngine(preset, ctx)),
        source: sourceRef(ctx, library.id, 'Library'),
    };
}
// ── Element conversion ───────────────────────────────────────────────────────
function functionDefToEngine(func, ctx) {
    return {
        kind: 'EngineFunction',
        id: func.id,
        name: func.name ?? func.id,
        returnType: typeRef(func.returnType),
        parameters: (func.parameters ?? []).map((ref) => paramDefToVariable(ref, ctx)),
        locals: (func.localVariables ?? [])
            .map((ref) => resolveElement(ctx, ref, 'Variable'))
            .filter((v) => v?.type === 'Variable')
            .map((variable) => variableToEngine(variable, 'local', ctx)),
        body: actionRefsToStatements(func.actions ?? [], ctx),
        flags: {
            native: func.flags?.includes('Native'),
            action: func.isFuncAction,
            call: func.isFuncCall,
            customScript: Boolean(func.scriptCode),
        },
        source: sourceRef(ctx, func.id, 'FunctionDef'),
    };
}
function triggerToEngine(trigger, ctx) {
    return {
        kind: 'EngineTrigger',
        id: trigger.id,
        name: trigger.name,
        enabled: !trigger.disabled,
        events: trigger.events
            .map((ref) => functionCallExpressionFromRef(ref, ctx))
            .filter((expr) => Boolean(expr)),
        conditions: trigger.conditions
            .map((ref) => functionCallExpressionFromRef(ref, ctx))
            .filter((expr) => Boolean(expr)),
        actions: actionRefsToStatements(trigger.actions, ctx),
        locals: trigger.localVariables
            .map((ref) => resolveElement(ctx, ref, 'Variable'))
            .filter((v) => v?.type === 'Variable')
            .map((variable) => variableToEngine(variable, 'local', ctx)),
        source: sourceRef(ctx, trigger.id, 'Trigger'),
    };
}
function structureToEngine(structure, ctx) {
    return {
        kind: 'EngineStruct',
        id: structure.id,
        name: structure.name ?? structure.id,
        fields: structure.variables
            .map((ref) => resolveElement(ctx, ref, 'Variable'))
            .filter((v) => v?.type === 'Variable')
            .map((variable) => variableToEngine(variable, 'struct-field', ctx)),
        source: sourceRef(ctx, structure.id, 'Structure'),
    };
}
function presetToEngine(preset, ctx) {
    return {
        kind: 'EnginePreset',
        id: preset.id,
        name: preset.name,
        baseType: preset.baseType ? { name: preset.baseType } : undefined,
        values: preset.values
            .map((ref) => resolveElement(ctx, ref, 'PresetValue'))
            .filter((v) => v?.type === 'PresetValue')
            .map((value) => ({
            id: value.id,
            name: value.name,
            value: value.value,
            source: sourceRef(ctx, value.id, 'PresetValue'),
        })),
        source: sourceRef(ctx, preset.id, 'Preset'),
    };
}
function variableToEngine(variable, scope, ctx) {
    return {
        kind: 'EngineVariable',
        id: variable.id,
        name: variable.name ?? variable.id,
        type: typeRef(variable.variableType),
        scope,
        constant: variable.isConstant,
        arrayDimensions: variable.arraySizes?.map((size) => size.variable
            ? refToExpression(size.variable, ctx)
            : literalExpression(parseLiteral(size.value ?? '0'))),
        initialValue: variable.initialValue ? refToExpression(variable.initialValue, ctx) : undefined,
        source: sourceRef(ctx, variable.id, 'Variable'),
    };
}
function paramDefToVariable(ref, ctx) {
    const param = resolveElement(ctx, ref, 'ParamDef');
    return {
        kind: 'EngineVariable',
        id: ref.id,
        name: param?.name ?? ref.id,
        type: param?.type === 'ParamDef' ? typeRef(param.paramType) : { name: 'unknown' },
        scope: 'parameter',
        source: sourceRef(ctx, ref.id, 'ParamDef'),
    };
}
// ── Statement / expression building ─────────────────────────────────────────
function actionRefsToStatements(refs, ctx) {
    return refs.flatMap((ref) => functionCallToStatements(ref, ctx));
}
function functionCallToStatements(ref, ctx) {
    // Comment elements carry no executable semantics -- the editor lets authors interleave
    // them between real actions purely for documentation. EngineRawStatement is meant for
    // content that genuinely couldn't be lowered but still needs preserving; a Comment isn't
    // that -- it's just dropped. (Without this, GalaxyRuntime.callFunction would throw
    // "EngineRawStatement (language: triggers) cannot be executed directly" the moment
    // execution reached ANY trigger with an inline comment in its action list -- which is
    // extremely common in real maps; see ROADMAP.md's Phase 2 EngineAst audit.)
    if (ref.type === 'Comment')
        return [];
    const call = resolveElement(ctx, ref, 'FunctionCall');
    if (!call || call.type !== 'FunctionCall')
        return rawRefStatement(ref, ctx);
    if (call.scriptCode) {
        return [{
                kind: 'EngineRawStatement',
                language: 'galaxy',
                code: call.scriptCode,
                source: sourceRef(ctx, call.id, 'FunctionCall'),
            }];
    }
    // Try to lower control-flow constructs (IfThenElse, While, Repeat, ForEachGroup, Switch, …).
    // Always attempt lowering when a functionDef is present — CF loops with empty bodies have
    // subFunctions.length === 0 but still need to be lowered (e.g. ForEachGroup with no actions).
    if (call.functionDef) {
        const lowered = tryLowerControlFlow(call, ctx);
        if (lowered)
            return lowered;
    }
    const statement = {
        kind: 'EngineExpressionStatement',
        expression: functionCallToExpression(call, ctx),
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    if (!ctx.includeRawFallbacks || !call.subFunctions?.length)
        return [statement];
    return [
        statement,
        {
            kind: 'EngineRawStatement',
            language: 'triggers',
            code: JSON.stringify({ subFunctions: call.subFunctions }),
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        },
    ];
}
function functionCallExpressionFromRef(ref, ctx) {
    const call = resolveElement(ctx, ref, 'FunctionCall');
    return call?.type === 'FunctionCall' ? functionCallToExpression(call, ctx) : undefined;
}
function functionCallToExpression(call, ctx) {
    const func = call.functionDef ? resolveElement(ctx, call.functionDef, 'FunctionDef') : undefined;
    const moduleId = call.functionDef?.library ?? ctx.library.id;
    return {
        kind: 'EngineCallExpression',
        callee: {
            name: func?.name ?? call.name ?? call.functionDef?.id,
            functionId: call.functionDef?.id,
            moduleId,
            nativeId: moduleId === 'Ntve' ? call.functionDef?.id : undefined,
        },
        args: (call.parameters ?? []).map((paramRef) => refToExpression(paramRef, ctx)),
        native: moduleId === 'Ntve',
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
}
function refToExpression(ref, ctx) {
    const element = resolveElement(ctx, ref);
    if (!element) {
        return {
            kind: 'EngineIdentifierExpression',
            name: ref.id,
            source: sourceRef(ctx, ref.id, ref.type),
        };
    }
    if (element.type === 'Param')
        return paramToExpression(element, ctx);
    if (element.type === 'FunctionCall')
        return functionCallToExpression(element, ctx);
    if (element.type === 'Variable') {
        return {
            kind: 'EngineVariableRefExpression',
            variableId: element.id,
            moduleId: ref.library ?? ctx.library.id,
            source: sourceRef(ctx, element.id, 'Variable'),
        };
    }
    if (element.type === 'PresetValue') {
        return literalExpression(parseLiteral(element.value ?? element.name ?? element.id), sourceRef(ctx, element.id, 'PresetValue'));
    }
    return {
        kind: 'EngineIdentifierExpression',
        name: element.name ?? element.id,
        source: sourceRef(ctx, element.id, element.type),
    };
}
function paramToExpression(param, ctx) {
    let expr;
    if (param.functionCall) {
        expr = refToExpression(param.functionCall, ctx);
    }
    else if (param.variable) {
        expr = {
            kind: 'EngineVariableRefExpression',
            variableId: param.variable.id,
            moduleId: param.variable.library ?? ctx.library.id,
            source: sourceRef(ctx, param.id, 'Param'),
        };
    }
    else if (param.paramRef) {
        expr = {
            kind: 'EngineParameterRefExpression',
            parameterId: param.paramRef.id,
            source: sourceRef(ctx, param.id, 'Param'),
        };
    }
    else if (param.preset || param.valueElement) {
        const target = param.preset ?? param.valueElement;
        expr = target ? refToExpression(target, ctx) : literalExpression(null);
    }
    else {
        expr = literalExpression(parseLiteral(param.value), sourceRef(ctx, param.id, 'Param'), typeRef(param.valueType));
    }
    const indexes = Array.isArray(param.array) ? param.array : param.array ? [param.array] : [];
    for (const index of indexes) {
        expr = {
            kind: 'EngineElementAccessExpression',
            object: expr,
            index: refToExpression(index, ctx),
            source: sourceRef(ctx, param.id, 'Param'),
        };
    }
    if (param.structMember) {
        const member = resolveElement(ctx, param.structMember);
        expr = {
            kind: 'EngineMemberExpression',
            object: expr,
            member: member?.name ?? param.structMember.id,
            source: sourceRef(ctx, param.id, 'Param'),
        };
    }
    return expr;
}
// ── Utilities ────────────────────────────────────────────────────────────────
function rawRefStatement(ref, ctx) {
    return [{
            kind: 'EngineRawStatement',
            language: 'triggers',
            code: JSON.stringify(ref),
            source: sourceRef(ctx, ref.id, ref.type),
        }];
}
function typeRef(type) {
    return {
        name: type?.type ?? 'void',
        gameType: type?.gameType,
        elementId: type?.typeElement?.id,
        moduleId: type?.typeElement?.library,
    };
}
function literalExpression(value, source, valueType) {
    return { kind: 'EngineLiteralExpression', value, valueType, source };
}
function parseLiteral(value) {
    if (value == null)
        return null;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    if (value === 'null')
        return null;
    if (/^-?\d+(?:\.\d+)?$/.test(value))
        return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}
/**
 * Resolves an element reference, searching own library first, then nativeLibraries.
 */
function resolveElement(ctx, ref, expectedType) {
    const libId = ref.library;
    // Own library
    if (!libId || libId === ctx.library.id) {
        return lookupInLibrary(ctx.library, ref, expectedType);
    }
    // Native dependencies
    const dep = ctx.nativeLibMap.get(libId);
    if (dep)
        return lookupInLibrary(dep, ref, expectedType);
    return undefined;
}
function lookupInLibrary(lib, ref, expectedType) {
    if (expectedType) {
        return lib.elementsByType[expectedType]?.[ref.id];
    }
    if (ref.type) {
        const byType = lib.elementsByType[ref.type]?.[ref.id];
        if (byType)
            return byType;
    }
    return lib.elements[`${ref.type}:${ref.id}`] ?? lib.elements[ref.id];
}
function sourceRef(ctx, elementId, elementType) {
    return {
        format: 'triggers',
        fileName: ctx.fileName,
        moduleId: ctx.library.id,
        elementId,
        elementType,
    };
}
// ── Control-flow lowering ────────────────────────────────────────────────────
/**
 * Returns the role name for a sub-block FunctionCall (e.g. 'If', 'Then', 'Actions').
 * Looks up ctx.subfuncRoles which was built from nativeLibraries[i].subFuncTypeNames.
 */
function subFuncRoleName(block, ctx) {
    const sfType = block.subFunctionType;
    if (!sfType)
        return '';
    // Key format in subFuncTypeNames: "{LibId}_{ElemId}"
    const key = sfType.library ? `${sfType.library}_${sfType.id}` : sfType.id;
    return ctx.subfuncRoles.get(key) ?? ctx.subfuncRoles.get(sfType.id) ?? '';
}
/**
 * Groups the sub-blocks of a FunctionCall by role name.
 */
function resolveSubBlocksByRole(call, ctx) {
    const result = new Map();
    for (const ref of call.subFunctions ?? []) {
        const block = resolveElement(ctx, ref, 'FunctionCall');
        if (block?.type !== 'FunctionCall')
            continue;
        const role = subFuncRoleName(block, ctx);
        if (role)
            result.set(role, block);
    }
    return result;
}
/**
 * AND-folds a list of condition expressions into a single expression.
 */
function combineConditions(conditions) {
    if (conditions.length === 0)
        return { kind: 'EngineLiteralExpression', value: true };
    return conditions.reduce((acc, expr) => ({
        kind: 'EngineBinaryExpression',
        operator: '&&',
        left: acc,
        right: expr,
    }));
}
function condBlockToExpressions(block, ctx) {
    return (block?.subFunctions ?? [])
        .map(ref => functionCallExpressionFromRef(ref, ctx))
        .filter((e) => Boolean(e));
}
/**
 * Dispatcher: resolves the FunctionDef name and switches directly on it.
 * No hardcoded element IDs — dispatch is by stable function name from TriggerStrings.
 */
function tryLowerControlFlow(call, ctx) {
    if (!call.functionDef)
        return undefined;
    const funcDef = resolveElement(ctx, call.functionDef, 'FunctionDef');
    switch (funcDef?.name) {
        case 'IfThenElse': return lowerIfThenElse(call, ctx);
        case 'While': return lowerWhile(call, ctx);
        case 'Repeat': return lowerRepeat(call, ctx);
        case 'RepeatForever': return lowerRepeatForever(call, ctx);
        case 'ForEachInteger':
        case 'ForEachInteger2': return lowerForEachInt(call, ctx);
        case 'Switch': return lowerSwitch(call, ctx);
        case 'ForEachPlayerInGroup':
        case 'ForEachUnitInGroup':
        case 'ForEachUnitInGroup2': return lowerForEachGroup(call, ctx);
        default: return undefined;
    }
}
// ── IfThenElse ──────────────────────────────────────────────────────────────
function lowerIfThenElse(call, ctx) {
    const blocks = resolveSubBlocksByRole(call, ctx);
    const condition = combineConditions(condBlockToExpressions(blocks.get('If'), ctx));
    const thenStmts = actionRefsToStatements(blocks.get('Then')?.subFunctions ?? [], ctx);
    const elseBlock = blocks.get('Else');
    const elseStmts = elseBlock?.subFunctions?.length
        ? actionRefsToStatements(elseBlock.subFunctions, ctx)
        : undefined;
    return [{
            kind: 'EngineIfStatement',
            condition,
            then: thenStmts,
            else: elseStmts,
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
// ── While ────────────────────────────────────────────────────────────────────
function lowerWhile(call, ctx) {
    const blocks = resolveSubBlocksByRole(call, ctx);
    const condition = combineConditions(condBlockToExpressions(blocks.get('Conditions'), ctx));
    const body = actionRefsToStatements(blocks.get('Actions')?.subFunctions ?? [], ctx);
    return [{
            kind: 'EngineWhileStatement',
            condition,
            body,
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
// ── Repeat ───────────────────────────────────────────────────────────────────
function lowerRepeat(call, ctx) {
    const blocks = resolveSubBlocksByRole(call, ctx);
    const countExpr = call.parameters?.[0]
        ? refToExpression(call.parameters[0], ctx)
        : { kind: 'EngineLiteralExpression', value: 0 };
    // Synthesise: lv__rep_<id> = 1; while (counter <= count) { ...actions; counter += 1 }
    const counterName = `lv__rep_${call.id}`;
    const counterRef = {
        kind: 'EngineVariableRefExpression',
        variableId: counterName,
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    const counterVar = {
        kind: 'EngineVariable',
        id: counterName,
        name: counterName,
        type: { name: 'int' },
        scope: 'local',
        initialValue: { kind: 'EngineLiteralExpression', value: 1 },
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    return [
        { kind: 'EngineVariableStatement', variable: counterVar, source: sourceRef(ctx, call.id, 'FunctionCall') },
        {
            kind: 'EngineWhileStatement',
            condition: { kind: 'EngineBinaryExpression', operator: '<=', left: counterRef, right: countExpr },
            body: [
                ...actionRefsToStatements(blocks.get('Actions')?.subFunctions ?? [], ctx),
                {
                    kind: 'EngineAssignmentStatement',
                    target: counterRef,
                    value: { kind: 'EngineLiteralExpression', value: 1 },
                    operator: '+=',
                    source: sourceRef(ctx, call.id, 'FunctionCall'),
                },
            ],
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        },
    ];
}
// ── RepeatForever ─────────────────────────────────────────────────────────────
function lowerRepeatForever(call, ctx) {
    const blocks = resolveSubBlocksByRole(call, ctx);
    return [{
            kind: 'EngineWhileStatement',
            condition: { kind: 'EngineLiteralExpression', value: true },
            body: actionRefsToStatements(blocks.get('Actions')?.subFunctions ?? [], ctx),
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
// ── Switch ────────────────────────────────────────────────────────────────────
// Sub-blocks inside the Switch's subFunctions list:
//   role "Cases"   → SwitchCase FunctionCall: parameters[0] = match value,
//                    subFunctions = body actions for this case.
//   role "Default" → action FunctionCall that IS part of the default body
//                    (multiple "Default"-tagged blocks = multiple default actions).
function lowerSwitch(call, ctx) {
    const discriminant = call.parameters?.[0]
        ? refToExpression(call.parameters[0], ctx)
        : literalExpression(null);
    const cases = [];
    const defaultStmts = [];
    for (const ref of call.subFunctions ?? []) {
        const block = resolveElement(ctx, ref, 'FunctionCall');
        if (block?.type !== 'FunctionCall')
            continue;
        const role = subFuncRoleName(block, ctx);
        if (role === 'Cases') {
            // SwitchCase: parameters[0] = match value, subFunctions = body actions
            const matchValue = block.parameters?.[0]
                ? refToExpression(block.parameters[0], ctx)
                : literalExpression(null);
            cases.push({ value: matchValue, body: actionRefsToStatements(block.subFunctions ?? [], ctx) });
        }
        else if (role === 'Default') {
            // Default blocks are direct action FunctionCalls, not containers
            defaultStmts.push(...resolvedCallToStatements(block, ctx));
        }
    }
    return [{
            kind: 'EngineSwitchStatement',
            discriminant,
            cases,
            default: defaultStmts.length ? defaultStmts : undefined,
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
/**
 * Converts an already-resolved FunctionCallJson to a list of EngineStatements.
 * Used when we have the call object directly rather than a ref.
 */
function resolvedCallToStatements(call, ctx) {
    if (call.scriptCode) {
        return [{
                kind: 'EngineRawStatement',
                language: 'galaxy',
                code: call.scriptCode,
                source: sourceRef(ctx, call.id, 'FunctionCall'),
            }];
    }
    if (call.subFunctions?.length) {
        const lowered = tryLowerControlFlow(call, ctx);
        if (lowered)
            return lowered;
    }
    return [{
            kind: 'EngineExpressionStatement',
            expression: functionCallToExpression(call, ctx),
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
// ── ForEachPlayerInGroup / ForEachUnitInGroup / ForEachUnitInGroup2 ───────────
// Actual call param order (from data): params[0] = group expr, params[1] = loop var ref.
// Lower to: EngineForEachStatement { variable, iterable = groupExpr, body }.
// The runtime iterates the group value as an array of items.
function lowerForEachGroup(call, ctx) {
    const params = call.parameters ?? [];
    // params[0] = group expression, params[1] = Param whose .variable points to the loop Variable
    const groupExpr = params[0]
        ? refToExpression(params[0], ctx)
        : literalExpression(null);
    // Extract loop variable identity from params[1]
    const varParamEl = params[1] ? resolveElement(ctx, params[1]) : undefined;
    const varRef = varParamEl?.type === 'Param' ? varParamEl.variable : undefined;
    const varElem = varRef ? resolveElement(ctx, varRef, 'Variable') : undefined;
    const loopVar = {
        kind: 'EngineVariable',
        id: varRef?.id ?? `lv__fg_${call.id}`,
        name: varElem?.name ?? varRef?.id ?? `lv__fg_${call.id}`,
        type: { name: 'int' },
        scope: 'local',
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    return [{
            kind: 'EngineForEachStatement',
            variable: loopVar,
            iterable: groupExpr,
            body: actionRefsToStatements(call.subFunctions ?? [], ctx),
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        }];
}
// ── ForEachInteger / ForEachInteger2 ─────────────────────────────────────────
// Ordered params: [start, end, (step for Integer2), loopVarRef]
// Lower to: loopVar = start; while (loopVar <= end) { ...actions; loopVar += step }
function lowerForEachInt(call, ctx) {
    const blocks = resolveSubBlocksByRole(call, ctx);
    const params = call.parameters ?? [];
    const startExpr = params[0]
        ? refToExpression(params[0], ctx)
        : { kind: 'EngineLiteralExpression', value: 1 };
    const endExpr = params[1]
        ? refToExpression(params[1], ctx)
        : { kind: 'EngineLiteralExpression', value: 0 };
    // ForEachInteger2 has 4 params [start, end, step, loopVar]; ForEachInteger has 3 [start, end, loopVar].
    const isInteger2 = params.length >= 4;
    const stepExpr = isInteger2 && params[2]
        ? refToExpression(params[2], ctx)
        : { kind: 'EngineLiteralExpression', value: 1 };
    const counterName = `lv__fei_${call.id}`;
    const counterRef = {
        kind: 'EngineVariableRefExpression',
        variableId: counterName,
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    const counterVar = {
        kind: 'EngineVariable',
        id: counterName,
        name: counterName,
        type: { name: 'int' },
        scope: 'local',
        initialValue: startExpr,
        source: sourceRef(ctx, call.id, 'FunctionCall'),
    };
    return [
        { kind: 'EngineVariableStatement', variable: counterVar, source: sourceRef(ctx, call.id, 'FunctionCall') },
        {
            kind: 'EngineWhileStatement',
            condition: { kind: 'EngineBinaryExpression', operator: '<=', left: counterRef, right: endExpr },
            body: [
                ...actionRefsToStatements(blocks.get('Actions')?.subFunctions ?? [], ctx),
                {
                    kind: 'EngineAssignmentStatement',
                    target: counterRef,
                    value: stepExpr,
                    operator: '+=',
                    source: sourceRef(ctx, call.id, 'FunctionCall'),
                },
            ],
            source: sourceRef(ctx, call.id, 'FunctionCall'),
        },
    ];
}
