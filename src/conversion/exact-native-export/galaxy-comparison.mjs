import { syntaxShape } from './script-template-alternate-4.mjs';
function canonicalName(name, options) {
  const ownPrefix = options.libraryId ? `lib${options.libraryId}_gt_` : '';
  if (ownPrefix && name.startsWith(ownPrefix)) return `gt_${name.slice(ownPrefix.length)}`;
  if (options.implicitLibrary === true) {
    const mapPrefix = 'libMap_gt_';
    if (name.startsWith(mapPrefix)) return `gt_${name.slice(mapPrefix.length)}`;
  }
  return name;
}
function isEmptyBlock(value) {
  return (
    value?.kind === 128 /* SyntaxKind.Block */ &&
    (!Array.isArray(value.statements) || value.statements.length === 0)
  );
}
const isBoolLiteral = (node) =>
  node?.kind === 67 /* SyntaxKind.TrueKeyword */ || node?.kind === 68; /* SyntaxKind.FalseKeyword */
const not = (operand) =>
  operand?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
  operand.operator?.kind === 32 /* SyntaxKind.ExclamationToken */
    ? operand.operand
    : {
        kind: 122 /* SyntaxKind.PrefixUnaryExpression */,
        operator: { kind: 32 /* SyntaxKind.ExclamationToken */ },
        operand,
      };
/**
 * Keep semantic AST fields while removing source formatting and the editor's
 * explicit empty `else {}` blocks.  Identifier spelling otherwise remains
 * exact: silently alpha-renaming a variable can hide a wrong binding.
 *
 * `tolerated` also rewrites forms that mean the same program but that the
 * GUI writes its own way, so hand-written code compares with its conversion:
 * `x == true` and `x != false` are `x`, `x == false` and `x != true` are `!x`,
 * and a local's initializer is its assignment right after the declarations
 * (`int p = X;` and `int lv_p; lv_p = X;`). The benchmark counts such an item
 * as a difference, not an error.
 */
