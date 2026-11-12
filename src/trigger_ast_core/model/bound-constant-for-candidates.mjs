// Read-only discovery: preserve a source for only as a later GUI candidate.
// A closed input graph, exact binding and immutable int declaration are required.
// This does not authorize GUI edits or prove a change of evaluation timing safe.
import {openVerifiedSourceBindingProgram} from './verified-source-binding-program.lexical-parameters.mjs';
import {sourceLiteralForCandidate} from '../bindings/source-for-form-preference.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
export function discoverBoundConstantForCandidates(source,closedContext={}){
 const bound=openVerifiedSourceBindingProgram(source,closedContext);
 if(!bound.program)return {reason:bound.reason,candidates:[],guiBindingAuthorized:false,wholeMapAccepted:false};
 const {program,ast,closure}=bound,candidates=[],refused=[];
 try{
  function inspect(n,owner){
   if(n.kind!==K.ForStatement)return;
   const c=n.condition,ref=unwrap(c?.right);
   if(c?.kind!==K.BinaryExpression||ref?.kind!==K.Identifier)return;
   const binding=program.getBinding(ref),decl=program.declarationAt(ref),where=decl&&program.location(decl),identity=where&&program.verifiedInputIdentity(where.sourceFile);
   if(binding.status!=='BOUND'||!where||identity?.contentSha256!==where.contentSha256||decl?.kind!==K.VariableDeclaration||decl.type?.kind!==K.IntKeyword||!decl.modifiers?.some(m=>m.kind===K.ConstKeyword))return;
   if(decl.parent?.kind!==K.SourceFile||decl.isReference||decl.modifiers?.length!==1||decl.modifiers[0].kind!==K.ConstKeyword)return;
   const value=readCanonicalInt32Literal(decl.initializer);if(value===undefined)return;
   // The existing literal matcher already refuses ambiguous counters, shadowing,
   // invalid directions, continue, nested locals and non-scalar iterators.
   // Substitute only in an ephemeral view; the source AST remains unchanged.
   const view={...n,condition:{...c,right:decl.initializer}},base=sourceLiteralForCandidate(view);if(!base)return;
   const init=unwrap(n.initializer),increment=unwrap(n.incrementor),refs=[init?.left,unwrap(c.left),increment?.left];
   const counter=refs[0]&&program.declarationAt(refs[0]);
   if(!counter||refs.some(r=>!r||program.getBinding(r).status!=='BOUND'||program.declarationAt(r)!==counter)){
    refused.push({owner:owner?.name?.name??null,start:n.pos,reason:'COUNTER_BINDING_AMBIGUOUS'});return;
   }
   candidates.push({owner:owner?.name?.name??null,start:n.pos,end:n.end,boundName:ref.name,boundValue:String(value),boundDeclaration:where,counterDeclaration:program.location(counter),constantCapturedOnlyAfterProof:true,sourceChanged:false});
  }
  function walk(n,owner){if(n.kind===K.FunctionDeclaration)owner=n;inspect(n,owner);forEachChild(n,c=>walk(c,owner));}
  walk(ast,undefined);
  return {kind:'BOUND_IMMUTABLE_INTEGER_FOR_DISCOVERY',candidates,refused,completeReachableClosure:closure.completeReachableClosure,
   sourceChanged:false,guiBindingAuthorized:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false};
 }finally{bound.dispose();}
}
