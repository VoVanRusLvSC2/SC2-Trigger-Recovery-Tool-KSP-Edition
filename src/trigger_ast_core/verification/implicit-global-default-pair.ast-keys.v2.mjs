// Reconcile explicit VM defaults with the same implicit scalar defaults only
// after proving that every earlier initializer cannot write a script global.
// Runtime stores are never removed. Unknown native effects remain a refusal.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {Scanner,Printer,SyntaxKind as K,isAssignmentOperator,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {createInitializationOrder} from '../model/initialization-order.include-once.mjs';
const skipped=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
const shape=x=>!x||typeof x!=='object'?x:Array.isArray(x)?x.map(shape):Object.fromEntries(Object.entries(x).filter(([k])=>!skipped.has(k)).map(([k,v])=>[k,shape(v)]));
const sha=t=>createHash('sha256').update(t).digest('hex');
const contracts=new Map([
 ['StringLength',{result:'int',parameters:['string'],contract:'Existing native string length reads its immutable string argument; no script-global write or callback.'}],
 ['Color',{result:'color',parameters:['fixed','fixed','fixed'],contract:'Existing native color value constructor; no script-global write or callback.'}],
]);
const parse=(text,name)=>{const ast=parseImmutableGalaxySyntax(text,name);assert.equal(ast.parseDiagnostics.length,0,'IMPLICIT_DEFAULT_SYNTAX');return ast;};
const defaultLiteral=n=>getTypeName(n.type)==='bool'&&n.initializer?.kind===K.FalseKeyword||getTypeName(n.type)==='trigger'&&n.initializer?.kind===K.NullKeyword;
const safeKinds=new Set([K.Identifier,K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword,K.BinaryExpression,K.PrefixUnaryExpression,K.ParenthesizedExpression,K.ElementAccessExpression,K.PropertyAccessExpression,K.CallExpression]);
function inspectExpression(expression,sources,calls){
  function walk(n){
    assert(safeKinds.has(n.kind),'IMPLICIT_DEFAULT_UNKNOWN_INITIALIZER_NODE');
    if(n.kind===K.BinaryExpression)assert(!isAssignmentOperator(n.operatorToken.kind),'IMPLICIT_DEFAULT_PRIOR_ASSIGNMENT');
    if(n.kind===K.PrefixUnaryExpression)assert(![K.PlusPlusToken,K.MinusMinusToken].includes((n.operatorToken??n.operator)?.kind??n.operator),'IMPLICIT_DEFAULT_PRIOR_INCREMENT');
    if(n.kind===K.CallExpression){
      const name=n.expression?.kind===K.Identifier?n.expression.name:undefined,contract=contracts.get(name);
      assert(contract,'IMPLICIT_DEFAULT_UNKNOWN_NATIVE_EFFECT:'+name);
      const declarations=sources.flatMap(s=>s.ast.statements.filter(f=>f.name?.name===name));
      assert(declarations.length&&declarations.every(f=>f.kind===K.FunctionDeclaration&&!f.body&&f.modifiers?.length===1&&f.modifiers[0].kind===K.NativeKeyword&&getTypeName(f.type)===contract.result&&f.parameters.length===contract.parameters.length&&f.parameters.every((p,i)=>p.type.kind!==K.ArrayType&&getTypeName(p.type)===contract.parameters[i]&&!p.isReference)),'IMPLICIT_DEFAULT_NATIVE_ABI_OR_OVERRIDE:'+name);
      assert.equal(n.arguments.length,contract.parameters.length,'IMPLICIT_DEFAULT_NATIVE_ARITY');calls.add(name);
      for(const argument of n.arguments)walk(argument);return;
    }
    // Operator tokens and member names are syntax, not executable children.
    if(n.kind===K.BinaryExpression){walk(n.left);walk(n.right);return;}
    if(n.kind===K.PrefixUnaryExpression){walk(n.operand);return;}
    if(n.kind===K.ParenthesizedExpression){walk(n.expression);return;}
    if(n.kind===K.ElementAccessExpression){walk(n.expression);walk(n.argumentExpression);return;}
    if(n.kind===K.PropertyAccessExpression){walk(n.expression);return;}
  }
  walk(expression);
}
function initializerSpan(text,n){
  const scanner=new Scanner(()=>{throw Error('IMPLICIT_DEFAULT_TOKEN_ERROR');});scanner.setText(text.slice(n.name.pos,n.end));
  const next=()=>{let t;do{t=scanner.scan();}while(t===K.SingleLineCommentTrivia);return t;};
  assert.equal(next(),K.Identifier);assert.equal(scanner.getTokenText(),n.name.name);assert.equal(next(),K.EqualsToken);
  const start=n.name.pos+scanner.getTokenPos();assert.equal(next(),n.initializer.kind);const end=n.name.pos+scanner.getCurrentPos();assert.equal(next(),K.SemicolonToken);return {start,end};
}
export function normalizeImplicitDefaultGlobalPair(before,after,externalSources,includeEvidence){
  const a=parse(before,'mapscript.galaxy'),b=parse(after,'generated.galaxy'),globals=ast=>ast.statements.filter(n=>n.kind===K.VariableDeclaration);
  const source=globals(a),target=globals(b),counts=ns=>new Set(ns.map(n=>n.name.name)).size===ns.length;
  assert(counts(source)&&counts(target),'IMPLICIT_DEFAULT_AMBIGUOUS_GLOBAL');
  const candidates=source.filter(n=>n.type.kind!==K.ArrayType&&defaultLiteral(n)&&!n.modifiers?.length).filter(n=>{const other=target.find(m=>m.name.name===n.name.name);return other&&!other.initializer&&isDeepStrictEqual(shape({...n,initializer:undefined}),shape({...other,initializer:undefined}));});
  if(!candidates.length)return {before,after,proof:{records:[],sourceOrCandidateChanged:false}};
  const sources=[{fileName:'mapscript.galaxy',text:before,ast:a},...externalSources.map(s=>({...s,ast:parse(s.text,s.fileName)}))];
  const order=createInitializationOrder(before,externalSources,includeEvidence,{rootAliases:['LibMap_h.galaxy','Base.SC2Data/MapScript.galaxy','Base.SC2Data/LibMap_h.galaxy']}),records=[],refused=[],edits=[];
  for(const candidate of candidates){
    try{
      const meta=order.initializers.filter(m=>m.fileName==='mapscript.galaxy'&&m.name===candidate.name.name);assert.equal(meta.length,1,'IMPLICIT_DEFAULT_OWN_INITIALIZER_NOT_UNIQUE');
      const calls=new Set();
      for(const earlier of order.initializers.slice(0,meta[0].index)){
        const file=sources.find(s=>s.fileName.replaceAll('\\','/').toLowerCase()===earlier.fileName),node=file?.ast.statements.find(n=>n.name?.name===earlier.name&&n.pos===earlier.start&&n.end===earlier.end);
        assert(node&&sha(file.text)===earlier.sourceSha256,'IMPLICIT_DEFAULT_ORDER_NODE_NOT_BOUND');inspectExpression(node.initializer,sources,calls);
      }
      edits.push({...initializerSpan(before,candidate),name:candidate.name.name});
      records.push({name:candidate.name.name,type:getTypeName(candidate.type),value:new Printer().printNode(candidate.initializer),priorInitializersChecked:meta[0].index,
        pureNativeContracts:[...calls].map(name=>({name,...contracts.get(name)})),executionStoresRemoved:0,priorScriptGlobalWritesExcluded:true,defaultAbi:'Galaxy VM bool=false and trigger=null; no new runtime store or function.'});
    }catch(error){refused.push({name:candidate.name.name,reason:String(error.message)});}
  }
  let text=before;for(const edit of edits.toSorted((x,y)=>y.start-x.start))text=text.slice(0,edit.start)+text.slice(edit.end);
  const names=new Set(edits.map(e=>e.name)),expected=a.statements.map(n=>{if(!names.has(n.name?.name)||n.kind!==K.VariableDeclaration)return n;const copy={...n};delete copy.initializer;return copy;});
  assert(isDeepStrictEqual(shape(parse(text,'implicit-default-view').statements),shape(expected)),'IMPLICIT_DEFAULT_OTHER_AST_CHANGED');
  return {before:text,after,proof:{kind:'EXPLICIT_TO_IMPLICIT_VM_DEFAULT_WITH_CLOSED_INCLUDE_PREFIX',records,refused,
    originalDefaultSourceSha256:sha(before),viewSha256:sha(text),initializationOrder:{files:order.files,edges:order.edges,includeOnce:order.includeOnceByResolvedPath},
    allOtherAstExact:true,sourceOrCandidateChanged:false,wholeProgramOracleStillRequired:true}};
}