function normalizedShape(value, options, localNames, tolerated = false) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value))
    return value.map((child) => normalizedShape(child, options, localNames, tolerated));
  const shaped = syntaxShape(value);
  const visit = (node, parentKind, parentKey) => {
    if (node === undefined || node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      // A semicolon between block statements is an inert EmptyStatement.
      // A semicolon used as an if/while/for body is not a block child and
      // remains significant in the comparison.
      let children = node
        .filter(
          (child) =>
            !(
              (
                parentKey === 'statements' &&
                parentKind === 128 /* SyntaxKind.Block */ &&
                child?.kind === 139
              ) /* SyntaxKind.EmptyStatement */
            ),
        )
        .map((child) => visit(child, parentKind, parentKey));
      if (parentKey !== 'statements') return children;
      if (tolerated) {
        let leading = 0;
        while (children[leading]?.kind === 141 /* SyntaxKind.VariableDeclaration */) leading += 1;
        const declarations = [],
          assignments = [];
        for (const declaration of children.slice(0, leading)) {
          const constant = (declaration.modifiers ?? []).some(
            (modifier) => modifier?.kind === 53 /* SyntaxKind.ConstKeyword */,
          );
          if (constant || declaration.initializer === undefined) {
            declarations.push(declaration);
            continue;
          }
          const { initializer, ...uninitialized } = declaration;
          declarations.push(uninitialized);
          assignments.push({
            kind: 138 /* SyntaxKind.ExpressionStatement */,
            expression: {
              kind: 124 /* SyntaxKind.BinaryExpression */,
              left: { ...declaration.name },
              right: initializer,
              operatorToken: { kind: 39 /* SyntaxKind.EqualsToken */ },
            },
          });
        }
        children = [...declarations, ...assignments, ...children.slice(leading)];
      }
      let declarationCount = 0;
      while (declarationCount < children.length) {
        const child = children[declarationCount];
        if (
          child?.kind !== 141 /* SyntaxKind.VariableDeclaration */ ||
          child.initializer !== undefined
        )
          break;
        declarationCount += 1;
      }
      if (declarationCount < 2) return children;
      // Uninitialized declarations at the start of one lexical block have no
      // evaluation order. The editor moves auto variables before ordinary
      // locals while the structured converter groups them the other way.
      const declarations = children
        .slice(0, declarationCount)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      return [...declarations, ...children.slice(declarationCount)];
    }
    if (
      node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
      node.operator?.kind === 32 /* SyntaxKind.ExclamationToken */ &&
      (node.operand?.kind === 67 /* SyntaxKind.TrueKeyword */ ||
        node.operand?.kind === 68) /* SyntaxKind.FalseKeyword */
    ) {
      return {
        kind:
          node.operand.kind === 67 /* SyntaxKind.TrueKeyword */
            ? 68 /* SyntaxKind.FalseKeyword */
            : 67 /* SyntaxKind.TrueKeyword */,
      };
    }
    if (
      node.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      (node.operatorToken?.kind === 17 /* SyntaxKind.EqualsEqualsToken */ ||
        node.operatorToken?.kind === 18) /* SyntaxKind.ExclamationEqualsToken */ &&
      (node.left?.kind === 67 /* SyntaxKind.TrueKeyword */ ||
        node.left?.kind === 68) /* SyntaxKind.FalseKeyword */ &&
      (node.right?.kind === 67 /* SyntaxKind.TrueKeyword */ ||
        node.right?.kind === 68) /* SyntaxKind.FalseKeyword */
    ) {
      const equal = node.left.kind === node.right.kind;
      return {
        kind:
          equal === (node.operatorToken.kind === 17) /* SyntaxKind.EqualsEqualsToken */
            ? 67 /* SyntaxKind.TrueKeyword */
            : 68 /* SyntaxKind.FalseKeyword */,
      };
    }
    if (
      tolerated &&
      node.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      (node.operatorToken?.kind === 17 /* SyntaxKind.EqualsEqualsToken */ ||
        node.operatorToken?.kind === 18) /* SyntaxKind.ExclamationEqualsToken */ &&
      isBoolLiteral(node.left) !== isBoolLiteral(node.right)
    ) {
      const literal = isBoolLiteral(node.left) ? node.left : node.right;
      const operand = visit(
        isBoolLiteral(node.left) ? node.right : node.left,
        node.kind,
        'operand',
      );
      const truth =
        (literal.kind === 67) /* SyntaxKind.TrueKeyword */ ===
        (node.operatorToken.kind === 17); /* SyntaxKind.EqualsEqualsToken */
      return truth ? operand : not(operand);
    }
    if (
      tolerated &&
      node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
      node.operator?.kind === 32 /* SyntaxKind.ExclamationToken */
    ) {
      return not(visit(node.operand, node.kind, 'operand'));
    }
    const result = {};
    for (const [key, child] of Object.entries(node)) {
      if (key === 'elseStatement' && isEmptyBlock(child)) continue;
      if (
        key === 'name' &&
        node.kind === 113 /* SyntaxKind.Identifier */ &&
        typeof child === 'string'
      ) {
        const isMemberName =
          parentKind === 120 /* SyntaxKind.PropertyAccessExpression */ && parentKey === 'name';
        result[key] =
          !isMemberName && localNames?.has(child)
            ? localNames.get(child)
            : canonicalName(child, options);
      } else {
        result[key] = visit(child, node.kind, key);
      }
    }
    if (
      node.kind === 121 /* SyntaxKind.CallExpression */ &&
      (node.expression?.name === 'Color' || node.expression?.name === 'ColorWithAlpha')
    ) {
      // These native arguments are fixed values; the editor may print an
      // integral fixed literal as 0.00. Do not normalize arithmetic operands.
      for (const argument of result['arguments'] ?? []) {
        if (argument?.kind === 2 /* SyntaxKind.NumericLiteral */) argument.numericType = 'fixed';
      }
    }
    return result;
  };
  return visit(shaped);
}
function shapeText(value, options, localNames) {
  return JSON.stringify(normalizedShape(value, options, localNames));
}
const semanticChildKeys = [
  'statements',
  'initializer',
  'expression',
  'arguments',
  'left',
  'right',
  'operand',
  'thenStatement',
  'elseStatement',
  'statement',
  'condition',
  'incrementor',
  'body',
  'properties',
  'members',
  'argumentExpression',
  'size',
];
/** Canonicalize only identifiers proven to be parameters or locals of this
 * function.  Positional binding remains strict, so using the wrong local is
 * still a difference while harmless editor-generated spelling is ignored. */
