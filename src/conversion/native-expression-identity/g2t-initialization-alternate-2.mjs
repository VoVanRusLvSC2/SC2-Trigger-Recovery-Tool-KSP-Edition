import { canonicalWhileArrayFills } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/canonical-while-array-fills.js";
import { recognizeMapStageAliases } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/map-stage-aliases.js";
/** Conservative recognition of an editor initialization bundle, before any nodes are removed. */
import { SyntaxKind } from "../exact-function-signatures/index-alternate-3.js";
import { getTypeName, unwrapArrayType, unwrapParens } from "./g2t-core.generated-call-provenance.mjs";
import { syntaxShape } from "./script-template.mjs";
import { conversionError, libraryPrefix, startupFunctionName } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
/** Keep an existing startup graph intact instead of manufacturing a second root. */
export function preservedInitializationRoot(nodes, libraryId, entryPoint) {
    const exact = (input) => preservedInitializationRootExact(input, libraryId, entryPoint);
    const root = exact(nodes);
    if (root !== undefined || entryPoint !== undefined)
        return root;
    const alias = recognizeMapStageAliases(nodes, libraryId, input => {
        const candidate = exact(input);
        return typeof candidate === 'string' ? { functions: new Set(), root: candidate } : undefined;
    }, getTypeName);
    return alias?.root;
}
function preservedInitializationRootExact(nodes, libraryId, entryPoint) {
    const definitions = new Map();
    for (const node of nodes)
        if (node.kind === SyntaxKind.FunctionDeclaration && node.body) {
            if (definitions.has(node.name.name))
                return conversionError('INITIALIZATION_SIGNATURE', 'Startup source has duplicate function definitions', { name: node.name.name });
            definitions.set(node.name.name, node);
        }
    const callable = (node) => node?.body && getTypeName(node.type) === 'void' && node.parameters.length === 0;
    if (entryPoint !== undefined) {
        if (!callable(definitions.get(entryPoint)))
            return conversionError('INITIALIZATION_SIGNATURE', 'Entry point must name a defined void function with no parameters', { entryPoint });
        return entryPoint;
    }
    const emptyMapName = startupFunctionName(libraryId, 'InitLib');
    const emptyMapBody = plainBody(definitions.get(emptyMapName));
    if (libraryPrefix(libraryId) === '' && definitions.size === 1 &&
        !nodes.some(node => node.kind === SyntaxKind.VariableDeclaration) && emptyMapBody &&
        !emptyMapBody.locals.length && !emptyMapBody.rest.length)
        return emptyMapName;
    const roots = [];
    for (const [name, node] of definitions) {
        if (!generatedName(name, startupFunctionName(libraryId, 'InitLib')))
            continue;
        // A map's startup root carries no completion guard. Missing it here reports
        // "no startup graph", which forces the caller into preserve mode and leaves
        // every generated stage to surface as an authored FunctionDef.
        const body = guardedBody(node) ?? (libraryPrefix(libraryId) === '' ? plainBody(node) : undefined);
        if (!body || body.locals.length)
            continue;
        const calls = body.rest.map(callName);
        // A library that uses no other library has no InitLibraries stage (EditorTest's
        // empty CCEM: InitLib alone); a map always initializes the native library.
        const withLibraries = generatedName(calls[0], startupFunctionName(libraryId, 'InitLibraries'));
        if (libraryPrefix(libraryId) === '' && !withLibraries)
            continue;
        if (new Set(calls).size !== calls.length || !calls.every(callee => !!callee && callable(definitions.get(callee))))
            continue;
        if (libraryPrefix(libraryId) === '') {
            // A map whose triggers all live in a library it defines itself has no
            // trigger stage: its InitMap calls InitLibs alone.
            if (calls.length > 1 && !generatedName(calls.at(-1), startupFunctionName(libraryId, 'InitTriggers')))
                continue;
            // Optional stages may have arbitrary work. Their bodies and call order are
            // retained, not folded into independent GUI initializers.
            if (!calls.slice(1, -1).every(callee => ['InitVariables', 'InitCustomScript'].some(role => generatedName(callee, startupFunctionName(libraryId, role)))))
                continue;
        }
        else if (!orderedStages(calls.slice(withLibraries ? 1 : 0), libraryId))
            continue;
        roots.push(name);
    }
    if (roots.length > 1)
        return conversionError('INITIALIZATION_AMBIGUOUS', 'Several preserved startup graphs require an explicit entryPoint', { roots });
    if (roots[0])
        return roots[0];
    // A MapScript can contain a compiled editor library followed by the map's
    // outer InitMap -> InitLibs shell.  The document is still a map, but its own
    // declarations retain an arbitrary historical lib* linkage prefix.  Treat
    // this as generated startup only when the complete guarded library bundle is
    // present; a bare naming match is deliberately insufficient.
    if (libraryPrefix(libraryId) === '') {
        const mapRootName = startupFunctionName(libraryId, 'InitLib');
        const mapLibrariesName = startupFunctionName(libraryId, 'InitLibraries');
        const mapRoot = plainBody(definitions.get(mapRootName));
        const rootCalls = mapRoot?.rest.map(callName) ?? [];
        const mapLibraries = plainBody(definitions.get(mapLibrariesName));
        const libraryCalls = mapLibraries?.rest.map(callName) ?? [];
        const bundles = libraryCalls
            .filter((name) => !!name)
            .map(name => embeddedLibraryBundle(definitions, name))
            .filter((bundle) => !!bundle);
        if (mapRoot && !mapRoot.locals.length && rootCalls.length === 1 && rootCalls[0] === mapLibrariesName &&
            mapLibraries && !mapLibraries.locals.length && libraryCalls.length > 0 && libraryCalls.every(Boolean) &&
            bundles.length > 0 && libraryCalls.every(name => bundles.some(bundle => bundle.rootName === name) ||
            /^lib[A-Za-z0-9_]+_(?:InitLib|InitVariables)$/u.test(name)))
            return mapRootName;
    }
    return undefined;
}
function identifier(node) {
    node = unwrapParens(node);
    return node?.kind === SyntaxKind.Identifier ? node.name : undefined;
}
function statements(node) {
    return node?.kind === SyntaxKind.Block ? Array.from(node.statements) : node ? [node] : [];
}
function assignment(statement) {
    const expression = statement?.kind === SyntaxKind.ExpressionStatement ? statement.expression : statement;
    return expression?.kind === SyntaxKind.BinaryExpression && expression.operatorToken?.kind === SyntaxKind.EqualsToken ? expression : undefined;
}
function literalNumber(node) {
    node = unwrapParens(node);
    return node?.kind === SyntaxKind.NumericLiteral ? Number(node.text ?? node.value) : undefined;
}
function identifierNames(node) {
    const names = new Set();
    const pending = [syntaxShape(node)];
    while (pending.length) {
        const value = pending.pop();
        if (!value || typeof value !== 'object')
            continue;
        if (value.kind === SyntaxKind.Identifier)
            names.add(value.name);
        pending.push(...Object.values(value));
    }
    return names;
}
// Moving an initializer is safe here only when it neither observes nor changes state.
function guardedBody(declaration) {
    if (!declaration?.body || getTypeName(declaration.type) !== 'void' || declaration.parameters?.length)
        return undefined;
    const body = Array.from(declaration.body.statements ?? []);
    const locals = [];
    while (body[0]?.kind === SyntaxKind.VariableDeclaration)
        locals.push(body.shift());
    const [guard, set, ...rest] = body;
    if (guard?.kind !== SyntaxKind.IfStatement || guard.elseStatement)
        return undefined;
    const flag = identifier(guard.expression);
    const branch = statements(guard.thenStatement);
    const write = assignment(set);
    if (!flag || branch.length !== 1 || branch[0].kind !== SyntaxKind.ReturnStatement || branch[0].expression ||
        identifier(write?.left) !== flag || unwrapParens(write?.right)?.kind !== SyntaxKind.TrueKeyword)
        return undefined;
    return { flag, locals, rest };
}
/** The initializers a custom script stage calls: its whole body is `f();` statements,
 *  each calling a function this script defines that is not part of the startup
 *  (the editor writes one call per CustomScript element with an initialization
 *  function, and nothing else). Undefined for any other body. */
