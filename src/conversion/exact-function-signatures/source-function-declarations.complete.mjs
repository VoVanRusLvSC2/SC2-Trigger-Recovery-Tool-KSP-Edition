export {
  indexSourceFunctionDeclarations,
  canonicalSourceFunctionDeclaration,
} from './source-function-declarations.mjs';
import { SyntaxKind as K } from './index-alternate-3.js';

export function publicAuthoredFunctionBodies(unit) {
  const names = new Set(unit.publicCalls.map((c) => c.name)),
    result = [];
  for (const name of names) {
    const declarations = unit.declarations.filter(
      (d) => d.kind === K.FunctionDeclaration && d.name === name,
    );
    const bodies = declarations.filter((d) => d.hasBody);
    // Missing/duplicate bodies remain explicit unsupported entries for callers;
    // filtering them out would incorrectly turn a missing ABI into an empty set.
    result.push(...(bodies.length === 1 ? bodies : declarations));
  }
  return result;
}
