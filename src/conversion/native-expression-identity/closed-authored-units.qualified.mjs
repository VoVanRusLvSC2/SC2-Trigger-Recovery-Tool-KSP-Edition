import {assertGuiEmittedDeclarationFrontierSnapshot,resolveGuiEmittedDeclarationFrontier} from "./gui-emitted-declaration-frontier.roles.mjs";
import {boundSourceDeclarationOwner} from "../../model/source-declaration-owner.mjs";
import {boundDeclarationOrigin} from "../exact-function-signatures/bound-declaration-origin.mjs";
import {boundSourceStoragePath,storageExpressionAt} from "../bound-static-primary-storage/authored-storage-boundary-path.member-tokens.mjs";
import {indexAuthoredInitializerSchedule} from "../exact-function-signatures/authored-initializer-schedule.indexed.mjs";
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from "../exact-function-signatures/source-function-declarations.mjs";
// Source ownership, not permission to emit raw code. The complete original unit
// and every typed outside interface still need independent output replay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext,declaredCarrier} from "../exact-function-signatures/galaxy-program-context.lazy-carriers.mjs";
import {indexAuthoredScriptSections} from "../exact-function-signatures/authored-script-sections.typedef-initializer-anchors.mjs";
import {embeddedLibraryIds} from "./g2t-initialization.mjs";
import {SyntaxKind as K,forEachChild} from "../exact-function-signatures/index-alternate-3.js";
const sha=s=>createHash('sha256').update(s).digest('hex');
const declKey=(file,node)=>JSON.stringify([file,node.pos,node.kind,node.name?.name]);