function customScriptInitializers(declaration, definitions, startup) {
    const body = plainBody(declaration);
    if (!body || body.locals.length)
        return undefined;
    const names = body.rest.map(callName);
    return names.every(name => name !== undefined && definitions.has(name) && !startup.has(name)) ? names : undefined;
}
/** A map's generated startup carries no completion guards: the editor emits
 *  InitMap/InitLibs/InitGlobals/InitTriggers as plain void functions. */
function plainBody(declaration) {
    if (!declaration?.body || getTypeName(declaration.type) !== 'void' || declaration.parameters?.length)
        return undefined;
    const body = Array.from(declaration.body.statements ?? []);
    const locals = [];
    while (body[0]?.kind === SyntaxKind.VariableDeclaration)
        locals.push(body.shift());
    return { locals, rest: body };
}
/** Fold an initializer body into per-variable initial values, or refuse when a
 *  statement encodes something the element model cannot store. */
function foldInitialization(body, globals, structures, completionGlobals) {
    const traceFailure = (reason, node) => {
        if (globalThis.process?.env?.['MX_G2T_TRACE_INITIALIZATION'] === '1') {
            console.error(`[triggers:g2t:init] ${reason} kind=${node?.kind ?? '-'} pos=${node?.pos ?? '-'} end=${node?.end ?? '-'}`);
        }
        return undefined;
    };
    const locals = new Set(body.locals.map(node => node.name.name));
    if (body.locals.some(node => getTypeName(node.type) !== 'int' || node.initializer))
        return traceFailure('unsupported-local', body.locals.find(node => getTypeName(node.type) !== 'int' || node.initializer));
    const canonical = canonicalWhileArrayFills(body, globals, locals, SyntaxKind);
    if (!canonical)
        return traceFailure('unsupported-while-array-fill');
    body = canonical;
    const initialValues = new Map();
    const writes = [];
    const structureValues = [];
    for (const statement of body.rest) {
        const write = initialAssignment(statement, globals, locals);
        if (!write) {
            const spread = structureFillLoop(statement, globals, locals, structures);
            const direct = spread ? undefined : memberAssignment(statement, [], []);
            if (!spread && (!direct || !globals.has(direct.base)))
                return traceFailure('unfoldable-statement', statement);
            if (spread)
                for (const entry of spread.members)
                    structureValues.push({ array: spread.array, ...entry });
            else
                structureValues.push({ array: direct.base, path: direct.path, value: direct.value });
            continue;
        }
        if (initialValues.has(write.name) || completionGlobals.has(write.name))
            return traceFailure('duplicate-or-completion-write', statement);
        writes.push(write);
        initialValues.set(write.name, write.value);
    }
    // The model stores an initial value per variable, not a statement order, so
    // a value that reads a global assigned after it encodes an ordering that
    // would be lost. Those stay as written rather than being folded.
    for (let index = 0; index < writes.length; index += 1) {
        const later = new Set(writes.slice(index + 1).map(write => write.name));
        for (const name of identifierNames(writes[index].value))
            if (later.has(name))
                return traceFailure(`forward-read:${name}`, writes[index].value);
    }
    if (canonical.requiresInitializationOrderProof) {
        // Nonliteral array initial values retain one evaluation per cell. Their
        // order must equal the owned global declaration order the GUI compiler uses.
        // Never move allocation calls across another variable initialization.
        const order = new Map([...globals.keys()].map((name, index) => [name, index]));
        let previous = -1;
        for (const write of writes) {
            const position = order.get(write.name);
            if (position === undefined || position <= previous)
                return traceFailure('initializer-declaration-order', write.value);
            previous = position;
        }
    }
    return { initialValues, structureValues };
}
function callName(statement) {
    const call = statement?.kind === SyntaxKind.ExpressionStatement ? statement.expression : undefined;
    return call?.kind === SyntaxKind.CallExpression && call.arguments.length === 0 ? identifier(call.expression) : undefined;
}
function generatedName(name, base) {
    return name === base || !!name?.startsWith(`${base}_`) && /^\d+$/u.test(name.slice(base.length + 1));
}
/** The stages a library's InitLib calls after InitLibraries. The editor writes
 *  only the stages the library has, always in this order: no InitVariables
 *  without global variables, no InitCustomScript without custom script and no
 *  InitTriggers without triggers (0 of 106 corpus libraries has an empty
 *  InitTriggers; an achievement library a map defines calls InitLibraries and
 *  InitVariables alone). */
