import {isIntrinsicScalarType,isPassiveFixedIntrinsicArrayDeclaration as passiveArray} from '../model/passive-function-entry-storage.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
function closedLiteral(node){
 if(node?.kind===K.ParenthesizedExpression)return closedLiteral(node.expression);
 return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(node?.kind)||
  node?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(node.operator?.kind)&&node.operand?.kind===K.NumericLiteral;
}

/** Canonical comparison IR for function-entry scalar initializers. Non-constant
 * initializers become assignments in their original evaluation order. Scalar
 * local storage has no constructor or address identity in Galaxy. Calls and
 * their expressions are retained exactly, never evaluated or reordered.
 * Intrinsic value and handle storage has no implicit allocating constructor. Only uninitialized fixed intrinsic arrays are passive; nominal/ref/dynamic arrays, static locals and state-reading consts refuse. */
export function canonicalLocalInitializerSequence(source){
 const ast=parseImmutableGalaxySyntax(source,'local-initializer-proof.galaxy');assert.equal(ast.parseDiagnostics.length,0);
 const edits=[],refused=[];
 for(const fn of ast.statements??[]){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const declarations=[];
  for(const n of fn.body.statements??[]){if(n.kind!==K.VariableDeclaration)break;declarations.push(n);}
  if(!declarations.some(n=>n.initializer&&!(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword)))continue;
  const reject=reason=>refused.push({function:fn.name.name,reason});
  const names=declarations.map(n=>n.name.name),parameters=fn.parameters.map(p=>p.name.name);
  if(new Set([...names,...parameters]).size!==names.length+parameters.length){reject('LOCAL_OR_PARAMETER_IDENTITY_AMBIGUOUS');continue;}
  if(declarations.some(n=>(!isIntrinsicScalarType(n.type)&&!passiveArray(n))||(n.modifiers??[]).some(m=>m.kind!==K.ConstKeyword))){reject('NONSCALAR_OR_STATIC_LOCAL_STORAGE');continue;}
  if(declarations.some(n=>n.modifiers?.length&&!closedLiteral(n.initializer))){reject('CONST_INITIALIZER_HAS_READS_OR_EFFECTS');continue;}
  let forwardReference=false;
  for(let i=0;i<declarations.length;i++){
   const later=new Set(names.slice(i));
   const walk=n=>{if(n.kind===K.Identifier&&later.has(n.name))forwardReference=true;forEachChild(n,walk);};
   if(declarations[i].initializer)walk(declarations[i].initializer);
  }
  if(forwardReference){reject('INITIALIZER_READS_UNDECLARED_OR_SELF_LOCAL');continue;}
  const declarationText=[],assignments=[];
  for(const n of declarations){
   if(n.modifiers?.length){declarationText.push(source.slice(n.pos,n.end));continue;}
   declarationText.push(source.slice(n.type.pos,n.type.end)+' '+source.slice(n.name.pos,n.name.end)+';');
   if(n.initializer)assignments.push({name:n.name.name,start:n.initializer.pos,end:n.initializer.end,expression:source.slice(n.initializer.pos,n.initializer.end)});
  }
  const start=declarations[0].pos,end=declarations.at(-1).end;
  edits.push({function:fn.name.name,start,end,before:source.slice(start,end),
   replacement:declarationText.join('\n')+'\n'+assignments.map(a=>`${a.name} = (${a.expression});`).join('\n')+'\n',
   assignments,intrinsicStorageOnly:true,passiveArrayDeclarations:declarations.filter(passiveArray).map(n=>({name:n.name.name,type:source.slice(n.type.pos,n.type.end)})),initializerEvaluationOrderPreserved:true,pureLiteralConstantsOnly:true});
 }
 let text=source;
 for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
 assert.equal(parseImmutableGalaxySyntax(text,'local-initializer-proof-output.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'INTRINSIC_LOCAL_INITIALIZERS_WITH_PASSIVE_FIXED_ARRAY_STORAGE',intrinsicValueAndHandleCarriers:true,sourceSha256:sha(source),proofInputSha256:sha(text),edits,refused,
  implicitDefaultsNeverInvented:true,unknownStorageAndForwardReferencesRefused:true,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
