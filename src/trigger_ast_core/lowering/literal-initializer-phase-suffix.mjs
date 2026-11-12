import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from '../model/source-function-declarations.mjs';
import {boundStorageShape} from '../model/bound-storage-shape.source-axes.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const zero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;
const call=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;
const integer=text=>{if(!/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(text)||text.length>32)return;
 try{const n=BigInt(/^0[0-7]+$/u.test(text)?'0o'+text.slice(1):text);return n<=2147483647n?n:undefined;}catch{return;}};
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};

/** Move a private, literal-only initialization suffix across two immediately
 * adjacent source phases. Trailing stores join their preceding existing helper.
 * No helper, wrapper, declaration, call or runtime effect is invented. The
 * caller must prove the remaining prefix representable using its unchanged
 * initializer recognizer. Native export and whole-program proof stay separate. */
export function lowerLiteralInitializerPhaseSuffix({program,fileName,foldPrefix,entryPoint='InitMap'}){
 assert(program?.documents instanceof Map&&!program.closed&&typeof foldPrefix==='function','LITERAL_INIT_BOUND_PROGRAM_REQUIRED');
 const ast=program.documents.get(fileName),identity=program.verifiedInputIdentity(fileName);
 assert(ast&&identity?.owned&&identity.contentSha256===sha(ast.text),'LITERAL_INIT_SOURCE_IDENTITY');
 const index=indexSourceFunctionDeclarations(program.documents),entry=index.get(entryPoint)?.body?.node,records=[],refusals=[];
 const result=(text=ast.text)=>({text,proof:{kind:'BOUND_LITERAL_INITIALIZER_PHASE_SUFFIX',inputSha256:sha(ast.text),outputSha256:sha(text),records,refusals,
  newNative:0,newRuntimeFunctions:0,newCustomScript:0,sourceArchivesChanged:false,wholeMapAccepted:false}});
 if(!zero(entry))return result();
 const target=c=>c&&program.getBinding(c.expression).status==='BOUND'?canonicalSourceFunctionDeclaration(index,program.declarationAt(c.expression)):undefined;
 const owned=n=>n&&program.location(n).sourceFile===fileName;
 const constantText=(node,seen=new Set())=>{
  node=un(node);if(node?.kind===K.StringLiteral)return readStringLiteralValue(node.text)?.value;
  if(node?.kind===K.BinaryExpression&&node.operatorToken.kind===K.PlusToken){const a=constantText(node.left,seen),b=constantText(node.right,seen);return a!==undefined&&b!==undefined&&a.length+b.length<=4096?a+b:undefined;}
  if(node?.kind!==K.Identifier||program.getBinding(node).status!=='BOUND')return;
  const d=program.declarationAt(node);if(d?.kind!==K.VariableDeclaration||!d.modifiers?.some(m=>m.kind===K.ConstKeyword)||!d.initializer||seen.has(d)||seen.size>=64)return;
  return constantText(d.initializer,new Set([...seen,d]));
 };
 function literalStore(statement){
  const e=statement.kind===K.ExpressionStatement&&statement.expression;
  if(e?.kind!==K.BinaryExpression||e.operatorToken.kind!==K.EqualsToken)return false;
  let base=un(e.left);const indices=[];
  while(base?.kind===K.ElementAccessExpression){const n=un(base.argumentExpression);if(n?.kind!==K.NumericLiteral)return false;
   const value=integer(String(n.text));if(value===undefined)return false;indices.unshift(value);base=un(base.expression);}
  if(!indices.length||base?.kind!==K.Identifier||program.getBinding(base).status!=='BOUND')return false;
  const declaration=program.declarationAt(base),where=declaration&&program.location(declaration);
  if(declaration?.kind!==K.VariableDeclaration||declaration.parent?.kind!==K.SourceFile||!program.verifiedInputIdentity(where.sourceFile)?.owned||declaration.modifiers?.length)return false;
  const shape=boundStorageShape(program,declaration.type);if(shape.status!=='RESOLVED'||shape.rank!==indices.length)return false;
  if(!shape.dimensions.every((s,i)=>{const extent=integer(s);return extent!==undefined&&indices[i]<extent;}))return false;
  const value=un(e.right);
  return shape.elementType==='string'&&value?.kind===K.StringLiteral&&!!readStringLiteralValue(value.text)||
   shape.elementType==='int'&&value?.kind===K.NumericLiteral&&integer(String(value.text))!==undefined||
   shape.elementType==='bool'&&[K.TrueKeyword,K.FalseKeyword].includes(value?.kind);
 }
 const slots=entry.body.statements;
 for(let i=0;i+1<slots.length;i++){
  const first=target(call(slots[i])),next=target(call(slots[i+1]));
  if(!zero(first)||!zero(next)||!owned(first)||!owned(next)||first===next||next.body.statements.some(n=>n.kind===K.VariableDeclaration))continue;
  const statements=first.body.statements;
  for(let boundary=0;boundary<statements.length;boundary++){
   const firstCall=call(statements[boundary]);if(!firstCall)continue;
   const prefix=statements.slice(0,boundary);if(!foldPrefix(first,prefix))continue;
   const helpers=[],tails=new Map();let valid=true;
   for(const s of statements.slice(boundary)){
    const c=call(s);
    if(c){const fn=target(c);
     if(!zero(fn)||!owned(fn)||[entry,first,next].includes(fn)||helpers.some(h=>h.fn===fn)||!fn.body.statements.length){valid=false;break;}
     const unsupported=fn.body.statements.find(s=>!literalStore(s));
     if(unsupported){refusals.push({phase:first.name.name,helper:fn.name.name,reason:'HELPER_LITERAL_CELL_STORE_NOT_PROVED',statement:program.location(unsupported)});valid=false;break;}
     helpers.push({fn,call:c,statement:s});tails.set(fn,[]);
    }else if(helpers.length&&literalStore(s))tails.get(helpers.at(-1).fn).push(s);
    else{refusals.push({phase:first.name.name,reason:'SUFFIX_LITERAL_CELL_STORE_NOT_PROVED',statement:program.location(s)});valid=false;break;}
   }
   if(!valid||!helpers.length)continue;
   const selected=new Set([first,next,...helpers.map(h=>h.fn)]),names=new Set([...selected].map(n=>n.name.name)),references=new Map([...selected].map(n=>[n,[]]));
   for(const tree of program.documents.values()){
    function visit(n){
     if(n.kind===K.StringLiteral&&!readStringLiteralValue(n.text))valid=false;
     if(n.kind===K.StringLiteral||n.kind===K.BinaryExpression&&n.operatorToken.kind===K.PlusToken){const value=constantText(n);if(value!==undefined&&value.split(/[^A-Za-z0-9_]+/u).some(s=>names.has(s)))valid=false;}
     if(n.kind===K.Identifier&&names.has(n.name)&&!(n.parent?.kind===K.FunctionDeclaration&&n.parent.name===n)){
      if(program.getBinding(n).status!=='BOUND')valid=false;
      else{const declaration=canonicalSourceFunctionDeclaration(index,program.declarationAt(n));if(selected.has(declaration))references.get(declaration).push(n);}
     }
     forEachChild(n,visit);
    }visit(tree);
   }
   const expected=new Map([[first,call(slots[i]).expression],[next,call(slots[i+1]).expression],...helpers.map(h=>[h.fn,h.call.expression])]);
   if(!valid||[...expected].some(([fn,node])=>references.get(fn).length!==1||references.get(fn)[0]!==node)){
    refusals.push({phase:first.name.name,reason:'OTHER_CALLER_OR_NAME_OBSERVER'});continue;
   }
   const source=ast.text,edits=[],snippet=n=>source.slice(n.pos,n.end),bodyEnd=n=>{
    const token=n.body.syntaxTokens?.filter(t=>t.kind===K.CloseBraceToken).at(-1);assert(token&&source[token.pos]==='}','LITERAL_INIT_BODY_BOUNDARY');return token.pos;};
   const calls=helpers.map(h=>snippet(h.statement)).join('\n');
   edits.push({start:statements[boundary].pos,end:statements.at(-1).end,replacement:'',role:'REMOVE_TRANSFERRED_SUFFIX'});
   const opening=next.body.syntaxTokens?.find(t=>t.kind===K.OpenBraceToken);assert(opening&&source[opening.pos]==='{','LITERAL_INIT_NEXT_BODY_BOUNDARY');
   edits.push({start:opening.pos+1,end:opening.pos+1,replacement:'\n'+calls+'\n',role:'PREPEND_EXISTING_CALLS'});
   for(const h of helpers){const tail=tails.get(h.fn);if(tail.length){const end=bodyEnd(h.fn);edits.push({start:end,end,replacement:'\n'+tail.map(snippet).join('\n')+'\n',role:'FUSE_LITERAL_STORES_INTO_SINGLE_CALL_HELPER'});}}
   edits.sort((a,b)=>a.start-b.start);for(let n=1;n<edits.length;n++)assert(edits[n-1].end<=edits[n].start,'LITERAL_INIT_OVERLAPPING_EDITS');
   let text=source;for(const e of edits.toReversed())text=text.slice(0,e.start)+e.replacement+text.slice(e.end);
   records.push({entry:program.location(entry),phase:program.location(first),nextPhase:program.location(next),prefixStatements:prefix.length,
    helpers:helpers.map(h=>({source:program.location(h.fn),call:program.location(h.call),originalLiteralStores:h.fn.body.statements.length,fusedLiteralStores:tails.get(h.fn).length})),
    sourcePhaseCallPosition:i,phasesDirectlyAdjacent:true,selectedFunctionsHaveSingleBoundCaller:true,noSelectedNameInStrings:true,
    helperBodiesHaveOnlyBoundLiteralCellStores:true,callOrderPreserved:true,runtimeNamedDispatchQualification:'SEPARATE_OBLIGATION',
    edits:edits.map(e=>({...e,removedSha256:sha(source.slice(e.start,e.end))}))});
   return result(text);
  }
 }
 return result();
}