const LIBRARY_STAGES = ['InitVariables', 'InitCustomScript', 'InitTriggers'];
function orderedStages(calls, libraryId, stages = LIBRARY_STAGES) {
    let next = 0;
    for (const callee of calls) {
        const at = stages.findIndex((role, index) => index >= next && generatedName(callee, startupFunctionName(libraryId, role)));
        if (at < 0)
            return false;
        next = at + 1;
    }
    return true;
}
/** Libraries a map script carries inline. The editor compiles the trigger libraries
 * a map defines itself (`<Library Id="1">` in its Triggers) into MapScript.galaxy,
 * each with its guarded startup `lib<Id>_InitLib` and the flag
 * `lib<Id>_InitLib_completed`; a library of a dependency is only called. Ids come
 * in the order the script defines them. */
export function embeddedLibraryIds(source) {
    const flags = new Set();
    const roots = [];
    for (const node of Array.from(source.statements)) {
        const name = node.name?.name;
        if (typeof name !== 'string')
            continue;
        if (node.kind === SyntaxKind.VariableDeclaration && name.endsWith('_InitLib_completed'))
            flags.add(name);
        if (node.kind === SyntaxKind.FunctionDeclaration && node.body && /^lib[A-Za-z0-9_]+?_InitLib$/u.test(name))
            roots.push(name);
    }
    return roots.filter(name => flags.has(`${name}_completed`)).map(name => name.slice('lib'.length, -'_InitLib'.length));
}
/** Exact guarded startup bundle produced for an editor library embedded in a
 * MapScript. The `lib*` token is discovered from syntax and never interpreted
 * as a content ID. */
