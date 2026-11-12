import {exactNumericLiteralShape} from "../../types/exact-numeric-literal-shape.mjs";
import { templateReplayShape } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/template-replay-shape.js";
/** The ScriptCode macro grammar, shared by both directions; no game function IDs or names. */
import { Parser, Printer, SyntaxKind, isAssignmentOperator } from "../../sdk/array-values/modules/galaxy/language-core/index.js";
import { conversionError, lookupElement } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import { mapParameterTypeToGalaxy, isResolvedGalaxyType, STRING_BACKED_TRIGGER_TYPES } from "./types/core.mjs";
export function templateMacros(code) {
    const out = [];
    let quote = false;
    // An action whose whole ScriptCode is one line comment exists to write that comment, and the editor fills its
    // #PARAM: NativeLib's Transmission Comment actions are `// Transmission - #PARAM(sound)`. In any other comment a
    // macro is the author's text.
    const commentOnly = /^\s*\/\/[^\n]*$/u.test(code);
    let commentEnd = -1;
    for (let i = 0; i < code.length; i++) {
        if (i >= commentEnd) {
            if (code[i] === '\\' && quote) {
                i++;
                continue;
            }
            if (code[i] === '"') {
                quote = !quote;
                continue;
            }
            if (quote)
                continue;
            if (code.startsWith('//', i)) {
                const end = code.indexOf('\n', i);
                if (!commentOnly) {
                    i = end < 0 ? code.length : end;
                    continue;
                }
                commentEnd = end < 0 ? code.length : end;
                continue;
            }
            if (code.startsWith('/*', i)) {
                const end = code.indexOf('*/', i + 2);
                i = end < 0 ? code.length : end + 1;
                continue;
            }
        }
        if (code[i] !== '#')
            continue;
        const name = /^[A-Z][A-Z0-9_]*/u.exec(code.slice(i + 1))?.[0];
        if (!name || i < commentEnd && name !== 'PARAM')
            continue;
        let end = i + 1 + name.length;
        const args = [];
        const rawArgs = [];
        if (code[end] === '(') {
            let depth = 1, inString = false, start = ++end;
            for (; end < code.length && depth; end++) {
                const char = code[end];
                if (char === '\\' && inString) {
                    end++;
                    continue;
                }
                if (char === '"')
                    inString = !inString;
                if (inString)
                    continue;
                if (char === '(')
                    depth++;
                if (char === ')')
                    depth--;
                if ((char === ',' && depth === 1) || depth === 0) {
                    rawArgs.push(code.slice(start, end));
                    args.push(code.slice(start, end).trim());
                    start = end + 1;
                }
            }
            if (depth)
                conversionError('TEMPLATE_SYNTAX', 'Unclosed ScriptCode macro', { macro: name });
        }
        out.push({ name, args, rawArgs, start: i, end });
        i = end - 1;
    }
    return out;
}
export function replaceTemplateMacros(code, replace) {
    let output = '', cursor = 0;
    for (const macro of templateMacros(code)) {
        output += code.slice(cursor, macro.start) + replace(macro);
        cursor = macro.end;
    }
    return output + code.slice(cursor);
}
/** The declaration forms understood in both directions of AUTOVAR expansion. */
export function autoVariableTypeSource(macro, code) {
    if (macro.name !== 'AUTOVAR')
        return undefined;
    if (macro.args[1] && macro.args[1] !== 'parent' && !macro.args[1].startsWith('ancestor:'))
        return { type: macro.args[1] };
    const parameter = /^\s*=\s*#PARAM\((\w+)\)/u.exec(code.slice(macro.end))?.[1];
    return parameter ? { parameter } : undefined;
}
export function templateRoles(definition, libraries) {
    const roles = new Map();
    for (const ref of definition.subFunctionTypes ?? []) {
        const typed = { ...ref, type: 'SubFuncType' };
        const element = lookupElement(libraries, typed, definition.library ?? '');
        const library = libraries.find(lib => lib.id === (ref.library || definition.library));
        const name = element?.name ?? library?.subFuncTypeNames?.[`${ref.library}_${ref.id}`];
        if (name)
            roles.set(name, typed);
    }
    return roles;
}
const printer = new Printer();
export function printNode(node) { return printer.printNode(node).trim(); }
/** Match the substitution rules used by the forward converter. */
export function printTemplateExpression(expression) {
    // A parenthesized expression already delimits itself; the editor writes
    // `((a - b) > c)`, never `(((a - b)) > c)`.
    const atomic = [SyntaxKind.Identifier, SyntaxKind.NumericLiteral, SyntaxKind.StringLiteral, SyntaxKind.TrueKeyword,
        SyntaxKind.FalseKeyword, SyntaxKind.NullKeyword, SyntaxKind.CallExpression, SyntaxKind.ElementAccessExpression,
        SyntaxKind.PropertyAccessExpression, SyntaxKind.ParenthesizedExpression].includes(expression.kind);
    const assignment = expression.kind === SyntaxKind.BinaryExpression && [SyntaxKind.EqualsToken, SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken,
        SyntaxKind.AsteriskEqualsToken, SyntaxKind.SlashEqualsToken, SyntaxKind.PercentEqualsToken, SyntaxKind.AmpersandEqualsToken,
        SyntaxKind.BarEqualsToken, SyntaxKind.CaretEqualsToken, SyntaxKind.LessThanLessThanEqualsToken, SyntaxKind.GreaterThanGreaterThanEqualsToken].includes(expression.operatorToken?.kind);
    return atomic || assignment ? printNode(expression) : `(${printNode(expression)})`;
}
function onlyEmptyAfterFirst(statements) {
    return !!statements?.length && statements.slice(1).every(statement => statement?.kind === SyntaxKind.EmptyStatement);
}
export function parseTemplateFragment(source, expression) {
    const wrapper = expression ? `void mkTemplate() { return ${source}; }` : `void mkTemplate() { ${source}\n }`;
    const parsed = new Parser().parseFile('template.galaxy', wrapper);
    if (parsed.parseDiagnostics?.length) {
        if (!expression)
            return undefined;
        // Galaxy permits assignment in statement/for positions, but not in return expressions.
        const assignment = new Parser().parseFile('template.galaxy', `void mkTemplate() { ${source}; }`);
        const statements = assignment.statements[0]?.body?.statements;
        return !assignment.parseDiagnostics?.length && assignment.statements.length === 1 && onlyEmptyAfterFirst(statements) && statements[0]?.kind === SyntaxKind.ExpressionStatement ? [statements[0].expression] : undefined;
    }
    const body = parsed.statements[0]?.body?.statements;
    if (parsed.statements.length !== 1 || !body)
        return undefined;
    // An authored ScriptCode expression may already end in a semicolon, which the
    // expression wrapper turns into a further empty statement. An empty statement
    // carries no behaviour, so read past it instead of editing the source text.
    if (expression && (!onlyEmptyAfterFirst(body) || body[0]?.kind !== SyntaxKind.ReturnStatement || !body[0].expression))
        return undefined;
    return expression ? [body[0]?.expression] : [...body];
}
/** Some editor operators declare ordered operands and an operator Preset instead of ScriptCode. */
export function resolveTemplateDefinition(definition, libraries, actualTypes) {
    if (definition.scriptCode)
        return definition;
    const container = implicitConditionalContainer(definition, libraries);
    if (container)
        return container;
    if (!definition.flags?.includes('Operator'))
        return definition;
    // A native implementation or an authored body can do more than change type.
    if (definition.flags.includes('Native') || definition.actions?.length || definition.localVariables?.length)
        return definition;
    const parameters = (definition.parameters ?? []).map(ref => lookupElement(libraries, ref, definition.library ?? ''));
    if (parameters.length === 1 && parameters[0]?.name && definition.returnType) {
        const library = libraries.find(library => library.id === definition.library);
        if (library) {
            const all = new Map(libraries.map(library => [library.id, library]));
            const formal = parameters[0];
            const sourceType = actualTypes?.get(formal.name) ?? formal.paramType;
            const source = mapParameterTypeToGalaxy(sourceType, library, undefined, all);
            const target = mapParameterTypeToGalaxy(definition.returnType, library, undefined, all);
            // A change of editor type with the same runtime representation is an
            // identity. Do not infer text creation, parsing or narrowing conversions.
            const unresolved = (type) => /^(any|sameas)/u.test(type.type) &&
                !STRING_BACKED_TRIGGER_TYPES.has(type.type) && (!type.variableType || /^(any|sameas)/u.test(type.variableType));
            // Such a definition carries no body, no ScriptCode and no native, so the
            // editor has nothing to emit but the argument. Insist the two Galaxy types
            // agree only where the loaded data actually says what they are; an editor
            // type nothing describes is no evidence of a conversion.
            const compatible = source === target ||
                !isResolvedGalaxyType(sourceType.type, undefined, all) ||
                !isResolvedGalaxyType(definition.returnType.type, undefined, all);
            if (![sourceType, definition.returnType].some(unresolved) &&
                formal.paramType.type !== definition.returnType.type && compatible) {
                return { ...definition, scriptCode: `#PARAM(${formal.name})`, flags: [...definition.flags, 'Template'] };
            }
        }
    }
    if (parameters.length !== 3 || parameters.some(parameter => !parameter?.name))
        return definition;
    const presetRef = parameters[1]?.paramType?.typeElement;
    const preset = lookupElement(libraries, presetRef, definition.library ?? '');
    if (preset?.type !== 'Preset' || !preset.values.length)
        return definition;
    const binaryToken = (ref) => {
        const value = lookupElement(libraries, ref, preset.library ?? definition.library ?? '');
        if (value?.type !== 'PresetValue' || !value.value)
            return false;
        const node = parseTemplateFragment(`leftOperand ${value.value} rightOperand`, true)?.[0];
        return node?.kind === SyntaxKind.BinaryExpression && node.left?.name === 'leftOperand' && node.right?.name === 'rightOperand';
    };
    if (!preset.values.every(binaryToken))
        return definition;
    // The editor parenthesizes such an operator wherever it appears — a condition
    // guard reads `!((a == b))` and an argument reads `BoolToInt((a == b))` — and
    // the shipped binary templates that do carry ScriptCode are written the same
    // way (`(#PARAM(val)," " #PARAM(op) " ")`).
    return {
        ...definition,
        scriptCode: `(${parameters.map(parameter => `#PARAM(${parameter.name})`).join(' ')})`,
        flags: [...definition.flags, 'Template'],
    };
}
/** Infer only a constrained branch chain whose child template proves the join syntax. */
function implicitConditionalContainer(definition, libraries) {
    if (!definition.flags?.includes('Action') || !definition.flags.includes('SubFunctions') ||
        definition.flags.some(flag => ['Native', 'CustomScript', 'Operator'].includes(flag)) ||
        definition.parameters?.length || definition.actions?.length || definition.localVariables?.length ||
        definition.returnType && definition.returnType.type !== 'void' || definition.subFunctionTypes?.length !== 1)
        return undefined;
    const role = lookupElement(libraries, { ...definition.subFunctionTypes[0], type: 'SubFuncType' }, definition.library ?? '');
    if (role?.type !== 'SubFuncType' || !role.isAction || !role.name || !role.functionDef)
        return undefined;
    const child = lookupElement(libraries, role.functionDef, role.library ?? definition.library ?? '');
    if (child?.type !== 'FunctionDef' || !child.scriptCode || child.flags?.includes('CustomScript'))
        return undefined;
    const directives = templateMacros(child.scriptCode).filter(macro => macro.name === 'IFSUBFUNC');
    if (!directives.length || directives.some(macro => macro.args[0] !== 'notfirst'))
        return undefined;
    const variant = (later) => replaceTemplateMacros(child.scriptCode, macro => macro.name === 'IFSUBFUNC'
        ? later ? macro.rawArgs[1] ?? '' : '' : child.scriptCode.slice(macro.start, macro.end));
    const firstCode = variant(false);
    const first = compileTemplate({ ...child, scriptCode: firstCode }, libraries);
    const joined = compileTemplate({ ...child, scriptCode: `${firstCode}\n${variant(true)}` }, libraries);
    if (first?.nodes.length !== 1 || first.nodes[0].kind !== SyntaxKind.IfStatement || first.nodes[0].elseStatement ||
        joined?.nodes.length !== 1 || joined.nodes[0].kind !== SyntaxKind.IfStatement || joined.nodes[0].elseStatement?.kind !== SyntaxKind.IfStatement)
        return undefined;
    return { ...definition, scriptCode: `#SUBFUNCS(${role.name})`, flags: [...definition.flags, 'Template'] };
}
/** Only localized editor labels permit an unambiguous case-folded macro binding. */
export function templateParameters(definition, libraries) {
    const formals = (definition.parameters ?? []).map(ref => ({ ref, parameter: lookupElement(libraries, ref, definition.library ?? '') }));
    const parameters = new Map();
    for (const { ref, parameter } of formals) {
        const name = parameter?.identifier ?? parameter?.name;
        if (!name)
            continue;
        if (parameters.has(name))
            conversionError('TEMPLATE_PARAMETER_AMBIGUOUS', 'Template has duplicate parameter identifiers', { definition: definition.id, name });
        parameters.set(name, ref);
    }
    const names = templateMacros(definition.scriptCode ?? '').flatMap(macro => macro.name === 'PARAM' ? [macro.args[0]] : macro.name === 'INITAUTOVAR' ? [macro.args[1]] : []);
    for (const name of names) {
        if (!name || parameters.has(name))
            continue;
        const candidates = formals.filter(({ parameter }) => parameter && !parameter.identifier && parameter.displayName?.toLowerCase() === name.toLowerCase());
        if (candidates.length > 1)
            conversionError('TEMPLATE_PARAMETER_AMBIGUOUS', 'Localized template parameter binding is ambiguous', { definition: definition.id, name });
        if (candidates.length === 1) {
            const { ref } = candidates[0];
            const existing = [...parameters].find(([, value]) => value === ref)?.[0];
            if (existing && names.includes(existing))
                conversionError('TEMPLATE_PARAMETER_AMBIGUOUS', 'One parameter is referenced through different macro names', { definition: definition.id, name, existing });
            if (existing)
                parameters.delete(existing);
            parameters.set(name, ref);
        }
    }
    return parameters;
}
export function compileTemplate(definition, libraries, fixedParameters = new Map()) {
    const code = definition.scriptCode;
    if (!code || definition.flags?.includes('CustomScript'))
        return undefined;
    // A function's ordinary body is not an inline template: replacing return by
    // a call to a helper with that body, for example, would change control flow.
    if (!definition.flags?.some(flag => ['Template', 'Inline', 'Operator'].includes(flag)) && templateMacros(code).length === 0)
        return undefined;
    const parameters = templateParameters(definition, libraries);
    const roles = templateRoles(definition, libraries);
    const holes = new Map();
    let supported = true;
    const expression = !!definition.isFuncCall || (!!definition.returnType && definition.returnType.type !== 'void' && !definition.isFuncAction);
    const expanded = replaceTemplateMacros(code, macro => {
        const name = macro.args[0] ?? '';
        const key = `mkTemplate_${macro.name}_${name}`;
        if (macro.name === 'PARAM' && parameters.has(name)) {
            const preset = fixedParameters.get(name);
            if (preset)
                return String(lookupElement(libraries, preset, definition.library ?? '')?.value ?? '');
            holes.set(key, { kind: 'parameter', name });
            return key;
        }
        if (macro.name === 'SUBFUNCS' && roles.has(name)) {
            let separator;
            if (macro.args[1] !== undefined) {
                try {
                    separator = JSON.parse(macro.args[1]);
                }
                catch {
                    supported = false;
                }
                if (typeof separator !== 'string')
                    supported = false;
            }
            holes.set(key, { kind: 'block', name, separator, join: separator === undefined ? undefined : separatorShape(separator) });
            return expression || separator !== undefined ? key : /^\s*;/u.test(code.slice(macro.end)) ? `${key}()` : `${key}();`;
        }
        if (macro.name === 'AUTOVAR') {
            holes.set(key, { kind: 'auto', name });
            return key;
        }
        if (macro.name === 'DEFRETURN') {
            holes.set(key, { kind: 'return', name: '' });
            return key;
        }
        if (macro.name === 'SMARTBREAK')
            return 'break;';
        if (macro.name === 'SMARTCONTINUE')
            return 'continue;';
        supported = false;
        return key;
    });
    if (!supported)
        return undefined;
    const nodes = parseTemplateFragment(expanded, expression);
    return nodes?.every(Boolean) ? { definition, expression, nodes, holes, parameters, roles, fixedParameters } : undefined;
}
/** Derive operator/list syntax from the loaded separator, not a named action. */
function separatorShape(separator) {
    const isMarker = (node, name) => node?.kind === SyntaxKind.Identifier && node.name === name;
    const expression = parseTemplateFragment(`mkLeft${separator}mkRight`, true)?.[0];
    if (expression?.kind === SyntaxKind.BinaryExpression && isMarker(expression.left, 'mkLeft') && isMarker(expression.right, 'mkRight')) {
        return { kind: 'binary', operator: expression.operatorToken.kind };
    }
    const call = parseTemplateFragment(`mkCall(mkLeft${separator}mkRight)`, true)?.[0];
    if (call?.kind === SyntaxKind.CallExpression && isMarker(call.expression, 'mkCall') && call.arguments.length === 2 &&
        isMarker(call.arguments[0], 'mkLeft') && isMarker(call.arguments[1], 'mkRight'))
        return { kind: 'arguments' };
    return undefined;
}
/** `#IFHAVESUBFUNCS(role, text)` emits `text` only when that role actually
 *  holds subfunctions, so one definition describes two shapes: with the section
 *  and without it. Both have to be matchable — otherwise the macro is simply
 *  unsupported, the native definition never compiles, and every `if` in every
 *  document falls through to a synthesized template. A section that is absent
 *  takes its own subfunction slot with it. */
