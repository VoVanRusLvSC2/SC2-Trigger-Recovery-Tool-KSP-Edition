// Proof view only. Never touch declarations or a live branch. No condition is
// guessed constant: an existing structural return/closed if is the boundary.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {Parser,Printer,SyntaxKind as K,forEachChild,getKeywordType} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {decodeBoundAsciiString} from '../../galaxy_ascii_string_v1246.mjs';
const skip=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));
const printer=new Printer();
function walk(n,fn,parent){fn(n,parent);forEachChild(n,c=>walk(c,fn,n));}
function cannotFallThrough(n){
 if(n.kind===K.ReturnStatement)return true;
 if(n.kind===K.IfStatement)return !!n.elseStatement&&cannotFallThrough(n.thenStatement)&&cannotFallThrough(n.elseStatement);
 if(n.kind===K.Block)return n.statements.some(cannotFallThrough);
 return false;
}
const declarations=new Set([K.VariableDeclaration,K.FunctionDeclaration,K.Parameter,K.TypedefDeclaration,K.StructDeclaration]);
export function normalizeClosedUnreachableStatements(text){
 const ast=new Parser().parseFile('unreachable-original',text);assert.equal(ast.parseDiagnostics.length,0,'CLOSED_UNREACHABLE_SYNTAX');
 const records=[],unusedLocals=[];
 function visit(node,owner){
  if(node.kind===K.FunctionDeclaration)owner=node;
  if(node.kind===K.Block){
   const retained=[];let closed=false;
   for(const statement of node.statements){
    if(closed){let declared=false;walk(statement,n=>{if(declarations.has(n.kind))declared=true;});if(!declared){records.push({function:owner?.name.name,removed:printer.printNode(statement),reason:'STRUCTURALLY_UNREACHABLE_AFTER_UNCONDITIONAL_RETURN',declarationsRemoved:false});continue;}}
    retained.push(statement);if(cannotFallThrough(statement))closed=true;
   }
   node.statements=retained;
  }
  forEachChild(node,c=>visit(c,owner));
 }
 visit(ast);
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const names=new Map(),literalNames=[];
  walk(fn,(n)=>{if(n.kind===K.Identifier)names.set(n.name,(names.get(n.name)??0)+1);if(n.kind===K.StringLiteral)literalNames.push(decodeBoundAsciiString(n,text));});
  let prefix=true;
  fn.body.statements=fn.body.statements.filter(n=>{
   if(n.kind!==K.VariableDeclaration){prefix=false;return true;}
   if(!prefix||n.initializer||n.modifiers?.length||!getKeywordType(n.type.kind)||n.type.kind===K.VoidKeyword||names.get(n.name.name)!==1||literalNames.some(s=>s===undefined||s.includes(n.name.name)))return true;
   unusedLocals.push({function:fn.name.name,name:n.name.name,type:printer.printNode(n.type),uninitializedPrimitiveScalar:true,noRemainingReference:true,onlyEntryDeclarationRemoved:true});return false;
  });
 }
 const result=records.length||unusedLocals.length?printer.printFile(ast):text,check=new Parser().parseFile('unreachable-view',result);
 assert.equal(check.parseDiagnostics.length,0,'CLOSED_UNREACHABLE_OUTPUT_SYNTAX');assert(isDeepStrictEqual(shape(check.statements),shape(ast.statements)),'CLOSED_UNREACHABLE_OTHER_AST_CHANGED');
 return {text:result,proof:{kind:'STRUCTURAL_UNREACHABILITY_WITH_NO_BINDING_LOSS',records,unusedLocals,sourceOrCandidateChanged:false,unknownConditionsNotFolded:true,wholeProgramOracleStillRequired:true,
   boundary:'Runtime business behavior under the existing Galaxy primitive-local ABI; debugger display and VM allocation limits are not an engine-acceptance claim.'}};
}
