// Identify a complete generated section by a public AST anchor, never by a map
// name or a comment banner. This is a diagnostic projection; changed global
// names still need a separate protocol/resource ABI closure before conversion.
import {readStringLiteralValue} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/types/string-literal-value.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {proveClosedGeneratedProgramAlpha} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/09e4959328f85737-closed-generated-program-alpha.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const parse=s=>{const a=new Parser().parseFile('owned-generated-section',s);assert.equal(a.parseDiagnostics.length,0,'INVALID_SECTION_SOURCE');return a;};
function walk(n,fn,p,owner){if(!n)return;if(n.kind===K.FunctionDeclaration)owner=n;fn(n,p,owner);forEachChild(n,c=>walk(c,fn,n,owner));}
function clean(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(clean);return Object.fromEntries(Object.keys(n).sort().filter(k=>!['parent','pos','end','line','char','syntaxTokens'].includes(k)).map(k=>[k,clean(n[k])]));}
function lastCodeEnd(n,text){const tokens=n.kind===K.FunctionDeclaration?n.body?.syntaxTokens:n.syntaxTokens,kind=n.kind===K.FunctionDeclaration?K.CloseBraceToken:K.SemicolonToken;const ends=tokens?.filter(t=>t.kind===kind);assert.equal(ends?.length,1,'GENERATED_SECTION_END_TOKEN');const end=ends[0].pos+1;assert.equal(text[end-1],kind===K.CloseBraceToken?'}':';');return end;}
export function projectOwnedGeneratedSection(source,canonical,{publicSymbols,externalSources=[]}={}){
 assert(publicSymbols?.length,'PUBLIC_SECTION_ANCHOR_REQUIRED');
 const ast=parse(source),expected=parse(canonical),publicSet=new Set(publicSymbols);
 const anchorIndex=expected.statements.findIndex(n=>n.kind===K.FunctionDeclaration&&n.body&&publicSet.has(n.name.name));assert(anchorIndex>=0,'PUBLIC_SECTION_ANCHOR_ABSENT');
 const anchor=expected.statements[anchorIndex].name.name,matches=ast.statements.flatMap((n,i)=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===anchor?[i]:[]);assert.equal(matches.length,1,'SOURCE_SECTION_ANCHOR_AMBIGUOUS');
 const startIndex=matches[0]-anchorIndex,endIndex=startIndex+expected.statements.length;assert(startIndex>=0&&endIndex<=ast.statements.length,'SECTION_WINDOW_OUT_OF_BOUNDS');
 const window=ast.statements.slice(startIndex,endIndex),start=window[0].pos,end=lastCodeEnd(window.at(-1),source),section=source.slice(start,end);
 const match=proveClosedGeneratedProgramAlpha(section,canonical,{publicSymbols,externalSources});assert(match.proof.matched,match.proof.reason??'SECTION_NOT_EXACT_ALPHA');
 const mappings=match.proof.globalBindings,mapping=new Map(mappings.map(r=>[r.source,r.target])),changedNames=new Set(mappings.flatMap(r=>[r.source,r.target]));
 const topLevel=new Set(ast.statements),privateDefs=new Map();
 for(const m of mappings){
  assert(/^[A-Za-z_]\w*$/u.test(m.source)&&/^[A-Za-z_]\w*$/u.test(m.target),'SECTION_NONCANONICAL_IDENTIFIER');
  const ds=ast.statements.filter(n=>n.name?.name===m.source),inside=window.filter(n=>n.name?.name===m.source);assert.equal(inside.length,1,'PRIVATE_SECTION_OWNER_AMBIGUOUS');
  const definition=inside[0];privateDefs.set(m.source,definition);
  if(m.kind==='variable')assert(ds.length===1&&definition.kind===K.VariableDeclaration,'PRIVATE_GLOBAL_COLLISION');
  else{assert(definition.kind===K.FunctionDeclaration&&ds.filter(n=>n.body).length===1,'PRIVATE_FUNCTION_COLLISION');for(const d of ds)assert(d.kind===K.FunctionDeclaration&&!d.modifiers?.length&&JSON.stringify(clean(d.type))===JSON.stringify(clean(definition.type))&&JSON.stringify(clean(d.parameters))===JSON.stringify(clean(definition.parameters)),'PRIVATE_PROTOTYPE_CHANGED');}
  assert(!ast.statements.some(n=>n.name?.name===m.target),'PRIVATE_TARGET_ALREADY_DECLARED');
 }
 const edits=[{start,end,text:canonical}],references=[];
 walk(ast,(n,parent,owner)=>{
  if(n.kind===K.StringLiteral){const decoded=readStringLiteralValue(n.text);assert(decoded,'PRIVATE_SECTION_UNDECODED_STRING');const bytes=decoded.bytes.toString('latin1').toLowerCase();for(const name of changedNames)assert(!bytes.includes(name.toLowerCase()),'PRIVATE_SECTION_NAME_STRING_OBSERVER');}
  if(!n.name?.name||![K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.StructDeclaration].includes(n.kind)||topLevel.has(n))return;
  assert(!changedNames.has(n.name.name),'PRIVATE_SECTION_LEXICAL_CAPTURE');
 });
 walk(ast,(n,parent)=>{
  if(n.kind!==K.Identifier||!mapping.has(n.name)||parent?.kind===K.PropertyAccessExpression&&parent.name===n)return;
  const definition=privateDefs.get(n.name),declaration=topLevel.has(parent)&&parent.name===n;
  if(!declaration){if(definition.kind===K.FunctionDeclaration)assert(parent?.kind===K.CallExpression&&parent.expression===n,'PRIVATE_FUNCTION_REFERENCE_ESCAPES');else assert(parent?.kind===K.ElementAccessExpression&&parent.expression===n,'PRIVATE_ARRAY_REFERENCE_ESCAPES');}
  if(start<=n.pos&&n.pos<end)return;
  assert.equal(source.slice(n.pos,n.pos+n.name.length),n.name,'PRIVATE_IDENTIFIER_TOKEN_BOUNDARY');
  edits.push({start:n.pos,end:n.pos+n.name.length,text:mapping.get(n.name)});references.push({source:n.name,target:mapping.get(n.name),position:n.pos});
 });
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_SECTION_PROJECTION');
 let text=source;for(const e of [...edits].reverse())text=text.slice(0,e.start)+e.text+text.slice(e.end);
 // Independently construct the only permitted AST change from fresh input.
 const allowed=parse(source);walk(allowed,(n,parent)=>{if(n.kind===K.Identifier&&mapping.has(n.name)&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n))n.name=mapping.get(n.name);});
 allowed.statements.splice(startIndex,window.length,...parse(canonical).statements);
 assert.deepEqual(clean(parse(text).statements),clean(allowed.statements),'SECTION_PROJECTION_OTHER_AST_CHANGED');
 return {text,proof:{kind:'OWNED_COMPLETE_GENERATED_SECTION_DIAGNOSTIC_PROJECTION',sourceSha256:sha(source),outputSha256:sha(text),canonicalSectionSha256:sha(canonical),anchor,startIndex,endIndex,start,end,sectionAlpha:match.proof,ownedReferences:references,wholeAstMatchesOnlyDeclaredEdits:true,privateAbiClosureProven:false,rewritePermitted:false,sourceOrArchiveChanged:false,newRuntimeFunctions:0,scope:'Exact generated-section AST and static owned reference projection; external name/resource closure remains mandatory.'}};
}
