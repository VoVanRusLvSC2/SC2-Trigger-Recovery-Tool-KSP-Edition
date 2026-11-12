// Distinct primitive cells initialized by literals commute. Initializers in
// retained external files must be compile-time constant expressions as well;
// an intervening mutable read or effect forbids this comparison view.
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {Printer,SyntaxKind as K,isKeywordTypeKind} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');
const literal=n=>n&&[K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n.kind);
const pureBinary=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken,K.AmpersandToken,K.BarToken,K.CaretToken,K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken,K.AmpersandAmpersandToken,K.BarBarToken].filter(k=>k!==undefined));
export function normalizeIndependentLiteralGlobalInitializers(before,after,externalSources=[]){
 const asts=[before,after].map((t,i)=>parseImmutableGalaxySyntax(t,'literal-globals-'+i));
 const proof={kind:'INDEPENDENT_PRIMITIVE_LITERAL_GLOBAL_INITIALIZER_ORDER',records:[],wholeProgramOracleStillRequired:true,sourceOrExportChanged:false};
 const external=externalSources.map((f,i)=>parseImmutableGalaxySyntax(f.text,f.fileName??'globals-external-'+i));
 if([...asts,...external].some(a=>a.parseDiagnostics.length))return {before,after,proof:{...proof,refused:'LITERAL_GLOBALS_SOURCE_SYNTAX'}};
 for(let side=0;side<2;side++){
  const ast=asts[side],all=[ast,...external],declarations=new Map();
  for(const a of all)for(const n of a.statements)if(n.kind===K.VariableDeclaration){const rows=declarations.get(n.name.name)??[];rows.push(n);declarations.set(n.name.name,rows);}
  const constant=(n,active=new Set())=>{
   if(literal(n))return true;
   if(n?.kind===K.ParenthesizedExpression)return constant(n.expression,active);
   if(n?.kind===K.Identifier){const rows=declarations.get(n.name)??[];if(!rows.length||active.has(n.name)||rows.some(d=>!d.modifiers?.some(m=>m.kind===K.ConstKeyword)))return false;
    const bodies=new Set(rows.map(d=>printer.printNode(d)));if(bodies.size!==1)return false;
    return constant(rows[0].initializer,new Set([...active,n.name]));}
   if(n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken,K.TildeToken,K.ExclamationToken].includes(n.operator?.kind))return constant(n.operand,active);
   if(n?.kind===K.BinaryExpression&&pureBinary.has(n.operatorToken.kind))return constant(n.left,active)&&constant(n.right,active);
   if(n?.kind===K.ConditionalExpression)return constant(n.condition,active)&&constant(n.whenTrue,active)&&constant(n.whenFalse,active);
   return false;
  };
  for(const a of external)for(const n of a.statements)if(n.kind===K.VariableDeclaration&&n.initializer&&!constant(n.initializer))return {before,after,proof:{...proof,refused:'LITERAL_GLOBALS_EXTERNAL_INITIALIZATION_EFFECT_OR_MUTABLE_READ',source:a.fileName,variable:n.name.name}};
  const initialized=ast.statements.filter(n=>n.kind===K.VariableDeclaration&&n.initializer);
  if(initialized.some(n=>!literal(n.initializer)||!isKeywordTypeKind(n.type.kind))||new Set(ast.statements.filter(n=>n.kind===K.VariableDeclaration).map(n=>n.name.name)).size!==ast.statements.filter(n=>n.kind===K.VariableDeclaration).length)
   return {before,after,proof:{...proof,refused:'LITERAL_GLOBALS_NONLITERAL_OR_NONPRIMITIVE_OR_DUPLICATE'}};
  proof.records.push({side:side?'after':'before',originalOrder:initialized.map(n=>n.name.name),initializers:initialized.map(n=>({name:n.name.name,sha256:sha(printer.printNode(n))})),externalInitializersChecked:external.reduce((c,a)=>c+a.statements.filter(n=>n.kind===K.VariableDeclaration&&n.initializer).length,0)});
 }
 const texts=asts.map(ast=>{
  const values=ast.statements.filter(n=>n.kind===K.VariableDeclaration&&n.initializer).toSorted((a,b)=>a.name.name<b.name.name?-1:a.name.name>b.name.name?1:0);let at=0;
  return printer.printFile({...ast,statements:ast.statements.map(n=>n.kind===K.VariableDeclaration&&n.initializer?values[at++]:n)});
 });
 return {before:texts[0],after:texts[1],proof};
}
