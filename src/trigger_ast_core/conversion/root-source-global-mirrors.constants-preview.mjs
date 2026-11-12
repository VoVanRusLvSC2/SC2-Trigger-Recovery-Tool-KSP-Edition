import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {serializeTriggerLibraryCanonical} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {inspectSourceGlobalMirrorCandidates} from '../model/source-global-mirror-candidates.mjs';
import {inspectUnusedConstantMirrors} from '../model/source-global-unused-constant-mirrors.mjs';
import {canonicalScopedGuiIdentity} from '../model/scoped-gui-signature.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const parse=(s,n)=>{const ast=new Parser().parseFile(n,s);assert.equal(ast.parseDiagnostics.length,0,'ROOT_MIRROR_SYNTAX');return ast;};
const key=(library,type,id)=>JSON.stringify([library,type,id]);
const element=(library,r,owner=library.id)=>{
 const source=r.library??owner;assert.equal(source,library.id,'ROOT_MIRROR_FOREIGN_REFERENCE');
 const rows=[...new Set([library.elements[r.type+':'+r.id],library.elements[r.id]].filter(e=>e?.type===r.type))];
 assert.equal(rows.length,1,'ROOT_MIRROR_AMBIGUOUS_REFERENCE');return rows[0];
};
const refs=(node,owner,visit)=>{
 function walk(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){for(const x of value)walk(x);return;}
  if(value!==node&&typeof value.type==='string'&&typeof value.id==='string')visit(value,owner);
  for(const [k,v]of Object.entries(value))if(!['xmlSource','elements','elementsByType'].includes(k))walk(v);
 }walk(node);
};
const containsIdentifier=(node,names)=>{let hit=false;function walk(n){if(n.kind===K.Identifier&&names.has(n.name))hit=true;forEachChild(n,walk);}walk(node);return hit;};
const literal=n=>{if(!n)return true;if([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n.kind))return true;
 if(n.kind===K.ParenthesizedExpression)return literal(n.expression);
 return n.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral;};
const normalize=e=>JSON.stringify(canonicalScopedGuiIdentity(e,e.library??'Map'));

/** Experimental, source-bound candidate construction. It does not approve a
 * map: actual Editor export, original initialization order, GUI usability,
 * all attributes and one whole-program proof are mandatory afterwards. */
