// Compose existing proof stages in dependency order. A compiler's redundant
// native prefix must be qualified before the resolved owned-include traversal;
// otherwise that traversal has no original root edge for the synthetic prefix.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {normalizeVerifiedNativeIncludes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/native_include_proof_v205.mjs';
import {parseImmutableGalaxySyntax as parse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d38acb45983d-immutable-galaxy-syntax.collections.mjs';
import {assertExactAstShape} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/exact-ast-shape.mjs';
import {literalByteSyntaxShape} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d7df136db06a-literal-byte-syntax-shape.mjs';
import {syntaxShape} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d5b99ebc4986-balanced-script-template.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function qualifyNativePrefixBeforeComposition(text,{declarations,nativeProof}){
 const ast=parse(text,'native-prefix-input');assert.equal(ast.parseDiagnostics.length,0);
 const qualified=normalizeVerifiedNativeIncludes(ast,K,{declarations,nativeProof,parseGalaxy:parse});
 const retained=new Set(qualified.source.statements),removed=ast.statements.filter(n=>!retained.has(n));
 assert(removed.every(n=>n.kind===K.IncludeStatement),'NATIVE_PREFIX_REMOVED_NON_INCLUDE');
 let result=text,boundary=Infinity;
 for(const node of removed.toSorted((a,b)=>b.pos-a.pos)){
  assert(node.end<=boundary&&node.pos>=0,'NATIVE_PREFIX_OVERLAPPING_SPANS');
  result=result.slice(0,node.pos)+result.slice(node.end);boundary=node.pos;
 }
 const after=parse(result,'native-prefix-output');assert.equal(after.parseDiagnostics.length,0);
 const shape=n=>literalByteSyntaxShape(n,syntaxShape);
 assertExactAstShape(after.statements.map(shape),qualified.source.statements.map(shape),{label:'NATIVE_PREFIX_CHANGED_OTHER_STATEMENTS'});
 return {text:result,proof:{kind:'EXISTING_NATIVE_INCLUDE_PROOF_BEFORE_OWNED_COMPOSITION',
  beforeSha256:sha(text),afterSha256:sha(result),removedIncludeCount:removed.length,
  notes:qualified.notes,refused:qualified.refused,qualification:qualified.proof,
  onlyQualifiedIncludeSpansRemoved:true,allOtherSourceBytesPreserved:true,
  newEquivalenceRules:0,sourceOrCandidateChanged:false,wholeProgramEquivalenceProved:false}};
}
