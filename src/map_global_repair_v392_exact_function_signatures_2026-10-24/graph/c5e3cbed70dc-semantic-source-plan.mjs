import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {projectSemanticGalaxySources} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/semantic-syntax-projection.collections.mjs';

// The legacy resolver changes type meaning only when this exact declaration
// set contains typedefs. Without aliases, its wrapper copies are structurally
// identical. Read-only consumers can share the original immutable syntax.
export function planSemanticGalaxySources(sources) {
  const resolveTypes=sources.some(source=>source.statements.some(node=>node.kind===SyntaxKind.TypedefDeclaration));
  return {sources:resolveTypes?projectSemanticGalaxySources(sources):sources,resolveTypes};
}
