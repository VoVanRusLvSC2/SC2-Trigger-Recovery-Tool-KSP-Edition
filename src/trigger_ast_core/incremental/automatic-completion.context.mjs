// Incremental AST lowering. Existing XML is edited by ranges, never reserialized
// wholesale. All decisions come from the complete Galaxy source, not a name list.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function createAutomaticCompletion(c){
const {syntaxShape,printNode,convertUserFunctionBody,xmlTree}=c;
const key=e=>e.type+':'+e.id;
const equal=(a,b)=>isDeepStrictEqual(syntaxShape(a),syntaxShape(b));
function parse(text){const ast=c.parseGalaxySource(text,'incremental.galaxy');assert.equal(ast.parseDiagnostics?.length??0,0,'Galaxy syntax errors');return ast;}
const functions=ast=>new Map(ast.statements.filter(n=>n.kind===142&&n.body).map(n=>[n.name.name,n]));
const signature=n=>({type:syntaxShape(n.type),parameters:Array.from(n.parameters??[],p=>syntaxShape(p)),modifiers:syntaxShape(n.modifiers)});
function refs(v,out=[]){if(Array.isArray(v))v.forEach(x=>refs(x,out));else if(v&&typeof v==='object'){if(v.type&&v.id)out.push(v);else Object.values(v).forEach(x=>refs(x,out));}return out;}

// A checkpoint is an explicit input-source observation, not a reusable conversion
// cache. It is bound to both XML and strings. It avoids mistaking old SDK/Editor
// emission differences for new AI edits. No checkpoint is required for GUI diff.
function checkpoint(xml,strings,galaxy){parse(galaxy);return{xmlSha256:sha(xml),stringsSha256:sha(strings),galaxySha256:sha(galaxy),galaxy};}

