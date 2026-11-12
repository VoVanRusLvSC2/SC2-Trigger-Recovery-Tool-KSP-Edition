import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
function literal(node){
 if(!node)return true;
 if([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(node.kind))return true;
 if(node.kind===K.ParenthesizedExpression)return literal(node.expression);
 return node.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(node.operator?.kind)&&node.operand?.kind===K.NumericLiteral;
}
function independent(node){
 return node.kind===K.VariableDeclaration&&typeof node.name?.name==='string'&&
  node.type?.kind>=K.BoolKeyword&&node.type.kind<=K.WavetargetKeyword&&node.type.kind!==K.VoidKeyword&&
  (node.modifiers??[]).every(m=>m.kind===K.ConstKeyword)&&literal(node.initializer);
}

/** Auxiliary proof only: canonicalize adjacent function-entry declarations whose
 * initializers have no reads, calls, aliases or writes. Every original type,
 * name, modifier and literal remains unchanged. Unknown declarations are barriers.
 * The raw oracle and source files are never replaced by this view. */
export function canonicalIndependentLocalDeclarations(source){
 const ast=parseImmutableGalaxySyntax(source,'declaration-order-proof.galaxy');
 assert.equal(ast.parseDiagnostics.length,0,'DECLARATION_PROOF_INVALID_SOURCE');
 const edits=[];
 for(const fn of ast.statements??[]){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const statements=fn.body.statements??[],prefix=[];
  for(const node of statements){if(node.kind!==K.VariableDeclaration)break;prefix.push(node);}
  const names=prefix.map(n=>n.name?.name),parameters=(fn.parameters??[]).map(p=>p.name?.name);
  if(names.some(n=>!n)||new Set([...names,...parameters]).size!==names.length+parameters.length)continue;
  let group=[];
  const flush=()=>{
   if(group.length>1){
    const ordered=[...group].sort((a,b)=>a.name.name<b.name.name?-1:a.name.name>b.name.name?1:0);
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
  for(const node of prefix){if(independent(node))group.push(node);else flush();}
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
 return{text,proof:{kind:'INDEPENDENT_LITERAL_SCALAR_LOCAL_DECLARATION_PERMUTATION',sourceSha256:sha(source),proofInputSha256:sha(text),edits,
  initializersContainNoReadsCallsAliasesOrWrites:true,unknownAndDependentInitializersAreBarriers:true,
  declarationContentsAndExecutableStatementOrderUnchanged:true,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
