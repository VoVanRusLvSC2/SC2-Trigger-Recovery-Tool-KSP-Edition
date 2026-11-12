import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {proveBoundedLiteralArithmetic} from './bounded-numeric-literal-arithmetic.recursive.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;

/** Comparison view of an integral literal passed to an exact fixed native
 * formal. The complete supplied include closure and unchanged native ABI are
 * prerequisites. The existing conservative common-carrier range proof rejects
 * overflow/unknown spellings. Arithmetic, integer formals, native aliases and
 * all nonintegral values retain their original spelling and types. */
export function canonicalClosedAbiFixedLiterals(source,{ownedSources=[],externalSources=[],includeEvidence=[]}={}){
 const root={fileName:'MapScript.galaxy',text:source},closed=removeAlreadyLoadedOwnedIncludes({root,ownedSources,externalSources,includeEvidence,includeRoot:false});
 assert.equal(closed.proof.completeReachableClosure,true,'FIXED_LITERAL_CLOSED_INCLUDE_CONTEXT_REQUIRED');
 const reachable=new Map(closed.proof.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256])),symbols=new Map(),seen=new Set(),inputs=[];
 const ast=parseImmutableGalaxySyntax(source,root.fileName);assert.equal(ast.parseDiagnostics.length,0);
 for(const f of [root,...ownedSources,...externalSources]){
  const owner=logicalSourcePath(f.originalPath??f.fileName),digest=sha(f.text);if(f!==root&&!reachable.has(owner))continue;
  if(reachable.has(owner))assert.equal(reachable.get(owner),digest,'FIXED_LITERAL_INCLUDE_SHA');
  if(f.sha256!==undefined)assert.equal(f.sha256,digest,'FIXED_LITERAL_INPUT_SHA');
  const key=JSON.stringify([owner,digest]);if(seen.has(key))continue;seen.add(key);inputs.push({owner,sha256:digest});
  const tree=f===root?ast:parseImmutableGalaxySyntax(f.text,owner);assert.equal(tree.parseDiagnostics.length,0);
  for(const n of tree.statements??[])if(n.name?.name){
   const list=symbols.get(n.name.name)??[];list.push({node:n,owner,sourceSha256:digest,declarationSha256:sha(f.text.slice(n.pos,n.end))});symbols.set(n.name.name,list);
  }
 }
 const nativeAbis=new Map();
 for(const [name,rows]of symbols){
  if(rows.some(({node:n})=>n.kind!==K.FunctionDeclaration||n.body||n.modifiers?.length!==1||n.modifiers[0].kind!==K.NativeKeyword||n.parameters.some(p=>p.isReference)))continue;
  const abi=n=>({returnType:printer.printNode(n.type),parameters:n.parameters.map(p=>printer.printNode(p.type))}),signature=abi(rows[0].node);
  if(rows.every(r=>JSON.stringify(abi(r.node))===JSON.stringify(signature)))nativeAbis.set(name,{...signature,declarations:rows.map(({node,...r})=>r)});
 }
 const shadowed=new Map();
 for(const fn of ast.statements??[])if(fn.kind===K.FunctionDeclaration&&fn.body){
  const names=new Set(fn.parameters.map(p=>p.name.name));const walk=n=>{if(n.kind===K.VariableDeclaration)names.add(n.name.name);forEachChild(n,walk);};walk(fn.body);shadowed.set(fn,names);
 }
 const edits=[],refusals={};
 const refuse=reason=>{refusals[reason]=(refusals[reason]??0)+1;};
 const visit=(n,fn)=>{
  if(n.kind===K.FunctionDeclaration)fn=n;
  if(n.kind===K.CallExpression&&n.expression.kind===K.Identifier){
   const name=n.expression.name,abi=nativeAbis.get(name);
   if(abi&&!shadowed.get(fn)?.has(name)&&abi.parameters.length===n.arguments.length)for(let i=0;i<abi.parameters.length;i++)if(abi.parameters[i]==='fixed'){
    const arg=unwrap(n.arguments[i]);
    if(arg?.kind!==K.NumericLiteral||!/^(?:0|[1-9]\d*)(?:\.0+)?$/u.test(arg.text)){refuse('NOT_A_DIRECT_UNAMBIGUOUS_INTEGRAL_LITERAL');continue;}
    const zero={kind:K.NumericLiteral,text:'0'},bounds=proveBoundedLiteralArithmetic({kind:K.BinaryExpression,left:arg,operatorToken:{kind:K.PlusToken},right:zero},node=>node.kind===K.NumericLiteral?{token:node.text}:undefined);
    if(!bounds){refuse('OUTSIDE_PROVEN_COMMON_CARRIER_DOMAIN');continue;}
    const token=BigInt(arg.text.split('.')[0]).toString()+'.0';if(token===arg.text)continue;
    edits.push({start:arg.pos,end:arg.end,before:source.slice(arg.pos,arg.end),replacement:token,callee:name,formalIndex:i,formalType:'fixed',
     sourceAbi:abi,rangeProof:bounds,arithmeticEvaluated:false,nonintegralPrecisionChanged:false});
   }
  }
  forEachChild(n,c=>visit(c,fn));
 };visit(ast);
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start);
 let text=source;for(const e of [...edits].reverse())text=text.slice(0,e.start)+e.replacement+text.slice(e.end);
 assert.equal(parseImmutableGalaxySyntax(text,'fixed-literal-view.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'CLOSED_NATIVE_FIXED_FORMAL_INTEGRAL_LITERAL_SPELLING',sourceSha256:sha(source),proofInputSha256:sha(text),inputs,edits,refusals,
  argumentContextAndAbiRequired:true,onlyProvenCommonCarrierIntegralValues:true,integerFormalsUnchanged:true,nonintegralValuesUnchanged:true,
  sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