function embeddedLibraryBundle(definitions, rootName) {
    const match = /^(lib[A-Za-z0-9_]+?)_InitLib(?:_\d+)?$/u.exec(rootName);
    if (!match)
        return undefined;
    const prefix = match[1];
    const rootBody = guardedBody(definitions.get(rootName));
    if (!rootBody || rootBody.locals.length || rootBody.rest.length !== 3)
        return undefined;
    const calls = rootBody.rest.map(callName);
    const bases = [`${prefix}_InitLibraries`, `${prefix}_InitVariables`, `${prefix}_InitTriggers`];
    if (!calls.every((name, index) => generatedName(name, bases[index])))
        return undefined;
    const [libraries, variables, triggers] = calls.map(name => definitions.get(name));
    if (![libraries, variables, triggers].every(fn => fn?.body && getTypeName(fn.type) === 'void' && fn.parameters.length === 0))
        return undefined;
    return { rootName, prefix, rootBody, stageNames: calls, libraries, variables, triggers };
}
/** Recognize only full-array writes with local counters, literal bounds and state-independent values. */
function initialAssignment(statement, globals, locals) {
    const counters = [];
    const bounds = [];
    while (statement?.kind === SyntaxKind.ForStatement) {
        const init = assignment(statement.initializer);
        const counter = identifier(init?.left);
        const condition = unwrapParens(statement.condition);
        const increment = statement.incrementor;
        if (!counter || !locals.has(counter) || counters.includes(counter) || literalNumber(init?.right) !== 0 ||
            condition?.kind !== SyntaxKind.BinaryExpression || identifier(condition.left) !== counter ||
            ![SyntaxKind.LessThanToken, SyntaxKind.LessThanEqualsToken].includes(condition.operatorToken?.kind) ||
            increment?.kind !== SyntaxKind.BinaryExpression || increment.operatorToken?.kind !== SyntaxKind.PlusEqualsToken ||
            identifier(increment.left) !== counter || literalNumber(increment.right) !== 1)
            return undefined;
        const body = statements(statement.statement);
        if (body.length !== 1)
            return undefined;
        counters.push(counter);
        bounds.push({
            expression: unwrapParens(condition.right),
            inclusive: condition.operatorToken.kind === SyntaxKind.LessThanEqualsToken,
        });
        statement = body[0];
    }
    const write = assignment(statement);
    if (!write)
        return undefined;
    let target = unwrapParens(write.left);
    const indices = [];
    while (target?.kind === SyntaxKind.ElementAccessExpression) {
        indices.unshift(identifier(target.argumentExpression));
        target = unwrapParens(target.expression);
    }
    const name = identifier(target);
    const declaration = name && globals.get(name);
    if (!name || !declaration || declaration.modifiers?.some((m) => m.kind === SyntaxKind.ConstKeyword))
        return undefined;
    const { sizes } = unwrapArrayType(declaration.type);
    if (indices.length !== counters.length || sizes.length !== counters.length ||
        !indices.every((index, i) => index === counters[i]) ||
        !sizes.every((size, i) => coversDeclaredSize(size, bounds[i])))
        return undefined;
    return { name, value: write.right };
}
/** `for (i = 0; i <= bound; i += 1) { g[i].one = x; g[i].two = y; }` -- the loop
 *  the editor writes to give every element of an array of structures the
 *  defaults declared on that structure's members. The defaults belong to the
 *  structure, not to the array, so only the member values are recovered. */
function structureFillLoop(statement, globals, locals, structures) {
    if (statement?.kind !== SyntaxKind.ForStatement)
        return undefined;
    const found = [];
    if (!collectFill(statement, locals, [], [], found) || found.length === 0)
        return undefined;
    const array = found[0].base;
    const seen = new Set();
    for (const fill of found) {
        if (fill.base !== array)
            return undefined;
        const key = fill.path.join('.');
        if (seen.has(key))
            return undefined;
        seen.add(key);
    }
    const declaration = globals.get(array);
    if (!declaration || declaration.modifiers?.some((m) => m.kind === SyntaxKind.ConstKeyword))
        return undefined;
    const { baseType, sizes } = unwrapArrayType(declaration.type);
    // Every level of every path has to be covered whole, or the model would claim
    // a default the source never gave every element.
    for (const fill of found) {
        if (sizes.length !== fill.base_indices.length ||
            !sizes.every((size, i) => coversDeclaredSize(size, fill.base_indices[i])))
            return undefined;
        let typeName = getTypeName(baseType);
        for (let depth = 0; depth < fill.path.length; depth += 1) {
            const member = structures.get(typeName)?.get(fill.path[depth]);
            if (!member)
                return undefined;
            const used = fill.indices[depth];
            if (member.sizes.length !== used.length ||
                !member.sizes.every((size, i) => coversDeclaredSize(size, used[i])))
                return undefined;
            typeName = member.typeName;
        }
    }
    return { array, members: found.map(fill => ({ path: fill.path, value: fill.value })) };
}
/** Walks one level of a fill loop. A level holds member assignments and further
 *  loops in any mix, so the walk is recursive; the loops open at each point
 *  supply the indices every write underneath must use, in order. */
function collectFill(node, locals, counters, bounds, out) {
    const shape = countedLoop(node, locals, counters);
    if (!shape)
        return false;
    const nextCounters = [...counters, shape.counter];
    const nextBounds = [...bounds, shape.bound];
    const body = statements(node.statement);
    if (body.length === 0)
        return false;
    for (const line of body) {
        if (line?.kind === SyntaxKind.ForStatement) {
            if (!collectFill(line, locals, nextCounters, nextBounds, out))
                return false;
            continue;
        }
        const walked = memberAssignment(line, nextCounters, nextBounds);
        if (!walked)
            return false;
        out.push(walked);
    }
    return true;
}
/** `base[i].one[j].two = value` -- one write inside a fill loop, possibly
 *  reaching through several structures. Every index must be the counter of the
 *  loop that introduced it, in order, so that whole arrays are written rather
 *  than chosen elements. */