export function buildRootSourceGlobalMirrors({original,xml,nativeExport,nativeGui,verifiedStockAssignment,closedContext={},existingTriggerData=false}){
 assert(!existingTriggerData,'ROOT_MIRROR_EXISTING_GUI_REQUIRES_INCREMENTAL_REPAIR');
 const parsed=readOwnedGuiLibraries(xml,'Map');assert.equal(parsed.size,1,'ROOT_MIRROR_OTHER_GUI_LIBRARIES_REQUIRE_ORDER_PROOF');
 const gui=parsed.get('Map');assert(gui?.implicit,'ROOT_MIRROR_MAP_ROOT_REQUIRED');
 const discovery=inspectSourceGlobalMirrorCandidates({original,exported:nativeExport,guiLibraries:parsed});
 const constantDiscovery=inspectUnusedConstantMirrors({original,exported:nativeExport,guiLibraries:parsed,closedContext});
 assert(!constantDiscovery.reason,'ROOT_MIRROR_CONSTANT_CLOSURE_NOT_VERIFIED:'+constantDiscovery.reason);
 const candidates=[...discovery.candidates,...constantDiscovery.candidates];assert(candidates.length,'ROOT_MIRROR_NO_CANDIDATES');
 const all=[...new Set(Object.values(gui.elements))],source=parse(original,'root-mirror-source'),native=parse(nativeExport,'root-mirror-native');
 const originalIncludes=source.statements.filter(n=>n.kind===K.IncludeStatement).map(n=>printer.printNode(n)),nativeIncludes=native.statements.filter(n=>n.kind===K.IncludeStatement).map(n=>printer.printNode(n));
 assert.deepEqual(nativeIncludes,originalIncludes,'ROOT_MIRROR_INCLUDE_ORDER_CHANGED');
 const scripts=all.filter(e=>e.type==='CustomScript'&&!e.disabled&&!e.initFunc&&!e.flags?.length&&typeof e.scriptCode==='string');
 const includeScripts=scripts.map(e=>({e,ast:parse(e.scriptCode,'root-mirror-includes')})).filter(({ast})=>ast.statements.length&&ast.statements.every(n=>n.kind===K.IncludeStatement));
 assert.equal(includeScripts.length,1,'ROOT_MIRROR_UNIQUE_EXISTING_INCLUDE_SECTION_REQUIRED');const section=includeScripts[0].e;
 const included=includeScripts[0].ast.statements.map(n=>printer.printNode(n)),start=originalIncludes.length-included.length;
 assert(start>=0&&JSON.stringify(originalIncludes.slice(start))===JSON.stringify(included),'ROOT_MIRROR_INCLUDE_SECTION_NOT_ORIGINAL_SUFFIX');
 const firstIndex=native.statements.findIndex(n=>n.kind===K.IncludeStatement&&printer.printNode(n)===included[0]);assert(firstIndex>=0,'ROOT_MIRROR_NATIVE_INCLUDE_SECTION_NOT_FOUND');
 assert.deepEqual(native.statements.slice(firstIndex,firstIndex+included.length).map(n=>n.kind===K.IncludeStatement?printer.printNode(n):null),included,'ROOT_MIRROR_NATIVE_INCLUDE_SECTION_NOT_CONTIGUOUS');
 const bySource=new Map(candidates.map(c=>[c.sourceName,c])),byEmitted=new Map(candidates.map(c=>[c.nativeEmittedName,c]));
 const originals=source.statements.filter(n=>n.kind===K.VariableDeclaration),chosen=originals.filter(n=>bySource.has(n.name.name));assert.equal(chosen.length,candidates.length,'ROOT_MIRROR_SOURCE_DECLARATION_MISSING');
 // Do not move an unselected computed initializer across source declarations.
 for(const n of originals)if(n.initializer&&!bySource.has(n.name.name))assert(literal(n.initializer),'ROOT_MIRROR_UNSELECTED_COMPUTED_INITIALIZER');
 const names=new Set([...bySource.keys(),...byEmitted.keys()]),removedInitializers=new Set();
 for(const statement of native.statements.slice(0,firstIndex)){
  if(statement.kind===K.VariableDeclaration&&byEmitted.has(statement.name.name)){
   const c=byEmitted.get(statement.name.name);
   if(c.representation==='DISABLED_UNUSED_CONSTANT_REFERENCE_ONLY'){
    const originalDecl=chosen.find(n=>n.name.name===c.sourceName);assert(originalDecl?.initializer&&statement.initializer&&printer.printNode(statement.initializer)===printer.printNode(originalDecl.initializer),'ROOT_MIRROR_CONSTANT_INITIALIZER_MISMATCH');
   }else assert(!statement.initializer,'ROOT_MIRROR_NATIVE_GLOBAL_INITIALIZER');
   continue;
  }
  if(statement.kind===K.FunctionDeclaration&&statement.name.name==='InitGlobals'&&statement.body){
   for(const s of statement.body.statements){const a=s.kind===K.ExpressionStatement?s.expression:undefined,c=a?.kind===K.BinaryExpression&&a.operatorToken.kind===K.EqualsToken&&a.left.kind===K.Identifier?byEmitted.get(a.left.name):undefined;
    if(c?.representation==='DISABLED_TYPED_VARIABLE_REFERENCE_ONLY'){
     const originalDecl=chosen.find(n=>n.name.name===c.sourceName);assert(originalDecl?.initializer&&printer.printNode(a.right)===printer.printNode(originalDecl.initializer),'ROOT_MIRROR_INITIALIZER_MISMATCH');
     assert(!removedInitializers.has(c.sourceName),'ROOT_MIRROR_DUPLICATE_INITIALIZER');removedInitializers.add(c.sourceName);continue;
    }
    assert(!containsIdentifier(s,names),'ROOT_MIRROR_GLOBAL_USED_BEFORE_SOURCE_DECLARATION');
   }continue;
  }
  assert(!containsIdentifier(statement,names),'ROOT_MIRROR_GLOBAL_USED_BEFORE_SOURCE_DECLARATION');
 }
 for(const c of candidates)if(c.representation==='DISABLED_TYPED_VARIABLE_REFERENCE_ONLY')assert(removedInitializers.has(c.sourceName),'ROOT_MIRROR_ORIGINAL_INITIALIZER_NOT_REMOVED');
 const parents=new Map();for(const call of all.filter(e=>e.type==='FunctionCall'))for(const p of call.parameters??[]){const k=key(p.library??call.library??'Map',p.type,p.id),rows=parents.get(k)??[];rows.push(call);parents.set(k,rows);}
 const resolveFormal=r=>{const owner=r.library??'Map',lib=owner==='Map'?gui:nativeGui.get(owner);assert(lib,'ROOT_MIRROR_FORMAL_LIBRARY_MISSING');const rows=[...new Set([lib.elements[r.type+':'+r.id],lib.elements[r.id]].filter(e=>e?.type===r.type))];assert.equal(rows.length,1,'ROOT_MIRROR_FORMAL_UNRESOLVED');return rows[0];};
 const affected=new Map(candidates.map(c=>[key(c.gui.library,c.gui.type,c.gui.id),c])),observed=[];
 for(const owner of all)refs(owner,owner,reference=>{const c=affected.get(key(reference.library??owner.library??'Map',reference.type,reference.id));if(!c)return;
  const isParam=owner.type==='Param'&&owner.variable===reference,isCategory=owner.type==='Category'&&(owner.items??[]).includes(reference);
  assert(isParam||isCategory,'ROOT_MIRROR_UNSUPPORTED_GUI_REFERENCE');observed.push({candidate:c,owner,reference,isParam,isCategory});
 });
 for(const item of observed.filter(x=>x.isParam)){
  const p=item.owner,c=item.candidate;assert(p.parameterDef,'ROOT_MIRROR_PARAMETER_FORMAL_REQUIRED');const formal=resolveFormal(p.parameterDef),owner=parents.get(key(p.library??'Map',p.type,p.id))??[];
  assert.equal(owner.length,1,'ROOT_MIRROR_PARAMETER_OWNER_NOT_UNIQUE');assert(!formal.isReference&&!formal.isMultiple,'ROOT_MIRROR_REFERENCE_OR_MULTIPLE_FORMAL');
  const type=formal.paramType?.type;
  if(type==='anyvariable'){
   assert(verifiedStockAssignment&&JSON.stringify(owner[0].functionDef)===JSON.stringify(verifiedStockAssignment.functionDef)&&
    JSON.stringify(p.parameterDef)===JSON.stringify(verifiedStockAssignment.parameterDef),'ROOT_MIRROR_ANY_VARIABLE_NOT_NATIVE_QUALIFIED');
   assert(['trigger','unit'].includes(c.sourceType),'ROOT_MIRROR_ANY_VARIABLE_TYPE_UNPROVED');
  }else assert.equal(type,c.sourceType,'ROOT_MIRROR_FORMAL_TYPE_MISMATCH');
 }
 const initialRoots=[];
 for(const c of candidates){const v=element(gui,c.gui);if(c.representation==='DISABLED_UNUSED_CONSTANT_REFERENCE_ONLY'){
   assert(v.isConstant&&v.initialValue&&c.references.length===0,'ROOT_MIRROR_UNUSED_CONSTANT_GUI_SHAPE');v.disabled=true;
  }else if(c.representation==='DISABLED_TYPED_VARIABLE_REFERENCE_ONLY'){
   if(v.initialValue)initialRoots.push(v.initialValue);v.disabled=true;delete v.initialValue;
  }else{
   assert(c.representation==='DISABLED_TRIGGER_REFERENCE_ONLY');assert(!gui.elements['Trigger:'+v.id],'ROOT_MIRROR_TRIGGER_ID_COLLISION');
   const oldType=v.type,id=v.id,library=v.library??'Map',stem=c.sourceName.slice(c.sourceName.indexOf('gt_')+3);
   for(const k of Object.keys(v))delete v[k];Object.assign(v,{id,type:'Trigger',library,name:stem,identifier:stem,disabled:true,events:[],conditions:[],actions:[],localVariables:[]});
   delete gui.elements[oldType+':'+id];gui.elements['Trigger:'+id]=v;
   for(const item of observed.filter(x=>x.candidate===c)){
    if(item.isCategory)item.reference.type='Trigger';else{delete item.owner.variable;item.owner.valueElement={library,type:'Trigger',id};item.owner.valueType={type:'trigger'};}
   }
  }
 }
 // Remove only newly detached initial-value expression trees, never unrelated
 // pre-existing nodes. Shared descendants stay if any outside reference exists.
 const scope=new Map(),todo=[...initialRoots];while(todo.length){const r=todo.pop();if(!['Param','FunctionCall'].includes(r.type))continue;
  const k=key(r.library??'Map',r.type,r.id);if(scope.has(k))continue;const e=element(gui,r);scope.set(k,e);
  refs(e,e,x=>{if(['Param','FunctionCall'].includes(x.type))todo.push(x);});
 }
 const live=new Set(),pending=[];for(const owner of [...new Set(Object.values(gui.elements))]){
  const ownerKey=key(owner.library??'Map',owner.type,owner.id);if(scope.has(ownerKey))continue;
  refs(owner,owner,r=>{const k=key(r.library??owner.library??'Map',r.type,r.id);if(scope.has(k)&&!live.has(k)){live.add(k);pending.push(k);}});
 }
 while(pending.length){const k=pending.pop(),owner=scope.get(k);refs(owner,owner,r=>{const child=key(r.library??owner.library??'Map',r.type,r.id);if(scope.has(child)&&!live.has(child)){live.add(child);pending.push(child);}});}
 const pruned=[];for(const [k,e]of scope)if(!live.has(k)){for(const name of Object.keys(gui.elements))if(gui.elements[name]===e)delete gui.elements[name];pruned.push({library:e.library??'Map',type:e.type,id:e.id});}
 // Trigger XML writes line endings canonically. Keep every declaration token
 // and comment, but normalize CRLF so serialization round-trips exactly.
 section.scriptCode=section.scriptCode.replace(/\s*$/u,'')+'\n'+chosen.map(n=>original.slice(n.pos,n.end).replace(/\r\n?/gu,'\n').trim()).join('\n')+'\n';
 const expected=[...new Set(Object.values(gui.elements))],afterXml=serializeTriggerLibraryCanonical(gui),after=readOwnedGuiLibraries(afterXml,'Map').get('Map');
 const restored=[...new Set(Object.values(after.elements))],index=new Map(restored.map(e=>[key(e.library??'Map',e.type,e.id),e]));assert.equal(index.size,expected.length,'ROOT_MIRROR_SERIALIZED_ELEMENT_COUNT');
 for(const e of expected){const r=index.get(key(e.library??'Map',e.type,e.id));assert(r&&normalize(r)===normalize(e),'ROOT_MIRROR_SERIALIZED_ELEMENT_CHANGED:'+e.type+':'+e.id);}
 return {triggerData:afterXml,proof:{kind:'EXPERIMENTAL_ROOT_SOURCE_GLOBAL_MIRROR_PREVIEW',originalSha256:sha(original),inputXmlSha256:sha(xml),nativeExportSha256:sha(nativeExport),outputXmlSha256:sha(afterXml),
  candidates:candidates.map(c=>({sourceName:c.sourceName,sourceType:c.sourceType,sourceDeclarationSha256:c.sourceDeclarationSha256,gui:c.gui,representation:c.representation,guiReferences:c.references.length})),
  originalIncludeOrder:originalIncludes,existingSourceSection:section.id,existingSourceSectionReused:true,prunedDetachedExpressionNodes:pruned,guiElementCountBefore:all.length,guiElementCountAfter:restored.length,
  originalSourceOrArchiveChanged:false,newCustomScriptSections:0,newNativeDescriptions:0,newRuntimeWrappers:0,guiOnlyPreview:true,actualEditor:false,completeProgramProved:false,wholeMapAccepted:false,
  requiredFollowup:['Independently validate all GUI types, names, owner references and initial-value tree changes.','Recheck complete original include and global initializer order, including native effects and dynamic name observation.','Compile and export the actual candidate through Editor; run strict whole-program and original-attribute comparison.','Check disabled mirrors are usable in the Editor UI.']}};
}