function conditionalSectionVariants(definition) {
    const code = definition.scriptCode;
    if (!code)
        return [definition];
    const roles = [...new Set(templateMacros(code).filter(macro => macro.name === 'IFHAVESUBFUNCS').map(macro => macro.args[0] ?? ''))];
    if (!roles.length || roles.length > 4)
        return [definition];
    let shapes = [new Set()];
    for (const role of roles)
        shapes = shapes.flatMap(shape => [shape, new Set([...shape, role])]);
    return shapes.map(present => ({
        ...definition,
        scriptCode: replaceTemplateMacros(code, macro => {
            const name = macro.args[0] ?? '';
            if (macro.name === 'IFHAVESUBFUNCS')
                return present.has(name) ? macro.rawArgs[1] ?? '' : '';
            if (macro.name === 'SUBFUNCS' && roles.includes(name) && !present.has(name))
                return '';
            return code.slice(macro.start, macro.end);
        }),
    }));
}
/** `#INITAUTOVAR(auto, parameter)` assigns the parameter to the auto variable in
 *  place, except that the editor promotes an intrinsically constant input to a
 *  const auto declaration and omits the assignment (see ttg-template.ts). Both
 *  shapes have to be matchable; as an unsupported macro it kept Repeat, Switch and
 *  the integer loops from compiling at all. */