function memberAssignment(line, counters, bounds) {
    const write = assignment(line);
    if (!write)
        return undefined;
    const segments = [];
    let node = unwrapParens(write.left);
    let pending = [];
    while (node?.kind === SyntaxKind.ElementAccessExpression || node?.kind === SyntaxKind.PropertyAccessExpression) {
        if (node.kind === SyntaxKind.ElementAccessExpression) {
            const index = identifier(node.argumentExpression);
            if (!index)
                return undefined;
            pending.unshift(index);
            node = unwrapParens(node.expression);
            continue;
        }
        const member = node.name?.name;
        if (typeof member !== 'string')
            return undefined;
        segments.unshift({ member, indices: pending });
        pending = [];
        node = unwrapParens(node.expression);
    }
    const base = identifier(node);
    if (!base || segments.length === 0)
        return undefined;
    const used = [...pending, ...segments.flatMap(segment => segment.indices)];
    if (used.length !== counters.length || !used.every((index, i) => index === counters[i]))
        return undefined;
    let consumed = pending.length;
    const indices = [];
    for (const segment of segments) {
        indices.push(bounds.slice(consumed, consumed + segment.indices.length));
        consumed += segment.indices.length;
    }
    return {
        base,
        base_indices: bounds.slice(0, pending.length),
        path: segments.map(segment => segment.member),
        indices,
        value: write.right,
    };
}
/** Declared shape of every member of every structure, by structure type name: a
 *  member fill loop is checked against the member's own length, and a member
 *  that is itself a structure continues the path. */
function structureMemberSizes(nodes) {
    const structures = new Map();
    for (const node of nodes) {
        if (node.kind !== SyntaxKind.StructDeclaration || !node.name?.name)
            continue;
        const members = new Map();
        for (const member of Array.from(node.members ?? [])) {
            if (!member?.name?.name)
                continue;
            const { baseType, sizes } = unwrapArrayType(member.type);
            members.set(member.name.name, { sizes, typeName: getTypeName(baseType) });
        }
        structures.set(node.name.name, members);
    }
    return structures;
}
/** One level of `for (i = 0; i <= bound; i += 1)`, or undefined for any other loop. */
function countedLoop(node, locals, taken) {
    const init = assignment(node.initializer);
    const counter = identifier(init?.left);
    const condition = unwrapParens(node.condition);
    const increment = node.incrementor;
    if (!counter || !locals.has(counter) || taken.includes(counter) || literalNumber(init?.right) !== 0 ||
        condition?.kind !== SyntaxKind.BinaryExpression || identifier(condition.left) !== counter ||
        ![SyntaxKind.LessThanToken, SyntaxKind.LessThanEqualsToken].includes(condition.operatorToken?.kind) ||
        increment?.kind !== SyntaxKind.BinaryExpression || increment.operatorToken?.kind !== SyntaxKind.PlusEqualsToken ||
        identifier(increment.left) !== counter || literalNumber(increment.right) !== 1)
        return undefined;
    return {
        counter,
        bound: { expression: unwrapParens(condition.right), inclusive: condition.operatorToken.kind === SyntaxKind.LessThanEqualsToken },
    };
}
/** Whether a counted loop covers exactly the array's declared length. An array
 *  may be declared with a symbolic size -- `int[MAX + 1] gv_x` filled by
 *  `for (i = 0; i <= MAX; i += 1)` -- so the two are compared as expressions
 *  rather than as numbers, which only a literal size could satisfy. */
function coversDeclaredSize(size, bound) {
    const declared = literalNumber(size);
    const limit = literalNumber(bound.expression);
    if (declared !== undefined && limit !== undefined)
        return declared === limit + (bound.inclusive ? 1 : 0);
    const shape = (node) => JSON.stringify(syntaxShape(node));
    if (!bound.inclusive)
        return shape(unwrapParens(size)) === shape(bound.expression);
    const sum = unwrapParens(size);
    return sum?.kind === SyntaxKind.BinaryExpression && sum.operatorToken?.kind === SyntaxKind.PlusToken &&
        literalNumber(sum.right) === 1 && shape(unwrapParens(sum.left)) === shape(bound.expression);
}
/**
 * A name is only a candidate. Partial matches never mutate the model. Anything
 * outside the proven bundle remains ordinary structured Galaxy functions.
 */
