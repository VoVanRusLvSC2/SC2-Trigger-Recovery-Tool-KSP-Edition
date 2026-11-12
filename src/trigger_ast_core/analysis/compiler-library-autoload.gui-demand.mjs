import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
// Restore explicit compiler library demand from the original program. This
// creates Data references, never runtime calls, wrappers or Native definitions.
import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{createGalaxyDocument}from'../model/galaxy-document.collections.mjs';
import{logicalSourcePath}from'../model/source-ownership.mjs';
import{readStringLiteralValue}from'../types/string-literal-value.mjs';
import{parseTriggerXmlSync}from'../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
import{SyntaxKind as K}from'../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import{libraryInitializationNames,withNamingIndexes}from'../../map_global_repair_v193_preset_reference_use_2026-10-19/types/189652cc1dc7-core.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),canonical=p=>logicalSourcePath(p).replace(/^base\.sc2data\//u,'');
const checked=file=>{assert(file?.fileName&&typeof file.text==='string'&&file.sha256===sha(file.text),'BOOTSTRAP_SOURCE_SHA');return file;};
function parse(file){checked(file);const doc=createGalaxyDocument(file);assert.equal(doc.ast.parseDiagnostics.length,0,'BOOTSTRAP_SOURCE_SYNTAX');return doc;}
const call=stmt=>stmt?.kind===K.ExpressionStatement&&stmt.expression?.kind===K.CallExpression&&stmt.expression.expression?.kind===K.Identifier&&stmt.expression.arguments.length===0?stmt.expression.expression.name:undefined;
function bootstrap(ast){
 const bodies=name=>ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===name&&n.body);
 const maps=bodies('InitMap'),libs=bodies('InitLibs');assert.equal(maps.length,1,'COMPILER_MAP_ENTRY_UNIQUE');assert.equal(libs.length,1,'COMPILER_LIBRARY_ENTRY_UNIQUE');
 assert.equal(maps[0].parameters.length,0);assert.equal(libs[0].parameters.length,0);
 assert.equal(call(maps[0].body.statements[0]),'InitLibs','COMPILER_LIBRARY_ENTRY_FIRST');
 assert.equal(maps[0].body.statements.filter(s=>call(s)==='InitLibs').length,1,'COMPILER_LIBRARY_ENTRY_ONCE');
 const calls=libs[0].body.statements.map(call);assert(calls.length&&calls.every(Boolean),'COMPILER_LIBRARY_BODY_NOT_DIRECT_CALLS');assert.equal(new Set(calls).size,calls.length,'DUPLICATE_LIBRARY_INITIALIZER');return calls;
}
export function planCompilerLibraryAutoload({root,observedRoot,metadata,declarations,includeEvidence,gui}){
 checked(root);if(observedRoot)checked(observedRoot);assert(Array.isArray(includeEvidence),'BOOTSTRAP_INCLUDE_EVIDENCE_REQUIRED');
 const guiBindings=new Set();
 if(gui!==undefined){assert(typeof gui==='string'&&gui.length<=64*1024**2,'BOOTSTRAP_GUI_INPUT_BOUND');const tree=xmlTree(gui);assert.equal(tree.tag,'TriggerData');
  const walk=n=>{if(n.tag!=='Element'&&n.attributes.Type&&n.attributes.Id&&n.attributes.Library)guiBindings.add(n.attributes.Library);for(const c of n.children)walk(c);};walk(tree);
 }
 const retainedGuiBindings=[];
 const libraries=new Map(),owners=new Map();let native;
 for(const file of metadata){checked(file);for(const[id,lib]of parseTriggerXmlSync(file.text)){
  assert(!libraries.has(id),'AMBIGUOUS_BOOTSTRAP_LIBRARY_ID');libraries.set(id,lib);owners.set(id,file);
  if(/(?:^|\/)nativelib\.triggerlib$/iu.test(logicalSourcePath(file.fileName))){assert(!native,'AMBIGUOUS_NATIVE_LIBRARY');native=lib;}
 }}assert(native,'NATIVE_LIBRARY_IDENTITY_REQUIRED');
 const doc=parse(root),observed=observedRoot&&parse(observedRoot);const parsed=[];
 try{return withNamingIndexes(()=>{
  const required=bootstrap(doc.ast),already=observed?bootstrap(observed.ast):[];
  assert(already.every(name=>required.includes(name)),'UNEXPECTED_OBSERVED_LIBRARY_INITIALIZER');
  assert.deepEqual(already,required.filter(name=>already.includes(name)),'OBSERVED_LIBRARY_ORDER_CHANGED');
  const includes=doc.ast.statements.filter(n=>n.kind===K.IncludeStatement).map(n=>({value:readStringLiteralValue(n.path.text)?.bytes.toString('utf8'),start:n.pos,end:n.end}));
  const candidates=new Map();for(const[id,lib]of libraries){const name=libraryInitializationNames(lib,native,libraries).library;const list=candidates.get(name)??[];list.push({id,lib,metadata:owners.get(id)});candidates.set(name,list);}
  const demands=[];
  for(const symbol of required){const matches=candidates.get(symbol)??[];assert.equal(matches.length,1,'BOOTSTRAP_CALL_LIBRARY_NOT_UNIQUE:'+symbol);const match=matches[0];
   if(match.id===native.id||already.includes(symbol))continue;
   if(guiBindings.has(match.id)){retainedGuiBindings.push({id:match.id,initializer:symbol,actualEditorExportRequired:true});continue;}
   const stem=canonical(match.metadata.fileName).replace(/\.(?:sc2lib|triggerlib)$/u,'');
   const paths=includes.filter(i=>i.value&&canonical(i.value.replace(/\.galaxy$/iu,''))===stem);assert.equal(paths.length,1,'ORIGINAL_LIBRARY_INCLUDE_NOT_UNIQUE:'+symbol);const include=paths[0];
   const edges=includeEvidence.filter(e=>canonical(e.from)===canonical(root.fileName)&&canonical(e.include.replace(/\.galaxy$/iu,''))===canonical(include.value.replace(/\.galaxy$/iu,'')));
   const identities=new Set(edges.map(e=>logicalSourcePath(e.path)+'\0'+e.layerId));assert.equal(identities.size,1,'LIBRARY_INCLUDE_RESOLUTION_NOT_UNIQUE');assert(edges[0]?.layerId,'LIBRARY_INCLUDE_LAYER_REQUIRED');
   const files=declarations.filter(f=>canonical(f.fileName)===canonical(edges[0].path));assert.equal(files.length,1,'LIBRARY_SOURCE_FILE_NOT_UNIQUE');const source=checked(files[0]);
   const d=parse(source);parsed.push(d);const bodies=d.ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===symbol&&n.body);assert.equal(bodies.length,1,'LIBRARY_SOURCE_INITIALIZER_NOT_UNIQUE');const fn=bodies[0];assert.equal(fn.parameters.length,0);assert.equal(fn.type.kind,K.VoidKeyword,'LIBRARY_INITIALIZER_NOT_VOID');
   demands.push({id:match.id,includePath:include.value.replace(/\.galaxy$/iu,''),initializer:symbol,sourceOrder:required.indexOf(symbol),metadata:{fileName:match.metadata.fileName,sha256:match.metadata.sha256},source:{fileName:source.fileName,sha256:source.sha256,declarationStart:fn.pos,declarationEnd:fn.end,declarationSha256:sha(source.text.slice(fn.pos,fn.end))},include:{start:include.start,end:include.end,path:edges[0].path,layerId:edges[0].layerId}});
  }
  return{kind:'ORIGINAL_COMPILER_LIBRARY_AUTOLOAD_DEMAND',root:{fileName:root.fileName,sha256:root.sha256},observedRoot:observedRoot?{fileName:observedRoot.fileName,sha256:observedRoot.sha256}:undefined,required,observed:already,demands,retainedGuiBindings,...(gui===undefined?{}:{guiSha256:sha(gui)}),newRuntimeFunctions:0,newNative:0,semanticEquivalenceProved:false,accepted:false};
 });}finally{doc.dispose();observed?.dispose();for(const d of parsed)d.dispose();}
}
