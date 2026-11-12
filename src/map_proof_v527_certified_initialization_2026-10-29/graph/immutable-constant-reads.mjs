import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const literal=n=>[K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||
 n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral;

/** An unevaluated const-read capability bound to this parsed source. Only
 * unique root primitive const declarations and literal/const reference chains
 * qualify. Mutable values, calls, arithmetic, aliases and local shadowing do
 * not. No expression is replaced and no constant value is guessed. */
export function immutableGlobalConstantReads(ast){
 const declarations=new Map();
 for(const n of ast.statements??[]){
  if(!n.name?.name)continue;const rows=declarations.get(n.name.name)??[];rows.push(n);declarations.set(n.name.name,rows);
 }
 const proven=new Set(),active=new Set();
 function expression(n,shadowed){
  if(!n)return true;
  if(literal(n))return true;
  if(n.kind===K.ParenthesizedExpression)return expression(n.expression,shadowed);
  return n.kind===K.Identifier&&!shadowed.has(n.name)&&global(n.name);
 }
 function global(name){
  if(proven.has(name))return true;if(active.has(name))return false;
  const rows=declarations.get(name)??[],n=rows.length===1?rows[0]:undefined;
  if(n?.kind!==K.VariableDeclaration||n.modifiers?.length!==1||n.modifiers[0].kind!==K.ConstKeyword||!n.initializer||
   n.type?.kind<K.BoolKeyword||n.type.kind>K.WavetargetKeyword||n.type.kind===K.VoidKeyword)return false;
  active.add(name);const ok=expression(n.initializer,new Set());active.delete(name);if(ok)proven.add(name);return ok;
 }
 return Object.freeze({isIndependent:(node,shadowed)=>expression(node,shadowed),witnesses:()=>[...proven].sort()});
}