export function analyzeClosedAuthoredUnits({sources,declarationSources=[],libraryId='Map',guiDeclarationFrontier}){
 if(guiDeclarationFrontier)assertGuiEmittedDeclarationFrontierSnapshot(guiDeclarationFrontier);
 const inputs=[...sources.map(s=>({...s,owned:true})),...declarationSources.map(s=>({...s,owned:false}))].map(s=>{
  assert.equal(typeof s.text,'string');const digest=sha(s.text);
  assert(!s.sha256||s.sha256===digest,'AUTHORED_UNIT_SOURCE_SHA_CHANGED');
  return {...s,sourceId:s.sourceId??s.fileName,contentSha256:digest};
 });
 const program=new GalaxyProgramContext(inputs,{files:inputs,dependencies:[]},sha,{checks:'binding'});
 const units=[],indexes=[],nodeOwner=new Map(),parents=[];
 const root=i=>parents[i]===i?i:(parents[i]=root(parents[i]));
 const join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parents[b]=a;};
 try{
  for(const source of program.documents.values())program.attachOriginal(source);
  for(const input of inputs.filter(s=>s.owned)){
   const ast=program.documents.get(input.fileName),index=indexAuthoredScriptSections({fileName:input.fileName,text:input.text,expectedSha256:input.contentSha256});
   assert.equal(ast.parseDiagnostics.length,0,'AUTHORED_UNIT_SYNTAX');indexes.push(index);
   const initializerSchedule=indexAuthoredInitializerSchedule({ast,text:input.text,index});
   const scopes=new Set([libraryId,...(libraryId==='Map'?embeddedLibraryIds(ast):[])]);
   for(const section of index.sections){
    if(!section.declarations.length)continue;
    const id=units.length,issues=[],declarations=[];parents.push(id);
    if(index.rejected.length)issues.push({reason:'SOURCE_SECTION_INDEX_HAS_REJECTIONS'});
    if(!scopes.has(section.library))issues.push({reason:'SOURCE_LIBRARY_SCOPE_NOT_PROVED',library:section.library});
    const initializer=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===section.initializer.name&&n.body);
    if(initializer.length!==1||(initializer[0].body.statements.length&&initializerSchedule.phases.find(p=>p.name===section.initializer.name&&p.library===section.library)?.status!=='EXACT_SOURCE_CALL_SCHEDULE'))issues.push({reason:'AUTHORED_INITIALIZER_SCHEDULING_NOT_PROVED'});
    for(const d of section.declarations){
     const matches=ast.statements.filter(n=>n.pos===d.start&&n.kind===d.kind&&n.name?.name===d.name);
     if(matches.length!==1){issues.push({reason:'SOURCE_DECLARATION_IDENTITY_NOT_UNIQUE',declaration:d});continue;}
     const node=matches[0];
     if(!node.name?.name){
      if(node.kind===K.EmptyStatement){declarations.push({kind:node.kind,key:declKey(input.fileName,node),sourceSha256:d.sha256,noOp:true});continue;}
      issues.push({reason:'AUTHORED_UNNAMED_DECLARATION_CONTRACT_REQUIRED',kind:node.kind});continue;}
     if(program.conflicts.has(node.name.name))issues.push({reason:'AMBIGUOUS_AUTHORED_SOURCE_SYMBOL',name:node.name.name});
     if(node.modifiers?.some(m=>m.kind===K.StaticKeyword))issues.push({reason:'AUTHORED_STATIC_FILE_SCOPE_CONTRACT_REQUIRED',name:node.name.name});
     const key=declKey(input.fileName,node);
     if(nodeOwner.has(key))throw Error('AUTHORED_UNIT_DECLARATION_MULTIPLE_OWNERS');
     nodeOwner.set(key,id);declarations.push({name:node.name.name,kind:node.kind,key,
      ...(node.kind===K.FunctionDeclaration?{hasBody:!!node.body,returnType:declaredCarrier(node.type),parameters:node.parameters.map(p=>({name:p.name.name,type:declaredCarrier(p.type)}))}:{type:declaredCarrier(node.type)}),
      sourceSha256:d.sha256});
     if(![K.VariableDeclaration,K.FunctionDeclaration,K.StructDeclaration,K.TypedefDeclaration].includes(node.kind))issues.push({reason:'AUTHORED_DECLARATION_KIND_NOT_SUPPORTED',kind:node.kind});
    }
    units.push({id,library:section.library,fileName:input.fileName,label:section.label,start:section.start,end:section.end,sourceSha256:input.contentSha256,
     sectionSha256:section.sha256,declarations,issues,initializerSchedule:initializerSchedule.phases.find(p=>p.name===section.initializer.name&&p.library===section.library),publicCalls:[],outboundExternalBindings:[],outboundGuiBindings:[],storageOutsideReferences:[],sourceCode:input.text.slice(section.start,section.end)});
   }
  }
  const functionIndex=indexSourceFunctionDeclarations(program.documents);
  for(const group of functionIndex.values())if(group.status==='ABI_CONFLICT'){
   for(const {fileName,node}of group.declarations){const id=nodeOwner.get(declKey(fileName,node));if(id!==undefined)units[id].issues.push({reason:'AUTHORED_FUNCTION_DECLARATION_ABI_CONFLICT',name:group.name});}
  }
  for(const group of functionIndex.values())if(group.body){
   const owners=group.declarations.map(({fileName,node})=>nodeOwner.get(declKey(fileName,node))).filter(id=>id!==undefined);
   for(const id of owners.slice(1))join(owners[0],id);
  }
  const ownerAt=(file,node)=>units.find(u=>u.fileName===file&&node.pos>=u.start&&node.pos<u.end);
  const inputByFile=new Map(inputs.map(s=>[s.fileName,s]));
  for(const [file,ast]of program.documents){
   const visit=(node,parent)=>{
    if(node.kind===K.Identifier){
     const containing=ownerAt(file,node),declaration=canonicalSourceFunctionDeclaration(functionIndex,program.declarationAt(node));
     if(declaration){
      const location=program.location(declaration),targetId=boundSourceDeclarationOwner(program,declaration,(node,file)=>nodeOwner.get(declKey(file,node)));
      if(targetId!==undefined){
       const target=units[targetId];
       if(containing&&containing.id!==targetId)join(containing.id,targetId);
       else if(!containing){
        const sameDeclaration=parent===declaration&&parent.name===node;
        if(!sameDeclaration){
         const directCall=parent?.kind===K.CallExpression&&parent.expression===node;
         const prototype=parent?.kind===K.FunctionDeclaration&&parent.name===node&&!parent.body;
         if(declaration.kind===K.FunctionDeclaration&&(directCall||prototype))target.publicCalls.push({name:declaration.name.name,site:program.location(node),kind:directCall?'DIRECT_CALL':'COMPATIBLE_SOURCE_PROTOTYPE'});
         else target.storageOutsideReferences.push({name:declaration.name.name,kind:declaration.kind,site:program.location(node),
          ...([K.VariableDeclaration,K.PropertyDeclaration].includes(declaration.kind)?{storageContract:boundSourceStoragePath(program,storageExpressionAt(node))}:{}),
          reason:declaration.kind===K.FunctionDeclaration?'NON_CALL_FUNCTION_REFERENCE':'SOURCE_STORAGE_OR_TYPE_USED_OUTSIDE_RAW_COMPONENT'});
        }
       }
      }else if(containing&&inputByFile.get(location.sourceFile)?.owned){
       // Function locals/parameters/members belong to their enclosing raw unit.
       const local=declaration.pos>=containing.start&&declaration.pos<containing.end&&location.sourceFile===file;
       if(!local){
        const contract=guiDeclarationFrontier&&resolveGuiEmittedDeclarationFrontier(guiDeclarationFrontier,program,declaration);
        if(contract?.status==='EXACT_MODELED_GUI_DECLARATION_ABI')containing.outboundGuiBindings.push({site:program.location(node),contract});
        else containing.issues.push({reason:'OUTBOUND_OWNED_SYMBOL_INTERFACE_NOT_PROVED',name:declaration.name?.name,kind:declaration.kind,site:program.location(node),...boundDeclarationOrigin(program,declaration),...(contract?{guiDeclarationContract:contract}:{})});
       }
      }else if(containing)containing.outboundExternalBindings.push({name:node.name,declaration:program.location(declaration),site:program.location(node)});
     }else if(containing&&parent?.name!==node&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===node)){
      containing.issues.push({reason:'AUTHORED_IDENTIFIER_BINDING_UNRESOLVED',name:node.name,site:program.location(node),binding:program.getBinding(node).status});
     }
    }
    forEachChild(node,child=>visit(child,node));
   };visit(ast);
  }
  const components=new Map();
  for(const unit of units){const id=root(unit.id),members=components.get(id)??[];members.push(unit);components.set(id,members);}
  const result=[...components.values()].map(members=>{
   const issues=members.flatMap(u=>u.issues.map(i=>({unit:u.id,...i}))),outside=members.flatMap(u=>u.storageOutsideReferences.map(i=>({unit:u.id,...i})));
   return {units:members.map(u=>u.id),closurePassed:!issues.length&&!outside.length,issues,outsideStorageReferences:outside};
  });
  return {kind:'SOURCE_BOUND_AUTHORED_UNIT_CLOSURE',units,components:result,indexes:indexes.map(i=>({fileName:i.fileName,sourceSha256:i.sourceSha256,rejected:i.rejected})),
   bindingOnly:true,sourceChanged:false,guiEmissionAuthorized:false,semanticEquivalenceProved:false,wholeMapAccepted:false};
 }finally{program.dispose();}
}
