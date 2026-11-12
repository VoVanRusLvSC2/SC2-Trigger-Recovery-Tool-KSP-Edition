// Source ownership, not permission to emit raw code. The complete original unit
// and every typed outside interface still need independent output replay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext,declaredCarrier} from '../model/galaxy-program-context.binding-mode.mjs';
import {indexAuthoredScriptSections} from '../model/authored-script-sections.typedef-initializer-anchors.mjs';
import {embeddedLibraryIds} from '../../map_global_repair_v265_attribute_scalar_codec_2026-10-21/g2t-initialization.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const declKey=(file,node)=>JSON.stringify([file,node.pos,node.kind,node.name?.name]);

export function analyzeClosedAuthoredUnits({sources,declarationSources=[],libraryId='Map'}){
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
   const scopes=new Set([libraryId,...(libraryId==='Map'?embeddedLibraryIds(ast):[])]);
   for(const section of index.sections){
    if(!section.declarations.length)continue;
    const id=units.length,issues=[],declarations=[];parents.push(id);
    if(index.rejected.length)issues.push({reason:'SOURCE_SECTION_INDEX_HAS_REJECTIONS'});
    if(!scopes.has(section.library))issues.push({reason:'SOURCE_LIBRARY_SCOPE_NOT_PROVED',library:section.library});
    const initializer=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===section.initializer.name&&n.body);
    if(initializer.length!==1||initializer[0].body.statements.length)issues.push({reason:'AUTHORED_INITIALIZER_SCHEDULING_NOT_PROVED'});
    for(const d of section.declarations){
     const matches=ast.statements.filter(n=>n.pos===d.start&&n.kind===d.kind&&n.name?.name===d.name);
     if(matches.length!==1){issues.push({reason:'SOURCE_DECLARATION_IDENTITY_NOT_UNIQUE',declaration:d});continue;}
     const node=matches[0],key=declKey(input.fileName,node);
     if(nodeOwner.has(key))throw Error('AUTHORED_UNIT_DECLARATION_MULTIPLE_OWNERS');
     nodeOwner.set(key,id);declarations.push({name:node.name.name,kind:node.kind,key,
      ...(node.kind===K.FunctionDeclaration?{hasBody:!!node.body,returnType:declaredCarrier(node.type),parameters:node.parameters.map(p=>({name:p.name.name,type:declaredCarrier(p.type)}))}:{type:declaredCarrier(node.type)}),
      sourceSha256:d.sha256});
     if(![K.VariableDeclaration,K.FunctionDeclaration,K.StructDeclaration,K.TypedefDeclaration].includes(node.kind))issues.push({reason:'AUTHORED_DECLARATION_KIND_NOT_SUPPORTED',kind:node.kind});
    }
    units.push({id,library:section.library,fileName:input.fileName,label:section.label,start:section.start,end:section.end,sourceSha256:input.contentSha256,
     sectionSha256:section.sha256,declarations,issues,publicCalls:[],outboundExternalBindings:[],storageOutsideReferences:[],sourceCode:input.text.slice(section.start,section.end)});
   }
  }
  const ownerAt=(file,node)=>units.find(u=>u.fileName===file&&node.pos>=u.start&&node.pos<u.end);
  const inputByFile=new Map(inputs.map(s=>[s.fileName,s]));
  for(const [file,ast]of program.documents){
   const visit=(node,parent)=>{
    if(node.kind===K.Identifier){
     const containing=ownerAt(file,node),declaration=program.declarationAt(node);
     if(declaration){
      const location=program.location(declaration),targetId=nodeOwner.get(declKey(location.sourceFile,declaration));
      if(targetId!==undefined){
       const target=units[targetId];
       if(containing&&containing.id!==targetId)join(containing.id,targetId);
       else if(!containing){
        const sameDeclaration=parent===declaration&&parent.name===node;
        if(!sameDeclaration){
         const directCall=parent?.kind===K.CallExpression&&parent.expression===node;
         const prototype=parent?.kind===K.FunctionDeclaration&&parent.name===node&&!parent.body;
         if(declaration.kind===K.FunctionDeclaration&&(directCall||prototype))target.publicCalls.push({name:declaration.name.name,site:program.location(node),kind:directCall?'DIRECT_CALL':'COMPATIBLE_SOURCE_PROTOTYPE'});
         else target.storageOutsideReferences.push({name:declaration.name.name,kind:declaration.kind,site:program.location(node),reason:declaration.kind===K.FunctionDeclaration?'NON_CALL_FUNCTION_REFERENCE':'SOURCE_STORAGE_OR_TYPE_USED_OUTSIDE_RAW_COMPONENT'});
        }
       }
      }else if(containing&&inputByFile.get(location.sourceFile)?.owned){
       // Function locals/parameters/members belong to their enclosing raw unit.
       const local=declaration.pos>=containing.start&&declaration.pos<containing.end&&location.sourceFile===file;
       if(!local)containing.issues.push({reason:'OUTBOUND_OWNED_SYMBOL_INTERFACE_NOT_PROVED',name:declaration.name?.name,kind:declaration.kind,site:program.location(node)});
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
