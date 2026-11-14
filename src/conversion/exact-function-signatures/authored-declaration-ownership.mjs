import assert from 'node:assert/strict';
import { indexAuthoredScriptSections } from './authored-script-sections.typedef-initializer-anchors.mjs';

// Original section membership is an AST identity, never a function-name rule.
// Optimizing/lowering passes can share this predicate without assuming that a
// source-authored function is generated scaffolding or safe to remove.
export function authoredDeclarationOwnership(program, { preserveAuthoredCode = false } = {}) {
  const owned = new WeakSet();
  if (!preserveAuthoredCode) return (node) => false;
  for (const [fileName, ast] of program.documents) {
    const source = program.verifiedInputIdentity(fileName);
    if (!source?.owned) continue;
    const index = indexAuthoredScriptSections({
      fileName,
      text: ast.text,
      expectedSha256: source.contentSha256,
    });
    assert(!index.rejected.length, 'AUTHORED_DECLARATION_OWNERSHIP_SECTION_REJECTED');
    const byStart = new Map(ast.statements.map((n) => [n.pos, n]));
    for (const section of index.sections)
      for (const declaration of section.declarations) {
        const node = byStart.get(declaration.start);
        assert(
          node?.kind === declaration.kind && node.name?.name === declaration.name,
          'AUTHORED_DECLARATION_OWNERSHIP_IDENTITY',
        );
        owned.add(node);
      }
  }
  return (node) => !!node && owned.has(node);
}
