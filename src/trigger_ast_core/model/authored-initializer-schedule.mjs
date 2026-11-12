import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const voidZero=node=>node?.kind===K.FunctionDeclaration&&node.type?.kind===K.VoidKeyword&&node.parameters.length===0&&
 !node.modifiers?.some(m=>[K.StaticKeyword,K.NativeKeyword].includes(m.kind));
const functionEnd=(node,text)=>{
 const close=node.body?.syntaxTokens?.filter(t=>t.kind===K.CloseBraceToken).at(-1),end=close&&close.pos+1;
 assert(end&&end<=node.end&&text[end-1]==='}','AUTHORED_PHASE_FUNCTION_TOKEN_BOUNDARY');return end;
};

// This is source scheduling evidence only. It cannot authorize raw units,
// source storage interfaces, GUI metadata, or a different emitted schedule.
export function indexAuthoredInitializerSchedule({ast,text,index}){
 assert.equal(sha(text),index.sourceSha256,'AUTHORED_PHASE_SOURCE_SHA_CHANGED');
 assert.equal(ast.text,text,'AUTHORED_PHASE_AST_SOURCE_CHANGED');
 const definitions=ast.statements.filter(n=>n.kind===K.FunctionDeclaration),phases=[],seen=new Set();
 for(const section of index.sections){
  const anchor=section.initializer,key=JSON.stringify([section.library,anchor.name,anchor.position]);if(seen.has(key))continue;seen.add(key);
  const candidates=definitions.filter(n=>n.name.name===anchor.name&&n.body),node=candidates[0],issues=[],calls=[];
  if(candidates.length!==1||!voidZero(node)||node.pos!==anchor.position){phases.push({library:section.library,name:anchor.name,status:'UNPROVED',issues:[{reason:'PHASE_ANCHOR_NOT_UNIQUE_VOID_ZERO'}]});continue;}
  for(const [ordinal,statement]of node.body.statements.entries()){
   const call=statement.kind===K.ExpressionStatement?statement.expression:undefined;
   if(call?.kind!==K.CallExpression||call.expression.kind!==K.Identifier||call.arguments.length){issues.push({ordinal,reason:'PHASE_DIRECT_ZERO_ARGUMENT_CALL_REQUIRED'});continue;}
   const name=call.expression.name,symbols=ast.statements.filter(n=>n.name?.name===name),bodies=symbols.filter(n=>n.kind===K.FunctionDeclaration&&n.body);
   const target=bodies[0];
   if(bodies.length!==1||!symbols.every(voidZero)){issues.push({ordinal,name,reason:'PHASE_TARGET_NOT_UNIQUE_VOID_ZERO'});continue;}
   const targetEnd=functionEnd(target,text),targetSha256=sha(text.slice(target.pos,targetEnd));
   const owners=index.sections.filter(unit=>unit.declarations.some(d=>d.kind===K.FunctionDeclaration&&d.start===target.pos&&d.end===targetEnd&&d.name===name&&d.sha256===targetSha256));
   if(owners.length!==1||owners[0].library!==section.library){issues.push({ordinal,name,reason:'PHASE_TARGET_SECTION_OWNERSHIP_UNPROVED'});continue;}
   calls.push({ordinal,name,callStart:statement.pos,callEnd:statement.end,callSha256:sha(text.slice(statement.pos,statement.end)),
    targetStart:target.pos,targetEnd,targetSha256,sectionSha256:owners[0].sha256,sectionLabel:owners[0].label,library:section.library});
  }
  const end=functionEnd(node,text);
  phases.push({library:section.library,name:anchor.name,start:node.pos,end,sha256:sha(text.slice(node.pos,end)),
   status:issues.length?'UNPROVED':'EXACT_SOURCE_CALL_SCHEDULE',calls,issues,requiresExactGuiEmissionOrder:true});
 }
 return {kind:'ORIGINAL_AUTHORED_INITIALIZER_SCHEDULE',sourceSha256:index.sourceSha256,phases,
  originalCodeChanged:false,guiEmissionAuthorized:false,sourceComponentClosureProved:false,semanticEquivalenceProved:false,wholeMapAccepted:false};
}
