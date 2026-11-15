import { planStableGlobalConcatAssignment } from './stable-global-concat-assignment.mjs';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as previous from './bound-source-access.authored.mjs';
import { planBoundConcatAssignment } from '../exact-function-signatures/private-frame-concat-assignment.mjs';
export * from './bound-source-access.authored.mjs';
const sourceProgram = new AsyncLocalStorage();
export function withBoundSourceCallReturns(program, operation) {
  return sourceProgram.run(program, () => previous.withBoundSourceCallReturns(program, operation));
}
export function privateFrameConcatAssignmentRecipe(node) {
  const program = sourceProgram.getStore();
  return (
    program &&
    (planStableGlobalConcatAssignment(program, node) ?? planBoundConcatAssignment(program, node))
  );
}
