import assert from 'node:assert/strict';
import {analyzeClosedAuthoredUnits} from '../../map_global_repair_v345_explicit_gui_frontier_roles_2026-10-23/graph/ca6c0fc23875-3e-4aa6aa8201a0-f2c268c3cec0-44a196f3a5cf-f70fb373e5c2-closed-authored-units.qualified.mjs';
import {indexGuiEmittedDeclarationFrontier} from '../model/gui-emitted-declaration-frontier.roles.mjs';
const identity=s=>JSON.stringify([s.library,s.fileName,s.sourceSha256,s.sectionSha256??s.sha256,s.start,s.end]);
const scalar=r=>r.storageContract?.status==='EXACT_BOUND_SCALAR_STORAGE'&&['read','write'].includes(r.storageContract.mode);

// Tentative selection is not emission permission. Only the two explicit
// boundary obligations may be deferred; unsupported storage/roles still fail.
export function canDeferAuthoredGuiComponent(component){
 return component.issues.every(issue=>{
  const d=issue.sourceDeclaration;
  return issue.reason==='OUTBOUND_OWNED_SYMBOL_INTERFACE_NOT_PROVED'&&
   ['VariableDeclaration','FunctionDeclaration'].includes(d?.kind)&&d.scopeOwner?.kind==='SourceFile'&&
   typeof d.contentSha256==='string'&&typeof d.declarationSha256==='string';
 })&&component.outsideStorageReferences.every(scalar);
}

// Replay against the final actual typed GUI graph. A provisional snapshot or
// serialized converter receipt is never accepted here as a declaration proof.
export function verifyAuthoredGuiFrontier({input,sections,libraries,carrier}){
 if(!sections.length)return {kind:'EXACT_ACTUAL_AUTHORED_GUI_FRONTIER',selectedSections:0,components:[],wholeMapAccepted:false};
 const frontier=indexGuiEmittedDeclarationFrontier({libraries,implicitLibraryId:input.libraryId??'Map',carrier});
 const sources=[['primary.galaxy',input.script??''],['header.galaxy',input.header??'']].filter(([,text])=>text.trim()).map(([fileName,text])=>({fileName,text}));
 const closure=analyzeClosedAuthoredUnits({sources,declarationSources:input.galaxyDeclarations??[],libraryId:input.libraryId??'Map',guiDeclarationFrontier:frontier});
 const selected=new Set(sections.map(identity));assert.equal(selected.size,sections.length,'AUTHORED_GUI_FRONTIER_DUPLICATE_SECTION');
 const units=new Map(closure.units.map(u=>[u.id,u])),selectedIds=new Set(closure.units.filter(u=>selected.has(identity(u))).map(u=>u.id));
 assert.equal(selectedIds.size,selected.size,'AUTHORED_GUI_FRONTIER_SOURCE_SECTION_CHANGED');
 const components=[];
 for(const c of closure.components){
  if(!c.units.some(id=>selectedIds.has(id)))continue;
  assert(c.units.every(id=>selectedIds.has(id)),'AUTHORED_GUI_FRONTIER_SPLIT_SOURCE_COMPONENT');
  assert(!c.issues.length,'AUTHORED_GUI_FRONTIER_UNPROVED_DECLARATIONS: '+JSON.stringify(c.issues.slice(0,6)));
  assert(c.outsideStorageReferences.every(scalar),'AUTHORED_GUI_FRONTIER_UNPROVED_STORAGE');
  components.push({sections:c.units.map(id=>identity(units.get(id))),
   outboundGuiSites:c.units.reduce((n,id)=>n+units.get(id).outboundGuiBindings.length,0),
   outsideScalarStorageSites:c.outsideStorageReferences.length});
 }
 assert(components.length,'AUTHORED_GUI_FRONTIER_COMPONENT_MISSING');
 return {kind:'EXACT_ACTUAL_AUTHORED_GUI_FRONTIER',selectedSections:selected.size,components,
  newNative:0,newRuntimeFunctions:0,sourceChanged:false,semanticEquivalenceProved:false,wholeMapAccepted:false};
}