export function recognizeGeneratedInitialization(nodes, libraryId, nativeLibraryId, triggerInitializers, dependencyLibraryIds = [], initializedDependencies) {
    const exact = (input) => recognizeGeneratedInitializationExact(input, libraryId, nativeLibraryId, triggerInitializers, dependencyLibraryIds, initializedDependencies);
    return exact(nodes) ?? recognizeMapStageAliases(nodes, libraryId, exact, getTypeName);
}
function recognizeGeneratedInitializationExact(nodes, libraryId, nativeLibraryId, triggerInitializers, dependencyLibraryIds = [], initializedDependencies) {
    const definitions = new Map();
    const globals = new Map();
    for (const node of nodes) {
        if (node.kind === SyntaxKind.FunctionDeclaration && node.body) {
            if (definitions.has(node.name.name))
                return undefined;
            definitions.set(node.name.name, node);
        }
        if (node.kind === SyntaxKind.VariableDeclaration)
            globals.set(node.name.name, node);
    }
    const structures = structureMemberSizes(nodes);
    for (const [rootName, root] of definitions) {
        if (!generatedName(rootName, startupFunctionName(libraryId, 'InitLib')))
            continue;
        const rootBody = guardedBody(root);
        if (!rootBody || rootBody.locals.length)
            continue;
        const calls = rootBody.rest.map(callName);
        // The editor writes no variable stage for a library without global variables,
        // no custom script stage for one without custom script and no trigger stage for
        // one without triggers; and no InitLibraries for a library that uses no other
        // library, the native one included (EditorTest's empty CCEM: InitLib alone).
        const librariesName = generatedName(calls[0], startupFunctionName(libraryId, 'InitLibraries')) ? calls[0] : undefined;
        if (!orderedStages(calls.slice(librariesName ? 1 : 0), libraryId))
            continue;
        const stage = (role) => calls.find(name => generatedName(name, startupFunctionName(libraryId, role)));
        const variablesName = stage('InitVariables');
        const customScriptName = stage('InitCustomScript');
        const triggersName = stage('InitTriggers');
        const libraries = librariesName ? definitions.get(librariesName) : undefined;
        const triggers = triggersName ? definitions.get(triggersName) : undefined;
        const variables = variablesName ? definitions.get(variablesName) : undefined;
        const customScript = customScriptName ? definitions.get(customScriptName) : undefined;
        if (![...(librariesName ? [libraries] : []), ...(triggersName ? [triggers] : []), ...(variablesName ? [variables] : []), ...(customScriptName ? [customScript] : [])]
            .every(fn => fn?.body && getTypeName(fn.type) === 'void' && fn.parameters.length === 0))
            continue;
        const initializers = customScriptName
            ? customScriptInitializers(customScript, definitions, new Set([rootName, ...calls, ...triggerInitializers]))
            : undefined;
        if (customScriptName && !initializers)
            continue;
        const variableBody = variables ? guardedBody(variables) : undefined;
        if (variables && (!variableBody || variableBody.flag === rootBody.flag))
            continue;
        const completionGlobals = new Set([rootBody.flag, ...(variableBody ? [variableBody.flag] : [])]);
        if (![...completionGlobals].every(name => getTypeName(globals.get(name)?.type) === 'bool' && unwrapParens(globals.get(name)?.initializer)?.kind === SyntaxKind.FalseKeyword))
            continue;
        const functions = new Set([rootName, ...calls]);
        const libraryCalls = libraries ? Array.from(libraries.body.statements).map(callName) : [];
        if (libraries && (!libraryCalls.length || ![`lib${nativeLibraryId}_InitLib`, `lib${nativeLibraryId}_InitVariables`].includes(libraryCalls[0] ?? '')))
            continue;
        const dependencyCalls = libraryCalls.slice(1).map(name => {
            const match = /^lib([A-Za-z0-9_]+)_InitVariables$/u.exec(name ?? '');
            return match?.[1];
        });
        if (dependencyCalls.some(id => !id))
            continue;
        // Dependency startup is regenerated from concrete cross-library element
        // references. Fold explicit calls only when every called library is used by
        // declarations outside this generated bundle and its order agrees with the
        // loaded document order. Otherwise the calls carry observable information
        // which the Trigger model cannot safely retain.
        const outsideIdentifiers = new Set();
        for (const node of nodes) {
            const name = node.name?.name;
            if (functions.has(name) || completionGlobals.has(name))
                continue;
            for (const identifier of identifierNames(node))
                outsideIdentifiers.add(identifier);
        }
        const referencedDependencies = dependencyLibraryIds.filter(id => [...outsideIdentifiers].some(name => name.startsWith(`lib${id}_`)));
        // A library a map defines itself can call a dependency's InitVariables that
        // no element of it references, or call one several times (PartAndParcel:
        // libARRA_InitVariables in an empty library; SkyFall: libCOMI_InitVariables
        // three times). A library the map starts before this one has run those
        // already, so such calls are no-ops and are not regenerated; any other
        // extra call still keeps the startup as written.
        const regenerated = dependencyCalls.filter((id, index) => referencedDependencies.includes(id) && dependencyCalls.indexOf(id) === index);
        const dropped = dependencyCalls.filter((id, index) => !(referencedDependencies.includes(id) && dependencyCalls.indexOf(id) === index));
        if (dropped.some(id => !initializedDependencies?.has(id)))
            continue;
        if (regenerated.length !== referencedDependencies.length ||
            !regenerated.every((id, index) => id === referencedDependencies[index]))
            continue;
        const triggerCalls = triggers ? Array.from(triggers.body.statements).map(callName) : [];
        if (triggerCalls.length !== triggerInitializers.size || !triggerCalls.every((name, i) => name === [...triggerInitializers][i]))
            continue;
        const folded = variableBody
            ? foldInitialization(variableBody, globals, structures, completionGlobals)
            : { initialValues: new Map(), structureValues: [] };
        if (!folded)
            continue;
        const { initialValues, structureValues } = folded;
        let valid = true;
        for (const node of nodes) {
            const name = node.name?.name;
            if (node === root || node === variables || completionGlobals.has(name))
                continue;
            const used = identifierNames(node);
            if ([...completionGlobals].some(flag => used.has(flag))) {
                valid = false;
                break;
            }
            // Calls to individual initialization stages carry observable ordering.
            if (!functions.has(name) && calls.some(stage => used.has(stage))) {
                valid = false;
                break;
            }
        }
        if (valid)
            return {
                functions, completionGlobals, initialValues, structureValues,
                ...(dropped.length ? { droppedDependencyCalls: dropped } : {}),
                ...(initializers ? { customScriptInitializers: initializers } : {}),
            };
    }
    return recognizeEmbeddedLibraryMapInitialization(nodes, libraryId, definitions, globals, structures, triggerInitializers)
        ?? recognizeMapInitialization(nodes, libraryId, definitions, globals, structures, triggerInitializers);
}
/** Fold one or more complete editor-library startup bundles found inside a map
 * into the map's own variables/triggers. This removes the duplicate lib*_Init*
 * graph while preserving every initialization value in the structural model. */
