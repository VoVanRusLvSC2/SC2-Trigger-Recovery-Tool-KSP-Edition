import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext,declaredCarrier} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {assertExactAstShape} from './exact-ast-shape.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id','comments','__sourceText','hasReturn']);
const carriers=new Set(['int','byte','fixed','bool','string','text','unit','point','region','unitgroup','playergroup','trigger','timer','bank','actor','actorscope','order','abilcmd','sound','color','wave','wavetarget','camerainfo']);
const walk=(node,visit)=>{const pending=[node];while(pending.length){const n=pending.pop();if(!n)continue;visit(n);const children=[];forEachChild(n,c=>children.push(c));pending.push(...children.reverse());}};
function inert(declaration){
  if(declaration.initializer||declaration.modifiers?.length)return false;
  let type=declaration.type;
  while(type?.kind===K.ArrayType){
    const size=type.size;
    if(size?.kind!==K.NumericLiteral||!/^(?:[1-9][0-9]*|0[xX][0-9a-fA-F]+)$/u.test(size.text??''))return false;
    const value=BigInt(size.text);if(value<=0n||value>2147483647n)return false;
    type=type.elementType;
  }
  return carriers.has(declaredCarrier(type));
}

/** Proof view only. Commute existing uninitialized scalar/constant-extent
 * array declarations within a contiguous entry segment. Use bound first-use
 * order, not generated-name prefixes or field-name spelling. No declaration,
 * initializer, assignment, call, type, or reference is deleted or renamed.
 * Inverse permutation plus exact AST comparison is a mandatory postcondition.
 */
export function normalizeBoundEntryDeclarationOrder(text){
  const input={fileName:'local-order.galaxy',sourceId:'bound-entry-order',text,owned:true,contentSha256:sha(text)};
  const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha);
  try{
    const ast=program.documents.get(input.fileName);program.attachOriginal(ast);
    assert.equal(ast.parseDiagnostics.length,0,'BOUND_LOCAL_ORDER_SYNTAX');
    const edits=[],records=[],refused=[];
    for(const [functionIndex,fn] of ast.statements.entries()){
      if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
      const entry=[];for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;entry.push(s);}
      if(entry.length<2)continue;
      const names=entry.map(n=>n.name.name),known=new Set(entry),bindings=new Map();let reason;
      if(new Set([...names,...fn.parameters.map(n=>n.name.name)]).size!==entry.length+fn.parameters.length)reason='DUPLICATE_ENTRY_BINDING';
      walk(fn.body,n=>{if(n.kind===K.VariableDeclaration&&!known.has(n))reason='NESTED_OR_LATE_DECLARATION';});
      for(const d of entry){const b=program.getBinding(d.name);if(b.status!=='BOUND'||program.declarationAt(d.name)!==d||bindings.has(b.symbolId))reason='ENTRY_LOCAL_BINDING_UNPROVEN';else bindings.set(b.symbolId,d);}
      if(reason){refused.push({function:fn.name.name,reason});continue;}
      const first=new Map();let order=0;
      for(const s of fn.body.statements.slice(entry.length))walk(s,n=>{
        if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;const b=program.getBinding(n);
        if(b.status==='BOUND'&&bindings.has(b.symbolId)&&!first.has(bindings.get(b.symbolId)))first.set(bindings.get(b.symbolId),order++);
      });
      const sorted=[...entry],segments=[];
      for(let i=0;i<entry.length;){
        if(!inert(entry[i])){i++;continue;}
        const start=i;while(i<entry.length&&inert(entry[i]))i++;
        const segment=entry.slice(start,i),result=[...segment].sort((a,b)=>(first.get(a)??Infinity)-(first.get(b)??Infinity));
        sorted.splice(start,segment.length,...result);
        segments.push({start,end:i,original:segment.map(n=>n.name.name),canonical:result.map(n=>n.name.name)});
      }
      if(sorted.every((n,i)=>n===entry[i]))continue;
      const chunks=new Map(entry.map((n,i)=>[n,text.slice(i?entry[i-1].end:entry[0].pos,n.end)]));
      edits.push({start:entry[0].pos,end:entry.at(-1).end,text:sorted.map(n=>chunks.get(n)).join('\n')+'\n'});
      records.push({function:fn.name.name,functionIndex,original:names,canonical:sorted.map(n=>n.name.name),segments,
        symbols:entry.map(n=>({name:n.name.name,symbolId:program.getBinding(n.name).symbolId,firstUse:first.get(n)??null})),
        initializersAndExecutableStatementsUnchanged:true});
    }
    let result=text;
    for(const e of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,e.start)+e.text+result.slice(e.end);
    const restored=new Parser().parseFile(input.fileName,result);assert.equal(restored.parseDiagnostics.length,0,'BOUND_LOCAL_ORDER_OUTPUT_SYNTAX');
    for(const record of records){
      const fn=restored.statements[record.functionIndex],n=record.original.length,byName=new Map(fn.body.statements.slice(0,n).map(d=>[d.name.name,d]));
      assert.deepEqual(fn.body.statements.slice(0,n).map(d=>d.name.name),record.canonical,'BOUND_LOCAL_ORDER_PERMUTATION');
      fn.body.statements.splice(0,n,...record.original.map(name=>{assert(byName.has(name));return byName.get(name);}));
    }
    const inverse=assertExactAstShape(restored.statements,ast.statements,{ignoredFields:ignored,label:'BOUND_LOCAL_ORDER_OTHER_AST_CHANGED'});
    return {text:result,proof:{kind:'BOUND_INERT_ENTRY_DECLARATION_PERMUTATION',sourceSha256:sha(text),viewSha256:sha(result),
      records,refused,inverse,sourceOrExportChanged:false,statementsRemoved:0,identifiersRenamed:0,initializersMoved:0,
      originalOracleStillRequired:true,wholeMapAccepted:false}};
  }finally{program.dispose();}
}
