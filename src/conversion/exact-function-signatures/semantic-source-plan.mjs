import { SyntaxKind } from './index-alternate-3.js';
import { projectSemanticGalaxySources } from '../../model/semantic-syntax-projection.collections.mjs';

// The legacy resolver changes type meaning only when this exact declaration
// set contains typedefs. Without aliases, its wrapper copies are structurally
// identical. Read-only consumers can share the original immutable syntax.
export function planSemanticGalaxySources(sources) {
  const resolveTypes = sources.some((source) =>
    source.statements.some((node) => node.kind === SyntaxKind.TypedefDeclaration),
  );
  return { sources: resolveTypes ? projectSemanticGalaxySources(sources) : sources, resolveTypes };
}
