// A uniquely owned scalar string literal with no writes can be represented by
// a GUI constant. Keep its initializer at header time; never move it into a
// later InitVariables stage. Original literal spelling is retained verbatim.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),skip=new Set(['parent','syntaxTokens','symbol','locals','flowNode']);
const assignmentKinds=new Set([K.EqualsToken,K.PlusEqualsToken,K.MinusEqualsToken,K.AsteriskEqualsToken,K.SlashEqualsToken,K.PercentEqualsToken,K.LessThanLessThanEqualsToken,K.GreaterThanGreaterThanEqualsToken,K.AmpersandEqualsToken,K.BarEqualsToken,K.CaretEqualsToken]);
function walk(n,fn){if(!n||typeof n!=='object')return;if(Array.isArray(n)){for(const c of n)walk(c,fn);return;}fn(n);for(const[k,v]of Object.entries(n))if(!skip.has(k))walk(v,fn);}
const unparen=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function rootName(n){n=unparen(n);while(n&&[K.ElementAccessExpression,K.PropertyAccessExpression].includes(n.kind))n=unparen(n.expression);return n?.kind===K.Identifier?n.name:undefined;}
export function promoteReadonlyLiteralStringGlobals(source,externalTexts=[],document){
 assert(Array.isArray(externalTexts)&&externalTexts.every(t=>typeof t==='string'),'INVALID_EXTERNAL_TEXTS');
 const ast=(document?document.input(source):new Parser().parseFile('readonly-string-input.galaxy',source));assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');
 const globals=ast.statements.filter(n=>n.kind===K.VariableDeclaration),records=[],edits=[];
 for(const n of globals){
  if(n.type?.kind!==K.StringKeyword||n.initializer?.kind!==K.StringLiteral||(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword))continue;
  const name=n.name.name;if(globals.filter(x=>x.name.name===name).length!==1||externalTexts.some(t=>t.includes(name)))continue;
  let refused=false;
  walk(ast,x=>{
   if(x!==n&&[K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.StructDeclaration].includes(x.kind)&&x.name?.name===name)refused=true;
   if(x.kind===K.BinaryExpression&&assignmentKinds.has(x.operatorToken.kind)&&rootName(x.left)===name)refused=true;
   if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(x.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(x.operator?.kind)&&rootName(x.operand)===name)refused=true;
   // Reject potential dynamic-name/ABI observations as well as foreign text
   // occurrences. This deliberately prefers an unresolved case over a guess.
   if(x.kind===K.StringLiteral&&String(x.value??x.text??'').includes(name))refused=true;
  });
  if(refused)continue;
  assert.equal(source.slice(n.type.pos,n.type.pos+6),'string','STRING_TYPE_TOKEN_CHANGED');
  const literal=source.slice(n.initializer.pos,n.initializer.end);
  edits.push({start:n.type.pos,end:n.type.pos,before:'',replacement:'const '});
  records.push({name,type:'string',sourceDeclarationPosition:n.pos,initializerSha256:sha(literal),literalSpellingPreserved:true,noOwnedWrites:true,noShadowDeclarations:true,noForeignNameOccurrences:true,noNameInStringLiterals:true,headerInitializationTimePreserved:true,guiConstant:true,sourceWasAlreadyConstant:false,wholeMapAccepted:false});
 }
 let text=source;for(const e of [...edits].sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.replacement+text.slice(e.start);
 assert.equal((document?document.output(text):new Parser().parseFile('readonly-string-output.galaxy',text)).parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 return{text,proof:{kind:'OWNED_READONLY_LITERAL_GLOBAL_STRING_TO_GUI_CONSTANT',sourceSha256:sha(source),outputSha256:sha(text),changed:records.length>0,records,edits,externalInputs:externalTexts.map(t=>({bytes:Buffer.byteLength(t),sha256:sha(t)})),initializerExpressionsOrTimingChanged:false,originalArchiveChanged:false,persistentCache:false}};
}
