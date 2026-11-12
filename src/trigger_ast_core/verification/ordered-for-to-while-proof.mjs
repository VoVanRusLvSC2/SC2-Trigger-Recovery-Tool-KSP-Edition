// Exact statement scheduling only. No loop bound, condition, update expression
// or effect is evaluated, deleted, duplicated on a runtime path or reordered.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {expressionGroupingShape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K, Printer, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer = new Printer(), loops = new Set([K.ForStatement, K.WhileStatement, K.DoStatement]);
const sha = text => createHash('sha256').update(text).digest('hex');
const metadata = new Set(['parent', 'symbol', 'locals', 'flowNode', 'syntaxTokens', 'comments']);
const clone = node => !node || typeof node !== 'object' ? node : Array.isArray(node) ? node.map(clone) :
  Object.fromEntries(Object.entries(node).filter(([key]) => !metadata.has(key)).map(([key, value]) => [key, clone(value)]));
function walk(node, operation) {operation(node);forEachChild(node, child => walk(child, operation));}
const shape = node => expressionGroupingShape(clone(node));
const expressionStatement = expression => ({kind: K.ExpressionStatement, expression: clone(expression)});
const block = statements => ({kind: K.Block, statements});

export function canonicalOrderedForLoops(source) {
  const ast = parse(source, 'ordered-for-source');assert.equal(ast.parseDiagnostics.length, 0);
  const edits = [], records = [], refused = [];
  function eligible(node) {
    if (node.statement?.kind !== K.Block) return 'NONBLOCK_BODY';
    let declaration = false, label = false;
    if (node.initializer) walk(node.initializer, child => {if (child.kind === K.VariableDeclaration) declaration = true;});
    if (declaration) return 'INITIALIZER_DECLARATION_SCOPE';
    const updateNames = new Set();if (node.incrementor) walk(node.incrementor, child => {if (child.kind === K.Identifier) updateNames.add(child.name);});
    let capture = false;
    walk(node.statement, child => {
      if ([K.VariableDeclaration, K.FunctionDeclaration, K.TypedefDeclaration, K.StructDeclaration].includes(child.kind) && updateNames.has(child.name?.name)) capture = true;
      if ([K.BreakStatement, K.ContinueStatement].includes(child.kind) && (child.label || child.identifier)) label = true;
      if (child.kind === K.TypedefDeclaration) declaration = true;
    });
    return capture ? 'UPDATE_NAME_CAPTURE_POSSIBLE' : label ? 'LABELLED_CONTROL_TRANSFER' : declaration ? 'LOCAL_TYPEDEF_EMISSION_UNSUPPORTED' : undefined;
  }
  function continueEdges(node, increment, depth = 0, list = false) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(child => continueEdges(child, increment, depth));
    if (node.kind === K.ContinueStatement && depth === 0 && increment) {
      const statements = [expressionStatement(increment), clone(node)];return list ? statements : block(statements);
    }
    const result = clone(node), next = depth + Number(loops.has(node.kind));
    if (node.kind === K.Block) result.statements = node.statements.flatMap(child => {
      const value = continueEdges(child, increment, next, true);return Array.isArray(value) ? value : [value];
    });
    else for (const [key, value] of Object.entries(node)) if (!metadata.has(key) && value && typeof value === 'object') result[key] = continueEdges(value, increment, next);
    return result;
  }
  function transform(node, localRecords, list = false) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(child => transform(child, localRecords));
    if (node.kind === K.ForStatement && !eligible(node)) {
      const body = transform(continueEdges(node.statement, node.incrementor), localRecords);
      if (node.incrementor) body.statements.push(expressionStatement(node.incrementor));
      const statements = [...(node.initializer ? [expressionStatement(node.initializer)] : []),
        {kind: K.WhileStatement, expression: clone(node.condition ?? {kind: K.TrueKeyword}), statement: body}];
      localRecords.push({start: node.pos, end: node.end, initializerOnce: !!node.initializer,
        conditionOrderUnchanged: true, continueUpdatesAtTheirOriginalEdges: true, incrementRetained: !!node.incrementor});
      return list ? statements : statements.length === 1 ? statements[0] : block(statements);
    }
    const result = clone(node);
    if (node.kind === K.Block) result.statements = node.statements.flatMap(child => {
      const value = transform(child, localRecords, true);return Array.isArray(value) ? value : [value];
    });
    else for (const [key, value] of Object.entries(node)) if (!metadata.has(key) && value && typeof value === 'object') result[key] = transform(value, localRecords);
    return result;
  }
  function select(node, parent) {
    if (node.kind === K.ForStatement) {
      const reason = eligible(node);
      if (reason) refused.push({start: node.pos, reason});
      else {
        const localRecords = [], list = parent?.kind === K.Block && parent.statements.includes(node);
        const transformed = transform(node, localRecords, list), expected = Array.isArray(transformed) ? transformed : [transformed];
        const replacement = expected.map(statement => printer.printNode(statement)).join('\n') + '\n';
        const check = parse('void loopProof(){\n' + replacement + '\n}', 'ordered-for-fragment');
        assert.equal(check.parseDiagnostics.length, 0, 'ORDERED_FOR_FRAGMENT_SYNTAX');
        assert.deepEqual(shape(check.statements[0].body.statements), shape(expected), 'ORDERED_FOR_EMITTED_TREE_CHANGED');
        edits.push({start: node.pos, end: node.end, before: source.slice(node.pos, node.end), replacement});records.push(...localRecords);return;
      }
    }
    forEachChild(node, child => select(child, node));
  }
  select(ast);edits.sort((a, b) => a.start - b.start);let delta = 0;
  for (let i = 0; i < edits.length; i++) {const edit = edits[i];if (i) assert(edits[i - 1].end <= edit.start);edit.newStart = edit.start + delta;delta += edit.replacement.length - (edit.end - edit.start);}
  let text = source;for (const edit of edits.toReversed()) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  let inverse = text;for (const edit of edits.toReversed()) inverse = inverse.slice(0, edit.newStart) + edit.before + inverse.slice(edit.newStart + edit.replacement.length);
  assert.equal(inverse, source, 'ORDERED_FOR_BYTE_INVERSE');assert.equal(parse(text, 'ordered-for-view').parseDiagnostics.length, 0);
  return {text, proof: {kind: 'ORDERED_FOR_TO_WHILE_CONTROL_FLOW', edits, records, refused, sourceSha256: sha(source), viewSha256: sha(text),
    sourceOrExportChanged: false, initializerDeclarationsNeverMoved: true, updateCaptureRejected: true,
    runtimeEffectsAndEvaluationCountsRetained: true, wholeProgramOracleStillRequired: true, wholeMapAccepted: false}};
}