function initializedAutoVariants(definition) {
    const code = definition.scriptCode;
    const initializers = code ? templateMacros(code).filter(macro => macro.name === 'INITAUTOVAR') : [];
    if (!initializers.length || initializers.length > 4)
        return [{ definition, promoted: new Map() }];
    let shapes = [new Map()];
    for (const macro of initializers)
        shapes = shapes.flatMap(shape => [shape, new Map([...shape, [macro.args[0], macro.args[1]]])]);
    return shapes.map(promoted => ({
        promoted,
        definition: { ...definition, scriptCode: replaceTemplateMacros(code, macro => macro.name !== 'INITAUTOVAR' ? code.slice(macro.start, macro.end)
                : promoted.has(macro.args[0]) ? '' : `#AUTOVAR(${macro.args[0]}) = #PARAM(${macro.args[1]});`) },
    }));
}
/** Operator slots are syntax tokens supplied by Preset definitions, not guessed by parameter names. */
export function compileTemplateVariants(definition, libraries) {
    definition = resolveTemplateDefinition(definition, libraries);
    const direct = conditionalSectionVariants(definition)
        .flatMap(initializedAutoVariants)
        .map(({ definition: shape, promoted }) => {
        const template = compileTemplate(shape, libraries);
        return template && promoted.size ? { ...template, promotedAutos: promoted } : template;
    })
        .filter((template) => !!template);
    if (direct.length)
        return direct;
    let variants = [new Map()];
    for (const ref of definition.parameters ?? []) {
        const parameter = lookupElement(libraries, ref, definition.library ?? '');
        const preset = parameter?.paramType?.typeElement && lookupElement(libraries, parameter.paramType.typeElement, definition.library ?? '');
        if (!parameter?.name || preset?.type !== 'Preset' || !preset.values?.length)
            continue;
        const values = preset.values.filter(value => lookupElement(libraries, value, preset.library ?? '')?.value !== undefined);
        if (!values.length)
            continue;
        if (variants.length * values.length > 256)
            return [];
        variants = variants.flatMap(variant => values.map(value => new Map([...variant, [parameter.name, value]])));
    }
    return variants.filter(variant => variant.size > 0).map(variant => compileTemplate(definition, libraries, variant)).filter((template) => !!template);
}
const semanticKeys = [
    'kind', 'name', 'type', 'modifiers', 'statements', 'parameters', 'initializer', 'expression',
    'arguments', 'left', 'right', 'operatorToken', 'operator', 'operand', 'thenStatement',
    'elseStatement', 'statement', 'condition', 'incrementor', 'body', 'properties', 'members',
    'argumentExpression', 'typeArguments', 'size', 'elementType', 'returnType',
];
/** Traverse syntax without following parser parent links or source metadata. */
export function syntaxChildren(node) {
    if (!node || typeof node !== 'object')
        return [];
    if (Array.isArray(node))
        return node;
    return semanticKeys.map(key => node[key]).filter(child => child && typeof child === 'object');
}
/** Return the required template ancestor only for a pure contextual accessor.
 * A ScriptCode body containing anything besides the AUTOVAR macro is an
 * operation, not an alias, and must not participate in legacy pairing. */
