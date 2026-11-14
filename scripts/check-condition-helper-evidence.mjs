import assert from 'node:assert/strict';
import { inspectConditionHelpers } from '../src/verification/condition-helper-evidence.mjs';
import { assumeCallAliases } from '../src/verification/conditional-call-aliases.mjs';

const original = `
bool Check(); void Disable();
bool Callback(bool testConds, bool runActions) {
  if (testConds) { if (!Check()) { Disable(); return false; } }
  return true;
}`;
const generated = `
bool Check(); void Disable(); bool Helper();
bool Callback(bool testConds, bool runActions) {
  if (testConds) { if (!Helper()) { return false; } }
  return true;
}
bool Helper() { if (!Check()) { Disable(); return false; } return true; }
`;
const accepted = inspectConditionHelpers(original, generated);
assert.equal(accepted.helpersExpanded, 1);
assert.equal(accepted.strictExactAfterExpansion, true);
const altered = inspectConditionHelpers(
  original,
  generated.replace('Disable(); return false;', 'return false;'),
);
assert.equal(altered.strictExactAfterExpansion, false);
const captured = inspectConditionHelpers(original, generated.replace('!Check()', '!testConds'));
assert.equal(captured.helpersExpanded, 0);
assert.deepEqual(captured.helpersRefused, ['Helper']);
const reused = inspectConditionHelpers(
  original,
  generated.replace('return true;\n}', 'Helper(); return true;\n}'),
);
assert.equal(reused.helpersExpanded, 0);
const dynamic = inspectConditionHelpers(original, generated + '\nstring reference = "Helper";');
assert.equal(dynamic.helpersExpanded, 0);
const alias = assumeCallAliases('int Alt(); string s = "Alt()"; int f(){return Alt();}', {
  Alt: 'Original',
});
assert.equal(alias.counts.Alt, 1);
assert.match(alias.assumed, /string s = "Alt\(\)"/u);
assert.match(alias.assumed, /return Original\(\)/u);
assert.throws(() => assumeCallAliases('void f(){}', { A: 'B', B: 'A' }), /chain|cycle/u);
console.log('Condition-helper structural evidence checks passed.');
