import {retainedNominalKind,verifyRetainedNominalGui} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/retained-nominal-declarations.mjs';
import {primarySourcePrototypeKind,verifyPrimarySourcePrototypeGui} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/primary-source-prototypes.mjs';
import {passivePrimaryStorageKind,verifyRetainedPrimaryStorageGui} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v490_retained_nominal_storage_2026-10-27/graph/872b2de8e963-34a636d18-cebb439d878b-82e195c30778-edcd5cff34b0-c7747b94dc78-retained-primary-storage.mjs';
import assert from 'node:assert/strict';
import {analyzeClosedAuthoredUnits} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/caa4041c38c0-3e-4aa6aa8201a0-f2c268c3cec0-44a196f3a5cf-f70fb373e5c2-closed-authored-units.qualified.mjs';
import {indexGuiEmittedDeclarationFrontier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/6cf63c9cf7af-c2c76246c174-31626bfbdc6a-gui-emitted-declaration-frontier.roles.mjs';
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
function verifyMarkerAuthoredGuiFrontier({input,sections,libraries,carrier}){
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

// Passive primary storage has a different origin contract from authored-code
// markers. Neither selection path grants permission to the other.
export function verifyAuthoredGuiFrontier({input,sections,libraries,carrier}){
 const passive=sections.filter(s=>s.kind===passivePrimaryStorageKind).map(s=>verifyRetainedPrimaryStorageGui(input,s,libraries));
 const nominal=sections.filter(s=>s.kind===retainedNominalKind).map(s=>verifyRetainedNominalGui(input,s,libraries));
 const authored=verifyMarkerAuthoredGuiFrontier({input,sections:sections.filter(s=>s.kind!==passivePrimaryStorageKind&&s.kind!==primarySourcePrototypeKind&&s.kind!==retainedNominalKind),libraries,carrier});
 const prototypes=verifyPrimarySourcePrototypeGui(input,sections,libraries);
 return {...authored,selectedSections:sections.length,sourcePrototypes:prototypes,passivePrimaryStorage:passive,retainedNominalDeclarations:nominal,semanticEquivalenceProved:false,wholeMapAccepted:false};
}
