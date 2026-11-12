import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from "../model/galaxy-program-context.lexical-parameters.mjs";
import {logicalSourcePath,partitionDeclarationViews} from "../model/source-ownership.mjs";
import {removeAlreadyLoadedOwnedIncludes} from "../passes/owned-include-closure.mjs";
import {SyntaxKind as K,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=s=>createHash('sha256').update(s).digest('hex');
const rootKinds=new Set([K.VariableDeclaration,K.FunctionDeclaration,K.StructDeclaration,K.TypedefDeclaration]);

/** Check the other direction of the source/GUI boundary: unchanged included
 * code must still resolve its primary-document references to primary storage,
 * callables and types. This is binding evidence, never whole-program proof. */
export function verifyRetainedSourcePrimaryBindings(input,after){
 const owned=input.additionalScripts??[],report={kind:'RETAINED_SOURCE_TO_PRIMARY_BINDINGS',passed:true,records:[],failures:[],
  unresolvedOriginalReferences:[],actualEditor:false,wholeMapAccepted:false,archivePackingVerified:false,stringObserversCovered:false};
 if(!owned.length)return {...report,skipped:'NO_RETAINED_SOURCES'};
 const rootName=logicalSourcePath(input.documentKind==='library'?'Lib'+input.libraryId+'.galaxy':'MapScript.galaxy');
 const views=partitionDeclarationViews(owned,input.galaxyDeclarations??[]);assert.equal(views.conflicts.length,0,'PRIMARY_BINDING_SOURCE_VIEW_CONFLICT');
 const open=text=>{
  const root={fileName:rootName,text},closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:views.external,includeEvidence:input.includeEvidence,includeRoot:false}).proof;
  if(!closure.completeReachableClosure||!Array.isArray(closure.resolvedFiles))
    throw Object.assign(new Error('PRIMARY_BINDING_COMPLETE_INCLUDE_CLOSURE_REQUIRED'),{context:{rootName,rootSha256:sha(text),closure}});
  const reached=new Map(closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256])),seen=new Set(),files=[];
  for(const f of [root,...owned,...views.external]){
   const fileName=logicalSourcePath(f.originalPath??f.fileName);if(seen.has(fileName)||f!==root&&!reached.has(fileName))continue;
   assert(f===root||sha(f.text)===reached.get(fileName),'PRIMARY_BINDING_REACHABLE_SOURCE_SHA');seen.add(fileName);
   files.push({fileName,text:f.text,sourceId:'primary-boundary:'+fileName,owned:f===root||owned.includes(f),contentSha256:sha(f.text)});
  }
  const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});
  try{for(const doc of program.documents.values()){assert.equal(doc.parseDiagnostics.length,0,'PRIMARY_BINDING_SOURCE_SYNTAX');program.attachOriginal(doc);}return program;}
  catch(error){program.dispose();throw error;}
 };
 const before=[input.header,input.script].filter(Boolean).join('\n'),original=open(before);let candidate;
 try{
  candidate=after===before?original:open(after);const root=original.documents.get(rootName);assert(root,'PRIMARY_BINDING_ROOT_DOCUMENT');
  const roots=new Set(root.statements.filter(n=>rootKinds.has(n.kind)&&n.name)),names=new Set([...roots].map(n=>n.name.name));
  for(const file of owned){
   const name=logicalSourcePath(file.originalPath??file.fileName),a=original.documents.get(name),b=candidate.documents.get(name);
   if(!a&&!b)continue;assert(a&&b&&a.text===b.text&&sha(a.text)===sha(file.text),'PRIMARY_BINDING_RETAINED_SOURCE_CHANGED');
   const targets=new Map();function index(n){if(n.kind===K.Identifier&&names.has(n.name))targets.set(n.pos+':'+n.end,n);forEachChild(n,index);}index(b);
   function visit(n){
    if(n.kind===K.Identifier&&names.has(n.name)){
     const declaration=original.declarationAt(n);
     if(!declaration){if(!(n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n))report.unresolvedOriginalReferences.push({file:name,start:n.pos,name:n.name});}
     else if(roots.has(declaration)){
      const target=targets.get(n.pos+':'+n.end);assert(target?.name===n.name,'PRIMARY_BINDING_REFERENCE_IDENTITY');
      const found=candidate.declarationAt(target),location=found&&candidate.location(found);
      const passed=!!found&&location?.sourceFile===rootName&&found.kind===declaration.kind&&found.name?.name===declaration.name.name;
      const record={file:name,start:n.pos,end:n.end,name:n.name,declarationKind:declaration.kind,originalDeclarationStart:declaration.pos,passed,
       candidate:found?{kind:found.kind,name:found.name?.name,sourceFile:location?.sourceFile}:null};
      report.records.push(record);if(!passed)report.failures.push(record);
     }
    }
    forEachChild(n,visit);
   }visit(a);
  }
  report.passed=!report.failures.length&&!report.unresolvedOriginalReferences.length;
  report.rootSha256={before:sha(before),after:sha(after)};report.retainedSources=owned.map(f=>({fileName:logicalSourcePath(f.originalPath??f.fileName),sha256:sha(f.text)}));
  return report;
 }finally{if(candidate&&candidate!==original)candidate.dispose();original.dispose();}
}
