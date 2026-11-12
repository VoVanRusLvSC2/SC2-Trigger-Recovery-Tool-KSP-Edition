// Read-only lexical type facts for aggregate projections. Values stay unknown.
// Duplicate owners, shadow collisions, unresolved types and malformed accesses
// refuse; no GUI element is selected and no source AST is rewritten.
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/06d3b5115b52-6da1ac5f5fd9-60762c25dea4-g2t-core.js';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,visit){if(!n)return;visit(n);forEachChild(n,c=>walk(c,visit));}
export function createSourceProjectionTypes(asts,{globals}){
 const structs=new Map();
 for(const ast of asts)for(const n of ast.statements)if(n.kind===K.StructDeclaration){const list=structs.get(n.name.name)??[];list.push(n);structs.set(n.name.name,list);}
 const scalar=(type,name)=>type&&![K.ArrayType,K.MappedType].includes(type.kind)&&getTypeName(type)===name;
 function variable(name,owner){
  const locals=[];
  if(owner){for(const p of owner.parameters)if(p.name.name===name)locals.push(p);walk(owner.body,n=>{if(n.kind===K.VariableDeclaration&&n.name.name===name)locals.push(n);});}
  const declarations=locals.length?locals:globals.get(name)??[];
  return declarations.length===1?declarations[0]:undefined;
 }
 function indexIsInt(n,owner){
  n=unwrap(n);if(!n)return false;
  if(n.kind===K.NumericLiteral)return /^(?:0[xX][0-9a-fA-F]+|\d+)$/u.test(n.text??'');
  if(n.kind===K.Identifier)return scalar(variable(n.name,owner)?.type,'int');
  if(n.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator.kind))return indexIsInt(n.operand,owner);
  return false;
 }
 function typeOf(n,owner,depth=0){
  n=unwrap(n);if(!n||depth>32)return undefined;
  if(n.kind===K.Identifier)return variable(n.name,owner)?.type;
  if(n.kind===K.ElementAccessExpression){
   const base=typeOf(n.expression,owner,depth+1);
   return base?.kind===K.ArrayType&&indexIsInt(n.argumentExpression,owner)?base.elementType:undefined;
  }
  if(n.kind!==K.PropertyAccessExpression)return undefined;
  const base=typeOf(n.expression,owner,depth+1);if(!base||[K.ArrayType,K.MappedType].includes(base.kind))return undefined;
  const definitions=structs.get(getTypeName(base))??[];if(definitions.length!==1)return undefined;
  const members=definitions[0].members.filter(m=>m.kind===K.PropertyDeclaration&&m.name.name===n.name.name);
  return members.length===1?members[0].type:undefined;
 }
 return Object.freeze({isStringProjection(node,owner){
  const n=unwrap(node);
  return [K.PropertyAccessExpression,K.ElementAccessExpression].includes(n?.kind)&&scalar(typeOf(n,owner),'string');
 }});
}
