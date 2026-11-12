import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const unwrap=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const primitive=new Set([K.BoolKeyword,K.IntKeyword,K.FixedKeyword,K.StringKeyword]);
const passive=node=>!node||[K.TrueKeyword,K.FalseKeyword,K.NumericLiteral,K.StringLiteral,K.NullKeyword].includes(unwrap(node)?.kind)||
  unwrap(node)?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(unwrap(node).operator?.kind)&&unwrap(unwrap(node).operand)?.kind===K.NumericLiteral;
const walk=(node,visit)=>{if(!node)return;visit(node);forEachChild(node,child=>{walk(child,visit);});};
const reference=node=>node.kind===K.Identifier&&!(node.parent?.kind===K.PropertyAccessExpression&&node.parent.name===node);

// A private condition computation can become an ordinary GUI Boolean function.
// Every moved local is private to this region and has a passive initializer;
// all exits reject the callback. This first form deliberately has no captures.
export function planClosedConditionRegion(declaration,guard,prefix) {
  assert(guard.thenStatement?.kind===K.Block&&!guard.elseStatement,'CONDITION_REGION_BLOCK_REQUIRED');
  const region=guard.thenStatement,locals=new Map(),counts=new Map();
  walk(declaration.body,node=>{if(node.kind===K.VariableDeclaration){const name=node.name.name;counts.set(name,(counts.get(name)??0)+1);}});
  for(const node of prefix.declarations){assert(!locals.has(node.name.name),'CONDITION_REGION_DUPLICATE_LOCAL');locals.set(node.name.name,node);}
  const used=new Set(),returns=[];
  walk(region,node=>{
    if(reference(node)&&locals.has(node.name))used.add(node.name);
    if(node.kind===K.ReturnStatement){assert(unwrap(node.expression)?.kind===K.FalseKeyword,'CONDITION_REGION_EARLY_SUCCESS_OR_VOID_RETURN');returns.push(node);}
  });
  assert(returns.length,'CONDITION_REGION_REJECTION_REQUIRED');
  const initializers=new Map(prefix.initializers.map(row=>[row.name,row.expression]));
  for(const name of used){
    const local=locals.get(name);
    assert(counts.get(name)===1&&primitive.has(local.type?.kind),'CONDITION_REGION_LOCAL_TYPE_OR_SCOPE_UNPROVED: '+name);
    assert(passive(initializers.get(name)),'CONDITION_REGION_EFFECTFUL_INITIALIZER: '+name);
  }
  const allowed=new Set();
  for(const local of prefix.declarations)allowed.add(local.name);
  for(const statement of declaration.body.statements.slice(0,prefix.length)){
    if(statement.kind===K.ExpressionStatement&&statement.expression?.kind===K.BinaryExpression&&statement.expression.operatorToken?.kind===K.EqualsToken){
      const left=unwrap(statement.expression.left);
      if(left?.kind===K.Identifier&&used.has(left.name)&&passive(statement.expression.right))allowed.add(left);
    }
  }
  const outside=node=>{
    if(node===region)return;
    if(reference(node)&&used.has(node.name)&&!allowed.has(node))assert.fail('CONDITION_REGION_LOCAL_ESCAPES: '+node.name);
    forEachChild(node,child=>{outside(child);});
  };outside(declaration.body);
  return {region,localNames:[...used],locals:[...used].map(name=>locals.get(name)),
    proof:{kind:'CLOSED_REJECTING_CONDITION_REGION',callback:declaration.name.name,start:region.pos,end:region.end,
      locals:[...used].map(name=>({name,start:locals.get(name).pos,end:locals.get(name).end,passiveInitializer:true})),
      rejectingReturns:returns.map(node=>({start:node.pos,end:node.end})),captures:[],localLiveOut:[],
      phaseEffectsMovedToActions:false,sourceChanged:false,wholeMapAccepted:false}};
}
