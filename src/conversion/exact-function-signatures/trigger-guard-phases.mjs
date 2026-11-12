import assert from 'node:assert/strict';
import {SyntaxKind as K} from "./index-alternate-3.js";
const unwrap = node => { while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node; };
function returnsTrue(branch) {
  if (branch?.kind === K.Block && branch.statements.length === 1) branch = branch.statements[0];
  return branch?.kind === K.ReturnStatement && unwrap(branch.expression)?.kind === K.TrueKeyword;
}

// GUI always evaluates conditions before deciding whether to run actions. It
// cannot represent an arbitrary permutation of these callback phases.
export function assertTriggerGuardPhases(statements, start, {isTestCondsGuard, isRunActionsGuard}) {
  let actions = false;
  for (let index = start; index < statements.length; index++) {
    const node = statements[index], guarded = node.kind === K.IfStatement && !node.elseStatement;
    if (guarded && isRunActionsGuard(unwrap(node.expression)) && returnsTrue(node.thenStatement)) {
      assert(!actions, 'TRIGGER_DUPLICATE_ACTION_GUARD');actions = true;continue;
    }
    if (guarded && isTestCondsGuard(unwrap(node.expression), node.thenStatement)) {
      assert(!actions, 'TRIGGER_CONDITIONS_AFTER_ACTION_GUARD');continue;
    }
    if (node.kind === K.EmptyStatement || index === statements.length - 1 && returnsTrue(node)) continue;
    assert(actions, 'TRIGGER_ACTION_BEFORE_ACTION_GUARD');
  }
}
