// Extend the qualified installed-template binding, preserving every old
// non-strict path. Never lower continue or introduce a helper/native definition.
import {AsyncLocalStorage} from 'node:async_hooks';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readCanonicalInt32Literal,inclusiveLiteralIntComparison} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/types/inclusive-literal-int-comparison.mjs';
import {matchLiteralCountedLoop as previousMatch,tryBuildLiteralCountedLoop as previousBuild,
 withLiteralCountedLoopBindings as previousContext} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/9691df4fcb5e02c8-literal-counted-loop.authored-counters.mjs';
const traces=new AsyncLocalStorage();
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
export function withLiteralCountedLoopBindings(records,operation){
 return traces.run(records,()=>previousContext(records,operation));
}
function candidate(node){
 if(node?.kind!==K.ForStatement)return {node};
 const op=unwrap(node.condition)?.operatorToken?.kind;
 if(![K.LessThanToken,K.GreaterThanToken].includes(op))return {node};
 const init=unwrap(node.initializer),increment=unwrap(node.incrementor);
 if(init?.kind!==K.BinaryExpression||increment?.kind!==K.BinaryExpression||
    readCanonicalInt32Literal(init.right)===undefined||readCanonicalInt32Literal(increment.right)===undefined)return;
 const converted=inclusiveLiteralIntComparison(node.condition);if(!converted)return;
 return {node:{...node,condition:converted.condition},proof:converted.proof};
}
export function matchLiteralCountedLoop(node,ctx){
 const c=candidate(node);if(!c)return;
 const match=previousMatch(c.node,ctx);if(!match)return;
 return {...match,...c.proof?{strictComparisonProof:c.proof}:{}};
}
export function tryBuildLiteralCountedLoop(node,role,ctx,build){
 const c=candidate(node);if(!c)return;
 const records=traces.getStore(),before=records?.length??0;
 // The previous binder still proves actual local-int ownership, direction,
 // nonzero step and the exact installed NativeLib macro before construction.
 const ref=previousBuild(c.node,role,ctx,build);
 if(ref&&c.proof&&records&&records.length>before){
  const record=records.at(-1);
  if(record.kind==='LITERAL_COUNTED_LOOP_TO_INSTALLED_GUI_RANGE')record.strictComparisonProof=c.proof;
 }
 return ref;
}
