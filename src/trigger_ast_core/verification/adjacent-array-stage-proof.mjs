// Independent comparison view for inlining one private null-array startup
// stage. This does not compare or approve a candidate. Every other AST node,
// including the complete ordered initializer body, remains in the final oracle.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {unwrapArrayType,getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {proveProtocolNameAbsenceWithStringShapes as proveClosedProtocolNameAbsence} from '../analysis/protocol-name-string-shapes.mjs';
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
const shape=(v,renames=new Map())=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(x=>shape(x,renames)):Object.fromEntries(Object.entries(v).filter(([k])=>!ignored.has(k)).map(([k,x])=>[k,v.kind===K.Identifier&&k==='name'&&renames.has(x)?renames.get(x):shape(x,renames)]));
const sha=s=>createHash('sha256').update(s).digest('hex');
const plain=f=>f?.kind===K.FunctionDeclaration&&f.type.kind===K.VoidKeyword&&!f.parameters.length&&!f.modifiers?.length;
function visit(n,fn,p){fn(n,p);forEachChild(n,c=>visit(c,fn,n));}
const number=n=>n?.kind===K.NumericLiteral&&/^\d+$/u.test(String(n.value))?Number(n.value):undefined;
const assignment=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.BinaryExpression&&s.expression.operatorToken.kind===K.EqualsToken?s.expression:undefined;
const call=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;
class Refusal extends Error {}
const check=(v,s)=>{if(!v)throw new Refusal(s);};