export function contextualAutoAncestor(definition) {
    const code = definition.scriptCode ?? '';
    const macros = templateMacros(code);
    if (macros.length !== 1 || macros[0].name !== 'AUTOVAR')
        return undefined;
    const scope = macros[0].args[1];
    if (!scope?.startsWith('ancestor:'))
        return undefined;
    if (`${code.slice(0, macros[0].start)}${code.slice(macros[0].end)}`.trim() !== '')
        return undefined;
    return scope.slice('ancestor:'.length);
}
const autoAccessorIndexes = new WeakMap();
/** Accessors such as UnitGroupLoopCurrent = #AUTOVAR(var,ancestor:PickEachUnitInGroup), keyed `action:auto`. */
function autoAccessorIndex(library) {
    let index = autoAccessorIndexes.get(library);
    if (!index) {
        index = new Map();
        for (const definition of Object.values(library.elementsByType?.FunctionDef ?? {})) {
            const ancestor = contextualAutoAncestor(definition);
            if (ancestor !== undefined)
                index.set(`${ancestor}:${templateMacros(definition.scriptCode)[0].args[0]}`, definition);
        }
        autoAccessorIndexes.set(library, index);
    }
    return index;
}
/** The editor expands an accessor into the auto variable of its nearest ancestor
 * action, so inside a matched action that variable reads back as the accessor
 * call. Resolved as a local instead, the body kept reading a variable that the
 * regenerated loop never assigns (111 loop bodies of a restored Star Party v).
 * An inner action of the same name shadows the outer one; a block that writes
 * the variable keeps it a variable. */
