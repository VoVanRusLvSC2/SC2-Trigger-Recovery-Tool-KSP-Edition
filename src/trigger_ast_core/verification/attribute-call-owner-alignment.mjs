import assert from 'node:assert/strict';

// Attribute selectors stay byte-exact. Only owner names already bound by the
// independent source/constructor/callback qualification may be aligned here.
// This component never proves function bodies, original lobby data, or acceptance.
export function alignAttributeCallOwners(original, generated, qualification, rootFile) {
 const makeNames = proof => {
  assert(proof && Array.isArray(proof.bindings), 'ATTRIBUTE_OWNER_QUALIFICATION_REQUIRED');
  assert.equal(proof.sourceArchiveChanged, false);
  const names = new Map(), targets = new Map();
  for (const binding of proof.bindings) {
   assert.equal(typeof binding.handle, 'string');
   assert.equal(typeof binding.targetHandle, 'string');
   for (const key of ['constructor', 'callback']) {
    const pair = binding[key];
    assert(pair && typeof pair.from === 'string' && pair.from.length && typeof pair.to === 'string' && pair.to.length, 'ATTRIBUTE_OWNER_INVALID_PAIR');
    assert(!names.has(pair.from) && !targets.has(pair.to), 'ATTRIBUTE_OWNER_NON_BIJECTIVE');
    names.set(pair.from, pair.to); targets.set(pair.to, pair.from);
   }
  }
  return names;
 };
 const beforeNames = makeNames(qualification.before), afterNames = makeNames(qualification.after);
 const fingerprint = (program, names) => {
  assert.equal(program.issues.length, 0, 'ATTRIBUTE_OWNER_UNRESOLVED_PROGRAM');
  const owners = new Map();
  for (const call of program.calls) {
   assert(!call.indirect && typeof call.selector === 'string', 'ATTRIBUTE_OWNER_INDIRECT_SELECTOR');
   const owner = call.file === rootFile ? names.get(call.function) ?? call.function : call.function;
   const key = JSON.stringify([call.file, owner]);
   if (!owners.has(key)) owners.set(key, []);
   // Preserve order and multiplicity inside each exact lexical owner.
   owners.get(key).push([call.api, call.selector, call.indirect]);
  }
  return [...owners].sort(([a],[b]) => a.localeCompare(b));
 };
 const before = fingerprint(original, beforeNames), after = fingerprint(generated, afterNames);
 return {
  kind: 'BYTE_EXACT_ATTRIBUTE_SELECTORS_WITH_SOURCE_BOUND_OWNER_ALIASES',
  exact: original.calls.length > 0 && JSON.stringify(before) === JSON.stringify(after),
  originalCalls: original.calls.length, generatedCalls: generated.calls.length,
  canonicalOriginal: before, canonicalGenerated: after,
  sourceSelectorsChanged: false, functionBodiesProved: false, originalLobbyProved: false, accepted: false,
 };
}