async function complete({xml='',strings='',galaxy,libraryId='Map',sourceCheckpoint,options={}}){
 const started=performance.now(),times={},opts={...c.opts,...options,libraryId,triggerStrings:strings};
 const desiredAst=parse(galaxy),desired=functions(desiredAst);
 const existing=xml.trim()?(await c.readAuthoredTriggerDocument(xml,c.sdk,strings)).document:undefined;
 const authored=existing?.libraries.get(libraryId);
 assert(authored||!existing?.libraries.size,'Requested library is absent from a nonempty multi-library document');
 if(!authored||!Object.values(authored.elements).length){
  // Full conversion receives the caller's verified metadata, just as the ordinary entrypoint.
  const result=await c.service.convertGalaxyToTriggers({...opts,script:galaxy,header:''});
  assert(!result.diagnostics?.some(d=>d.severity==='error'),'Full reconstruction failed');
  const verify=await c.service.convertTriggersToGalaxy(result.output.triggerData,{...opts,triggerStrings:result.output.triggerStrings});
  const actual=functions(parse(verify.output.script));
  for(const[name,n]of desired)assert(equal(n,actual.get(name)),'Full reconstruction function is not exact: '+name);
  return{mode:'FULL_REBUILD',xml:result.output.triggerData,strings:result.output.triggerStrings,conversion:result,
   proof:{inputFunctionsAstExact:true,semanticStatus:result.fidelity?.semanticProgram?.status,actualEditorExport:false},timingsMs:{total:performance.now()-started}};
 }
 const t=performance.now(),forward=await c.service.convertTriggersToGalaxy(xml,opts);
 assert(!forward.diagnostics?.some(d=>d.severity==='error'),'Existing GUI cannot be emitted safely');
 const generated=functions(parse(forward.output.script));times.baselineEmission=performance.now()-t;
 let beforeAst=parse(forward.output.script),before=generated;
 if(sourceCheckpoint){
  assert.equal(sourceCheckpoint.xmlSha256,sha(xml),'Checkpoint XML mismatch');
  assert.equal(sourceCheckpoint.stringsSha256,sha(strings),'Checkpoint strings mismatch');
  assert.equal(sourceCheckpoint.galaxySha256,sha(sourceCheckpoint.galaxy),'Checkpoint source mismatch');
  beforeAst=parse(sourceCheckpoint.galaxy);before=functions(beforeAst);
 }
 // Nonfunction definitions (globals, structures, includes) cannot silently be
 // swallowed by a function-only transaction. Preserve or reject them explicitly.
 assert(isDeepStrictEqual(beforeAst.statements.filter(n=>n.kind!==142).map(syntaxShape),desiredAst.statements.filter(n=>n.kind!==142).map(syntaxShape)),
  'Changes to globals/includes/structures require a separate declaration transaction');
 for(const name of before.keys())assert(desired.has(name),'Function deletion requires explicit reference migration: '+name);
 const selected=[...desired].filter(([name,n])=>!before.has(name)||!equal(n,before.get(name))||(!generated.has(name)&&c.core.extractUserFunctionName(name,libraryId)));
 if(!selected.length)return{mode:'UNCHANGED',xml,strings,changes:[],timingsMs:{...times,total:performance.now()-started}};
 const values=Object.values(authored.elements),byKey=new Map(values.map(e=>[key(e),e]));
 // IDs may be reused across element types in authored XML. Give the converter
 // temporary unique keys, then restore original typed identities at commit.
 const temp=new Map(values.map((e,i)=>[key(e),(0x90000000+i).toString(16).toUpperCase()]));
 const undo=new Map(values.map(e=>[temp.get(key(e)),e.id]));
 function remap(v,reverse=false){
  if(Array.isArray(v))return v.map(x=>remap(x,reverse));if(!v||typeof v!=='object')return v;
  const r=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,remap(x,reverse)]));
  if(v.type&&v.id&&(v.library??libraryId)===libraryId){const id=reverse?undo.get(v.id):temp.get(key(v));if(id)r.id=id;}return r;
 }
 const work=remap({...authored,xmlSource:undefined});work.elements=Object.fromEntries(Object.values(work.elements).map(e=>[e.id,e]));
 Object.assign(work,c.xmlTools.normalizeTriggerLibrary(work));
 const all=new Map(c.libraries);all.set(libraryId,work);
 const funcMap=new Map(),globals=new Map(),structures=new Map(),members=new Map(),triggers=new Map(),owned=new Map();
 for(const l of [...c.libraries.values(),authored]){
  const isOwn=l===authored;
  for(const[n,e]of c.core.buildFuncNameToFuncDefMap(l))funcMap.set(n,isOwn?work.elements[temp.get(key(e))]:e);
  for(const e of Object.values(l.elements).filter(e=>e.type==='FunctionDef')){
   const n=c.names.toGalaxyFunctionName(e,{library:l,libId:l.id,nativeLibrary:c.nativeLibrary,allLibraries:c.libraries});
   if(isOwn){owned.set(n,e);funcMap.set(n,work.elements[temp.get(key(e))]);}
  }
  const vs=c.model.globalVariables(l),ns=c.model.globalVariableNames(l.id,vs);
  for(const v of vs)globals.set(ns.get(v.id),{type:'Variable',library:l.id,id:isOwn?temp.get(key(v)):v.id});
  for(const e of Object.values(l.elements))if(e.type==='Structure'){
   const sr={type:'Structure',library:l.id,id:e.id},ref=isOwn?remap(sr):sr;
   structures.set(c.names.structureTypeName(sr,l,c.nativeLibrary,c.libraries),ref);
   for(const vr of e.variables??[]){const v=Object.values(l.elements).find(x=>key(x)===key(vr));members.set(c.core.structureMemberKey(ref.id,c.names.memberVarName(v,l.id),ref.library),isOwn?remap(vr):vr);}
  }else if(e.type==='Trigger')triggers.set(c.names.triggerHandleName(l.id,e),isOwn?remap({type:e.type,library:l.id,id:e.id}):{type:e.type,library:l.id,id:e.id});
 }
 c.core.resetGalaxyToTriggerIdCounter();for(const e of values)c.core.reserveGalaxyToTriggerId(e.id);for(const id of undo.keys())c.core.reserveGalaxyToTriggerId(id);
 const sources=[...c.galaxyDeclarations.map(d=>c.parseGalaxySource(d.text,d.fileName)),desiredAst];
 const constants=new c.GalaxyConstantIndex(sources),external=new Map();
 for(const s of sources)for(const d of s.statements)if(d.kind===142)external.set(d.name.name,Array.from(d.parameters??[],p=>c.core.getTypeName(p.type)));
 const headerCtx={libId:libraryId,elements:work.elements,nativeLibrary:c.nativeLibrary,dependencyLibraries:all,structureByGalaxyTypeName:structures,globalVarByGalaxyName:globals,constants};
 const changes=[],addedDefs=[];
 // Reserve every new function before any body is converted: forward, recursive
 // and mutually recursive calls bind to actual GUI definitions, never wrappers.
 for(const[name,node]of selected){
  let original=owned.get(name),def;
  if(original){
   assert(isDeepStrictEqual(signature(before.get(name)),signature(node)),'Signature migration not yet supported: '+name);
   assert(!original.scriptCode&&!original.flags?.includes('Native'),'Existing native/template definition cannot be replaced as a user body: '+name);
   def=work.elements[temp.get(key(original))];
  }else{
   assert(!before.has(name)||!generated.has(name),'Changed trigger/helper boilerplate requires trigger-aware migration: '+name);
   const stem=c.core.extractUserFunctionName(name,libraryId);assert(stem,'Not an owned user function: '+name);
   const parameters=Array.from(node.parameters??[],p=>{
    const name=p.name.name.replace(/^lp_/u,''),id=c.core.generateId();
    work.elements[id]={type:'ParamDef',id,library:libraryId,name,identifier:name,paramType:c.core.triggerParamTypeFromGalaxyTypeName(c.core.getTypeName(p.type),headerCtx,true)};
    return{type:'ParamDef',library:libraryId,id};
   });
   const type=c.core.getTypeName(node.type)||'void';
   def={type:'FunctionDef',id:c.core.generateId(),library:libraryId,name:stem,identifier:stem,parameters,isFuncAction:type==='void',isFuncCall:type!=='void',returnType:type==='void'?undefined:c.core.triggerParamTypeFromGalaxyTypeName(type,headerCtx)};
   work.elements[def.id]=def;funcMap.set(name,def);addedDefs.push(def);
  }
  changes.push({name,node,original,def});
 }
 const conversionStart=performance.now();
 for(const ch of changes){
  const a=performance.now();
  const body=convertUserFunctionBody(ch.node,ch.def,libraryId,work.elements,funcMap,c.core.buildRoleToSubFuncTypeMap(c.nativeLibrary),globals,
   c.core.buildGalaxyConstToPresetMap(c.nativeLibrary,all),structures,members,c.nativeLibrary,external,undefined,galaxy,triggers,all,constants);
  ch.def.actions=body.actions;ch.def.localVariables=body.localVariables;ch.conversionMs=performance.now()-a;
 }
 times.lowering=performance.now()-conversionStart;
 // Collect new reachable elements. Template Return is rebound to the shipped
 // Return GUI function; no synthetic Native/custom template may leak out.
 const added=new Map(Object.values(work.elements).filter(e=>!undo.has(e.id)).map(e=>[key(e),e]));
 for(const e of added.values())if(e.type==='FunctionCall'){
  const d=added.get('FunctionDef:'+e.functionDef?.id);
  if(d?.scriptCode==='return #PARAM(expression);'){
   const loaded=Object.values(c.nativeLibrary.elements).find(d=>d.type==='FunctionDef'&&d.name==='Return');assert(loaded);
   e.functionDef=c.core.fdRef(loaded);added.get('Param:'+e.parameters[0].id).parameterDef=loaded.parameters[0];
  }
 }
 const keep=new Map();
 function visit(ref){if((ref.library??libraryId)!==libraryId)return;const e=added.get(key(ref));if(!e||keep.has(key(e)))return;keep.set(key(e),e);for(const v of Object.values(e))for(const r of refs(v))visit(r);}
 for(const ch of changes){if(!ch.original)visit(ch.def);for(const r of [...ch.def.actions,...ch.def.localVariables])visit(r);}
 const bad=[...keep.values()].filter(e=>e.scriptCode||e.type==='CustomScript'||e.flags?.includes('Native')||(e.type==='FunctionDef'&&!addedDefs.includes(e)));
 assert.equal(bad.length,0,'Changed functions must lower to real GUI, without synthetic Native or raw code: '+JSON.stringify(bad.map(e=>({type:e.type,id:e.id}))));
 const tree=xmlTree(xml),lib=tree.children.find(n=>n.tag==='Library'&&n.attributes.Id===libraryId);assert(lib);
 const nodes=new Map(lib.children.filter(n=>n.tag==='Element').map(n=>[n.attributes.Type+':'+n.attributes.Id,n]));
 const newElements=[...keep.values()].map(e=>remap(e,true));
 function fragments(elements){
  const data=c.xmlTools.serializeTriggerLibraryCanonical({id:libraryId,items:[],elements:Object.fromEntries(elements.map(e=>[e.id,e])),elementsByType:{}});
  const l=xmlTree(data).children.find(n=>n.tag==='Library');return l.children.filter(n=>n.tag==='Element').map(n=>data.slice(n.start,n.end)).join('\n');
 }
 const edits=[];
 for(const ch of changes)if(ch.original){
  const n=nodes.get(key(ch.original));assert(n);
  // Preserve original metadata, flags, names, formal IDs and comments verbatim.
  for(const child of n.children.filter(n=>['Action','FunctionCall','Variable'].includes(n.tag)))edits.push({start:child.start,end:child.end,text:''});
  const lines=[...ch.def.localVariables.map(r=>['Variable',r]),...ch.def.actions.map(r=>['FunctionCall',r])].map(([tag,r])=>{r=remap(r,true);return`<${tag} Type="${r.type}" Library="${r.library??libraryId}" Id="${r.id}"/>`;});
  edits.push({start:n.closeStart,end:n.closeStart,text:lines.join('\n')+'\n'});
 }
 // New functions live alongside the first changed definition; existing sibling
 // order is unchanged. If there is no changed owner, append to the existing root.
 let folder;
 const oldOwner=changes.find(ch=>ch.original)?.original;
 if(oldOwner)folder=lib.children.find(n=>n.tag==='Element'&&n.attributes.Type==='Category'&&n.children.some(x=>x.tag==='Item'&&x.attributes.Type==='FunctionDef'&&x.attributes.Id===oldOwner.id));
 const parent=folder??lib.children.find(n=>n.tag==='Root');assert(parent);
 if(addedDefs.length)edits.push({start:parent.closeStart,end:parent.closeStart,text:addedDefs.map(d=>`<Item Type="FunctionDef" Library="${libraryId}" Id="${d.id}"/>`).join('\n')+'\n'});
 edits.push({start:lib.closeStart,end:lib.closeStart,text:'\n'+fragments(newElements)+'\n'});
 let output=xml;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))output=output.slice(0,e.start)+e.text+output.slice(e.end);
 // Existing dead body records deliberately remain until a separate ownership
 // sweep; this transaction never deletes a potentially shared authored node.
 const newKeys=new Set(newElements.map(key)),resultNodes=new Map(xmlTree(output).children.find(n=>n.tag==='Library'&&n.attributes.Id===libraryId).children.filter(n=>n.tag==='Element').map(n=>[n.attributes.Type+':'+n.attributes.Id,n]));
 const changedKeys=new Set(changes.filter(ch=>ch.original).map(ch=>key(ch.original)));if(folder&&addedDefs.length)changedKeys.add('Category:'+folder.attributes.Id);
 let unchanged=0;for(const[k,n]of nodes){if(changedKeys.has(k))continue;const b=resultNodes.get(k);assert(b,'Lost original element '+k);assert.equal(output.slice(b.start,b.end),xml.slice(n.start,n.end),'Unrelated XML changed '+k);unchanged++;}
 let outStrings=strings;
 for(const e of newElements)if(['FunctionDef','ParamDef','Variable'].includes(e.type))outStrings+=(outStrings.endsWith('\n')?'':'\n')+`${e.type}/Name/lib_${libraryId}_${e.id}=${e.name}\n`;
 times.injection=performance.now()-conversionStart-times.lowering;
 const v=performance.now(),after=await c.service.convertTriggersToGalaxy(output,{...opts,triggerStrings:outStrings});
 assert(!after.diagnostics?.some(d=>d.severity==='error'),'New GUI forward emission failed');
 const final=functions(parse(after.output.script)),changedNames=new Set(changes.map(ch=>ch.name));
 for(const ch of changes)assert(equal(ch.node,final.get(ch.name)),'Changed function AST is not exact after GUI emission: '+ch.name+'\nINPUT:\n'+printNode(ch.node)+'\nOUTPUT:\n'+(final.has(ch.name)?printNode(final.get(ch.name)):'MISSING'));
 for(const[name,n]of generated)if(!changedNames.has(name))assert(equal(n,final.get(name)),'Unrelated emitted function changed: '+name);
 assert.equal(final.size,generated.size+addedDefs.length,'Unexpected wrapper/initialization function created');
 times.verification=performance.now()-v;times.total=performance.now()-started;
 const wholeSourceDifferences=[...desired].filter(([name,n])=>!equal(n,final.get(name))).map(([name])=>name);
 return{mode:'INCREMENTAL',xml:output,strings:outStrings,forward:after.output,changes:changes.map(ch=>({name:ch.name,kind:ch.original?'MODIFIED':'ADDED',id:remap(ch.def,true).id,conversionMs:ch.conversionMs})),
  proof:{unchangedElementsByteExact:unchanged,originalElements:values.length,addedElements:newKeys.size,unchangedFolderOrdering:true,newNative:0,newRaw:0,newSyntheticWrappers:0,changedFunctionsAstExact:true,unchangedGeneratedFunctionsAstExact:true,wholeSourceDifferences,wholeSourceAstExact:!wholeSourceDifferences.length,actualEditorExport:false},timingsMs:times};
}

return Object.freeze({complete,checkpoint});
}