function functionParameterNames(node) {
  return Array.from(node.parameters ?? [])
    .map((parameter) => parameter?.name?.name)
    .filter((name) => typeof name === 'string');
}
function functionDeclaredLocalNames(node) {
  const result = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (value.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      const name = value.name?.name;
      if (typeof name === 'string' && !seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
    for (const key of semanticChildKeys) visit(value[key]);
  };
  visit(node.body);
  return result;
}
function functionUsedLocalNames(node, declaredNames) {
  const declared = new Set(declaredNames);
  const used = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (value.kind === 141 /* SyntaxKind.VariableDeclaration */) {
      visit(value.initializer);
      return;
    }
    if (value.kind === 113 /* SyntaxKind.Identifier */) {
      if (declared.has(value.name) && !seen.has(value.name)) {
        seen.add(value.name);
        used.push(value.name);
      }
      return;
    }
    for (const key of semanticChildKeys) visit(value[key]);
  };
  visit(node.body);
  return used;
}
function functionLocalNames(node) {
  const names = new Map();
  for (const [index, name] of functionParameterNames(node).entries()) names.set(name, `$p${index}`);
  for (const [index, name] of functionDeclaredLocalNames(node).entries()) {
    if (!names.has(name)) names.set(name, `$v${index}`);
  }
  return names;
}
/** Build paired alpha-renaming maps. Exact local names are stronger evidence
 * than declaration order (the editor moves auto variables between sections),
 * while remaining renamed locals still match positionally. */
