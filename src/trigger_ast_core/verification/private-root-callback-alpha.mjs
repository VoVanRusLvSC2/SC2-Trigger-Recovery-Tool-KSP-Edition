import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {checkedArchiveProofFile} from './archive-proof-context.mjs';
import {qualifyPrivateRootTriggerAliases} from '../passes/qualified-root-trigger-aliases.mjs';
import {declaredTriggerConstructorFrame} from '../model/declared-trigger-constructor-frame.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const scopes=new WeakMap(),sha=t=>createHash('sha256').update(t).digest('hex');
export async function readPrivateRootArchiveScope(sourceArchive,sourceRoot){
 const reader=await openMpqReader(await checkedArchiveProofFile(sourceArchive),{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 try{
  assert(reader.entries.every(e=>e.path),'ROOT_ALPHA_UNNAMED_ARCHIVE_SCOPE');
  assert(!reader.entries.some(e=>/(^|\/)triggers$/iu.test(e.path.replaceAll('\\','/'))),'ROOT_ALPHA_EXISTING_GUI_PROTECTED');
  const galaxy=reader.entries.filter(e=>e.path.toLowerCase().endsWith('.galaxy'));
  assert(galaxy.length===1&&galaxy[0].path.toLowerCase()==='mapscript.galaxy','ROOT_ALPHA_OWNED_SOURCE_FILES_PROTECTED');
  assert.equal(Buffer.from(await reader.read(galaxy[0].id)).toString('utf8'),sourceRoot,'ROOT_ALPHA_NOT_SERVER_ROOT');
  const resources=[];for(const e of reader.entries)if(e!==galaxy[0])resources.push({path:e.path,bytes:Buffer.from(await reader.read(e.id))});
  const cap=Object.freeze({kind:'PINNED_SINGLE_ROOT_NO_GUI_ARCHIVE_SCOPE'});scopes.set(cap,{sourceArchive,sourceRootSha256:sha(sourceRoot),resources});return cap;
 }finally{reader.dispose();}
}
export function projectPrivateRootCallbackAlpha(before,after,{scope,sourceRoot,candidateRoot,externalSources=[]}){
 const bound=scopes.get(scope);assert(bound&&bound.sourceRootSha256===sha(sourceRoot),'ROOT_ALPHA_UNTRUSTED_ARCHIVE_SCOPE');
 const q=qualifyPrivateRootTriggerAliases({text:sourceRoot,otherSources:externalSources.map(f=>({name:f.fileName,text:f.text})),parse:(t,n)=>new Parser().parseFile(n,t),typeName:getTypeName,sourceEligibility:{ownedSources:[],existingTriggerData:undefined}});
 assert(q.proof.edits,'ROOT_ALPHA_NO_ALIAS_REQUIRED');
 const candidate=new Parser().parseFile('actual-native-root',candidateRoot);assert.equal(candidate.parseDiagnostics.length,0);
 const mapping=new Map(),callbacks=new Map();
 for(const b of q.proof.bindings){
  const ctor=candidate.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.constructor.to),callback=candidate.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.callback.to);
  assert(ctor.length===1&&callback.length===1,'ROOT_ALPHA_ACTUAL_NATIVE_ROLES_MISSING');
  const frame=declaredTriggerConstructorFrame(ctor[0]);assert(frame?.handle===b.handle&&frame.callback===b.callback.to,'ROOT_ALPHA_ACTUAL_NATIVE_REGISTRATION_CHANGED');
  assert(callback[0].type.kind===K.BoolKeyword&&callback[0].parameters.length===2&&callback[0].parameters.every(p=>p.type.kind===K.BoolKeyword&&!p.isReference),'ROOT_ALPHA_ACTUAL_NATIVE_CALLBACK_ABI');
  if(b.constructor.from!==b.constructor.to)mapping.set(b.constructor.from,b.constructor.to);
  if(b.callback.from!==b.callback.to){mapping.set(b.callback.from,b.callback.to);callbacks.set(b.callback.from,b.callback.to);}
 }
 const names=q.proof.flow.privateNames.filter(n=>n!=='InitMap');
 for(const resource of bound.resources)for(const name of names)assert(!resource.bytes.includes(Buffer.from(name,'utf8'))&&!resource.bytes.includes(Buffer.from(name,'utf16le')),'ROOT_ALPHA_NON_SOURCE_LITERAL_REFERENCE:'+resource.path);
 const ast=new Parser().parseFile('complete-selected-before',before);assert.equal(ast.parseDiagnostics.length,0);const edits=[];
 const visit=(n,p)=>{
  if(n.kind===K.Identifier&&mapping.has(n.name)){
   assert(p?.kind===K.FunctionDeclaration&&p.name===n||p?.kind===K.CallExpression&&p.expression===n,'ROOT_ALPHA_VIEW_ESCAPING_REFERENCE');
   const raw=before.slice(n.pos,n.end),start=n.pos+raw.indexOf(n.name);assert.equal(before.slice(start,n.end),n.name);edits.push({start,end:n.end,value:mapping.get(n.name)});
  }
  if(n.kind===K.StringLiteral&&mapping.has(n.value)){
   assert(callbacks.has(n.value)&&p?.kind===K.CallExpression&&p.expression.name==='TriggerCreate'&&p.arguments[0]===n&&p.arguments.length===1,'ROOT_ALPHA_VIEW_OTHER_NAME_CONSUMER');
   const raw=before.slice(n.pos,n.end),token=JSON.stringify(n.value),start=n.pos+raw.indexOf(token);assert(start>=n.pos&&before.slice(start,n.end)===token);edits.push({start,end:n.end,value:JSON.stringify(callbacks.get(n.value))});
  }
  forEachChild(n,c=>visit(c,n));
 };visit(ast);
 let text=before,boundary=text.length;for(const e of edits.sort((a,b)=>b.start-a.start)){assert(e.end<=boundary);text=text.slice(0,e.start)+e.value+text.slice(e.end);boundary=e.start;}
 assert.equal(new Parser().parseFile('root-alpha-complete-view',text).parseDiagnostics.length,0);
 return {before:text,after,proof:{kind:'ARCHIVE_BOUND_PRIVATE_ROOT_CALLBACK_ALPHA',permission:q.proof,sourceArchive:bound.sourceArchive,
  sourceRootSha256:bound.sourceRootSha256,candidateRootSha256:sha(candidateRoot),nonSourcePayloadLiteralChecks:bound.resources.map(r=>({path:r.path,sha256:sha(r.bytes)})),
  literalCheckBoundary:'UTF-8 and UTF-16LE literal references in every named non-source payload; supplied Galaxy and standard core name consumers define the semantic boundary.',
  edits:edits.length,inputViewSha256:{before:sha(before),after:sha(after)},viewSha256:{before:sha(text),after:sha(after)},
  newNative:0,newRuntimeFunctions:0,sourceOrExportChanged:false,completeProgramOracleStillRequired:true,wholeMapAccepted:false}};
}
