import { createHash } from 'node:crypto';
import { cloneGalaxySyntax } from '../exact-native-export/semantic-forms.mjs';
import { recognizeThreadedFunctions } from './galaxy-to-trigger-alternate-3.mjs';
/** Comparison only: private compiler capture cells can be renamed consistently
 * by parameter position. Every use must stay in the EXACT recognized wrapper /
 * callback and declaration. Any foreign code, other function, literal reference
 * or colliding target refuses the proof. Calls/order/types stay strictly checked.
 */
export function normalizePrivateThreadCaptures(
  original,
  generated,
  K,
  forEachChild,
  { foreignCode } = {},
) {
  if (!Array.isArray(foreignCode) || !foreignCode.length)
    return { original, generated, notes: [], refused: 'Actual dependency source proof omitted' };
  const left = recognizeThreadedFunctions(original.statements, 'Map'),
    right = recognizeThreadedFunctions(generated.statements, 'Map');
  const globals = (s) =>
    new Map(
      s.statements.filter((n) => n.kind === K.VariableDeclaration).map((n) => [n.name.name, n]),
    );
  const declarations = [globals(original), globals(generated)],
    mapping = new Map(),
    notes = [];
  const walk = (n, fn, parent) => {
    if (!n) return;
    fn(n, parent);
    forEachChild(n, (c) => walk(c, fn, n));
  };
  const uses = new WeakMap();
  function index(source) {
    const cached = uses.get(source);
    if (cached) return cached;
    const names = new Map(),
      literals = new Set();
    for (const statement of source.statements) {
      const owner = statement.kind === K.FunctionDeclaration ? statement.name.name : undefined;
      walk(statement, (n, parent) => {
        if (n.kind === K.StringLiteral) literals.add(String(n.value));
        if (n.kind !== K.Identifier) return;
        if (parent?.kind === K.PropertyAccessExpression && parent.name === n) return;
        let row = names.get(n.name);
        if (!row) names.set(n.name, (row = { unsafe: false, functions: new Set() }));
        if (statement.kind === K.VariableDeclaration && statement.name === n) return;
        if (
          !owner ||
          ([K.VariableDeclaration, K.ParameterDeclaration, K.FunctionDeclaration].includes(
            parent?.kind,
          ) &&
            parent.name === n)
        )
          row.unsafe = true;
        else row.functions.add(owner);
      });
    }
    const seen = { names, literals: [...literals] };
    uses.set(source, seen);
    return seen;
  }
  function closed(source, name, pattern) {
    const { names, literals } = index(source);
    const row = names.get(name);
    return (
      !row?.unsafe &&
      (!row ||
        [...row.functions].every(
          (owner) => owner === pattern.wrapperName || owner === pattern.callbackName,
        )) &&
      !literals.some((value) => value.includes(name))
    );
  }
  for (const [name, a] of left) {
    const b = right.get(name);
    if (!b || a.callbackName !== b.callbackName) continue;
    const oldCells = [...a.machineryGlobals].slice(1),
      newCells = [...b.machineryGlobals].slice(1);
    if (oldCells.length !== newCells.length) continue;
    let okay = true;
    for (let i = 0; i < oldCells.length; i++) {
      const x = oldCells[i],
        y = newCells[i];
      if (x === y) continue;
      if (
        declarations[0].has(y) ||
        declarations[1].has(x) ||
        index(original).names.has(y) ||
        index(generated).names.has(x) ||
        !closed(original, x, a) ||
        !closed(generated, y, b) ||
        foreignCode.some((d) => d.text.includes(x) || d.text.includes(y))
      ) {
        okay = false;
        break;
      }
    }
    if (!okay) continue;
    for (let i = 0; i < oldCells.length; i++)
      if (oldCells[i] !== newCells[i]) {
        mapping.set(oldCells[i], newCells[i]);
        notes.push({
          function: name,
          parameter: i,
          rule: 'CLOSED_PRIVATE_THREAD_CAPTURE_BINDING',
          original: oldCells[i],
          generated: newCells[i],
        });
      }
  }
  if (!mapping.size) return { original, generated, notes };
  if (new Set(mapping.values()).size !== mapping.size)
    return { original, generated, notes: [], refused: 'Noninjective binding mapping' };
  const copy = { ...original, statements: original.statements.map(cloneGalaxySyntax) };
  walk(copy, (n, parent) => {
    if (
      n.kind === K.Identifier &&
      mapping.has(n.name) &&
      !(parent?.kind === K.PropertyAccessExpression && parent.name === n)
    )
      n.name = mapping.get(n.name);
  });
  return {
    original: copy,
    generated,
    notes,
    foreignSourceProof: foreignCode.map((d) => ({
      fileName: d.fileName,
      sha256: createHash('sha256').update(d.text).digest('hex'),
    })),
  };
}
