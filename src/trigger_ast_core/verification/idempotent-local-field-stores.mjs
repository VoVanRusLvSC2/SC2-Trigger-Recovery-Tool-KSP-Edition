// Only consecutive identical stores to a plain local value-structure field.
// No indexed/call lvalue, reference parameter, global store or mutable RHS.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {Parser,Printer,SyntaxKind as K,getKeywordType,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const skip=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));
const typeName=t=>t?.kind===K.Identifier?t.name:t?.kind===K.TypeReference?t.typeName?.name:undefined;
const literal=n=>n&&[K.NullKeyword,K.TrueKeyword,K.FalseKeyword,K.NumericLiteral,K.StringLiteral].includes(n.kind);
function store(s){const b=s?.kind===K.ExpressionStatement?s.expression:undefined;return b?.kind===K.BinaryExpression&&b.operatorToken.kind===K.EqualsToken&&b.left.kind===K.PropertyAccessExpression&&b.left.expression.kind===K.Identifier?b:undefined;}
export function normalizeIdempotentLocalFieldStores(text,externalSources=[]){
 const parse=(text,name)=>{const a=new Parser().parseFile(name,text);assert.equal(a.parseDiagnostics.length,0,'LOCAL_FIELD_STORE_SYNTAX');return a;};
 const ast=parse(text,'local-field-stores'),sources=[ast,...externalSources.map((s,i)=>parse(s.text,'external-'+i))],records=[],printer=new Printer();
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const locals=fn.body.statements.filter(n=>n.kind===K.VariableDeclaration),names=new Set([...locals,...fn.parameters].map(n=>n.name.name));
  function stableValue(n){
   if(literal(n))return {literal:true};
   if(n.kind!==K.Identifier||names.has(n.name))return;
   const ds=sources.flatMap(s=>s.statements.filter(d=>d.name?.name===n.name));
   if(!ds.length||!ds.every(d=>d.kind===K.VariableDeclaration&&getKeywordType(d.type.kind)&&d.modifiers?.some(m=>m.kind===K.ConstKeyword)))return;
   const initialized=ds.filter(d=>d.initializer);if(!initialized.length||!initialized.every(d=>literal(d.initializer)||d.initializer.kind===K.PrefixUnaryExpression&&literal(d.initializer.operand)))return;
   if(!initialized.every(d=>isDeepStrictEqual(shape(d.initializer),shape(initialized[0].initializer))))return;
   return {constant:n.name,declarations:ds.length};
  }
  function localField(left){
   const ds=locals.filter(d=>d.name.name===left.expression.name);if(ds.length!==1||ds[0].modifiers?.length||fn.parameters.some(p=>p.name.name===left.expression.name))return;
   const name=typeName(ds[0].type);if(!name)return;
   const structs=sources.flatMap(s=>s.statements.filter(d=>d.kind===K.StructDeclaration&&d.name.name===name));
   if(!structs.length||!structs.every(d=>isDeepStrictEqual(shape(d),shape(structs[0]))))return;
   const member=structs[0].members.find(m=>m.name.name===left.name.name);if(!member||!getKeywordType(member.type.kind))return;
   return {local:ds[0].name.name,structure:name,field:member.name.name};
  }
  function visit(n){
   if(n.kind===K.Block){const kept=[];for(const s of n.statements){const a=store(kept.at(-1)),b=store(s);if(a&&b&&isDeepStrictEqual(shape(a),shape(b))){const field=localField(b.left),value=stableValue(b.right);if(field&&value){records.push({...field,value,adjacentIdenticalStores:true,remainingStoreRetained:true});kept[kept.length-1]=s;continue;}}kept.push(s);}n.statements=kept;}
   forEachChild(n,visit);
  }
  visit(fn.body);
 }
 const result=records.length?printer.printFile(ast):text,after=parse(result,'local-field-view');assert(isDeepStrictEqual(shape(after.statements),shape(ast.statements)),'LOCAL_FIELD_STORE_OTHER_AST_CHANGED');
 return {text:result,proof:{kind:'IDEMPOTENT_PLAIN_LOCAL_STRUCTURE_FIELD_STORE',records,sourceOrCandidateChanged:false,noNativeCallOrYieldRemoved:true,wholeProgramOracleStillRequired:true}};
}
