import { conversionError, refKey } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { createBlock } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';
/**
 * ttg-actions — action and control-flow conversion for trigger→Galaxy.
 *
 * Converts every action FunctionCallJson into one or more Galaxy Statements.
 * Control flow is interpreted from loaded ScriptCode. Legacy exported names
 * below are compatibility adapters to that same path, not dispatch rules:
 *   - IfThenElse, WhileDo, Repeat, RepeatForever
 *   - WaitForCondition, WaitForConditionWithMaximumDuration
 *   - PickEachInteger, ForEachInteger (and deprecated variants)
 *   - PickEachPlayerInGroup, PickEachUnitInGroup
 *   - Switch, ActionQueueAdd
 *   - SetVariable, IncrementInteger (via scriptCode template expansion)
 *   - SkipRemaining / StopLooping / Continue (return true / break / continue)
 *
 * Loop constructs emit auto-variable helpers (autoXXX_var, autoXXX_ae, etc.)
 * hoisted to the enclosing function top via ctx.autoVarDeclarations.
 *
 * Depends on: ttg-core, ttg-convert (convertFunctionCallExpr).
 * Consumed by: trigger-to-galaxy.
 */
import { resolveTemplateDefinition } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/e61ec7b358d47fee-script-template.mjs';
import { emitScriptTemplate, isInlineTemplate } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/efb973f0dceafd0e-ttg-template.mjs';
import { createBinaryExpression, createBreakStatement, createCallExpression, createContinueStatement, createElementAccessExpression, createExpressionStatement, createIdentifier, createNumericLiteral, createParenthesizedExpression, createReturnStatement, createStringLiteral } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';
import { resolveRefFull } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/types/39006703de6e-core.mjs';
import { convertFunctionCallExpr } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/06d265dee5c4224c-ttg-convert.mjs';
function expressionContainsInvalidIdentifier(expr) {
    if (!expr)
        return false;
    const node = expr;
    if (node.kind === 113 /* SyntaxKind.Identifier */) {
        return !/^(?:[A-Za-z_]\w*|true|false|null)$/.test(String(node.name ?? ''));
    }
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent' || key === 'syntaxTokens')
            continue;
        if (!value || typeof value !== 'object')
            continue;
        if (Array.isArray(value)) {
            if (value.some(item => item && typeof item === 'object' && expressionContainsInvalidIdentifier(item))) {
                return true;
            }
            continue;
        }
        if (expressionContainsInvalidIdentifier(value))
            return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Sub-block helpers
// ---------------------------------------------------------------------------
export function collectActionStatements(calls, ctx) {
    const stmts = [];
    for (const call of calls) {
        const result = convertAction(call, ctx);
        if (result !== undefined) {
            if (Array.isArray(result))
                stmts.push(...result);
            else
                stmts.push(result);
        }
    }
    return stmts;
}
export function collectConditionExpr(calls, ctx) {
    if (calls.length === 0)
        return createIdentifier('true');
    const exprs = calls.map(c => convertFunctionCallExpr(c, ctx)).filter(Boolean);
    if (exprs.length === 0)
        return createIdentifier('true');
    if (exprs.length === 1)
        return exprs[0];
    return exprs.reduce((a, b) => createBinaryExpression(a, 34 /* SyntaxKind.AmpersandAmpersandToken */, b));
}
// ---------------------------------------------------------------------------
// Script code action converter
// ---------------------------------------------------------------------------
export function convertScriptCodeAction(call, funcDef, ctx) {
    const result = emitScriptTemplate(call, funcDef, ctx, false);
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
// ---------------------------------------------------------------------------
// Action conversion
// ---------------------------------------------------------------------------
export function convertAction(call, ctx) {
    if (call.disabled)
        return [];
    if (call.type === 'Comment') {
        const text = call.comment ?? call.name ?? '';
        return text ? registerRawScriptReplacement(text.trim().split(/\r?\n/u).map(line => `// ${line.trim()}`).join('\n'), ctx) : [];
    }
    let funcDef = resolveRefFull(call.functionDef, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
    // Some editor actions only register resources for the compile/preload pass.
    // They are structurally identified by a bodiless SubFunctions definition
    // with no child role and exclusively ParamFlagPreload inputs. The editor does
    // not emit a runtime call for these elements (for example bank/sound preload).
    if (funcDef?.flags?.includes('SubFunctions') && !funcDef.scriptCode &&
        !(funcDef.subFunctionTypes?.length) && funcDef.parameters.length > 0 &&
        funcDef.parameters.every(ref => {
            const parameter = resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
            return parameter?.type === 'ParamDef' && parameter.isPreload === true;
        }))
        return [];
    // Initialize before template conversion so shallow child contexts share the
    // same queue instead of creating an unreachable queue of their own.
    const expressionPrelude = ctx.expressionPrelude ??= [];
    const preludeStart = expressionPrelude.length;
    if (funcDef && !funcDef.scriptCode) {
        const libraries = new Map(ctx.allLibraries);
        libraries.set(ctx.library.id, ctx.library);
        if (ctx.nativeLibrary)
            libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
        funcDef = resolveTemplateDefinition(funcDef, [...libraries.values()]);
    }
    ctx.trace?.('action:convert:start', {
        id: call.id,
        functionDef: call.functionDef?.id,
        functionName: funcDef?.name,
        params: call.parameters?.length ?? 0,
        subFunctions: call.subFunctions?.length ?? 0,
    });
    const finish = (result, path) => {
        ctx.trace?.('action:convert:end', {
            id: call.id,
            functionName: funcDef?.name,
            path,
            statements: Array.isArray(result) ? result.length : result ? 1 : 0,
        });
        const prelude = expressionPrelude.splice(preludeStart);
        if (prelude.length === 0)
            return result;
        if (Array.isArray(result))
            return [...prelude, ...result];
        return result ? [...prelude, result] : prelude;
    };
    const roles = (funcDef?.subFunctionTypes ?? []).map(ref => resolveRefFull({ ...ref, type: 'SubFuncType' }, ctx.library, ctx.nativeLibrary, ctx.allLibraries));
    if (!funcDef?.scriptCode && roles.length && roles.every(role => role?.type === 'SubFuncType' && role.isEvent)) {
        if (!ctx.eventRegistrationTarget)
            conversionError('EVENT_CONTEXT', 'Event container requires a registration target', { call: refKey(call) });
        return finish((call.subFunctions ?? []).flatMap(ref => {
            const child = resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
            if (child?.disabled)
                return [];
            if (child?.type === 'Comment')
                return convertAction(child, ctx) ?? [];
            if (child?.type !== 'FunctionCall')
                return conversionError('EVENT_CHILD', 'Event container child is not a call', { call: refKey(call), child: ref });
            const definition = resolveRefFull(child.functionDef, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
            if (definition?.type !== 'FunctionDef' || !definition.flags?.includes('Event'))
                return conversionError('EVENT_CHILD', 'Event role requires an event definition', { call: refKey(child) });
            const childRole = child.subFunctionType;
            if (childRole && !roles.some(role => role && refKey(role, funcDef?.library) === refKey({ ...childRole, type: 'SubFuncType' }, child.library)))
                conversionError('EVENT_ROLE', 'Event child does not belong to a declared role', { call: refKey(child) });
            const expression = convertFunctionCallExpr(child, ctx);
            return expression ? [createExpressionStatement(expression)] : [];
        }), 'eventContainer');
    }
    if (funcDef && isInlineTemplate(funcDef))
        return finish(emitScriptTemplate(call, funcDef, ctx, false), 'inlineTemplate');
    const executableSubFunctions = (call.subFunctions ?? []).filter(ref => {
        const child = resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
        return child && !child.disabled && child.type !== 'Comment';
    });
    // The editor may attach parameter/help comments to an ordinary user-call as
    // FunctionCall children. They are layout metadata and do not make the call a
    // control-flow template; the generated editor Galaxy emits only the call.
    if (executableSubFunctions.length > 0)
        conversionError('UNSUPPORTED_TEMPLATE', 'A subfunction tree needs a loaded ScriptCode template', { call: refKey(call) });
    // customscriptaction (FlagCustomScript): emit the raw inline Galaxy code verbatim.
    if (funcDef?.flags?.includes('CustomScript') && call.scriptCode) {
        if (isComplexRawScript(call.scriptCode)) {
            return finish(registerRawScriptReplacement(call.scriptCode, ctx), 'rawScriptReplacement');
        }
        const stmts = parseRawScriptCode(call.scriptCode);
        if (stmts && stmts.length > 0)
            return finish(stmts, 'rawScriptParsed');
        return finish(registerRawScriptReplacement(call.scriptCode, ctx), 'rawScriptReplacement');
    }
    const expressionCall = executableSubFunctions.length === 0 && (call.subFunctions?.length ?? 0) > 0
        ? { ...call, subFunctions: [] }
        : call;
    const expr = convertFunctionCallExpr(expressionCall, ctx);
    if (!expr)
        return finish(undefined, 'unresolvedExpression');
    if (expressionContainsInvalidIdentifier(expr))
        return finish(undefined, 'invalidExpression');
    return finish(createExpressionStatement(expr), 'functionCallExpression');
}
export const RAW_SCRIPT_PLACEHOLDER = '__mx_raw_script';
/** Replace a bare return in raw Galaxy while leaving strings and comments
 * byte-for-byte intact.  This is needed when an editor template containing
 * comments is preserved as raw text inside a generated bool trigger callback. */
function returnTrueForBareReturns(code) {
    let out = '';
    let i = 0;
    while (i < code.length) {
        const ch = code[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            const start = i++;
            while (i < code.length) {
                if (code[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (code[i++] === quote)
                    break;
            }
            out += code.slice(start, i);
            continue;
        }
        if (ch === '/' && code[i + 1] === '/') {
            const start = i;
            i += 2;
            while (i < code.length && code[i] !== '\n' && code[i] !== '\r')
                i++;
            out += code.slice(start, i);
            continue;
        }
        if (ch === '/' && code[i + 1] === '*') {
            const start = i;
            i += 2;
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/'))
                i++;
            i = Math.min(code.length, i + 2);
            out += code.slice(start, i);
            continue;
        }
        if (/[A-Za-z_]/u.test(ch)) {
            const start = i++;
            while (i < code.length && /[A-Za-z0-9_]/u.test(code[i]))
                i++;
            const word = code.slice(start, i);
            if (word === 'return') {
                let j = i;
                while (j < code.length) {
                    if (/\s/u.test(code[j])) {
                        j++;
                        continue;
                    }
                    if (code[j] === '/' && code[j + 1] === '/') {
                        j += 2;
                        while (j < code.length && code[j] !== '\n' && code[j] !== '\r')
                            j++;
                        continue;
                    }
                    if (code[j] === '/' && code[j + 1] === '*') {
                        j += 2;
                        while (j < code.length && !(code[j] === '*' && code[j + 1] === '/'))
                            j++;
                        j = Math.min(code.length, j + 2);
                        continue;
                    }
                    break;
                }
                if (code[j] === ';') {
                    const trivia = code.slice(i, j);
                    out += word + (trivia || ' ') + 'true';
                    i = j;
                    continue;
                }
            }
            out += word;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}
function isComplexRawScript(code) {
    return /^(?:if|while|for|switch)\s*\(/.test(code.trim());
}
export function registerRawScriptReplacement(code, ctx) {
    if (!ctx.rawScriptReplacements)
        ctx.rawScriptReplacements = new Map();
    const id = `raw_${ctx.rawScriptReplacements.size.toString(16).toUpperCase()}`;
    const raw = code.trim();
    ctx.rawScriptReplacements.set(id, ctx.returnType === 'bool' ? returnTrueForBareReturns(raw) : raw);
    return createExpressionStatement(createCallExpression(RAW_SCRIPT_PLACEHOLDER, [createStringLiteral(id)]));
}
function parseRawScriptCode(code) {
    const trimmed = code.trim();
    if (!trimmed)
        return undefined;
    // Keep this intentionally conservative. Inline custom script can contain
    // arbitrary Galaxy; unsupported cases are preserved verbatim through raw
    // placeholders instead of feeding pathological snippets to the full parser.
    if (trimmed === 'return;')
        return [createReturnStatement()];
    if (trimmed === 'break;')
        return [createBreakStatement()];
    if (trimmed === 'continue;')
        return [createContinueStatement()];
    return parseSimpleRawStatement(trimmed);
}
function parseSimpleRawStatement(code) {
    const blockInner = unwrapOuterBlock(code);
    if (blockInner !== undefined) {
        const statementTexts = splitSimpleRawStatements(blockInner);
        if (!statementTexts)
            return undefined;
        const statements = [];
        for (const statementText of statementTexts) {
            const parsed = parseSimpleRawStatement(statementText);
            if (!parsed)
                return undefined;
            statements.push(...parsed);
        }
        return statements;
    }
    const returnMatch = code.match(/^return(?:\s+(.+))?;$/);
    if (returnMatch) {
        const exprText = returnMatch[1]?.trim();
        const expr = exprText ? parseSimpleRawExpression(exprText) : undefined;
        if (exprText && !expr)
            return undefined;
        return [createReturnStatement(expr)];
    }
    const assignment = findTopLevelAssignment(code);
    if (assignment) {
        const left = parseSimpleRawExpression(assignment.left);
        const right = parseSimpleRawExpression(assignment.right);
        if (left && right) {
            return [createExpressionStatement(createBinaryExpression(left, 39 /* SyntaxKind.EqualsToken */, right))];
        }
    }
    const exprText = code.endsWith(';') ? code.slice(0, -1).trim() : '';
    if (!exprText)
        return undefined;
    const expr = parseSimpleRawExpression(exprText);
    return expr ? [createExpressionStatement(expr)] : undefined;
}
function parseSimpleRawExpression(text) {
    const expr = text.trim();
    if (!expr)
        return undefined;
    const parenInner = unwrapOuterParens(expr);
    if (parenInner !== undefined) {
        const innerExpr = parseSimpleRawExpression(parenInner);
        return innerExpr ? createParenthesizedExpression(innerExpr) : undefined;
    }
    if (/^-?(?:\d+|\d+\.\d+|\.\d+)$/.test(expr))
        return createNumericLiteral(expr);
    if (/^(?:true|false|null)$/.test(expr))
        return createIdentifier(expr);
    const stringValue = parseRawStringLiteral(expr);
    if (stringValue !== undefined)
        return createStringLiteral(stringValue);
    const call = parseSimpleRawCallExpression(expr);
    if (call)
        return call;
    const elementAccess = parseSimpleRawElementAccess(expr);
    if (elementAccess)
        return elementAccess;
    if (/^[A-Za-z_]\w*$/.test(expr))
        return createIdentifier(expr);
    return undefined;
}
function parseSimpleRawCallExpression(expr) {
    const openIdx = expr.indexOf('(');
    if (openIdx <= 0 || !expr.endsWith(')'))
        return undefined;
    const fnName = expr.slice(0, openIdx).trim();
    if (!/^[A-Za-z_]\w*$/.test(fnName))
        return undefined;
    const argsText = expr.slice(openIdx + 1, -1);
    if (!isBalancedRawFragment(argsText))
        return undefined;
    const argTexts = splitRawArguments(argsText);
    if (!argTexts)
        return undefined;
    const args = [];
    for (const argText of argTexts) {
        if (!argText.trim())
            continue;
        const arg = parseSimpleRawExpression(argText);
        if (!arg)
            return undefined;
        args.push(arg);
    }
    return createCallExpression(fnName, args);
}
function parseSimpleRawElementAccess(expr) {
    const closeIdx = expr.lastIndexOf(']');
    const openIdx = expr.lastIndexOf('[');
    if (closeIdx !== expr.length - 1 || openIdx <= 0)
        return undefined;
    const base = parseSimpleRawExpression(expr.slice(0, openIdx));
    const index = parseSimpleRawExpression(expr.slice(openIdx + 1, closeIdx));
    if (!base || !index)
        return undefined;
    return createElementAccessExpression(base, index);
}
function parseRawStringLiteral(expr) {
    if (expr.length < 2 || expr[0] !== '"' || expr[expr.length - 1] !== '"')
        return undefined;
    let out = '';
    for (let i = 1; i < expr.length - 1; i++) {
        const ch = expr[i];
        if (ch !== '\\') {
            out += ch;
            continue;
        }
        const next = expr[++i];
        if (next === undefined)
            return undefined;
        if (next === 'n')
            out += '\n';
        else if (next === 'r')
            out += '\r';
        else if (next === 't')
            out += '\t';
        else
            out += next;
    }
    return out;
}
function findTopLevelAssignment(code) {
    if (!code.endsWith(';'))
        return undefined;
    const body = code.slice(0, -1);
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (ch === '\\')
                escaped = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '(' || ch === '[')
            depth++;
        else if (ch === ')' || ch === ']')
            depth--;
        else if (ch === '=' && depth === 0 && body[i - 1] !== '=' && body[i + 1] !== '=') {
            return { left: body.slice(0, i).trim(), right: body.slice(i + 1).trim() };
        }
        if (depth < 0)
            return undefined;
    }
    return undefined;
}
function unwrapOuterParens(expr) {
    if (!expr.startsWith('(') || !expr.endsWith(')'))
        return undefined;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (ch === '\\')
                escaped = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '(')
            depth++;
        else if (ch === ')')
            depth--;
        if (depth === 0 && i < expr.length - 1)
            return undefined;
    }
    return depth === 0 ? expr.slice(1, -1).trim() : undefined;
}
function unwrapOuterBlock(code) {
    if (!code.startsWith('{') || !code.endsWith('}'))
        return undefined;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (ch === '\\')
                escaped = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{')
            depth++;
        else if (ch === '}')
            depth--;
        if (depth === 0 && i < code.length - 1)
            return undefined;
    }
    return depth === 0 ? code.slice(1, -1).trim() : undefined;
}
function splitSimpleRawStatements(blockText) {
    const trimmed = blockText.trim();
    if (!trimmed)
        return [];
    const out = [];
    let start = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < blockText.length; i++) {
        const ch = blockText[i];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (ch === '\\')
                escaped = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '(')
            parenDepth++;
        else if (ch === ')')
            parenDepth--;
        else if (ch === '[')
            bracketDepth++;
        else if (ch === ']')
            bracketDepth--;
        else if (ch === '{')
            braceDepth++;
        else if (ch === '}')
            braceDepth--;
        else if (ch === ';' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
            const statement = blockText.slice(start, i + 1).trim();
            if (statement)
                out.push(statement);
            start = i + 1;
        }
        if (parenDepth < 0 || bracketDepth < 0 || braceDepth < 0)
            return undefined;
    }
    if (inString || parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0)
        return undefined;
    if (blockText.slice(start).trim())
        return undefined;
    return out;
}
function splitRawArguments(argsText) {
    const out = [];
    let start = 0;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < argsText.length; i++) {
        const ch = argsText[i];
        if (inString) {
            if (escaped)
                escaped = false;
            else if (ch === '\\')
                escaped = true;
            else if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '(' || ch === '[')
            depth++;
        else if (ch === ')' || ch === ']')
            depth--;
        else if (ch === ',' && depth === 0) {
            out.push(argsText.slice(start, i).trim());
            start = i + 1;
        }
        if (depth < 0)
            return undefined;
    }
    if (inString || depth !== 0)
        return undefined;
    out.push(argsText.slice(start).trim());
    return out;
}
function isBalancedRawFragment(text) {
    return splitRawArguments(text) !== undefined;
}
export function convertSetVariable(call, ctx) {
    const result = convertAction(call, ctx);
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertIfThenElse(call, ctx) {
    const result = convertAction(call, ctx);
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertIfThenMultiple(call, ctx) {
    const result = convertAction(call, ctx);
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertWhileDo(call, ctx) {
    const result = convertAction(call, ctx);
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertRepeat(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertRepeatForever(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertWaitForCondition(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result.length === 1 ? result[0] : createBlock(result) : result;
}
export function convertWaitForConditionWithMaximumDuration(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertActionQueueAdd(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertPickEachInteger(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function exprLooksFixed(expr) {
    if (!expr)
        return false;
    if (expr.kind === 2 /* SyntaxKind.NumericLiteral */) {
        const raw = String(expr.text ?? expr.value ?? '');
        return raw.includes('.');
    }
    if (expr.kind === 126 /* SyntaxKind.ParenthesizedExpression */) {
        return exprLooksFixed(expr.expression);
    }
    return false;
}
export function convertForEachInteger(call, ctx) {
    const result = convertAction(call, ctx);
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertPickEachPlayerInGroup(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertPickEachUnitInGroup(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertForEachCatalogEntryInCatalog(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertForEachUserDataInstanceInUserType(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertForEachUIFrame(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
export function convertSwitch(call, ctx) {
    const result = convertAction(call, ctx);
    if (result === undefined)
        return conversionError('ACTION_CONVERSION', 'Action could not be converted', { call: refKey(call) });
    return Array.isArray(result) ? result : result === undefined ? [] : [result];
}
//# sourceMappingURL=ttg-actions.js.map