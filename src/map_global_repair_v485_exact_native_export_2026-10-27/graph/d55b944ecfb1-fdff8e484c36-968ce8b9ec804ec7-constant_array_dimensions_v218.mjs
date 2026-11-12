import {cloneGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
/** Comparison only: global/struct type dimensions may use literal-valued int
 * constants from the actual source/foreign files. No function-local bindings,
 * runtime expressions, ambiguous definitions, arithmetic or guessed values.
 */
export function normalizeConstantArrayDimensions(source,K,forEachChild,{declarations=[],parseGalaxy}={}){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const definitions=new Map(),ambiguous=new Set();
 const eligible=n=>n.kind===K.VariableDeclaration&&[K.IntKeyword,K.ByteKeyword].includes(n.type?.kind)&&n.modifiers?.some(m=>m.kind===K.ConstKeyword);
 const fingerprint=n=>JSON.stringify(cloneGalaxySyntax(n));
 const add=(n,own=false)=>{
  if(n.kind!==K.VariableDeclaration)return;
  const key=n.name.name,old=definitions.get(key);
  if(old&&(own||fingerprint(old)!==fingerprint(n)))ambiguous.add(key);
  if(!old)definitions.set(key,n);
 };
 for(const file of declarations){
  const parsed=parseGalaxy(file.text,file.fileName??'foreign.galaxy');
  if(parsed.parseDiagnostics.length)return {source:result,notes,refused:'FOREIGN_PARSE_ERROR'};
  parsed.statements.forEach(n=>add(n));
 }
 result.statements.forEach(n=>add(n,true));
 const value=(n,seen=new Set())=>{
  if(!n)return;
  if(n.kind===K.ParenthesizedExpression)return value(n.expression,seen);
  if(n.kind===K.NumericLiteral&&/^(?:[0-9]+|0[xX][0-9a-fA-F]+)$/.test(n.text)){
   const x=BigInt(n.text);if(x<=2147483647n)return Number(x);return;
  }
  if(n.kind===K.Identifier&&!seen.has(n.name)&&!ambiguous.has(n.name)){
   const d=definitions.get(n.name);if(eligible(d??{}))return value(d.initializer,new Set([...seen,n.name]));
  }
 };
 const visitType=type=>{
  if(type?.kind!==K.ArrayType)return;
  const size=value(type.size);
  if(size>0&&type.size.kind!==K.NumericLiteral){
   notes.push({rule:'PROVEN_LITERAL_CONSTANT_ARRAY_DIMENSION',expression:fingerprint(type.size),value:size});
   type.size={kind:K.NumericLiteral,value:String(size),text:String(size)};
  }
  visitType(type.elementType);
 };
 for(const n of result.statements){
  if(n.kind===K.VariableDeclaration)visitType(n.type);
  else if(n.kind===K.StructDeclaration){
   // Visit only member declarations. No function/local scope is rewritten.
   for(const member of n.members??[])visitType(member.type);
  }
 }
 return {source:result,notes};
}
