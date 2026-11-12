import {cloneGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
/** Comparison-only ordering of compile-time primitive constants.
 * Runtime initializers stay in EXACT order. Mutable literal writes are not
 * moved across calls. Only literal-valued consts and expressions of such consts
 * qualify; runtime calls, mutable aliases, handles and unknown operators refuse.
 */
export function normalizeImmutableGlobalConstants(source,K,{declarations=[],parseGalaxy}={}){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const globals=new Map(),duplicates=new Set();
 for(const n of result.statements)if(n.kind===K.VariableDeclaration){if(globals.has(n.name.name))duplicates.add(n.name.name);globals.set(n.name.name,n);}
 // Actual foreign constants may prove a source-owned constant initializer.
 // Foreign declarations are never moved/inserted; conflicting definitions refuse.
 if(parseGalaxy)for(const file of declarations){
  const parsed=parseGalaxy(file.text,file.fileName??'foreign.galaxy');
  if(parsed.parseDiagnostics.length)return {source:result,notes,refused:'FOREIGN_PARSE_ERROR'};
  for(const n of parsed.statements)if(n.kind===K.VariableDeclaration){
   const name=n.name.name,old=globals.get(name);
   if(old&&JSON.stringify(cloneGalaxySyntax(old))!==JSON.stringify(cloneGalaxySyntax(n)))duplicates.add(name);
   if(!old)globals.set(name,n);
  }
 }
 const primitive=new Set([K.BoolKeyword,K.ByteKeyword,K.IntKeyword,K.FixedKeyword,K.StringKeyword]);
 const literal=new Set([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword]);
 const unary=new Set([K.PlusToken,K.MinusToken,K.TildeToken,K.ExclamationToken]);
 const binary=new Set(['PlusToken','MinusToken','AsteriskToken','AmpersandToken','BarToken','CaretToken','LessThanToken','LessThanEqualsToken','GreaterThanToken','GreaterThanEqualsToken','EqualsEqualsToken','ExclamationEqualsToken','AmpersandAmpersandToken','BarBarToken'].map(k=>K[k]));
 const isConst=n=>n?.kind===K.VariableDeclaration&&primitive.has(n.type?.kind)&&n.modifiers?.some(m=>m.kind===K.ConstKeyword)&&!duplicates.has(n.name.name);
 const pure=(n,seen)=>{if(!n)return false;if(literal.has(n.kind))return true;
  if(n.kind===K.ParenthesizedExpression)return pure(n.expression,seen);
  if(n.kind===K.PrefixUnaryExpression)return unary.has(n.operator?.kind)&&pure(n.operand,seen);
  if(n.kind===K.BinaryExpression)return binary.has(n.operatorToken?.kind)&&pure(n.left,seen)&&pure(n.right,seen);
  if(n.kind===K.Identifier){const d=globals.get(n.name);return isConst(d)&&!seen.has(n.name)&&pure(d.initializer,new Set([...seen,n.name]));}
  return false;
 };
 const chosen=result.statements.filter(n=>isConst(n)&&pure(n.initializer,new Set([n.name.name]))),selected=new Set(chosen);
 if(chosen.length){chosen.sort((a,b)=>a.name.name.localeCompare(b.name.name));result.statements=[...chosen,...result.statements.filter(n=>!selected.has(n))];notes.push({rule:'COMPILE_TIME_LITERAL_PRIMITIVE_CONSTANT_ORDER',names:chosen.map(n=>n.name.name),runtimeInitializersMoved:0});}
 return {source:result,notes};
}
