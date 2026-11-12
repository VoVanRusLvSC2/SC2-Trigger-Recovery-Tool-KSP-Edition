import {decodeBoundAsciiString} from '../../galaxy_ascii_string_v1246.mjs';
import {verifyActualTriggerHandleTargets,projectPrivateTriggerHandleIdentifiers} from './private-trigger-handle-identities.mjs';
import {deriveRootEntryStageRoleAliases} from './root-entry-stage-role-aliases.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {checkedArchiveProofFile} from './archive-proof-context.mjs';
import {qualifyPrivateRootTriggerAliases} from '../passes/qualified-root-trigger-aliases.decoded-literals.mjs';
import {declaredTriggerConstructorFrame} from '../model/declared-trigger-constructor-frame.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const scopes=new WeakMap(),sha=t=>createHash('sha256').update(t).digest('hex');
export async function readPrivateRootArchiveScope(sourceArchive,sourceRoot){
 const reader=await openMpqReader(await checkedArchiveProofFile(sourceArchive),{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 try{
  assert(reader.entries.every(e=>e.path),'ROOT_ALPHA_UNNAMED_ARCHIVE_SCOPE');
  assert(!reader.entries.some(e=>/(^|\/)triggers$/iu.test(e.path.replaceAll('\\','/'))),'ROOT_ALPHA_EXISTING_GUI_PROTECTED');
  const root=reader.find('MapScript.galaxy');assert(root,'ROOT_ALPHA_ORIGINAL_ROOT_REQUIRED');
  assert.equal(Buffer.from(await reader.read(root.id)).toString('utf8'),sourceRoot,'ROOT_ALPHA_NOT_SERVER_ROOT');
  const resources=[],preservedSources=[];
  for(const e of reader.entries)if(e.id!==root.id){
   const bytes=Buffer.from(await reader.read(e.id));
   if(e.path.toLowerCase().endsWith('.galaxy'))preservedSources.push({fileName:e.path,text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),sha256:sha(bytes)});
   else resources.push({path:e.path,bytes});
  }
  const cap=Object.freeze({kind:'PINNED_ROOT_WITH_PROTECTED_GALAXY_SCOPE'});scopes.set(cap,{sourceArchive,sourceRootSha256:sha(sourceRoot),resources,preservedSources});return cap;
 }finally{reader.dispose();}
}
export function projectPrivateRootCallbackAlpha(before,after,{scope,sourceRoot,candidateRoot,externalSources=[]}){
 const bound=scopes.get(scope);assert(bound&&bound.sourceRootSha256===sha(sourceRoot),'ROOT_ALPHA_UNTRUSTED_ARCHIVE_SCOPE');
 const q=qualifyArchiveBoundRootRoles(scope,sourceRoot,externalSources);
 assert(q.proof.edits,'ROOT_ALPHA_NO_ALIAS_REQUIRED');
 const candidate=new Parser().parseFile('actual-native-root',candidateRoot);assert.equal(candidate.parseDiagnostics.length,0);
 const mapping=new Map(),callbacks=new Map();
 const handleRecords=q.proof.globalHandleAlpha?.records??[];verifyActualTriggerHandleTargets(candidate,handleRecords);
 for(const b of q.proof.bindings){
  const ctor=candidate.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.constructor.to),callback=candidate.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.callback.to);
  assert(ctor.length===1&&callback.length===1,'ROOT_ALPHA_ACTUAL_NATIVE_ROLES_MISSING');
  const frame=declaredTriggerConstructorFrame(ctor[0]);assert(frame?.handle===b.targetHandle&&frame.callback===b.callback.to,'ROOT_ALPHA_ACTUAL_NATIVE_REGISTRATION_CHANGED');
  assert(callback[0].type.kind===K.BoolKeyword&&callback[0].parameters.length===2&&callback[0].parameters.every(p=>p.type.kind===K.BoolKeyword&&!p.isReference),'ROOT_ALPHA_ACTUAL_NATIVE_CALLBACK_ABI');
  if(b.constructor.from!==b.constructor.to)mapping.set(b.constructor.from,b.constructor.to);
  if(b.callback.from!==b.callback.to){mapping.set(b.callback.from,b.callback.to);callbacks.set(b.callback.from,b.callback.to);}
 }
 const stageRoles=deriveRootEntryStageRoleAliases({sourceText:q.text,candidateText:candidateRoot,permission:q.proof,otherSources:[...bound.preservedSources,...externalSources]});for(const r of stageRoles.records){assert(!mapping.has(r.from)||mapping.get(r.from)===r.to,'ROOT_STAGE_ROLE_MAPPING_CONFLICT');mapping.set(r.from,r.to);}
 const names=[...q.proof.flow.privateNames.filter(n=>n!=='InitMap'),...handleRecords.flatMap(r=>[r.from,r.to])];
 for(const resource of bound.resources)for(const name of names)assert(!resource.bytes.includes(Buffer.from(name,'utf8'))&&!resource.bytes.includes(Buffer.from(name,'utf16le')),'ROOT_ALPHA_NON_SOURCE_LITERAL_REFERENCE:'+resource.path);
 const ast=new Parser().parseFile('complete-selected-before',before);assert.equal(ast.parseDiagnostics.length,0);const edits=[];
 projectPrivateTriggerHandleIdentifiers(ast,handleRecords,(n,value)=>{const raw=before.slice(n.pos,n.end),start=n.pos+raw.indexOf(n.name);assert.equal(before.slice(start,n.end),n.name);edits.push({start,end:n.end,value});});
 const visit=(n,p)=>{
  if(n.kind===K.Identifier&&mapping.has(n.name)){
   assert(p?.kind===K.FunctionDeclaration&&p.name===n||p?.kind===K.CallExpression&&p.expression===n,'ROOT_ALPHA_VIEW_ESCAPING_REFERENCE');
   const raw=before.slice(n.pos,n.end),start=n.pos+raw.indexOf(n.name);assert.equal(before.slice(start,n.end),n.name);edits.push({start,end:n.end,value:mapping.get(n.name)});
  }
  const literal=n.kind===K.StringLiteral?decodeBoundAsciiString(n,before):undefined;
  if(literal!==undefined&&mapping.has(literal)){
   assert(callbacks.has(literal)&&p?.kind===K.CallExpression&&p.expression.name==='TriggerCreate'&&p.arguments[0]===n&&p.arguments.length===1,'ROOT_ALPHA_VIEW_OTHER_NAME_CONSUMER');
   const raw=before.slice(n.pos,n.end),token=raw.trim(),start=n.pos+raw.indexOf(token);assert(token.startsWith('"')&&token.endsWith('"')&&start>=n.pos&&before.slice(start,n.end)===token,'ROOT_ALPHA_VIEW_BOUND_STRING_TOKEN');edits.push({start,end:n.end,value:JSON.stringify(callbacks.get(literal))});
  }
  forEachChild(n,c=>visit(c,n));
 };visit(ast);
 let text=before,boundary=text.length;for(const e of edits.sort((a,b)=>b.start-a.start)){assert(e.end<=boundary);text=text.slice(0,e.start)+e.value+text.slice(e.end);boundary=e.start;}
 assert.equal(new Parser().parseFile('root-alpha-complete-view',text).parseDiagnostics.length,0);
 return {before:text,after,proof:{kind:'ARCHIVE_BOUND_PRIVATE_ROOT_CALLBACK_ALPHA',permission:q.proof,stageRoles,sourceArchive:bound.sourceArchive,
  preservedSources:bound.preservedSources.map(({fileName,sha256})=>({fileName,sha256})),sourceRootSha256:bound.sourceRootSha256,candidateRootSha256:sha(candidateRoot),nonSourcePayloadLiteralChecks:bound.resources.map(r=>({path:r.path,sha256:sha(r.bytes)})),
  literalCheckBoundary:'UTF-8 and UTF-16LE literal references in every named non-source payload; supplied Galaxy and standard core name consumers define the semantic boundary.',
  edits:edits.length,inputViewSha256:{before:sha(before),after:sha(after)},viewSha256:{before:sha(text),after:sha(after)},
  newNative:0,newRuntimeFunctions:0,sourceOrExportChanged:false,completeProgramOracleStillRequired:true,wholeMapAccepted:false}};
}

