import {declaredTriggerConstructorFrame} from "../../model/declared-trigger-constructor-frame.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from "../../model/galaxy-document.collections.mjs";
import {SyntaxKind as K,forEachChild} from "../../sdk/array-values/modules/galaxy/language-core/index.js";
export const passivePrimaryStorageKind='ORIGINAL_PASSIVE_PRIMARY_SOURCE_STORAGE';
const sha=s=>createHash('sha256').update(s).digest('hex');
const prefix=input=>input.documentKind==='library'?'lib'+input.libraryId+'_gv_':'gv_';
function base(type){while(type?.kind===K.ArrayType)type=type.elementType;return type;}
function supported(node){const type=base(node.type);return node.kind===K.VariableDeclaration&&!node.initializer&&(node.modifiers??[]).every(m=>m.kind===K.StaticKeyword)&&type?.kind>=K.BoolKeyword&&type.kind<=K.WavetargetKeyword&&type.kind!==K.VoidKeyword;}
function callAssignments(ast){
 const assignments=new Map(),unwrap=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
 for(const owner of ast.statements){
  if(owner.kind!==K.FunctionDeclaration||!owner.body)continue;
  const frame=declaredTriggerConstructorFrame(owner);
  function visit(n){
   if(n.kind===K.BinaryExpression&&n.operatorToken.kind===K.EqualsToken){
    const left=unwrap(n.left),right=unwrap(n.right);
    if(left?.kind===K.Identifier&&right?.kind===K.CallExpression){const rows=assignments.get(left.name)??[];rows.push(frame);assignments.set(left.name,rows);}
   }forEachChild(n,visit);
  }visit(owner.body);
 }
 // A mismatched original constructor is already an ordinary source function:
 // it cannot satisfy the automatic GUI constructor's handle/name contract.
 // Any other call assignment remains conservatively owned by that model.
 return new Set([...assignments].filter(([name,frames])=>!frames.every(f=>f&&f.handle===name&&f.sourceFunction!==f.conventionalConstructor)).map(([name])=>name));
}

/** GUI globals use the native global prefix. An unprefixed primary variable
 * or static primary variable cannot be represented by renaming its
 * storage. Retain its original passive declaration; executable bodies stay GUI.
 * Only observed noncanonical storage or original static linkage needs a passive source declaration. Other primitive globals remain GUI elements; static storage stays in its original primary unit. */
export function planPassivePrimarySourceStorage(input,observedNames){
 if(input.existingTriggerData?.trim())return [];
 const text=input.script??'',document=createGalaxyDocument({fileName:'primary.galaxy',text}),sections=[];
 try{
  assert.equal(document.ast.parseDiagnostics.length,0,'PASSIVE_PRIMARY_SOURCE_SYNTAX');
  const variables=document.ast.statements.filter(n=>n.kind===K.VariableDeclaration),noncanonical=new Set(variables.filter(n=>!n.name.name.startsWith(prefix(input))||n.modifiers?.some(m=>m.kind===K.StaticKeyword)).map(n=>n.name.name));
  const factories=callAssignments(document.ast),selected=new Set();for(const node of variables){
   const name=node.name.name;if((!observedNames.has(name)&&!node.modifiers?.some(m=>m.kind===K.StaticKeyword))||!noncanonical.has(name)||!supported(node))continue;
   // A primary trigger factory may own a normal GUI Trigger. Its storage role
   // requires the constructor model; never retain only half that component.
   if(base(node.type).kind===K.TriggerKeyword&&factories.has(name))continue;
   let unsafeTypeDependency=false;function inspect(n){if(n.kind===K.Identifier&&noncanonical.has(n.name))unsafeTypeDependency=true;forEachChild(n,inspect);}inspect(node.type);
   if(unsafeTypeDependency)continue;
   selected.add(node);
  }
  let group=[];const flush=()=>{if(!group.length)return;const start=group[0].pos,end=group.at(-1).end,code=text.slice(start,end);
   sections.push({kind:passivePrimaryStorageKind,library:input.libraryId??'Map',fileName:'primary.galaxy',label:group.length===1?group[0].name.name:'Source storage',
    sourceSha256:sha(text),start,end,sha256:sha(code),code,functions:[],allFunctionNames:[],
    declarations:group.map(node=>({kind:node.kind,name:node.name.name,start:node.pos,end:node.end,sha256:sha(text.slice(node.pos,node.end))})),
    privateDeclarations:group.map(node=>({kind:node.kind,name:node.name.name})),closedMixedUnit:true,
    passiveDeclarationOnly:true,newRuntimeFunctions:0,newRuntimeInitializationActions:0});group=[];};
  for(const node of document.ast.statements){if(selected.has(node))group.push(node);else flush();}flush();
  return sections;
 }finally{document.dispose();}
}

/** Independent origin check. A planning receipt cannot authorize new code:
 * unchanged original declarations, with no initializer and only optional original static linkage, form the
 * complete unit. No function body, statement or synthesized declaration fits. */
export function verifyPassivePrimarySourceStorage(input,section){
 assert.equal(section.kind,passivePrimaryStorageKind);assert.equal(section.fileName,'primary.galaxy');
 assert.equal(section.library,input.libraryId??'Map');const text=input.script??'';assert.equal(section.sourceSha256,sha(text),'PASSIVE_PRIMARY_SOURCE_SHA');
 const document=createGalaxyDocument({fileName:section.fileName,text});
 try{
  assert.equal(document.ast.parseDiagnostics.length,0,'PASSIVE_PRIMARY_SOURCE_SYNTAX');
  const matches=document.ast.statements.filter(n=>n.pos>=section.start&&n.end<=section.end);assert(matches.length&&matches.every(supported)&&matches[0].pos===section.start&&matches.at(-1).end===section.end,'PASSIVE_PRIMARY_ORIGINAL_DECLARATION');
  const node=matches[0],code=text.slice(section.start,section.end);assert(matches.every(n=>!n.name.name.startsWith(prefix(input))||n.modifiers?.some(m=>m.kind===K.StaticKeyword)),'PASSIVE_PRIMARY_GUI_REPRESENTABLE_NAME');
  assert.equal(section.code,code,'PASSIVE_PRIMARY_CODE_CHANGED');assert.equal(section.sha256,sha(code),'PASSIVE_PRIMARY_CODE_SHA');
  assert.deepEqual(section.functions,[]);assert.deepEqual(section.allFunctionNames,[]);assert.equal(section.initializer,undefined);
  assert.deepEqual(section.privateDeclarations,matches.map(n=>({kind:n.kind,name:n.name.name})));
  assert.deepEqual(section.declarations,matches.map(n=>({kind:n.kind,name:n.name.name,start:n.pos,end:n.end,sha256:sha(text.slice(n.pos,n.end))})));
  return {name:node.name.name,kind:node.kind,start:node.pos,end:node.end,sha256:sha(code),sourceSha256:sha(text)};
 }finally{document.dispose();}
}
