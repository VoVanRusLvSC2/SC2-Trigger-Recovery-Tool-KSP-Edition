import {triggerConstructorFrame} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c3b0867e4312-trigger-constructor-frame.mjs';
// Preserve for-loop timing. Only expression initializers in existing blocks;
// reject continue and lower nested for loops from the inside out.
import assert from 'node:assert/strict';
import {prepareContinuePreservingForBody} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/44dcc4ff403f-continue-preserving-for-body.mjs';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {extractAutoVarName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
import {withImplicitLibrary} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {recognizeGeneratedInitialization,preservedInitializationRoot} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/65fff955e00c-e749434127c-3758fe833459-2a6e83df5e21-ae8cbc69824c-49bb33ba0d1462b1-g2t-initialization.mjs';
import {analyzeTriggerPrefix} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/ec4d73d64566-06d1f681cbf-5922168f54f3d2-227463be7f068e61-668be9b6fa7a-2053d4e6ede7-g2t-trigger-body.mjs';
import {splitEmbeddedLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/38cf76afad33-7aad75ad7-fde480086426-0ad250c2cb118639-embedded-libraries.custom-section-ownership.v2.mjs';
import {recoverCustomAi} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/6f3c952f5acc-c-22c673d689cc-7fa9349faa91-79feee0cc9fc-98442e6670289420-custom-ai-recovery.ast-empty.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function walk(n,fn){if(!n||typeof n!=='object')return;if(Array.isArray(n)){for(const c of n)walk(c,fn);return;}fn(n);for(const[k,v]of Object.entries(n))if(!['parent','syntaxTokens','symbol','locals','flowNode'].includes(k))walk(v,fn);}
export function lowerStructuralForLoops(source,{libraryId='Map',nativeLibraryId='Ntve',customAiScripts=[],dependencyCustomAiDocuments=[],nativeTemplateLoopPreserver}={},document){
 // The actual Custom AI reverse codec proves whole generated files and their
 // complete dispatch section by regeneration. Do not lower their compiler loops:
 // a semantically equivalent spelling would prevent that stricter codec matching.
 const originalAi=recoverCustomAi(source,customAiScripts,dependencyCustomAiDocuments);
 const aiProof={state:originalAi.state,reason:originalAi.reason,sourceSha256:sha(source),preservedFunctions:[]};
 let expectedAi;
 if(originalAi.state==='recovered'){
  const input=document?document.input(source):new Parser().parseFile('ai-input.galaxy',source);
  const remaining=new Parser().parseFile('ai-authored.galaxy',originalAi.value.script);
  assert.equal(input.parseDiagnostics.length,0,'INVALID_AI_INPUT');
  assert.equal(remaining.parseDiagnostics.length,0,'INVALID_AI_AUTHORED');
  const functions=input.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body);
  const names=new Set(remaining.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body).map(n=>n.name.name));
  assert.equal(new Set(functions.map(f=>f.name.name)).size,functions.length,'AMBIGUOUS_AI_FUNCTION_OWNERSHIP');
  aiProof.preservedFunctions=functions.filter(f=>!names.has(f.name.name)).map(f=>({name:f.name.name,sha256:sha(source.slice(f.pos,f.end))}));
  expectedAi=new Map(aiProof.preservedFunctions.map(f=>[f.name,f.sha256]));
 }
 let text=source;const passes=[];let startupScopes=[];const additionalInitializationFunctions=new Set();
 for(let pass=0;pass<32;pass++){
  const ast=document?(pass===0?document.input(text):document.output(text)):new Parser().parseFile('for-input.galaxy',text);assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');const slots=new Set(),edits=[],preserved=new WeakSet();
  walk(ast,n=>{if(n.kind===K.Block)for(const [index,statement]of n.statements.entries()){
   slots.add(statement);
   if(nativeTemplateLoopPreserver?.shouldPreserve(n.statements,index))preserved.add(statement);
  }});
  const functions=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body),callbacks=new Set();
  const triggerInitializers=new Set(functions.filter(f=>f.body.statements.some(s=>s.kind===K.ExpressionStatement&&s.expression?.right?.expression?.name==='TriggerCreate')).map(f=>f.name.name));
  for(const f of functions)for(const s of f.body.statements){const call=s.expression?.right;if(call?.expression?.name==='TriggerCreate'&&call.arguments[0]?.kind===K.StringLiteral)callbacks.add(call.arguments[0].value);}
  // Keep the previous recognizer unchanged. Only the additional owner-scoped
  // facts are frozen from the original input before any runtime-loop edit.
  const baselineInitialization=withImplicitLibrary(libraryId,()=>recognizeGeneratedInitialization(ast.statements,libraryId,nativeLibraryId,triggerInitializers));
  if(pass===0){
  // Use the same source ownership boundary as conversion, after the exact AI
  // reverse codec removes only compiler scaffolding from its classifier view.
  // A library initializer must not become an extra map initializer candidate.
  const ai=expectedAi?recoverCustomAi(text,customAiScripts,dependencyCustomAiDocuments):undefined;
  if(expectedAi)assert.equal(ai.state,'recovered','CANONICAL_AI_CLASSIFIER_VIEW_LOST');
  const classifierText=ai?.value.script??text;
  const classifierAst=ai?new Parser().parseFile('authored-startup.galaxy',classifierText):ast;
  assert.equal(classifierAst.parseDiagnostics.length,0,'INVALID_STARTUP_CLASSIFIER_VIEW');
  const partition=libraryId==='Map'?splitEmbeddedLibraries(classifierText,classifierAst):undefined;
  const scopes=partition?[{id:libraryId,script:partition.map},...partition.libraries]:[{id:libraryId,script:classifierText}];
  const scopeRecords=[];
  for(const scope of scopes){
   const scopedAst=scope.script===classifierText?classifierAst:new Parser().parseFile('owned-startup.galaxy',scope.script);
   assert.equal(scopedAst.parseDiagnostics.length,0,'INVALID_OWNED_STARTUP_VIEW');
   const scopedFunctions=scopedAst.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body);
   const scopedTriggers=new Set(scopedFunctions.filter(f=>f.body.statements.some(s=>s.kind===K.ExpressionStatement&&s.expression?.right?.expression?.name==='TriggerCreate')).map(f=>f.name.name));
   const recognized=withImplicitLibrary(libraryId,()=>recognizeGeneratedInitialization(scopedAst.statements,scope.id,nativeLibraryId,scopedTriggers));
   // Value folding may require constants unavailable in this preprocessing
   // view. The SDK separately proves a preserved startup graph without moving
   // any initializer. Keep its actual direct stages intact even when their
   // bodies cannot yet be folded here. This changes no body or call order.
   let structuralRoot;
   try{structuralRoot=withImplicitLibrary(libraryId,()=>preservedInitializationRoot(scopedAst.statements,scope.id));}
   catch(error){if(!['INITIALIZATION_AMBIGUOUS','INITIALIZATION_SIGNATURE'].includes(error?.code))throw error;}
   const structuralFunctions=new Set();
   if(typeof structuralRoot==='string'){
    const entry=scopedFunctions.find(f=>f.name.name===structuralRoot);assert(entry,'STRUCTURAL_STARTUP_ENTRY_ABSENT');
    structuralFunctions.add(entry.name.name);
    for(const statement of entry.body.statements){
     const call=statement.kind===K.ExpressionStatement?statement.expression:undefined;
     if(call?.kind!==K.CallExpression||call.expression?.kind!==K.Identifier||call.arguments.length)continue;
     const target=scopedFunctions.find(f=>f.name.name===call.expression.name);
     assert(target&&target.type?.kind===K.VoidKeyword&&target.parameters.length===0,'STRUCTURAL_STARTUP_STAGE_NOT_OWNED');
     structuralFunctions.add(target.name.name);
    }
   }
   const allRecognized=new Set([...(recognized?.functions??[]),...structuralFunctions]);
   for(const name of allRecognized)additionalInitializationFunctions.add(name);
   scopeRecords.push({id:scope.id,sourceSha256:sha(scope.script),triggerInitializerCount:scopedTriggers.size,recognizedFunctions:[...allRecognized],foldingRecognizedFunctions:[...recognized?.functions??[]],structuralRoot,structuralFunctions:[...structuralFunctions]});
  }
  startupScopes=scopeRecords;
  }
  const initialization={functions:new Set([...(baselineInitialization?.functions??[]),...additionalInitializationFunctions])};
  for(const f of functions){
   if(triggerConstructorFrame(f)){walk(f.body,n=>{if(n.kind===K.ForStatement)preserved.add(n);});continue;}
   if(expectedAi?.has(f.name.name)){
    assert.equal(sha(text.slice(f.pos,f.end)),expectedAi.get(f.name.name),'GENERATED_AI_REGION_CHANGED');
    walk(f.body,n=>{if(n.kind===K.ForStatement)preserved.add(n);});continue;
   }
   if(initialization?.functions.has(f.name.name)){walk(f.body,n=>{if(n.kind===K.ForStatement)preserved.add(n);});continue;}
   let prefix;
   if(callbacks.has(f.name.name))prefix=analyzeTriggerPrefix(f);
   else{
    const banner=/^[ \t]*\/\/ Implementation[ \t]*\r?$/mu.exec(text.slice(f.body.pos,f.body.end));
    if(banner){const position=f.body.pos+banner.index,at=f.body.statements.findIndex(s=>s.pos>position),index=at<0?f.body.statements.length:at;
     // Read-only classifier view: expose the same prefix length through the
     // existing codec, retaining every original trailing read for its guards.
     // This marker is never printed, inserted into source, or emitted as GUI.
     const marker={kind:K.IfStatement,expression:{kind:K.PrefixUnaryExpression,operator:{kind:K.ExclamationToken},operand:{kind:K.Identifier,name:'runActions'}},thenStatement:{kind:K.Block,statements:[{kind:K.ReturnStatement,expression:{kind:K.TrueKeyword}}]}};
     const statements=[...f.body.statements.slice(0,index),marker,...f.body.statements.slice(index)];
     prefix=analyzeTriggerPrefix({...f,body:{...f.body,statements}});
    }
   }
   if(prefix)for(const s of f.body.statements.slice(0,prefix.length))walk(s,n=>{if(n.kind===K.ForStatement)preserved.add(n);});
  }
  walk(ast,n=>{
   if(n.kind!==K.ForStatement||n.statement?.kind!==K.Block||!slots.has(n)||n.initializer?.kind===K.VariableDeclaration)return;
   const closingTokens=(n.statement.syntaxTokens??[]).filter(t=>t.kind===K.CloseBraceToken);
   const closingPosition=closingTokens.length===1?closingTokens[0].pos:undefined;
   // Token.end may include following comments. The actual brace is at pos;
   // retain the following trivia outside the replacement, byte-for-byte.
   if(preserved.has(n)||text[n.statement.pos]!=='{'||closingPosition===undefined||text[closingPosition]!=='}'||closingPosition<n.statement.pos||closingPosition>=n.statement.end||text.slice(n.pos,n.pos+3)!=='for'||text.slice(n.statement.end,n.end).trim()!=='')return;
   let compilerHeader=false;for(const h of [n.initializer,n.condition,n.incrementor])walk(h,x=>{if(x.kind===K.Identifier&&extractAutoVarName(x.name))compilerHeader=true;});if(compilerHeader)return;
   const owner=functions.find(f=>f.body.pos<n.pos&&n.end<=f.body.end);
   const continuation=prepareContinuePreservingForBody(n,owner,text,closingPosition);
   if(!continuation.safe)return;
   let blocked=false;walk(n.statement,x=>{
    if(x.kind===K.ForStatement){
     let protectedHeader=false;for(const h of [x.initializer,x.condition,x.incrementor])walk(h,y=>{if(y.kind===K.Identifier&&extractAutoVarName(y.name))protectedHeader=true;});
     // These nested subtrees cannot receive a competing edit in this pass.
     // Keep them byte-for-byte while lowering the enclosing authored loop.
     if(!protectedHeader&&!preserved.has(x))blocked=true;
    }
   });if(blocked)return;
   const slice=x=>text.slice(x.pos,x.end),body=continuation.body;
   assert(text[n.statement.pos]==='{'&&text[closingPosition]==='}');
   const initializer=n.initializer?slice(n.initializer):null,condition=n.condition?slice(n.condition):'true',increment=n.incrementor?slice(n.incrementor):null;
   const replacement=(initializer?initializer+';\n':'')+'while ('+condition+') {'+body+(increment?'\n'+increment+';':'')+'\n}';
   edits.push({start:n.pos,end:closingPosition+1,replacement,record:{initializer,condition,increment,bodySha256:sha(body),replacementSha256:sha(replacement),initializerOnce:true,conditionBeforeEveryIteration:true,normalExitIncrementAfterBody:true,continueTargetProof:continuation.proof,nestedForSubtreesPreservedWithoutEdits:true,preciseClosingBraceToken:true,trailingCommentsRetained:true,breakReturnAndFailureSkipIncrement:true,existingScopeRetained:true}});
  });
  if(!edits.length)break;
  edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_FOR_EDITS');const beforeSha256=sha(text);
  for(const e of [...edits].reverse())text=text.slice(0,e.start)+e.replacement+text.slice(e.end);
  passes.push({pass,beforeSha256,afterSha256:sha(text),records:edits.map(({start,end,record})=>({start,end,...record}))});
 }
 assert.equal((document?document.output(text):new Parser().parseFile('while-output.galaxy',text)).parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 if(expectedAi){
  const afterAi=recoverCustomAi(text,customAiScripts,dependencyCustomAiDocuments);
  assert.equal(afterAi.state,'recovered','CUSTOM_AI_RECOGNITION_LOST');
  assert.deepEqual(afterAi.value.document,originalAi.value.document,'CUSTOM_AI_DOCUMENT_CHANGED');
  assert.deepEqual(afterAi.value.declarations,originalAi.value.declarations,'CUSTOM_AI_GENERATED_FILES_CHANGED');
 }
 return{text,proof:{canonicalCustomAi:aiProof,startupScopes,additionalStartupOwnershipFrozenBeforeLowering:true,previousStartupRecognitionRetained:true,kind:'STRUCTURAL_FOR_TO_WHILE_SCOPED_CONTINUE',beforeSha256:sha(source),afterSha256:sha(text),changed:passes.length>0,passes,maximumPasses:32,originalFilesChanged:false,persistentCache:false}};
}
