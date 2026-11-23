import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SyntaxKind as K } from './index-alternate-3.js';
import { literalByteSyntaxShape } from './literal-byte-syntax-shape.mjs';
import { threadedBodyName } from './initializer-origins.local-array-entry.qualified.mjs';
import { patchUniqueIdentifier } from '../../libraries/gui/patch-unique-abi-identifier.lossless.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const isIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const declarations = (ast, kind) =>
  new Map(
    ast.statements
      .filter((node) => node.kind === kind && node.name?.name)
      .map((node) => [node.name.name, node]),
  );
const isConstant = (node) =>
  node?.initializer && node.modifiers?.some((modifier) => modifier.kind === K.ConstKeyword);

function functionShape(node, syntaxShape, aliases) {
  if (!node?.body) return;
  const locals = node.body.statements.filter(
    (statement) => statement.kind === K.VariableDeclaration,
  );
  const slots = [...node.parameters, ...locals].map(({ name }) => name?.name);
  if (slots.some((name) => !name) || new Set(slots).size !== slots.length) return;
  const shape = literalByteSyntaxShape(node, syntaxShape);
  const countDeclarations = (value) =>
    value && typeof value === 'object'
      ? Number(value.kind === K.VariableDeclaration) +
        Object.values(value).reduce((count, child) => count + countDeclarations(child), 0)
      : 0;
  // The simple positional binding below covers only function-scope locals.
  if (countDeclarations(shape.body) !== locals.length) return;
  const names = new Map(aliases);
  slots.forEach((name, index) => names.set(name, '$slot' + index));
  const rewrite = (value, parent, field) => {
    if (!value || typeof value !== 'object') return;
    if (field === 'type' || (parent?.kind === K.PropertyAccessExpression && field === 'name'))
      return;
    if (value.kind === K.Identifier && names.has(value.name)) value.name = names.get(value.name);
    for (const [key, child] of Object.entries(value)) rewrite(child, value, key);
  };
  shape.name.name = '$function';
  rewrite(shape);
  return JSON.stringify(shape);
}

function constantShape(node, syntaxShape) {
  if (!isConstant(node)) return;
  const shape = literalByteSyntaxShape(node, syntaxShape);
  shape.name.name = '$constant';
  return JSON.stringify(shape);
}

function matchUnique(before, after, fingerprint) {
  const group = (rows) => {
    const index = new Map();
    for (const row of rows) {
      const key = fingerprint(row);
      if (key === undefined) continue;
      const values = index.get(key) ?? [];
      values.push(row);
      index.set(key, values);
    }
    return index;
  };
  const originals = group(before),
    observed = group(after),
    pairs = [];
  for (const [key, left] of originals) {
    const right = observed.get(key);
    if (left.length === 1 && right?.length === 1) pairs.push([left[0], right[0]]);
  }
  return pairs;
}

/** Galaxy can contain editor-assigned names missing from Triggers and every
 * locale. Restore an existing declaration's Identifier only when its emitted
 * AST is uniquely matched by the archived source. No GUI body is rebuilt here. */
export function prepareRuntimeIdentifierProbe({ xml, sourceAst, emittedAst, library, model }) {
  const anonymous = (element) =>
    !element.name &&
    element.identifier === undefined &&
    element.scriptCode === undefined &&
    element.expressionCode === undefined &&
    !element.flags?.some((flag) => flag === 'Native' || flag === 'NoScriptPrefix');
  const definitions = Object.values(library.elements).filter((e) => e.type === 'FunctionDef');
  const functions = definitions.filter(anonymous);
  if (!functions.length) return;
  const prefix = library.implicit ? '' : 'lib' + library.id + '_';
  const emitted = declarations(emittedAst, K.FunctionDeclaration);
  if (
    !sourceAst.statements.some(
      (node) =>
        node.kind === K.FunctionDeclaration &&
        node.body &&
        node.name.name.startsWith(prefix + 'gf_') &&
        !emitted.has(node.name.name),
    )
  )
    return;

  // Anonymous authored entries are skipped by the emitter. Give only those
  // entries temporary names in a separate XML view so their bodies are visible
  // to the ordinary compiler and can be compared with the archived Galaxy.
  let view = xml;
  const records = [];
  const vars = model.globalVariables(library).filter(anonymous);
  const formalOwners = new Map();
  for (const definition of definitions)
    for (const ref of definition.parameters ?? []) {
      if ((ref.library ?? library.id) !== library.id) continue;
      formalOwners.set(ref.id, (formalOwners.get(ref.id) ?? 0) + 1);
    }
  for (const element of [...functions, ...vars]) {
    const { type, id } = element;
    if (!/^[A-Fa-f0-9]{8}$/u.test(id)) continue;
    const stem = 'RecoveryProbe_' + id;
    let patched = patchUniqueIdentifier(view, { type, id, stem });
    if (patched === null) continue;
    const parameters = [];
    for (const [index, ref] of (element.parameters ?? []).entries()) {
      if (
        (ref.library ?? library.id) !== library.id ||
        formalOwners.get(ref.id) !== 1 ||
        !/^[A-Fa-f0-9]{8}$/u.test(ref.id)
      )
        continue;
      const formal = model.lookupElementIn(library, ref);
      if (formal?.type !== 'ParamDef' || !anonymous(formal)) continue;
      patched = patchUniqueIdentifier(patched, {
        type: formal.type,
        id: formal.id,
        stem: 'RecoveryProbe_' + formal.id,
      });
      if (patched === null) break;
      parameters.push({
        id: formal.id,
        index: index + Number(element.flags?.includes('Event') === true),
      });
    }
    if (patched === null) continue;
    view = patched;
    records.push({
      type,
      id,
      parameters,
      symbol: prefix + (type === 'Variable' ? 'gv_' : 'gf_') + stem,
    });
  }
  return records.some(({ type }) => type === 'FunctionDef')
    ? { xml: view, records, prefix }
    : undefined;
}

