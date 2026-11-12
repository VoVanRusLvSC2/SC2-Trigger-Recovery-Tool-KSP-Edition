import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const operations=new Map([[K.PlusEqualsToken,'+'],[K.MinusEqualsToken,'-'],[K.AsteriskEqualsToken,'*'],[K.SlashEqualsToken,'/'],[K.PercentEqualsToken,'%'],
 [K.LessThanLessThanEqualsToken,'<<'],[K.GreaterThanGreaterThanEqualsToken,'>>'],[K.AmpersandEqualsToken,'&'],[K.BarEqualsToken,'|'],[K.CaretEqualsToken,'^']]);
const reads=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken,
 K.AmpersandToken,K.BarToken,K.CaretToken,K.AmpersandAmpersandToken,K.BarBarToken,K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.GreaterThanToken,K.LessThanEqualsToken,K.GreaterThanEqualsToken]);
function pureReads(n){
 if([K.Identifier,K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword].includes(n?.kind))return true;
 if(n?.kind===K.ParenthesizedExpression)return pureReads(n.expression);
 if(n?.kind===K.PrefixUnaryExpression)return[K.PlusToken,K.MinusToken,K.ExclamationToken,K.TildeToken].includes(n.operator?.kind)&&pureReads(n.operand);
 return n?.kind===K.BinaryExpression&&reads.has(n.operatorToken?.kind)&&pureReads(n.left)&&pureReads(n.right);
}

/** Expand only a unique mutable primitive local/parameter and an effect-free
 * RHS. Globals, members, indexed targets, aliases, calls and ambiguous locals
 * are refused. The original operator, read/write identity and operands stay
 * ordered; no algebra, default value or evaluation is introduced. */
export function canonicalLocalCompoundAssignments(source){
 const ast=parseImmutableGalaxySyntax(source,'compound-proof.galaxy');assert.equal(ast.parseDiagnostics.length,0);
 const edits=[],refused=[];
 for(const fn of ast.statements??[]){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const bindings=new Map(),add=n=>{const name=n.name?.name;if(!name)return;const rows=bindings.get(name)??[];rows.push(n);bindings.set(name,rows);};
  for(const p of fn.parameters)add(p);
  const declarations=n=>{if(n.kind===K.VariableDeclaration)add(n);forEachChild(n,declarations);};declarations(fn.body);
  const visit=n=>{
   const op=n.kind===K.BinaryExpression&&operations.get(n.operatorToken?.kind);
   if(op){
    const rows=n.left?.kind===K.Identifier?bindings.get(n.left.name)??[]:[];
    const target=rows.length===1?rows[0]:undefined,type=target?.type?.kind;
    const allowed=type===K.IntKeyword||type===K.FixedKeyword&&['+','-','*','/'].includes(op)||type===K.StringKeyword&&op==='+';
    if(!target||target.isReference||target.modifiers?.length||!allowed||!pureReads(n.right)){
     refused.push({function:fn.name.name,start:n.pos,reason:'NONUNIQUE_NONLOCAL_OR_EFFECTFUL_COMPOUND_ASSIGNMENT'});
    }else{
     const name=source.slice(n.left.pos,n.left.end),rhs=source.slice(n.right.pos,n.right.end);
     edits.push({function:fn.name.name,start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:`${name} = (${name} ${op} (${rhs}))`,
      operator:op,bindingDeclaration:{start:target.pos,end:target.end,type:K[type]},targetEvaluatedWithoutEffects:true,rhsHasReadsOnly:true});
    }
   }
   forEachChild(n,visit);
  };visit(fn.body);
 }
 const sorted=edits.sort((a,b)=>a.start-b.start);for(let i=1;i<sorted.length;i++)assert(sorted[i-1].end<=sorted[i].start);
 let text=source;for(const e of [...sorted].reverse())text=text.slice(0,e.start)+e.replacement+text.slice(e.end);
 assert.equal(parseImmutableGalaxySyntax(text,'compound-proof-output.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'UNIQUE_PRIMITIVE_LOCAL_COMPOUND_ASSIGNMENT',sourceSha256:sha(source),proofInputSha256:sha(text),edits:sorted,refused,
  sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
