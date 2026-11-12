import {immutableGlobalConstantReads} from './immutable-constant-reads.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
function independent(node,constantReads,shadowed){
 return node.kind===K.VariableDeclaration&&typeof node.name?.name==='string'&&
  node.type?.kind>=K.BoolKeyword&&node.type.kind<=K.WavetargetKeyword&&node.type.kind!==K.VoidKeyword&&
  (node.modifiers??[]).every(m=>m.kind===K.ConstKeyword)&&constantReads.isIndependent(node.initializer,shadowed);
}

/** Auxiliary proof only: canonicalize adjacent function-entry declarations whose
 * initializers contain only literals or immutable root const reads. Every original type,
 * name, modifier and literal remains unchanged. Unknown declarations are barriers.
 * The raw oracle and source files are never replaced by this view. */
export function canonicalIndependentLocalDeclarations(source){
 const ast=parseImmutableGalaxySyntax(source,'declaration-order-proof.galaxy');
 assert.equal(ast.parseDiagnostics.length,0,'DECLARATION_PROOF_INVALID_SOURCE');
 const edits=[],constantReads=immutableGlobalConstantReads(ast);
 for(const fn of ast.statements??[]){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const statements=fn.body.statements??[],prefix=[];
  for(const node of statements){if(node.kind!==K.VariableDeclaration)break;prefix.push(node);}
  const names=prefix.map(n=>n.name?.name),parameters=(fn.parameters??[]).map(p=>p.name?.name);
  if(names.some(n=>!n)||new Set([...names,...parameters]).size!==names.length+parameters.length)continue;
  const shadowed=new Set([...names,...parameters]);
  // Reference order is invariant under compiler-added local-name prefixes.
  // It affects only the chosen permutation; independence still proves legality.
  const firstUse=new Map();let ordinal=0;
  const walk=(node,parent)=>{
   if(node.kind===K.Identifier&&names.includes(node.name)&&
    !(parent?.name===node&&[K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.PropertyAccessExpression].includes(parent.kind))){
    if(!firstUse.has(node.name))firstUse.set(node.name,ordinal++);
   }
   forEachChild(node,child=>walk(child,node));
  };walk(fn.body);

  let group=[];
  const flush=()=>{
   if(group.length>1){
    const ordered=[...group].sort((a,b)=>(firstUse.get(a.name.name)??Infinity)-(firstUse.get(b.name.name)??Infinity)||(a.name.name<b.name.name?-1:a.name.name>b.name.name?1:0));
    if(ordered.some((node,i)=>node!==group[i])){
     const start=group[0].pos,end=group.at(-1).end;
     edits.push({function:fn.name.name,start,end,before:source.slice(start,end),
      replacement:ordered.map(node=>source.slice(node.pos,node.end)).join('\n'),
      declarations:group.map(node=>({name:node.name.name,text:source.slice(node.pos,node.end)})),
      order:ordered.map(node=>node.name.name)});
    }
   }
   group=[];
  };
  for(const node of prefix){if(independent(node,constantReads,shadowed))group.push(node);else flush();}
  flush();
 }
 edits.sort((a,b)=>a.start-b.start);
 for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start);
 let text=source;
 for(const edit of [...edits].reverse()){
  assert.equal(text.slice(edit.start,edit.end),edit.before);
  text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
 }
 assert.equal(parseImmutableGalaxySyntax(text,'declaration-order-proof-output.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'INDEPENDENT_DECLARATIONS_IN_FIRST_REFERENCE_ORDER',immutableRootConstantsUsed:constantReads.witnesses(),sourceSha256:sha(source),proofInputSha256:sha(text),edits,
  rankingDoesNotRenameOrRewriteReferences:true,initializersContainNoMutableReadsCallsAliasesOrWrites:true,unknownAndDependentInitializersAreBarriers:true,
  declarationContentsAndExecutableStatementOrderUnchanged:true,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
