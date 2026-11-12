// Comparison views only: separate private counter lifetimes without changing
// stores, loop bounds, iteration order or runtime source. Unknown uses refuse.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function walk(n,visit){visit(n);forEachChild(n,c=>walk(c,visit));}
const inside=(n,owner)=>owner&&n.pos>=owner.pos&&n.end<=owner.end;

function normalize(text,prefix){
 const input={fileName:'private-for.galaxy',sourceId:'private-for',text,owned:true,contentSha256:sha(text)};
 const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha);
 try{
  const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);
  const edits=[],records=[],refused=[];
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const locals=fn.body.statements.filter(n=>n.kind===K.VariableDeclaration),pairs=[];
   walk(fn.body,loop=>{
    if(loop.kind!==K.ForStatement)return;
    const init=un(loop.initializer),condition=un(loop.condition),step=un(loop.incrementor),target=un(init?.left);
    if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||target?.kind!==K.Identifier)return;
    const binding=program.getBinding(target),local=program.declarationAt(target);
    if(binding.status!=='BOUND'||!locals.includes(local)||local.type?.kind!==K.IntKeyword||local.initializer||local.modifiers?.length)return;
    const same=n=>{n=un(n);return n?.kind===K.Identifier&&program.getBinding(n).symbolId===binding.symbolId;};
    if(readCanonicalInt32Literal(init.right)!==0n||condition?.kind!==K.BinaryExpression||
       ![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken?.kind)||!same(condition.left))return;
    const bound=readCanonicalInt32Literal(condition.right);
    if(bound===undefined||bound<0n||bound>2147483646n)return;
    if(step?.kind!==K.BinaryExpression||step.operatorToken?.kind!==K.PlusEqualsToken||!same(step.left)||readCanonicalInt32Literal(step.right)!==1n)return;
    pairs.push({loop,local,symbolId:binding.symbolId,name:local.name.name,bound:String(bound),refs:[]});
   });
   const selected=[];
   for(const symbolId of new Set(pairs.map(p=>p.symbolId))){
    const group=pairs.filter(p=>p.symbolId===symbolId),local=group[0].local;
    let failure;
    walk(fn.body,n=>{
     if(n.kind!==K.Identifier||n===local.name||program.getBinding(n).symbolId!==symbolId)return;
     const owners=group.filter(p=>inside(n,p.loop));
     if(owners.length!==1){failure='READ_OUTSIDE_OR_OVERLAPPING_COUNTER_LIFETIMES';return;}
     const pair=owners[0];
     if(![pair.loop.initializer,pair.loop.condition,pair.loop.incrementor].some(head=>inside(n,head))){
      let index;
      for(let parent=n.parent;parent&&inside(parent,pair.loop.statement);parent=parent.parent){
       if(parent.kind===K.ElementAccessExpression&&inside(n,parent.argumentExpression)){index=parent.argumentExpression;break;}
      }
      if(!index){failure='COUNTER_BODY_USE_IS_NOT_AN_ARRAY_INDEX';return;}
      let pure=true;walk(index,value=>{if(![K.Identifier,K.NumericLiteral,K.ParenthesizedExpression,K.BinaryExpression,
       K.PlusToken,K.MinusToken,K.AsteriskToken].includes(value.kind))pure=false;});
      if(!pure){failure='INDEX_EXPRESSION_NOT_CLOSED_PRIMITIVE_ARITHMETIC';return;}
     }
     pair.refs.push(n);
    });
    if(failure){refused.push({function:fn.name.name,name:local.name.name,symbolId,reason:failure});continue;}
    selected.push(...group);
   }
   selected.sort((a,b)=>a.loop.pos-b.loop.pos);
   if(!selected.length)continue;
   const declarations=[...new Set(selected.map(p=>p.local))];
   for(const local of declarations)edits.push({start:local.pos,end:local.end,before:text.slice(local.pos,local.end),replacement:''});
   const fresh=[];
   for(const [i,pair]of selected.entries()){
    const name=prefix+i;fresh.push('int '+name+';');
    for(const ref of pair.refs){const end=ref.pos+ref.name.length;assert.equal(text.slice(ref.pos,end),ref.name);edits.push({start:ref.pos,end,before:ref.name,replacement:name});}
    records.push({function:fn.name.name,sourceSymbolId:pair.symbolId,from:pair.name,to:name,bound:pair.bound,
     allReadsInOneResetLifetime:true,bodyUsesOnlyPureArrayIndices:true,loopAndStoreOrderUnchanged:true});
   }
   assert.equal(text[fn.body.pos],'{');
   edits.push({start:fn.body.pos+1,end:fn.body.pos+1,before:'',replacement:'\n'+fresh.join('\n')+'\n'});
  }
  edits.sort((a,b)=>a.start-b.start||a.end-b.end);
  for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'PRIVATE_COUNTER_EDITS_OVERLAP');
  let result=text;for(const e of [...edits].reverse()){assert.equal(result.slice(e.start,e.end),e.before);result=result.slice(0,e.start)+e.replacement+result.slice(e.end);}
  assert.equal(parseImmutableGalaxySyntax(result,'private-for-view.galaxy').parseDiagnostics.length,0);
  return {text:result,proof:{sourceSha256:sha(text),viewSha256:sha(result),records,refused}};
 }finally{program.dispose();}
}

export function normalizeBoundPrivateForCounters(before,after){
 const names=new Set();for(const text of [before,after]){const ast=parseImmutableGalaxySyntax(text,'private-for-identities.galaxy');assert.equal(ast.parseDiagnostics.length,0);walk(ast,n=>{if(n.kind===K.Identifier)names.add(n.name);});}
 let prefix='proofLoopIndex';while([...names].some(n=>n.startsWith(prefix)))prefix+='X';
 const a=normalize(before,prefix),b=normalize(after,prefix);
 return {before:a.text,after:b.text,proof:{kind:'EXACT_BOUND_PRIVATE_FOR_COUNTER_LIFETIMES',prefix,before:a.proof,after:b.proof,
  sourceOrExportChanged:false,rawOracleReplaced:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false}};
}