export function inlinePrivateArrayInitializationStage(text,externalSources=[]) {
  const proof={kind:'PRIVATE_ADJACENT_NULL_ARRAY_STAGE_INLINE',records:[],originalSourceOrCandidateChanged:false,wholeProgramEquivalenceProved:false};
  try {
    const ast=parseImmutableGalaxySyntax(text,'array-stage-original.galaxy');check(!ast.parseDiagnostics.length,'ARRAY_STAGE_SYNTAX');
    const roots=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body);
    if(roots.length!==1||!plain(roots[0])||roots[0].body.statements.length!==4)return {text,proof};
    const root=roots[0],calls=root.body.statements.map(call);if(calls.some(c=>!c))return {text,proof};
    const names=calls.map(c=>c.expression.name);check(new Set(names).size===4,'ARRAY_STAGE_DISTINCT_ENTRY_CALLS');
    const stages=ast.statements.filter(n=>n.name?.name===names[2]),extra=stages.find(n=>n.body),previousDeclarations=ast.statements.filter(n=>n.name?.name===names[1]),previous=previousDeclarations.filter(n=>n.body);
    check(stages.length>=1&&stages.length<=2&&stages.every(plain)&&stages.filter(n=>n.body).length===1,'ARRAY_STAGE_UNIQUE_EXTRA');
    check(previous.length===1&&previousDeclarations.length<=2&&previousDeclarations.every(plain),'ARRAY_STAGE_UNIQUE_PREVIOUS');
    const prev=previous[0],locals=[];let prefix=true;
    for(const n of extra.body.statements){if(prefix&&n.kind===K.VariableDeclaration)locals.push(n);else prefix=false;}
    check(locals.length>0&&locals.every(n=>getTypeName(n.type)==='int'&&!n.initializer&&!n.modifiers?.length),'ARRAY_STAGE_INT_COUNTER_LOCALS');
    const counters=new Set(locals.map(n=>n.name.name)),globals=new Map();
    for(const n of ast.statements.filter(n=>n.kind===K.VariableDeclaration)){check(!globals.has(n.name.name),'ARRAY_STAGE_GLOBAL_COLLISION');globals.set(n.name.name,n);}
    check(counters.size===locals.length&&[...counters].every(n=>!globals.has(n)),'ARRAY_STAGE_COUNTER_SHADOW');
    const tail=extra.body.statements.slice(locals.length),fills=[];check(tail.length>0,'ARRAY_STAGE_NO_FILLS');
    for(const loop of tail) {
      check(loop.kind===K.ForStatement,'ARRAY_STAGE_ONLY_CANONICAL_FOR_FILLS');
      const init=loop.initializer,condition=loop.condition,step=loop.incrementor;
      check(init?.kind===K.BinaryExpression&&init.operatorToken.kind===K.EqualsToken&&init.left.kind===K.Identifier&&counters.has(init.left.name)&&number(init.right)===0,'ARRAY_STAGE_ZERO_COUNTER');
      const name=init.left.name;
      check(condition?.kind===K.BinaryExpression&&condition.left.kind===K.Identifier&&condition.left.name===name,'ARRAY_STAGE_COUNTER_CONDITION');
      check(step?.kind===K.BinaryExpression&&step.operatorToken.kind===K.PlusEqualsToken&&step.left.kind===K.Identifier&&step.left.name===name&&number(step.right)===1,'ARRAY_STAGE_UNIT_COUNTER_STEP');
      const statements=loop.statement?.kind===K.Block?loop.statement.statements:[loop.statement];check(statements.length===1,'ARRAY_STAGE_SINGLE_STORE');
      const store=assignment(statements[0]),target=store?.left;
      check(store?.right.kind===K.NullKeyword&&target?.kind===K.ElementAccessExpression&&target.expression.kind===K.Identifier&&target.argumentExpression.kind===K.Identifier&&target.argumentExpression.name===name,'ARRAY_STAGE_NULL_ARRAY_STORE');
      const declaration=globals.get(target.expression.name);check(declaration,'ARRAY_STAGE_GLOBAL_ARRAY_REQUIRED');
      const type=unwrapArrayType(declaration.type),size=type.sizes.length===1?number(type.sizes[0]):undefined;
      check(getTypeName(type.baseType)==='string'&&Number.isSafeInteger(size)&&size>0&&size<=65536,'ARRAY_STAGE_LITERAL_STRING_ARRAY_SIZE');
      const bound=number(condition.right),operator=condition.operatorToken.kind;
      check(operator===K.LessThanToken&&bound===size||operator===K.LessThanEqualsToken&&bound===size-1,'ARRAY_STAGE_EXACT_IN_BOUNDS_FILL');
      fills.push({array:target.expression.name,size,counter:name});
    }
    visit(prev.body,n=>check(![K.ReturnStatement,K.BreakpointStatement].includes(n.kind),'ARRAY_STAGE_PREVIOUS_EARLY_EXIT'));
    const external=externalSources.map((f,i)=>{const a=parseImmutableGalaxySyntax(typeof f==='string'?f:f.text,typeof f==='string'?'external-'+i:f.fileName??'external-'+i);check(!a.parseDiagnostics.length,'ARRAY_STAGE_EXTERNAL_SYNTAX');return a;});
    const allowed=new Set([...stages,...previousDeclarations].map(n=>n.name));
    for(const tree of [ast,...external])visit(tree,(n,p)=>{
      if(n.kind!==K.Identifier||![names[1],names[2]].includes(n.name)||allowed.has(n))return;
      if(p?.kind===K.FunctionDeclaration&&p.name===n&&!p.body&&plain(p))return;
      const entryCall=calls[n.name===names[2]?2:1];
      check(n===entryCall.expression&&p===entryCall,'ARRAY_STAGE_FUNCTION_REFERENCE_ESCAPES');
    });
    let protocol;try{protocol=proveClosedProtocolNameAbsence([ast,...external],new Set([names[1],names[2]]));}catch(error){throw new Refusal(String(error.message));}
    const used=new Set();
    visit(ast,n=>{if(n.kind===K.Identifier)used.add(n.name);});
    const renames=new Map();let count=0;
    for(const name of counters){let to;do{to='arrayStageCounter'+count++;}while(used.has(to));renames.set(name,to);used.add(to);}
    const renamedSlice=(start,end)=>{
      const edits=[];visit(extra.body,n=>{if(n.kind===K.Identifier&&renames.has(n.name)&&n.pos>=start&&n.end<=end){check(text.slice(n.pos,n.end)===n.name,'ARRAY_STAGE_IDENTIFIER_SPAN');edits.push({start:n.pos,end:n.end,text:renames.get(n.name)});}});
      let value=text.slice(start,end);for(const e of edits.toSorted((a,b)=>b.start-a.start))value=value.slice(0,e.start-start)+e.text+value.slice(e.end-start);return value;
    };
    let prefixCount=0;while(prev.body.statements[prefixCount]?.kind===K.VariableDeclaration)prefixCount++;
    const insertAt=prefixCount?prev.body.statements[prefixCount-1].end:prev.body.pos+1;
    const edits=[...stages.map(n=>({start:n.pos,end:n.end,text:''})),{start:root.body.statements[2].pos,end:root.body.statements[2].end,text:''},
      {start:insertAt,end:insertAt,text:'\n'+locals.map(n=>renamedSlice(n.pos,n.end)).join('\n')+'\n'},
      {start:prev.body.end-1,end:prev.body.end-1,text:'\n'+tail.map(n=>renamedSlice(n.pos,n.end)).join('\n')+'\n'}];
    let result=text,edge=Infinity;
    for(const e of edits.toSorted((a,b)=>b.start-a.start)){assert(e.end<=edge,'ARRAY_STAGE_EDIT_OVERLAP');result=result.slice(0,e.start)+e.text+result.slice(e.end);edge=e.start;}
    const after=parseImmutableGalaxySyntax(result,'array-stage-inline-view.galaxy');assert.equal(after.parseDiagnostics.length,0,'ARRAY_STAGE_OUTPUT_SYNTAX');
    const expected=ast.statements.filter(n=>!stages.includes(n)).map(n=>n===prev?{...n,body:{...n.body,statements:[...n.body.statements.slice(0,prefixCount),...locals.map(n=>shape(n,renames)),...n.body.statements.slice(prefixCount),...tail.map(n=>shape(n,renames))]}}:n===root?{...n,body:{...n.body,statements:n.body.statements.filter((_,i)=>i!==2)}}:n);
    assert(isDeepStrictEqual(shape(after.statements),shape(expected)),'ARRAY_STAGE_OTHER_AST_CHANGED');
    proof.records.push({extraStage:names[2],previousStage:names[1],entryOrder:names,fills,localRenames:[...renames],protocol,
      allOtherAstExact:true,entireOrderedBodyRetained:true,noCallsInExtraStage:true,sourceSha256:sha(text),viewSha256:sha(result)});
    return {text:result,proof};
  }catch(error){if(error instanceof Refusal)return {text,proof:{...proof,refused:error.message}};throw error;}
}