export function reconcileAuthoredRuntimeIdentifiers({
  xml,
  sourceAst,
  emittedAst,
  probe,
  probeAst,
  syntaxShape,
}) {
  const proof = {
    kind: 'SOURCE_QUALIFIED_AUTHORED_RUNTIME_IDENTIFIERS',
    records: [],
    originalXmlSha256: sha(xml),
    newElements: 0,
    newRaw: 0,
    newNative: 0,
  };
  const { prefix } = probe;
  const generatedVars = declarations(emittedAst, K.VariableDeclaration);
  const probeVars = declarations(probeAst, K.VariableDeclaration);
  const sourceVars = declarations(sourceAst, K.VariableDeclaration);
  const unmatched = (original, observed, stem) =>
    [...observed]
      .filter(([symbol]) => symbol.startsWith(stem) && !original.has(symbol))
      .map(([symbol, node]) => ({ symbol, node }));
  const oldVars = probe.records
    .filter(({ type }) => type === 'Variable')
    .map((element) => ({ element, symbol: element.symbol, node: probeVars.get(element.symbol) }));
  const constants = matchUnique(
    oldVars,
    unmatched(generatedVars, sourceVars, prefix + 'gv_'),
    ({ node }) => constantShape(node, syntaxShape),
  );

  let output = xml;
  const aliases = new Map();
  function insert(before, after, stem, parameters = []) {
    const identifier = after.symbol.slice(stem.length);
    if (!isIdentifier.test(identifier)) return;
    const { type, id } = before.element;
    let patched = patchUniqueIdentifier(output, { type, id, stem: identifier });
    if (patched === null) return;
    for (const parameter of parameters) {
      patched = patchUniqueIdentifier(patched, {
        type: 'ParamDef',
        id: parameter.id,
        stem: parameter.identifier,
      });
      if (patched === null) return;
    }
    output = patched;
    proof.records.push({
      type,
      id,
      probeSymbol: before.symbol,
      sourceSymbol: after.symbol,
      identifier,
      criterion: type === 'Variable' ? 'exact-constant' : 'exact-function-and-lexical-slots',
      ...(parameters.length ? { parameters } : {}),
    });
    return true;
  }
  for (const [before, after] of constants)
    if (insert(before, after, prefix + 'gv_')) aliases.set(before.symbol, after.symbol);

  const emittedFunctions = declarations(emittedAst, K.FunctionDeclaration);
  const probeFunctions = declarations(probeAst, K.FunctionDeclaration);
  const sourceFunctions = declarations(sourceAst, K.FunctionDeclaration);
  const oldFunctions = probe.records
    .filter(({ type }) => type === 'FunctionDef')
    .map((element) => ({
      element,
      symbol: element.symbol,
      node: probeFunctions.get(element.symbol),
    }));
  const sourceMissing = unmatched(emittedFunctions, sourceFunctions, prefix + 'gf_');
  const pairs = matchUnique(oldFunctions, sourceMissing, (row) =>
    functionShape(row.node, syntaxShape, row.element ? aliases : new Map()),
  );
  for (const [before, after] of pairs) {
    // A real threaded wrapper also owns an indirect callback. Matching its
    // public signature and body alone is insufficient.
    if (
      probeFunctions.has(threadedBodyName(before.symbol)) ||
      sourceFunctions.has(threadedBodyName(after.symbol))
    )
      continue;
    const parameters = before.element.parameters.map(({ id, index }) => ({
      id,
      index,
      name: after.node.parameters[index]?.name?.name,
    }));
    if (parameters.some(({ name }) => !/^lp_[A-Za-z_][A-Za-z0-9_]*$/u.test(name ?? ''))) continue;
    insert(
      before,
      after,
      prefix + 'gf_',
      parameters.map(({ id, index, name }) => ({ id, index, identifier: name })),
    );
  }
  return proof.records.some(({ type }) => type === 'FunctionDef')
    ? { xml: output, proof }
    : { xml, proof: { ...proof, records: [] } };
}

export function assertRuntimeIdentifiersEmitted(proof, sourceAst, emittedAst, syntaxShape) {
  const generatedVars = declarations(emittedAst, K.VariableDeclaration);
  const sourceVars = declarations(sourceAst, K.VariableDeclaration);
  const generatedFunctions = declarations(emittedAst, K.FunctionDeclaration);
  const sourceFunctions = declarations(sourceAst, K.FunctionDeclaration);
  for (const { type, sourceSymbol, probeSymbol, parameters } of proof.records) {
    const variable = type === 'Variable';
    const current = variable ? generatedVars : generatedFunctions;
    const wanted = variable ? sourceVars : sourceFunctions;
    const fingerprint = (node) =>
      variable ? constantShape(node, syntaxShape) : functionShape(node, syntaxShape, new Map());
    assert(!current.has(probeSymbol), 'Probe runtime symbol was emitted: ' + probeSymbol);
    const actual = fingerprint(current.get(sourceSymbol));
    assert(
      actual && actual === fingerprint(wanted.get(sourceSymbol)),
      'Authored runtime identifier failed its source-identity check: ' + sourceSymbol,
    );
    for (const { index, identifier } of parameters ?? [])
      assert.equal(
        current.get(sourceSymbol).parameters[index].name.name,
        identifier,
        'Authored runtime parameter did not retain its source name: ' + sourceSymbol,
      );
  }
}
