import {closedSourceFunctionReachability} from '../model/closed-source-function-reachability.initializers.mjs';
// A paired proof for an empty, unobserved Editor lifecycle stage. This changes
// comparison views only; it neither creates GUI Custom Script nor edits a map.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {logicalSourcePath, partitionDeclarationViews} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const stage = 'InitCustomScript', entry = 'InitMap'; // Editor's map lifecycle ABI.
function walk(node, visit) {visit(node);forEachChild(node, child => walk(child, visit));}
const zeroVoid = node => node?.kind === K.FunctionDeclaration && node.type.kind === K.VoidKeyword &&
  !node.modifiers?.length && !node.parameters.length && !!node.body;


export function projectEmptyCustomLifecyclePair(before, after, context = {}) {
  const proof = {kind: 'PAIRED_EMPTY_EDITOR_CUSTOM_LIFECYCLE', applied: false, edits: [],
    sourceOrExportChanged: false, wholeProgramOracleStillRequired: true, wholeMapAccepted: false};
  const unchanged = reason => ({before, after, proof: {...proof, reason}});
  const left = parse(before, 'MapScript.galaxy'), right = parse(after, 'emitted.galaxy');
  if (left.parseDiagnostics.length || right.parseDiagnostics.length) return unchanged('SYNTAX');
  const named = (ast, name) => ast.statements.filter(node => node.kind === K.FunctionDeclaration && node.name.name === name);
  const definitions = named(left, stage), owners = named(left, entry), targets = named(right, entry);
  if (definitions.length !== 1 || named(right, stage).length || owners.length !== 1 || targets.length !== 1)
    return unchanged('NOT_ONE_MISSING_LIFECYCLE_STAGE');
  const fn = definitions[0], owner = owners[0], target = targets[0];
  if (![fn, owner, target].every(zeroVoid) || fn.body.statements.length) return unchanged('NOT_EMPTY_VOID_STAGE');
  const sequence = ast => ast.body.statements.map(node => {
    const expression = node.kind === K.ExpressionStatement && node.expression;
    return expression?.kind === K.CallExpression && expression.expression.kind === K.Identifier &&
      !expression.arguments.length ? expression.expression.name : undefined;
  });
  const original = sequence(owner), emitted = sequence(target);
  if (![ ['InitLibs', stage, 'InitTriggers'], ['InitLibs', 'InitGlobals', stage, 'InitTriggers'] ]
    .some(contract => JSON.stringify(contract) === JSON.stringify(original)) ||
    JSON.stringify(original.filter(name => name !== stage)) !== JSON.stringify(emitted)) return unchanged('LIFECYCLE_ORDER');
  const statement = owner.body.statements[original.indexOf(stage)], reference = statement.expression.expression;
  const allowed = new Set([fn.name, reference]);
  let refused;
  const inspect = (ast, external, checkCallbacks = false) => walk(ast, node => {
    if (!checkCallbacks && node.kind === K.Identifier && node.name === stage && (external || !allowed.has(node))) refused = 'OTHER_BINDING_OR_REFERENCE';
    if (node.kind === K.StringLiteral) {
      const value = readStringLiteralValue(node.text);
      if (!value || value.value.includes(stage)) refused = 'TEXTUAL_LIFECYCLE_OBSERVER';
    }
    // Galaxy callbacks can address functions by name. A dynamically assembled
    // callback target prevents this closed proof, even with no literal mention.
    if (checkCallbacks && node.kind === K.CallExpression && node.expression.kind === K.Identifier && node.expression.name === 'TriggerCreate' &&
      (node.arguments.length !== 1 || node.arguments[0].kind !== K.StringLiteral)) refused = 'DYNAMIC_CALLBACK_TARGET';
  });
  inspect(left, false);inspect(right, true);
  const root = {fileName: 'MapScript.galaxy', text: before}, owned = context.ownedSources ?? [];
  const views = partitionDeclarationViews(owned, context.externalSources ?? []);
  if (views.conflicts.length) return unchanged('SOURCE_CONTENT_CONFLICT');
  const closure = removeAlreadyLoadedOwnedIncludes({root, ownedSources: owned, externalSources: views.external,
    includeEvidence: context.includeEvidence ?? [], includeRoot: false}).proof;
  if (!closure.completeReachableClosure) return unchanged('INCOMPLETE_INCLUDE_CLOSURE');
  const reachable = new Set(closure.resolvedFiles.map(file => logicalSourcePath(file.path)));
  const files = [{ast: left, owned: true}, {ast: right, owned: true}];
  const ownedPaths = new Set(owned.map(file => logicalSourcePath(file.originalPath ?? file.fileName)));
  for (const file of [...owned, ...views.external]) if (reachable.has(logicalSourcePath(file.originalPath ?? file.fileName))) {
    const ast = parse(file.text, file.fileName);
    if (ast.parseDiagnostics.length) return unchanged('EXTERNAL_SYNTAX');
    inspect(ast, true);files.push({ast, owned: ownedPaths.has(logicalSourcePath(file.originalPath ?? file.fileName))});
  }
  const dispatch = closedSourceFunctionReachability(files);
  if (dispatch.issues.length) return unchanged(dispatch.issues[0]);
  for (const node of dispatch.reachable) inspect(node.body, false, true);
  for (const node of dispatch.initializers) inspect(node, false, true);
  if (refused) return unchanged(refused);
  const edits = [fn, statement].map(node => ({start: node.pos, end: node.end, text: before.slice(node.pos, node.end)})).sort((a, b) => a.start - b.start);
  let text = before, delta = 0;
  for (const edit of edits) {edit.newStart = edit.start + delta;delta -= edit.end - edit.start;}
  for (const edit of edits.toReversed()) text = text.slice(0, edit.start) + text.slice(edit.end);
  let inverse = text;
  for (const edit of edits.toReversed()) inverse = inverse.slice(0, edit.newStart) + edit.text + inverse.slice(edit.newStart);
  assert.equal(inverse, before, 'EMPTY_LIFECYCLE_BYTE_INVERSE');
  assert.equal(parse(text, 'empty-lifecycle-view').parseDiagnostics.length, 0, 'EMPTY_LIFECYCLE_VIEW_SYNTAX');
  return {before: text, after, proof: {...proof, applied: true, edits, closure, originalSha256: sha(before), viewSha256: sha(text),
    reason: 'EMPTY_UNOBSERVED_STAGE_WITH_ONE_DIRECT_ORDERED_ENTRY_CALL', dispatchClosure: {reachableBodies: dispatch.reachable.size, issues: dispatch.issues, allOwnedFunctionsAreRoots: true},
    boundary: 'Runtime business effects; debugger frames and VM instruction/resource accounting are not an engine-acceptance claim.'}};
}
