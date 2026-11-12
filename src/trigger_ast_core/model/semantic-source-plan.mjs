import {SyntaxKind} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {projectSemanticGalaxySources} from './semantic-syntax-projection.collections.mjs';

// The legacy resolver changes type meaning only when this exact declaration
// set contains typedefs. Without aliases, its wrapper copies are structurally
// identical. Read-only consumers can share the original immutable syntax.
export function planSemanticGalaxySources(sources) {
  const resolveTypes=sources.some(source=>source.statements.some(node=>node.kind===SyntaxKind.TypedefDeclaration));
  return {sources:resolveTypes?projectSemanticGalaxySources(sources):sources,resolveTypes};
}
