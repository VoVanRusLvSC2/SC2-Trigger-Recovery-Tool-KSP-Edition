import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const primitive=new Set([K.BoolKeyword,K.ByteKeyword,K.IntKeyword,K.FixedKeyword]);
const binary=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.AmpersandToken,K.BarToken,K.CaretToken]);
const integer=n=>n?.kind===K.NumericLiteral&&/^(?:0x[0-9a-f]+|[0-9]+)$/iu.test(n.text??n.value??'')?Number(n.text??n.value):undefined;
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function closed(n){
 n=un(n);if([K.NumericLiteral,K.TrueKeyword,K.FalseKeyword].includes(n?.kind))return true;
 if(n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken,K.TildeToken].includes(n.operator?.kind))return closed(n.operand);
 if(n?.kind!==K.BinaryExpression||!closed(n.left)||!closed(n.right))return false;
 if(binary.has(n.operatorToken.kind))return true;
 return [K.LessThanLessThanToken,K.GreaterThanGreaterThanToken].includes(n.operatorToken.kind)&&Number.isInteger(integer(un(n.right)))&&integer(un(n.right))>=0&&integer(un(n.right))<32;
}
function passiveArray(declaration){
 if(declaration.initializer||declaration.modifiers?.length)return;
 let type=declaration.type;const dimensions=[];
 while(type.kind===K.ArrayType){const size=integer(un(type.size));if(!Number.isSafeInteger(size)||size<=0||size>0x7fffffff)return;dimensions.push(size);type=type.elementType;}
 if(!dimensions.length||!primitive.has(type.kind))return;
 return {baseKind:type.kind,dimensions};
}
/** Proof view only: closed scalar computations commute with default initialization
 * of fixed primitive local storage. No state reads, calls, nominal constructors,
 * dynamic extents or array initializers may cross the declaration boundary. */
export function canonicalPassiveArrayLocalInitializers(source){
 const ast=parse(source,'passive-local-initializers');assert.equal(ast.parseDiagnostics.length,0);
 const edits=[],refused=[];
 for(const fn of ast.statements){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const declarations=[];for(const node of fn.body.statements){if(node.kind!==K.VariableDeclaration)break;declarations.push(node);}
  if(!declarations.some(n=>n.type.kind===K.ArrayType)||!declarations.some(n=>n.initializer))continue;
  const arrays=declarations.filter(n=>n.type.kind===K.ArrayType),arrayLayouts=arrays.map(passiveArray);
  const reject=reason=>refused.push({function:fn.name.name,reason});
  if(arrayLayouts.some(a=>!a)){reject('NONPASSIVE_ARRAY_STORAGE');continue;}
  const scalars=declarations.filter(n=>n.type.kind!==K.ArrayType);
  if(scalars.some(n=>!primitive.has(n.type.kind)||n.modifiers?.length||n.initializer&&!closed(n.initializer))){reject('NONCLOSED_SCALAR_INITIALIZATION');continue;}
  const names=new Set(declarations.map(n=>n.name.name));let collision=names.size!==declarations.length||fn.parameters.some(n=>names.has(n.name.name));
  const prefix=new Set(declarations),visit=node=>{if(node.kind===K.VariableDeclaration&&!prefix.has(node)&&names.has(node.name.name))collision=true;forEachChild(node,visit);};visit(fn.body);
  if(collision){reject('LOCAL_STORAGE_IDENTITY_AMBIGUOUS');continue;}
  const start=declarations[0].pos,end=declarations.at(-1).end;
  const assignments=scalars.filter(n=>n.initializer).map(n=>({name:n.name.name,expression:source.slice(n.initializer.pos,n.initializer.end)}));
  const replacement=declarations.map(n=>n.initializer?source.slice(n.type.pos,n.type.end)+' '+source.slice(n.name.pos,n.name.end)+';':source.slice(n.pos,n.end)).join('\n')+
   '\n'+assignments.map(n=>n.name+' = ('+n.expression+');').join('\n')+'\n';
  edits.push({function:fn.name.name,start,end,before:source.slice(start,end),replacement,assignments,
   arrays:arrays.map((n,i)=>({name:n.name.name,...arrayLayouts[i]})),closedInitializerOrderPreserved:true,defaultArrayStorageUnobservedByInitializers:true});
 }
 let text=source,delta=0;for(const edit of edits){edit.newStart=edit.start+delta;delta+=edit.replacement.length-(edit.end-edit.start);}
 for(const edit of edits.toReversed())text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
 let inverse=text;for(const edit of edits.toReversed())inverse=inverse.slice(0,edit.newStart)+edit.before+inverse.slice(edit.newStart+edit.replacement.length);
 assert.equal(inverse,source,'PASSIVE_ARRAY_INITIALIZER_BYTE_INVERSE');assert.equal(parse(text,'passive-local-initializer-view').parseDiagnostics.length,0);
 return {text,proof:{kind:'CLOSED_SCALAR_INITIALIZERS_ACROSS_PASSIVE_LOCAL_ARRAY_STORAGE',sourceSha256:sha(source),viewSha256:sha(text),edits,refused,
  sourceOrExportChanged:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false,rawOracleReplaced:false,
  boundary:'Runtime business effects; local debugger state and VM resource accounting are not an engine-acceptance claim.'}};
}
