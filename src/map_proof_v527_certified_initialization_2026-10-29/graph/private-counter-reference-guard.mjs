import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
function walk(node,visit){visit(node);forEachChild(node,c=>walk(c,visit));}
export function verifyPrivateCounterReferences(text,stage){
 assert.equal(sha(text),stage.sourceSha256,'PRIVATE_COUNTER_GUARD_SOURCE_CHANGED');
 if(!stage.records.length)return {checkedBindings:0,checkedReferences:0,sourceSha256:sha(text)};
 const input={fileName:'private-for.galaxy',sourceId:'private-for',text,owned:true,contentSha256:sha(text)};
 const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha);
 try{
  const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);
  const groups=new Map();for(const r of stage.records)groups.set(JSON.stringify([r.function,r.sourceSymbolId]),r);
  let references=0;
  for(const row of groups.values()){
   const owners=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===row.function);assert.equal(owners.length,1,'PRIVATE_COUNTER_FUNCTION_OWNER');
   const locals=owners[0].body.statements.filter(n=>n.kind===K.VariableDeclaration&&n.name.name===row.from);assert.equal(locals.length,1,'PRIVATE_COUNTER_LOCAL_OWNER');
   assert.equal(program.getBinding(locals[0].name).symbolId,row.sourceSymbolId,'PRIVATE_COUNTER_DECLARATION_IDENTITY');
   walk(owners[0].body,node=>{
    if(node.kind!==K.Identifier||node.name!==row.from||node===locals[0].name||node.parent?.kind===K.PropertyAccessExpression&&node.parent.name===node)return;
    const binding=program.getBinding(node);assert.equal(binding.status,'BOUND','PRIVATE_COUNTER_UNRESOLVED_SAME_SPELLING_REFERENCE');
    if(binding.symbolId===row.sourceSymbolId)references++;
   });
  }
  return {checkedBindings:groups.size,checkedReferences:references,sourceSha256:sha(text),allSameSpellingValueReferencesBound:true};
 }finally{program.dispose();}
}