function recognizeEmbeddedLibraryMapInitialization(nodes, libraryId, definitions, globals, structures, triggerInitializers) {
    if (libraryPrefix(libraryId) !== '')
        return undefined;
    const mapRootName = startupFunctionName(libraryId, 'InitLib');
    const mapLibrariesName = startupFunctionName(libraryId, 'InitLibraries');
    const mapRoot = definitions.get(mapRootName);
    const mapRootBody = plainBody(mapRoot);
    if (!mapRootBody || mapRootBody.locals.length || mapRootBody.rest.length !== 1 || callName(mapRootBody.rest[0]) !== mapLibrariesName)
        return undefined;
    const mapLibraries = definitions.get(mapLibrariesName);
    const mapLibrariesBody = plainBody(mapLibraries);
    if (!mapLibrariesBody || mapLibrariesBody.locals.length || !mapLibrariesBody.rest.length)
        return undefined;
    const outerCalls = mapLibrariesBody.rest.map(callName);
    if (outerCalls.some(name => !name || !/^lib[A-Za-z0-9_]+_(?:InitLib|InitVariables)$/u.test(name)))
        return undefined;
    const bundles = outerCalls
        .map(name => embeddedLibraryBundle(definitions, name))
        .filter((bundle) => !!bundle);
    if (!bundles.length)
        return undefined;
    const functions = new Set([mapRootName, mapLibrariesName]);
    const completionGlobals = new Set();
    const initialValues = new Map();
    const structureValues = [];
    const triggerCalls = [];
    for (const bundle of bundles) {
        const variableBody = guardedBody(bundle.variables);
        const libraryBody = plainBody(bundle.libraries);
        const triggerBody = plainBody(bundle.triggers);
        if (!variableBody || variableBody.flag === bundle.rootBody.flag || !libraryBody || libraryBody.locals.length ||
            !triggerBody || triggerBody.locals.length)
            return undefined;
        const dependencyCalls = libraryBody.rest.map(callName);
        if (dependencyCalls.some(name => !name || !/^lib[A-Za-z0-9_]+_(?:InitLib|InitVariables)$/u.test(name) || name.startsWith(`${bundle.prefix}_`)))
            return undefined;
        const localTriggerCalls = triggerBody.rest.map(callName);
        if (localTriggerCalls.some(name => !name || !triggerInitializers.has(name)))
            return undefined;
        const folded = foldInitialization(variableBody, globals, structures, new Set([bundle.rootBody.flag, variableBody.flag]));
        if (!folded)
            return undefined;
        for (const [name, value] of folded.initialValues) {
            if (initialValues.has(name))
                return undefined;
            initialValues.set(name, value);
        }
        structureValues.push(...folded.structureValues);
        triggerCalls.push(...localTriggerCalls);
        completionGlobals.add(bundle.rootBody.flag);
        completionGlobals.add(variableBody.flag);
        functions.add(bundle.rootName);
        for (const name of bundle.stageNames)
            functions.add(name);
    }
    const expectedTriggers = [...triggerInitializers];
    if (triggerCalls.length !== expectedTriggers.length || !triggerCalls.every((name, index) => name === expectedTriggers[index]))
        return undefined;
    if (![...completionGlobals].every(name => getTypeName(globals.get(name)?.type) === 'bool' &&
        unwrapParens(globals.get(name)?.initializer)?.kind === SyntaxKind.FalseKeyword))
        return undefined;
    const protectedStages = new Set([...functions].filter(name => name !== mapRootName));
    for (const node of nodes) {
        const name = node.name?.name;
        if (functions.has(name) || completionGlobals.has(name))
            continue;
        const used = identifierNames(node);
        if ([...completionGlobals].some(flag => used.has(flag)) || [...protectedStages].some(stage => used.has(stage)))
            return undefined;
    }
    return { functions, completionGlobals, initialValues, structureValues };
}
/** A map is not a library: its startup graph is InitMap calling InitLibs,
 *  InitGlobals and InitTriggers, none of them guarded by a completion flag.
 *  Left unrecognized, every one of those becomes a user FunctionDef in the
 *  reconstructed tree — generator scaffolding presented as authored work. */
