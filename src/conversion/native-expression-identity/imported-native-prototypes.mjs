/** A native FunctionDef describes an existing API. Do not add an ordinary
 * map forward declaration when the supplied RAW native source already owns
 * the exact signature. Model/synthetic declaration sources are NOT admitted.
 */
import { Parser, SyntaxKind } from '../exact-function-signatures/index-alternate-3.js';
import { printNode } from './script-template.mjs';
const signature = (type, params) =>
  JSON.stringify([printNode(type), params.map((p) => printNode(p.type))]);
export function importedNativePrototypeIndex(sources = []) {
  const output = new Map(),
    ambiguous = new Set();
  for (const d of sources) {
    if (/GuiNativeActionDeclarations|model|prototypes/iu.test(d.fileName)) continue;
    const ast = new Parser().parseFile(d.fileName, d.text);
    if (ast.parseDiagnostics?.length) continue;
    for (const n of ast.statements) {
      if (n.kind !== 142 || !n.name?.name) continue;
      if (n.body || !n.modifiers?.some((m) => m.kind === SyntaxKind.NativeKeyword)) {
        output.delete(n.name.name);
        ambiguous.add(n.name.name);
        continue;
      }
      const name = n.name.name,
        value = signature(n.type, [...n.parameters]);
      if (ambiguous.has(name)) continue;
      if (output.has(name) && output.get(name) !== value) {
        output.delete(name);
        ambiguous.add(name);
      } else output.set(name, value);
    }
  }
  return output;
}
export function importedNativePrototypeMatches(index, name, type, params) {
  return index.get(name) === signature(type, params);
}