export function pairedFunctionLocalNames(expected, actual) {
  const expectedMap = new Map();
  const actualMap = new Map();
  const expectedParameters = functionParameterNames(expected);
  const actualParameters = functionParameterNames(actual);
  for (
    let index = 0;
    index < Math.max(expectedParameters.length, actualParameters.length);
    index += 1
  ) {
    if (expectedParameters[index]) expectedMap.set(expectedParameters[index], `$p${index}`);
    if (actualParameters[index]) actualMap.set(actualParameters[index], `$p${index}`);
  }
  const expectedLocals = functionDeclaredLocalNames(expected).filter(
    (name) => !expectedMap.has(name),
  );
  const actualLocals = functionDeclaredLocalNames(actual).filter((name) => !actualMap.has(name));
  const actualSet = new Set(actualLocals);
  const common = expectedLocals.filter((name) => actualSet.has(name)).sort();
  let localIndex = 0;
  for (const name of common) {
    const canonical = `$v${localIndex++}`;
    expectedMap.set(name, canonical);
    actualMap.set(name, canonical);
  }
  // Generated auto IDs are unstable, and the editor may declare loop groups
  // in a different order. Pair each suffix by first use, then compare the
  // complete AST so a wrong binding or changed operation still fails.
  const autoSuffix = (name) => /^auto[A-Za-z0-9]+_([A-Za-z0-9]+)$/u.exec(name)?.[1];
  if (
    expectedLocals.some((name) => !expectedMap.has(name) && autoSuffix(name)) &&
    actualLocals.some((name) => !actualMap.has(name) && autoSuffix(name))
  ) {
    const actualAutoBySuffix = new Map();
    for (const name of functionUsedLocalNames(actual, actualLocals)) {
      const suffix = autoSuffix(name);
      if (!suffix || actualMap.has(name)) continue;
      const names = actualAutoBySuffix.get(suffix) ?? [];
      names.push(name);
      actualAutoBySuffix.set(suffix, names);
    }
    for (const name of functionUsedLocalNames(expected, expectedLocals)) {
      const suffix = autoSuffix(name);
      if (!suffix || expectedMap.has(name)) continue;
      const match = actualAutoBySuffix.get(suffix)?.shift();
      if (!match) continue;
      const canonical = `$v${localIndex++}`;
      expectedMap.set(name, canonical);
      actualMap.set(match, canonical);
    }
  }
  const expectedRemaining = expectedLocals.filter((name) => !expectedMap.has(name));
  const actualRemaining = actualLocals.filter((name) => !actualMap.has(name));
  for (
    let index = 0;
    index < Math.max(expectedRemaining.length, actualRemaining.length);
    index += 1
  ) {
    const canonical = `$v${localIndex + index}`;
    if (expectedRemaining[index]) expectedMap.set(expectedRemaining[index], canonical);
    if (actualRemaining[index]) actualMap.set(actualRemaining[index], canonical);
  }
  return [expectedMap, actualMap];
}
function collectNamed(source, predicate, key, options) {
  const values = new Map();
  const duplicates = new Set();
  for (const node of Array.from(source.statements)) {
    const name = node.name?.name;
    if (typeof name !== 'string' || !predicate(node)) continue;
    const canonical = canonicalName(name, options);
    const itemKey = key(node, canonical);
    if (values.has(itemKey)) duplicates.add(itemKey);
    else values.set(itemKey, { name, node });
  }
  return { values, duplicates: [...duplicates].sort() };
}
function compareNamed(left, right, options, project = (node) => node, canonicalizeLocals = false) {
  const exact = [];
  const equivalent = [];
  const missing = [];
  const differing = [];
  const differenceSamples = [];
  for (const [key, expected] of left.values) {
    const actual = right.values.get(key);
    if (!actual) missing.push(expected.name);
    else {
      const pairedLocals = canonicalizeLocals
        ? pairedFunctionLocalNames(expected.node, actual.node)
        : undefined;
      const expectedShape = normalizedShape(project(expected.node), options, pairedLocals?.[0]);
      const actualShape = normalizedShape(project(actual.node), options, pairedLocals?.[1]);
      if (JSON.stringify(expectedShape) === JSON.stringify(actualShape)) exact.push(expected.name);
      else if (
        JSON.stringify(
          normalizedShape(project(expected.node), options, pairedLocals?.[0], true),
        ) ===
        JSON.stringify(normalizedShape(project(actual.node), options, pairedLocals?.[1], true))
      )
        equivalent.push(expected.name);
      else {
        differing.push(expected.name);
        const difference = firstDifference(expectedShape, actualShape);
        if (difference && differenceSamples.length < (options.sampleLimit ?? 20)) {
          differenceSamples.push({ name: expected.name, ...difference });
        }
      }
    }
  }
  return {
    expected: left.values.size,
    actual: right.values.size,
    exact: exact.sort(),
    equivalent: equivalent.sort(),
    missing: missing.sort(),
    added: [...right.values]
      .filter(([key]) => !left.values.has(key))
      .map(([, value]) => value.name)
      .sort(),
    differing: differing.sort(),
    duplicateExpected: left.duplicates,
    duplicateActual: right.duplicates,
    differenceSamples,
  };
}
function sampleValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  const text = JSON.stringify(value);
  return text.length <= 500 ? value : `${text.slice(0, 497)}...`;
}
function firstDifference(expected, actual, path = '$') {
  if (Object.is(expected, actual)) return undefined;
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object'
  ) {
    return { path, expected: sampleValue(expected), actual: sampleValue(actual) };
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual))
      return { path, expected: sampleValue(expected), actual: sampleValue(actual) };
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const difference = firstDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return undefined;
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  for (const key of keys) {
    const difference = firstDifference(expected[key], actual[key], `${path}.${key}`);
    if (difference) return difference;
  }
  return undefined;
}
function functionSignature(node) {
  return {
    kind: node.kind,
    name: node.name,
    type: node.type,
    modifiers: node.modifiers,
    parameters: node.parameters,
  };
}
function collectSignatures(source, options) {
  const values = new Map();
  const duplicates = new Set();
  for (const node of Array.from(source.statements)) {
    if (
      node.kind !== 142 /* SyntaxKind.FunctionDeclaration */ ||
      typeof node.name?.name !== 'string'
    )
      continue;
    const key = canonicalName(node.name.name, options);
    const existing = values.get(key);
    if (!existing) {
      values.set(key, { name: node.name.name, node });
      continue;
    }
    // A generated header prototype and its script definition are one Galaxy
    // declaration. Only incompatible repeated signatures are duplicates.
    if (
      shapeText(functionSignature(existing.node), options) !==
      shapeText(functionSignature(node), options)
    ) {
      duplicates.add(key);
    } else if (!existing.node.body && node.body) {
      values.set(key, { name: node.name.name, node });
    }
  }
  return { values, duplicates: [...duplicates].sort() };
}
function countCalls(
  source,
  options,
  include = () => true,
  argumentsMatter = true,
  localNamesByFunction,
) {
  const counts = new Map();
  const visit = (node, localNames) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, localNames);
      return;
    }
    if (
      node.kind === 121 /* SyntaxKind.CallExpression */ &&
      node.expression?.kind === 113 /* SyntaxKind.Identifier */
    ) {
      const callee = canonicalName(String(node.expression.name), options);
      if (include(callee)) {
        const fingerprint = argumentsMatter
          ? `${callee}:${JSON.stringify(normalizedShape(node, options, localNames, true).arguments ?? [])}`
          : callee;
        counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
      }
    }
    // Parser parent/source metadata is cyclic. These are the semantic child
    // slots used by the Galaxy grammar and by syntaxShape.
    for (const key of semanticChildKeys) visit(node[key], localNames);
  };
  for (const statement of Array.from(source.statements)) {
    if (statement.kind === 142 /* SyntaxKind.FunctionDeclaration */) {
      visit(statement.body, localNamesByFunction?.get(statement) ?? functionLocalNames(statement));
    } else visit(statement);
  }
  return counts;
}
function pairedLocalNameMaps(expected, actual) {
  const expectedMaps = new Map();
  const actualMaps = new Map();
  for (const [key, expectedFunction] of expected.values) {
    const actualFunction = actual.values.get(key);
    if (!actualFunction) continue;
    const [expectedNames, actualNames] = pairedFunctionLocalNames(
      expectedFunction.node,
      actualFunction.node,
    );
    expectedMaps.set(expectedFunction.node, expectedNames);
    actualMaps.set(actualFunction.node, actualNames);
  }
  return [expectedMaps, actualMaps];
}
function compareCounts(left, right, limit) {
  const missing = [];
  const added = [];
  for (const [call, count] of left) {
    const delta = count - (right.get(call) ?? 0);
    if (delta > 0) missing.push({ call, count: delta });
  }
  for (const [call, count] of right) {
    const delta = count - (left.get(call) ?? 0);
    if (delta > 0) added.push({ call, count: delta });
  }
  const byCall = (a, b) => a.call.localeCompare(b.call);
  missing.sort(byCall);
  added.sort(byCall);
  return {
    exact: missing.length === 0 && added.length === 0,
    missingCount: missing.reduce((sum, item) => sum + item.count, 0),
    addedCount: added.reduce((sum, item) => sum + item.count, 0),
    missingSamples: missing.slice(0, limit),
    addedSamples: added.slice(0, limit),
  };
}
function compareTopLevelSequence(expected, actual, options, predicate) {
  const project = (source) =>
    Array.from(source.statements)
      .filter(predicate)
      // syntaxShape intentionally keeps only syntax slots used by templates;
      // IncludeStatement.path is not one of those slots, yet it selects the
      // source unit and therefore cannot be discarded by the verifier.
      .map((node) =>
        node.kind === 136 /* SyntaxKind.IncludeStatement */
          ? { kind: node.kind, path: node.path?.value ?? node.path?.text }
          : normalizedShape(node, options),
      );
  const left = project(expected);
  const right = project(actual);
  const difference = firstDifference(left, right);
  return {
    expected: left.length,
    actual: right.length,
    exact: difference === undefined,
    ...(difference === undefined ? {} : { difference }),
  };
}
export function compareGalaxyPrograms(expected, actual, options = {}) {
  const functionPredicate = (node) =>
    node.kind === 142 /* SyntaxKind.FunctionDeclaration */ && node.body;
  const declarationPredicate = (node) =>
    node.kind === 141 /* SyntaxKind.VariableDeclaration */ ||
    node.kind === 140 /* SyntaxKind.StructDeclaration */ ||
    node.kind === 145; /* SyntaxKind.TypedefDeclaration */
  const functionKey = (_node, name) => name;
  const declarationKey = (node, name) => `${node.kind}:${name}`;
  const leftFunctions = collectNamed(expected, functionPredicate, functionKey, options);
  const rightFunctions = collectNamed(actual, functionPredicate, functionKey, options);
  const [leftLocalNames, rightLocalNames] = pairedLocalNameMaps(leftFunctions, rightFunctions);
  const functions = compareNamed(leftFunctions, rightFunctions, options, (node) => node.body, true);
  const signatures = compareNamed(
    collectSignatures(expected, options),
    collectSignatures(actual, options),
    options,
    functionSignature,
    true,
  );
  const declarations = compareNamed(
    collectNamed(expected, declarationPredicate, declarationKey, options),
    collectNamed(actual, declarationPredicate, declarationKey, options),
    options,
  );
  const includes = compareTopLevelSequence(
    expected,
    actual,
    options,
    (node) => node.kind === 136 /* SyntaxKind.IncludeStatement */,
  );
  const globalInitializers = compareTopLevelSequence(
    expected,
    actual,
    options,
    (node) =>
      node.kind === 141 /* SyntaxKind.VariableDeclaration */ && node.initializer !== undefined,
  );
  const calls = compareCounts(
    countCalls(expected, options, () => true, true, leftLocalNames),
    countCalls(actual, options, () => true, true, rightLocalNames),
    options.sampleLimit ?? 20,
  );
  const callees = compareCounts(
    countCalls(expected, options, () => true, false, leftLocalNames),
    countCalls(actual, options, () => true, false, rightLocalNames),
    options.sampleLimit ?? 20,
  );
  const isRegistration = (callee) =>
    callee === 'TriggerCreate' || /^Trigger(?:AddEvent|Register|Enable)/u.test(callee);
  const triggerRegistrations = compareCounts(
    countCalls(expected, options, isRegistration, true, leftLocalNames),
    countCalls(actual, options, isRegistration, true, rightLocalNames),
    options.sampleLimit ?? 20,
  );
  const itemExact = (value) =>
    value.missing.length === 0 &&
    value.added.length === 0 &&
    value.differing.length === 0 &&
    value.duplicateExpected.length === 0 &&
    value.duplicateActual.length === 0;
  const syntaxValid =
    expected.parseDiagnostics.length === 0 && actual.parseDiagnostics.length === 0;
  const tolerated = [functions, signatures, declarations].some(
    (value) => value.equivalent.length > 0,
  );
  return {
    functions,
    signatures,
    declarations,
    includes,
    globalInitializers,
    calls,
    callees,
    triggerRegistrations,
    syntaxValid,
    tolerated,
    exact:
      syntaxValid &&
      itemExact(functions) &&
      itemExact(signatures) &&
      itemExact(declarations) &&
      includes.exact &&
      globalInitializers.exact &&
      calls.exact &&
      triggerRegistrations.exact,
  };
}
//# sourceMappingURL=galaxy-comparison.js.map
