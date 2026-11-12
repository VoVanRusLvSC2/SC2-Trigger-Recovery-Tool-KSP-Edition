// Compose existing proof stages in dependency order. A compiler's redundant
// native prefix must be qualified before the resolved owned-include traversal;
// otherwise that traversal has no original root edge for the synthetic prefix.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {normalizeVerifiedNativeIncludes} from "../utilities";
import {parseImmutableGalaxySyntax as parse} from "../model/immutable-galaxy-syntax.collections.mjs";
import {assertExactAstShape} from "./exact-ast-shape.mjs";
import {literalByteSyntaxShape} from "./literal-byte-syntax-shape.mjs";
import {syntaxShape} from "../ast/balanced-script-template.mjs";
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
