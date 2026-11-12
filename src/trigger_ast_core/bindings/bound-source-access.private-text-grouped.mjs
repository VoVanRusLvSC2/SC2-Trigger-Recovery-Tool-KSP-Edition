import {AsyncLocalStorage} from 'node:async_hooks';
import * as previous from './bound-source-access.authored.mjs';
import {planPrivateFrameTextAppend} from '../lowering/private-frame-text-append.grouped.mjs';
export * from './bound-source-access.authored.mjs';
const sourceProgram = new AsyncLocalStorage();
export function withBoundSourceCallReturns(program, operation) {
  return sourceProgram.run(program, () => previous.withBoundSourceCallReturns(program, operation));
}
export function privateFrameTextAppendRecipe(node) {
  const program = sourceProgram.getStore();return program && planPrivateFrameTextAppend(program, node);
}