export function templateAutoAccessors(action, bindings, libraries, outer) {
    const accessors = new Map([...(outer ?? [])].filter(([, accessor]) => contextualAutoAncestor(accessor) !== action));
    const blocks = [...bindings.blocks.values()].flat();
    for (const [auto, identifier] of bindings.autos) {
        const accessor = libraries.map(library => autoAccessorIndex(library).get(`${action}:${auto}`)).find(Boolean);
        if (accessor && identifier?.kind === SyntaxKind.Identifier && !writesIdentifier(blocks, identifier.name))
            accessors.set(identifier.name, accessor);
    }
    return accessors;
}
function writesIdentifier(nodes, name) {
    const pending = [...nodes];
    while (pending.length) {
        const node = pending.pop();
        const target = node?.kind === SyntaxKind.BinaryExpression && isAssignmentOperator(node.operatorToken?.kind) ? node.left
            : [SyntaxKind.PlusPlusToken, SyntaxKind.MinusMinusToken].includes(node?.operator?.kind) ? node.operand : undefined;
        if (target?.kind === SyntaxKind.Identifier && target.name === name)
            return true;
        pending.push(...syntaxChildren(node));
    }
    return false;
}
function unwrap(node) {
    while (node?.kind === SyntaxKind.ParenthesizedExpression)
        node = node.expression;
    return node;
}
// Shaping is the dominant cost of template matching, but memoising it against
// the node measured slower on a large library than rebuilding: the map
// operations on millions of nodes cost more than the small object they save.
// What is kept is the allocation the old form made for nothing — a filter array,
// a map array and two closures per node.
export function syntaxShape(node) {
    node = unwrap(node);
    if (node === undefined || node === null || typeof node !== 'object')
        return node;
    if (Array.isArray(node))
        return node.map(syntaxShape);
    if (node.kind === SyntaxKind.StringLiteral)
        return { kind: node.kind, value: node.value };
    if (node.kind === SyntaxKind.NumericLiteral) {
        return exactNumericLiteralShape(node);
    }
    const shape = {};
    for (const key of semanticKeys)
        if (node[key] !== undefined)
            shape[key] = syntaxShape(node[key]);
    return shape;
}
/** Canonical text of a node's syntax; equal text means equal syntax. */
export function shapeText(node) {
    return JSON.stringify(syntaxShape(node));
}
/** Matches syntax, not whitespace, source positions or human-facing function names. */
function matchTemplateNodes(template, nodes, defaultReturn, prefix) {
    const bindings = { parameters: new Map(), blocks: new Map(), autos: new Map() };
    // Ambiguous captures must remain bounded. Exhaustion only declines this
    // high-level match; syntax-directed conversion still preserves the input.
    let budget = 10000;
    const bind = (map, key, value) => {
        if (map.has(key))
            return shapeText(map.get(key)) === shapeText(value);
        map.set(key, value);
        return true;
    };
    const snapshot = () => ({ parameters: new Map(bindings.parameters), blocks: new Map(bindings.blocks), autos: new Map(bindings.autos) });
    const restore = (saved) => Object.assign(bindings, saved);
    const sequenceHole = (pattern) => {
        const expression = pattern?.kind === SyntaxKind.ExpressionStatement ? pattern.expression : undefined;
        const marker = expression?.kind === SyntaxKind.CallExpression && expression.arguments.length === 0 ? expression.expression : pattern;
        const hole = marker?.kind === SyntaxKind.Identifier ? template.holes.get(marker.name) : undefined;
        return hole?.kind === 'block' && (expression ? hole.separator === undefined : hole.join?.kind === 'arguments') ? hole : undefined;
    };
    const matchSequence = (patterns, values, allowTrailing = false, pi = 0, vi = 0) => {
        if (--budget < 0)
            return undefined;
        if (pi === patterns.length)
            return allowTrailing || vi === values.length ? vi : undefined;
        const hole = sequenceHole(patterns[pi]);
        if (hole) {
            // A terminal unconstrained body has no recoverable boundary in a prefix.
            if (allowTrailing && pi === patterns.length - 1)
                return undefined;
            const minimumSuffix = patterns.slice(pi + 1).filter(node => !sequenceHole(node)).length;
            for (let end = vi; end <= values.length - minimumSuffix && budget >= 0; end++) {
                const saved = snapshot();
                if (bind(bindings.blocks, hole.name, values.slice(vi, end))) {
                    const consumed = matchSequence(patterns, values, allowTrailing, pi + 1, end);
                    if (consumed !== undefined)
                        return consumed;
                }
                restore(saved);
            }
            return undefined;
        }
        if (vi >= values.length || !match(patterns[pi], values[vi]))
            return undefined;
        return matchSequence(patterns, values, allowTrailing, pi + 1, vi + 1);
    };
    const match = (pattern, value) => {
        if (--budget < 0)
            return false;
        pattern = unwrap(pattern);
        value = unwrap(value);
        const hole = pattern?.kind === SyntaxKind.Identifier ? template.holes.get(pattern.name) : undefined;
        if (hole) {
            if (!value)
                return false;
            if (hole.kind === 'parameter')
                return bind(bindings.parameters, hole.name, value);
            if (hole.kind === 'auto')
                return value.kind === SyntaxKind.Identifier && bind(bindings.autos, hole.name, value);
            if (hole.kind === 'return')
                return defaultReturn !== undefined && shapeText(defaultReturn) === shapeText(value);
            if (hole.kind === 'block') {
                if (hole.separator !== undefined && !hole.join)
                    return false;
                const children = [];
                if (hole.join?.kind === 'binary') {
                    // Follow only the left branch. Flattening the right branch would
                    // change a - (b - c), floating-point grouping and evaluation order.
                    let left = value;
                    while (left?.kind === SyntaxKind.BinaryExpression && left.operatorToken.kind === hole.join.operator) {
                        if (--budget < 0)
                            return false;
                        children.unshift(left.right);
                        left = unwrap(left.left);
                    }
                    children.unshift(left);
                }
                else
                    children.push(value);
                return bind(bindings.blocks, hole.name, children);
            }
        }
        if (pattern?.kind === SyntaxKind.Block) {
            const items = pattern.statements ?? [];
            if (items.length === 1) {
                const marker = items[0]?.expression?.expression?.name;
                const block = template.holes.get(marker);
                if (block?.kind === 'block')
                    return bind(bindings.blocks, block.name, value?.kind === SyntaxKind.Block ? [...value.statements] : value ? [value] : []);
            }
        }
        if (Array.isArray(pattern))
            return Array.isArray(value) && matchSequence(pattern, value) !== undefined;
        if (!pattern || typeof pattern !== 'object')
            return pattern === value;
        if (!value || pattern.kind !== value.kind)
            return false;
        if (pattern.kind === SyntaxKind.NumericLiteral || pattern.kind === SyntaxKind.StringLiteral)
            return shapeText(pattern) === shapeText(value);
        return semanticKeys.filter(key => pattern[key] !== undefined || value[key] !== undefined).every(key => match(pattern[key], value[key]));
    };
    const consumed = matchSequence(template.nodes, nodes, prefix);
    return consumed !== undefined ? { bindings, consumed } : undefined;
}
export function matchTemplate(template, nodes, defaultReturn) {
    return matchTemplateNodes(template, nodes, defaultReturn, false)?.bindings;
}
export function matchTemplatePrefix(template, nodes, defaultReturn) {
    return matchTemplateNodes(template, nodes, defaultReturn, true);
}
/** A capture of the entire input would re-enter the same conversion forever. */
export function templateMakesProgress(nodes, bindings) {
    const whole = shapeText(nodes);
    return ![...bindings.parameters.values()].some(value => shapeText([value]) === whole) &&
        ![...bindings.blocks.values()].some(values => shapeText(values) === whole);
}
/** Prove the loaded macro text recreates the matched tree before building refs. */
export function templateBindingMatches(template, nodes, bindings, libraries, defaultReturn) {
    let supported = true;
    const source = replaceTemplateMacros(template.definition.scriptCode ?? '', macro => {
        const name = macro.args[0] ?? '';
        if (macro.name === 'PARAM') {
            const preset = template.fixedParameters?.get(name);
            if (preset)
                return String(lookupElement(libraries, preset, template.definition.library ?? '')?.value ?? '');
            const value = bindings.parameters.get(name);
            if (value)
                return printTemplateExpression(value);
        }
        if (macro.name === 'SUBFUNCS') {
            const children = bindings.blocks.get(name) ?? [];
            if (macro.args[1] === undefined)
                return children.map(printNode).join('\n');
            const separator = [...template.holes.values()].find(hole => hole.kind === 'block' && hole.name === name)?.separator;
            if (separator !== undefined)
                return children.map(child => `(${printNode(child)})`).join(separator);
        }
        if (macro.name === 'AUTOVAR') {
            const value = bindings.autos.get(name);
            if (value)
                return printNode(value);
        }
        if (macro.name === 'DEFRETURN')
            return defaultReturn ? printNode(defaultReturn) : '';
        if (macro.name === 'SMARTBREAK')
            return 'break;';
        if (macro.name === 'SMARTCONTINUE')
            return 'continue;';
        supported = false;
        return '';
    });
    if (!supported)
        return false;
    const expanded = parseTemplateFragment(source, template.expression);
    return !!expanded && JSON.stringify(templateReplayShape(expanded, syntaxShape)) === JSON.stringify(templateReplayShape(nodes, syntaxShape));
}
