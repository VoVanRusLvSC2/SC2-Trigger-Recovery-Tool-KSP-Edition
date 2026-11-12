import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const unwrap=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};

// The caller proves TriggerCreate ownership. Parameter positions define its ABI;
// spelling does not. Consumed flags cannot also carry ordinary business values.
export function bindTriggerPhaseParameters(declaration) {
  const parameters=declaration.parameters??[];
  assert(declaration.type?.kind===K.BoolKeyword&&parameters.length===2&&
    parameters.every(p=>p.type?.kind===K.BoolKeyword&&p.name?.kind===K.Identifier)&&
    parameters[0].name.name!==parameters[1].name.name,'TRIGGER_CALLBACK_BOOL_ABI_REQUIRED');
  const names=parameters.map(p=>p.name.name),permitted=new Set();
  function positive(expression,name,remember=false) {
    let node=unwrap(expression);
    if(node?.kind===K.BinaryExpression&&node.operatorToken?.kind===K.EqualsEqualsToken&&
      unwrap(node.right)?.kind===K.TrueKeyword)node=unwrap(node.left);
    const matches=node?.kind===K.Identifier&&node.name===name;
    if(matches&&remember)permitted.add(node);
    return matches;
  }
  const conditions=expression=>positive(expression,names[0]);
  const actions=expression=>{
    const node=unwrap(expression);
    return node?.kind===K.PrefixUnaryExpression&&node.operator?.kind===K.ExclamationToken&&positive(node.operand,names[1]);
  };
  for(const statement of declaration.body?.statements??[]) {
    if(statement.kind!==K.IfStatement||statement.elseStatement)continue;
    if(conditions(statement.expression))positive(statement.expression,names[0],true);
    else if(actions(statement.expression))positive(unwrap(statement.expression).operand,names[1],true);
  }
  const walk=node=>{
    if(node.kind===K.Identifier&&names.includes(node.name)&&!permitted.has(node)) {
      const parent=node.parent;
      const property=parent?.kind===K.PropertyAccessExpression&&parent.name===node;
      assert(property,'TRIGGER_PHASE_PARAMETER_USED_AS_BUSINESS_VALUE: '+declaration.name.name+':'+node.name+'@'+node.pos);
    }
    forEachChild(node,walk);
  };
  walk(declaration.body);
  return {isTestCondsGuard:conditions,isRunActionsGuard:actions,
    parameters:parameters.map((p,index)=>({role:index===0?'conditions':'actions',name:p.name.name,start:p.pos,end:p.end}))};
}
