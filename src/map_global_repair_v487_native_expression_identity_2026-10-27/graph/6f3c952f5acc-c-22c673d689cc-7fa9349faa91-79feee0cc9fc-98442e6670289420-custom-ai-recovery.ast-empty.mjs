// Fallback for an empty native CustomAI document whose Galaxy lost formatting
// or comment banners. Whole generated ASTs must match; private global aliases
// are deliberately refused. Existing nonempty/source-profile recovery stays first.
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {recoverCustomAi as previous} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/custom-ai-recovery.source-profile.mjs';
import {withSourceCustomAiProfiles} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/source-custom-ai-profile.mjs';
import {generateCustomAiMapScriptSection,generateCustomAiScript} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/custom-ai-script.source-profile.mjs';
import {proveClosedGeneratedProgramAlpha} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/36a7d0acd49c-845b8d343eb1-a2e2af444349-d7316f49b502-09e4959328f85737-closed-generated-program-alpha.mjs';
import {projectOwnedGeneratedSection} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/dd16d3a6142e-cd55d6fd-25ca4381902bf1e5-owned-generated-section-projection.decoded-name-observers.r2.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
function parse(text){const ast=new Parser().parseFile('native-empty-custom-ai',text);if(ast.parseDiagnostics.length)throw Error('INVALID_CUSTOM_AI_AST');return ast;}
function walk(n,visit,p){visit(n,p);forEachChild(n,c=>walk(c,visit,n));}
function includePath(n){return n.path?.value??n.path?.text?.replace(/^"|"$/gu,'');}
function codeEnd(n){const tokens=n.syntaxTokens?.filter(t=>t.kind===K.SemicolonToken);if(tokens?.length!==1)throw Error('AMBIGUOUS_STATEMENT_END');return tokens[0].pos+1;}
export function recoverEmptyCustomAiAst(mapScript,files){
 try{
  const ast=parse(mapScript),includes=ast.statements.filter(n=>n.kind===K.IncludeStatement&&/^ai[0-9A-F]{8}$/u.test(includePath(n)??''));
  if(!includes.length||includes.length>128)return {state:'none'};
  const ids=includes.map(n=>includePath(n).slice(2));
  if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_EMPTY_AI_INCLUDE');
  const definitions=ids.map(id=>({id,targetPlayers:[],steps:[]})),document={definitions},used=[],fileProofs=[];
  const section=generateCustomAiMapScriptSection(document,{campaignPlayers:[]}),sectionAst=parse(section);
  const publicSymbols=sectionAst.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name.startsWith('cai_')).map(n=>n.name.name);
  for(const definition of definitions){
   const fileName=`ai${definition.id}.galaxy`,matches=files.filter(f=>f.fileName.split(/[\\/]/u).at(-1)===fileName);
   if(matches.length!==1)throw Error('EMPTY_AI_FILE_OWNER_AMBIGUOUS');
   const file=matches[0],expected=generateCustomAiScript(definition,{aiName:()=>'',triggerFunction:x=>x});
   // No private global rename, callback-string rename or externally supplied
   // ABI assumption is needed by this fallback.
   const match=proveClosedGeneratedProgramAlpha(file.text,expected,{publicSymbols:parse(expected).statements.filter(n=>n.name).map(n=>n.name.name)});
   if(!match.proof.matched||match.proof.globalBindings.length||match.proof.callbackBindings.length)throw Error('EMPTY_AI_FILE_NOT_EXACT_PUBLIC_AST');
   used.push(file);fileProofs.push({fileName,sourceSha256:sha(file.text),proof:match.proof});
  }
  const projection=projectOwnedGeneratedSection(mapScript,section,{publicSymbols});
  if(projection.proof.sectionAlpha.globalBindings.length||projection.proof.sectionAlpha.callbackBindings.length)throw Error('EMPTY_AI_SECTION_PRIVATE_RENAME_REFUSED');
  const initMaps=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body);
  if(initMaps.length!==1)throw Error('EMPTY_AI_STARTUP_OWNER_AMBIGUOUS');
  const initMap=initMaps[0],calls=[];
  walk(ast,(n,p)=>{if(n.kind===K.CallExpression&&n.expression?.name==='InitCustomAI')calls.push({call:n,parent:p});});
  if(calls.length!==1)throw Error('EMPTY_AI_STARTUP_CALL_COUNT');
  const {call,parent}=calls[0];
  if(call.arguments.length||parent.kind!==K.ExpressionStatement||!initMap.body.statements.includes(parent))throw Error('EMPTY_AI_STARTUP_NOT_DIRECT_INITMAP_STATEMENT');
  let otherUses=0;
  walk(ast,(n,p)=>{if(n.kind===K.Identifier&&n.name==='InitCustomAI'&&!(p?.kind===K.FunctionDeclaration&&p.name===n)&&!(p===call&&call.expression===n))otherUses++;});
  if(otherUses)throw Error('EMPTY_AI_STARTUP_SYMBOL_ESCAPES');
  const start=projection.proof.start,end=projection.proof.end;
  if(start<=parent.pos&&parent.pos<end)throw Error('EMPTY_AI_STARTUP_INSIDE_OWNED_SECTION');
  const edits=[{start,end},...includes.map(n=>{if(mapScript.slice(n.path.pos,n.path.end)!==n.path.text)throw Error('EMPTY_AI_INCLUDE_TOKEN_BOUNDARY');return {start:n.pos,end:n.path.end};}),{start:parent.pos,end:codeEnd(parent)}].sort((a,b)=>a.start-b.start);
  for(let i=1;i<edits.length;i++)if(edits[i-1].end>edits[i].start)throw Error('EMPTY_AI_OWNER_RANGES_OVERLAP');
  let script=mapScript;for(const e of [...edits].reverse())script=script.slice(0,e.start)+script.slice(e.end);
  parse(script);
  const aiNames=new Map(used.map(f=>[/^ai([0-9A-F]{8})\.galaxy$/u.exec(f.fileName.split(/[\\/]/u).at(-1))[1],/^\/\/ AI Name: (.*)$/mu.exec(f.text)?.[1]??'']));
  return {state:'recovered',value:{document,aiNames,campaignPlayers:[],triggerFunctions:new Map(),script,files:used,declarations:[...used,{fileName:'CustomAIFunctions.galaxy',text:section}]},astOwnershipProof:{kind:'EMPTY_CUSTOM_AI_WHOLE_AST_OWNERSHIP',sourceSha256:sha(mapScript),remainderSha256:sha(script),fileProofs,sectionProof:projection.proof,privateGlobalRenames:0,sourceStartupCallRemovedExactlyOnce:true,startupStatementIndex:initMap.body.statements.indexOf(parent),fullRootRoundtripProofRequired:true}};
 }catch(error){return {state:'kept',reason:'empty-ai-ast-ownership-refused',details:{reason:String(error.message).split('\n')[0]}};}
}
export function recoverCustomAi(mapScript,files,dependencyDocuments=[]){
 const original=withSourceCustomAiProfiles(files,()=>previous(mapScript,files,dependencyDocuments));
 if(original.state==='recovered')return original;
 const fallback=recoverEmptyCustomAiAst(mapScript,files);
 return fallback.state==='recovered'?fallback:original;
}
