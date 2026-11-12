import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
// Comparison view only: bound const-int values in exact integer contexts.
// Existing calls, declarations, argument order and runtime bodies stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lazy-carriers.mjs';
import {partitionDeclarationViews, logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K, Printer, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const comparisons = new Set([K.LessThanToken, K.LessThanEqualsToken, K.GreaterThanToken, K.GreaterThanEqualsToken, K.EqualsEqualsToken, K.ExclamationEqualsToken]);
const printer = new Printer();
const bounded = value => value >= -2147483648n && value <= 2147483647n;
export function canonicalBoundIntegerExtentsAndBounds(source, context = {}) {
  const proof = {kind: 'BOUND_CONST_INT_EXTENTS_BOUNDS_AND_BY_VALUE_FORMALS', edits: [], sourceOrExportChanged: false,
    rawOracleReplaced: false, wholeMapAccepted: false, callsAndDeclarationsRetained: true};
  const unchanged = reason => ({text: source, proof: {...proof, reason}});
  const root = {fileName: 'MapScript.galaxy', text: source}, owned = context.ownedSources ?? [];
  const views = partitionDeclarationViews(owned, context.externalSources ?? []);
  if (views.conflicts.length) return unchanged('CONFLICTING_SOURCE_VIEWS');
  const closure = removeAlreadyLoadedOwnedIncludes({root, ownedSources: owned, externalSources: views.external,
    includeEvidence: context.includeEvidence ?? [], includeRoot: false}).proof;
  if (!closure.completeReachableClosure) return unchanged('INCOMPLETE_INCLUDE_CLOSURE');
  const reached = new Map(closure.resolvedFiles.map(file => [logicalSourcePath(file.path), file.sha256]));
  const files = [], seen = new Set(), ownedPaths = new Set(owned.map(file => logicalSourcePath(file.originalPath ?? file.fileName)));
  for (const file of [root, ...owned, ...views.external]) {
    const fileName = logicalSourcePath(file.originalPath ?? file.fileName), digest = sha(file.text);
    if (!reached.has(fileName) || seen.has(fileName)) continue;
    assert.equal(reached.get(fileName), digest, 'CONST_BOUND_INCLUDE_CONTENT_CHANGED');seen.add(fileName);
    files.push({fileName, text: file.text, owned: file === root || ownedPaths.has(fileName), sourceId: 'const-bound:' + fileName, contentSha256: digest});
  }
  const program = new GalaxyProgramContext(files, {files}, sha, {checks: 'binding'});
  try {
    for (const ast of program.documents.values()) program.attachOriginal(ast);
    const ast = program.documents.get(logicalSourcePath(root.fileName));
    const names = new Map();
    for (const document of program.documents.values()) for (const node of document.statements) if (node.name?.name) {
      const rows = names.get(node.name.name) ?? [];rows.push(node);names.set(node.name.name, rows);
    }
    const evaluate = (node, active = new Set(), depth = 0, budget = {remaining: 256}) => {
      if (!node || depth > 32 || --budget.remaining < 0) return;
      if (node.kind === K.ParenthesizedExpression) return evaluate(node.expression, active, depth + 1, budget);
      if (node.kind === K.NumericLiteral) {
        if (!/^(?:0|[1-9][0-9]*)$/u.test(node.text ?? '') || node.text.length > 10) return;
        const value = BigInt(node.text);return bounded(value) ? {value, witnesses: []} : undefined;
      }
      if (node.kind === K.Identifier) {
        const binding = program.getBinding(node), declaration = program.declarationAt(node);
        if (binding.status !== 'BOUND' || declaration?.kind !== K.VariableDeclaration || declaration.type.kind !== K.IntKeyword ||
          declaration.modifiers?.length !== 1 || declaration.modifiers[0].kind !== K.ConstKeyword || active.has(declaration)) return;
        const where = program.location(declaration);
        if (!where?.contentSha256 || program.verifiedInputIdentity(where.sourceFile)?.contentSha256 !== where.contentSha256) return;
        const next = new Set(active);next.add(declaration);
        const result = evaluate(declaration.initializer, next, depth + 1, budget);if (!result) return;
        return {value: result.value, witnesses: [...result.witnesses, {name: declaration.name.name, symbolId: binding.symbolId,
          source: where, value: result.value.toString(), carrier: 'int', readonly: true}]};
      }
      if (node.kind === K.PrefixUnaryExpression && [K.PlusToken, K.MinusToken].includes(node.operator?.kind)) {
        const result = evaluate(node.operand, active, depth + 1, budget);if (!result) return;
        const value = node.operator.kind === K.MinusToken ? -result.value : result.value;
        return bounded(value) ? {...result, value} : undefined;
      }
      if (node.kind !== K.BinaryExpression || ![K.PlusToken, K.MinusToken, K.AsteriskToken].includes(node.operatorToken.kind)) return;
      const left = evaluate(node.left, active, depth + 1, budget), right = evaluate(node.right, active, depth + 1, budget);
      if (!left || !right) return;
      const value = node.operatorToken.kind === K.PlusToken ? left.value + right.value : node.operatorToken.kind === K.MinusToken ? left.value - right.value : left.value * right.value;
      return bounded(value) ? {value, witnesses: [...left.witnesses, ...right.witnesses]} : undefined;
    };
    const add = (node, role, formal) => {
      const result = evaluate(node);
      if (!result?.witnesses.length || role === 'array-extent' && result.value <= 0n) return;
      proof.edits.push({start: node.pos, end: node.end, before: source.slice(node.pos, node.end),
        replacement: result.value < 0n ? '(' + result.value + ')' : result.value.toString(), role, ...(formal ? {formal} : {}), witnesses: result.witnesses,
        everyIntermediateWithinSignedInt32: true, expectedCarrier: 'int'});
    };
    const visit = node => {
      if (node.kind === K.ArrayType) add(node.size, 'array-extent');
      if (node.kind === K.CallExpression && node.expression.kind === K.Identifier) {
        const target = program.declarationAt(node.expression), rows = names.get(node.expression.name) ?? [];
        if (target?.kind === K.FunctionDeclaration && rows.includes(target) && rows.every(row =>
          row.kind === K.FunctionDeclaration && row.parameters.length === node.arguments.length &&
          row.parameters.every((parameter, i) => parameter.isReference === target.parameters[i]?.isReference &&
            printer.printNode(parameter.type) === printer.printNode(target.parameters[i].type)) &&
          printer.printNode(row.type) === printer.printNode(target.type))) {
          const location = program.location(target);
          if (location?.contentSha256 && program.verifiedInputIdentity(location.sourceFile)?.contentSha256 === location.contentSha256)
            for (let i = 0; i < target.parameters.length; i++) {
              const parameter = target.parameters[i];
              if (parameter.type.kind === K.IntKeyword && !parameter.isReference)
                add(node.arguments[i], 'bound-by-value-int-formal', {source: location, parameterIndex: i,
                  parameter: parameter.name.name, type: 'int', isReference: false, allActiveSignaturesAgree: true});
            }
        }
      }
      if (node.kind === K.BinaryExpression && comparisons.has(node.operatorToken.kind)) {
        if (program.carrierAt(node.right) === 'int') add(node.left, 'integer-comparison');
        if (program.carrierAt(node.left) === 'int') add(node.right, 'integer-comparison');
      }

    };
    const pending = [ast];while (pending.length) {const node = pending.pop();visit(node);forEachChild(node, child => {pending.push(child);});}
    proof.edits.sort((a, b) => a.start - b.start);
    let delta = 0;
    for (let i = 0; i < proof.edits.length; i++) {
      const edit = proof.edits[i];if (i) assert(proof.edits[i - 1].end <= edit.start, 'OVERLAPPING_CONST_BOUND_EDITS');
      edit.newStart = edit.start + delta;delta += edit.replacement.length - (edit.end - edit.start);
    }
    const applied=applyReversibleSourceEdits(source,proof.edits);
    assert.deepEqual(applied.proof.edits,proof.edits,'LINEAR_EDITS_CHANGED_WITNESS');
    const text=applied.text;
    assert.equal(parse(text, 'const-bound-view').parseDiagnostics.length, 0);
    return {text, proof: {...proof, closure, sourceSha256: sha(source), viewSha256: sha(text), bindingOnly: true,
      fullSemanticValidationClaimed: false, persistentCache: false, fixedContextsAndReferenceArgumentsExcluded: true}};
  } finally {program.dispose();}
}