export function qualifyArchiveBoundRootRoles(scope,sourceRoot,externalSources=[]){
 const bound=scopes.get(scope);assert(bound&&bound.sourceRootSha256===sha(sourceRoot),'ROOT_ALPHA_UNTRUSTED_ARCHIVE_SCOPE');
 const merged=[],names=new Map(),digests=new Set();
 for(const f of [...bound.preservedSources,...externalSources]){
  const name=f.fileName.replaceAll('\\','/'),key=name.toLowerCase(),digest=sha(f.text);
  assert(!names.has(key)||names.get(key)===digest,'ROOT_ALPHA_SOURCE_OWNER_CONTENT_CONFLICT');names.set(key,digest);
  if(digests.has(digest))continue;digests.add(digest);merged.push({name,text:f.text});
 }
 // Identical whole files reached through more than one archive layer need
 // only one analysis, while each protected archive member remains pinned.
 const represented=bound.preservedSources.map(f=>{const actual=merged.find(g=>sha(g.text)===sha(f.text));return {...f,fileName:actual.name};});
 return qualifyPrivateRootTriggerAliases({text:sourceRoot,otherSources:merged,parse:(t,n)=>new Parser().parseFile(n,t),typeName:getTypeName,
  sourceEligibility:{existingTriggerData:undefined,ownedSources:represented,preserveOtherSources:true}});
}
export async function verifyProtectedRootSourcesUnchanged(scope,candidateArchive){
 const bound=scopes.get(scope);assert(bound,'ROOT_ALPHA_UNTRUSTED_ARCHIVE_SCOPE');
 const reader=await openMpqReader(await checkedArchiveProofFile(candidateArchive),{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 try{for(const f of bound.preservedSources){const e=reader.find(f.fileName);assert(e,'ROOT_ALPHA_PRESERVED_SOURCE_LOST');assert.equal(sha(await reader.read(e.id)),f.sha256,'ROOT_ALPHA_PRESERVED_SOURCE_CHANGED');}}
 finally{reader.dispose();}
 return {kind:'ALL_OTHER_ARCHIVE_GALAXY_MEMBERS_BYTE_IDENTICAL',files:bound.preservedSources.map(({fileName,sha256})=>({fileName,sha256}))};
}
