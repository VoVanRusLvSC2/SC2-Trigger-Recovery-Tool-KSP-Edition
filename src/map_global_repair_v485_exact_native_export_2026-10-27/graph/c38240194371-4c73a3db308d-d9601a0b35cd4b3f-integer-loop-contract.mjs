/** A PickEachInteger snapshots its boundary and owns its private iterator.
 * Authored loops must retain repeated reads and observable iterator state.
 * All indexes belong to this parsed function/conversion only.
 */
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import {extractAutoVarName,functionSymbolIndex,readSignedIntLiteral,unwrapParens} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';

export function integerLoopEndIsSnapshot(expression,ctx) {
  const end=unwrapParens(expression);
  if(readSignedIntLiteral(end)!==undefined)return true;
  if(end?.kind!==K.Identifier||extractAutoVarName(end.name)?.suffix!=='ae'||!ctx.structuredFunctionStatements)return false;
  const declaration=functionSymbolIndex(ctx.structuredFunctionStatements).declarations.get(end.name);
  return !!declaration?.initializer&&!!declaration.modifiers?.some(m=>m.kind===K.ConstKeyword);
}

const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken',
  'PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken',
  'BarEqualsToken','CaretEqualsToken'].map(name=>K[name]).filter(value=>value!==undefined));

export function privateSnapshotIntegerLoop(loop,ctx) {
  const name=loop.condition?.left?.name,full=ctx.structuredFunctionStatements;
  if(extractAutoVarName(name??'')?.suffix!=='var'||!full||!integerLoopEndIsSnapshot(loop.condition?.right,ctx))return false;
  const whole=functionSymbolIndex(full),own=functionSymbolIndex([loop]);
  const id=ctx.localVarByGalaxyName.get(name),variable=id&&ctx.elements[id],declaration=whole.declarations.get(name);
  if(variable?.type!=='Variable'||variable.variableType?.type!=='int'||variable.isArray||variable.isConstant||!declaration||declaration.initializer)return false;
  // With no inline initializer the known captured start is one extra assignment.
  const captured=!loop.initializer&&ctx.pendingAutoInits?.has(name);
  if(!loop.initializer&&!captured)return false;
  if(whole.uses.get(name)!==(own.uses.get(name)??0)+(captured?1:0))return false;
  if(whole.assignments.get(name)!==1)return false;
  let unsafe=false;
  const visit=n=>{
    if(!n)return;
    if(n.kind===K.VariableDeclaration&&n.name?.name===name)unsafe=true;
    if(n.kind===K.BinaryExpression&&writes.has(n.operatorToken?.kind)&&unwrapParens(n.left)?.name===name)unsafe=true;
    if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&
      [K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind)&&unwrapParens(n.operand)?.name===name)unsafe=true;
    forEachChild(n,visit);
  };
  visit(loop.statement);
  return !unsafe;
}
