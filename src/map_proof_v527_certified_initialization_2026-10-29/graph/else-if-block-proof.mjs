import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
function apply(source,edits,offset=0){let text=source;for(const e of [...edits].sort((a,b)=>b.start-a.start))text=text.slice(0,e.start-offset)+e.replacement+text.slice(e.end-offset);return text;}
export function canonicalElseIfBlocks(source){
 const ast=parseImmutableGalaxySyntax(source,'else-if-proof.galaxy');assert.equal(ast.parseDiagnostics.length,0);
 const visit=node=>{
  let edits=[];forEachChild(node,child=>{edits.push(...visit(child));});
  const block=node.kind===K.IfStatement?node.elseStatement:undefined;
  if(block?.kind!==K.Block||block.statements?.length!==1||block.statements[0].kind!==K.IfStatement)return edits;
  const inner=block.statements[0],nested=edits.filter(e=>e.start>=inner.pos&&e.end<=inner.end);
  edits=edits.filter(e=>!nested.includes(e));
  edits.push({start:block.pos,end:block.end,before:source.slice(block.pos,block.end),
   replacement:' '+apply(source.slice(inner.pos,inner.end),nested,inner.pos)+' ',nested,
   kind:'ELSE_BLOCK_CONTAINING_ONLY_IF',conditionEvaluationAndBranchOrderUnchanged:true});
  return edits;
 };
 const edits=visit(ast).sort((a,b)=>a.start-b.start);
 for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start);
 const text=apply(source,edits);assert.equal(parseImmutableGalaxySyntax(text,'else-if-proof-output.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'SINGLE_IF_ELSE_BLOCK_ELISION',sourceSha256:sha(source),proofInputSha256:sha(text),edits,
  bodiesAndConditionsPreserved:true,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
