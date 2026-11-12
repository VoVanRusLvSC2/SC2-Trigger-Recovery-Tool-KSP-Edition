import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function canonicalBlockEmptyStatements(source){
  const ast=parse(source,'block-empty');assert.equal(ast.parseDiagnostics.length,0);const edits=[];
  const walk=node=>{
    if(node.kind===K.Block)for(let i=0;i<node.statements.length;i++){
      const child=node.statements[i],previous=node.statements[i-1];
      if(child.kind===K.EmptyStatement&&![K.TypedefDeclaration,K.StructDeclaration].includes(previous?.kind)){
        const before=source.slice(child.pos,child.end);assert.equal(before,';');
        edits.push({start:child.pos,end:child.end,before,replacement:'',syntaxOnlyStatement:true});
      }
    }
    forEachChild(node,walk);
  };walk(ast);edits.sort((a,b)=>a.start-b.start);let delta=0;
  for(const edit of edits){edit.newStart=edit.start+delta;delta-=edit.end-edit.start;}
  let text=source;for(const edit of edits.toReversed())text=text.slice(0,edit.start)+text.slice(edit.end);
  let inverse=text;for(const edit of edits.toReversed())inverse=inverse.slice(0,edit.newStart)+edit.before+inverse.slice(edit.newStart);
  assert.equal(inverse,source);assert.equal(parse(text,'block-empty-view').parseDiagnostics.length,0);
  return {text,proof:{kind:'BLOCK_EMPTY_STATEMENTS_ONLY',sourceSha256:sha(source),viewSha256:sha(text),edits,
    typedefAndStructTerminatorsRetained:true,forHeaderSeparatorsRetained:true,allExpressionsAndControlTransfersRetained:true,
    sourceOrExportChanged:false,wholeMapAccepted:false}};
}
