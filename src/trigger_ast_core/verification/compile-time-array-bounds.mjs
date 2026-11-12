import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {createClosedConstantIntResolver} from '../types/closed-constant-int.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
const walk=(node,visit,parent)=>{visit(node,parent);forEachChild(node,child=>walk(child,visit,node));};

/** A comparison view, not a runtime rewrite. Remove explicitly selected const
 * int zero declarations only after proving every bound reference occurs in a
 * compile-time singleton extent. Shadowing, runtime or external uses refuse.
 * The unchanged oracle must still compare all remaining declarations/bodies.
 */
export function normalizeCompileTimeArrayBounds(text,{constantNames,externalSources=[]}) {
 const names=new Set(constantNames);assert.equal(names.size,constantNames.length,'ARRAY_BOUND_PROOF_DUPLICATE_NAME');
 const file={fileName:'native-array-bounds.galaxy',text,sourceId:'array-bounds',owned:true,contentSha256:sha(text)};
 const program=new GalaxyProgramContext([file],{files:[file],dependencies:[]},sha);
 try {
  const ast=program.documents.get(file.fileName);assert(!ast.parseDiagnostics.length,'ARRAY_BOUND_PROOF_SYNTAX');program.attachOriginal(ast);
  const declarations=new Map();
  for(const n of ast.statements)if(names.has(n.name?.name)) {
   assert(!declarations.has(n.name.name),'ARRAY_BOUND_PROOF_DUPLICATE_DECLARATION');
   assert(n.kind===K.VariableDeclaration&&n.type?.kind===K.IntKeyword&&n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword,'ARRAY_BOUND_PROOF_NOT_CONST_INT');
   declarations.set(n.name.name,n);
  }
  assert.equal(declarations.size,names.size,'ARRAY_BOUND_PROOF_DECLARATION_MISSING');
  const evaluate=createClosedConstantIntResolver([ast]);
  for(const d of declarations.values())assert.equal(evaluate(d.initializer)?.value,0n,'ARRAY_BOUND_PROOF_NOT_ZERO');
  const permitted=new Set(),edits=[],records=[],uses=new Map([...declarations.values()].map(d=>[d,0]));
  walk(ast,node=>{
   if(node.kind!==K.ArrayType)return;
   const references=[];walk(node.size,n=>{if(n.kind===K.Identifier&&declarations.has(n.name))references.push(n);});
   if(!references.length)return;
   for(const n of references) {
    const d=declarations.get(n.name);assert.equal(program.declarationAt(n),d,'ARRAY_BOUND_PROOF_SHADOWED');
    assert.equal(program.getBinding(n).status,'BOUND','ARRAY_BOUND_PROOF_UNBOUND');permitted.add(n);uses.set(d,uses.get(d)+1);
   }
   const result=evaluate(node.size);assert.equal(result?.value,1n,'ARRAY_BOUND_PROOF_NON_SINGLETON');
   edits.push({start:node.size.pos,end:node.size.end,text:'1'});records.push({start:node.size.pos,end:node.size.end,old:text.slice(node.size.pos,node.size.end),length:1,dependencies:result.proof.dependencies});
  });
  walk(ast,(node,parent)=>{
   if(node.kind===K.StringLiteral)assert(!names.has(node.value),'ARRAY_BOUND_PROOF_TEXTUAL_OBSERVER');
   if(node.kind!==K.Identifier||!names.has(node.name))return;
   const d=declarations.get(node.name);
   if(parent===d&&parent.name===node)return;
   assert(permitted.has(node),'ARRAY_BOUND_PROOF_RUNTIME_OR_SHADOW_USE');
  });
  for(const [d,count]of uses){assert(count>0,'ARRAY_BOUND_PROOF_UNUSED_DECLARATION');edits.push({start:d.pos,end:d.end,text:''});}
  for(const [i,external]of externalSources.entries()) {
   const ext=parseImmutableGalaxySyntax(typeof external==='string'?external:external.text,'array-bound-external-'+i);assert(!ext.parseDiagnostics.length,'ARRAY_BOUND_PROOF_EXTERNAL_SYNTAX');
   walk(ext,n=>{if(n.kind===K.Identifier)assert(!names.has(n.name),'ARRAY_BOUND_PROOF_EXTERNAL_USE');if(n.kind===K.StringLiteral)assert(!names.has(n.value),'ARRAY_BOUND_PROOF_EXTERNAL_OBSERVER');});
  }
  let after='',cursor=0;
  for(const e of edits.toSorted((a,b)=>a.start-b.start)) {assert(e.start>=cursor,'ARRAY_BOUND_PROOF_OVERLAP');after+=text.slice(cursor,e.start)+e.text;cursor=e.end;}
  after+=text.slice(cursor);assert(!parseImmutableGalaxySyntax(after,'normalized-array-bounds').parseDiagnostics.length,'ARRAY_BOUND_PROOF_OUTPUT_SYNTAX');
  return {text:after,proof:{kind:'COMPILE_TIME_SINGLETON_ARRAY_EXTENTS',beforeSha256:sha(text),afterSha256:sha(after),constants:[...names],records,
   everyReferenceBound:true,runtimeUses:0,newRuntimeFunctions:0,sourceOrCandidateChanged:false,wholeProgramEquivalent:false,benchmarkChanged:false}};
 } finally {program.dispose();}
}