function recognizeMapInitialization(nodes, libraryId, definitions, globals, structures, triggerInitializers) {
    if (libraryPrefix(libraryId) !== '')
        return undefined;
    const rootName = startupFunctionName(libraryId, 'InitLib');
    const [librariesName, variablesName, customScriptName, triggersName] = ['InitLibraries', 'InitVariables', 'InitCustomScript', 'InitTriggers'].map(role => startupFunctionName(libraryId, role));
    const root = definitions.get(rootName);
    const rootBody = root ? plainBody(root) : undefined;
    if (!rootBody || rootBody.locals.length)
        return undefined;
    if (definitions.size === 1 && globals.size === 0 && triggerInitializers.size === 0 && rootBody.rest.length === 0)
        return { functions: new Set([rootName]), completionGlobals: new Set(), initialValues: new Map(), structureValues: [] };
    const calls = rootBody.rest.map(callName);
    // The editor writes no variable stage for a map without global variables and
    // no custom script stage for one without custom script, and writes a trigger
    // stage for a map with any of these or with triggers: InitMap calls InitLibs,
    // the stages the map has and InitTriggers, or InitLibs alone (a map whose
    // triggers all live in a library it defines itself).
    const optional = calls.slice(1, -1).map(name => [variablesName, customScriptName].indexOf(name ?? ''));
    const ordered = optional.every((position, index) => position >= 0 && (index === 0 || position > optional[index - 1]));
    if (calls[0] !== librariesName || calls.length > 1 && (calls.at(-1) !== triggersName || !ordered))
        return undefined;
    const expected = calls;
    const libraries = definitions.get(librariesName);
    const triggers = calls.length > 1 ? definitions.get(triggersName) : undefined;
    const variables = calls.includes(variablesName) ? definitions.get(variablesName) : undefined;
    const customScript = calls.includes(customScriptName) ? definitions.get(customScriptName) : undefined;
    const staged = [libraries, ...(calls.length > 1 ? [triggers] : []), ...(variables ? [variables] : []), ...(calls.includes(customScriptName) ? [customScript] : [])];
    if (!staged.every(fn => fn?.body && getTypeName(fn.type) === 'void' && fn.parameters.length === 0))
        return undefined;
    const initializers = customScript ? customScriptInitializers(customScript, definitions, new Set([rootName, ...expected, ...triggerInitializers])) : undefined;
    if (customScript && !initializers)
        return undefined;
    // InitLibs holds one InitLib call per dependency. Dependency startup is
    // derived from element references, so those calls carry nothing additional.
    const libraryCalls = Array.from(libraries.body.statements).map(callName);
    if (!libraryCalls.length || !libraryCalls.every(name => !!name && /^lib[A-Za-z0-9]+_InitLib$/u.test(name)))
        return undefined;
    const triggerCalls = triggers ? Array.from(triggers.body.statements).map(callName) : [];
    if (triggerCalls.length !== triggerInitializers.size || !triggerCalls.every((name, i) => name === [...triggerInitializers][i]))
        return undefined;
    const variableBody = variables ? plainBody(variables) : undefined;
    if (variables && !variableBody)
        return undefined;
    const completionGlobals = new Set();
    // Only the stages this map actually has: a map that never calls InitGlobals may
    // still define a function by that name, and that one is the author's.
    const functions = new Set([rootName, ...expected]);
    for (const node of nodes) {
        const name = node.name?.name;
        if (node === root || node === variables)
            continue;
        // Calls to individual initialization stages carry observable ordering.
        if (!functions.has(name) && calls.some(stage => identifierNames(node).has(stage)))
            return undefined;
    }
    const custom = initializers ? { customScriptInitializers: initializers } : {};
    const folded = variableBody ? foldInitialization(variableBody, globals, structures, completionGlobals) : undefined;
    if (folded)
        return { functions, completionGlobals, ...folded, ...custom };
    // Nothing to schedule when the map has no variable stage at all.
    if (!variables)
        return { functions, completionGlobals, initialValues: new Map(), structureValues: [], ...custom };
    // This is still a structurally proven editor startup graph. Keeping its
    // reserved Init* functions as authored FunctionDefs makes the editor define
    // them a second time. Preserve only the ordered initialization body as a
    // scheduled CustomScript; this is the transparent fallback for effects the
    // Trigger XML variable model cannot encode independently.
    return {
        functions,
        completionGlobals,
        initialValues: new Map(),
        structureValues: [],
        customInitializerBody: variables.body,
        ...custom,
    };
}
