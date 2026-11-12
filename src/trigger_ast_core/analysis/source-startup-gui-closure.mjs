// Detect a serialization gap: a source-bound SDK capability is not a GUI edge.
// This is an offline risk audit, not an Editor result or an equivalence waiver.
import {referencedLibraries} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {createSourceMapStartupDependencies} from '../../queue_audit_2026-10-15/source-map-startup-dependencies.mjs';

export function auditSourceStartupGuiClosure(source,libraries,nativeLibraryId) {
 const startup=createSourceMapStartupDependencies(source).proof;
 const base={sourceSha256:startup.sourceSha256,editorPerformed:false,accepted:false,
  scope:'Source startup versus serialized enabled GUI references; library side effects are never assumed empty.'};
 const own=[...libraries.values()].filter(l=>l.implicit===true);
 if(!startup.applicable||own.length!==1||!nativeLibraryId||startup.libraryIds[0]!==nativeLibraryId)
  return {...base,status:'UNPROVEN_STARTUP_SHAPE',passed:false,reason:startup.reason??'MAP_OR_NATIVE_IDENTITY_UNPROVEN'};
 const map=own[0],embedded=[...libraries.keys()].filter(id=>id!==map.id);
 const referenced=new Set([nativeLibraryId,...embedded]);
 for(const library of libraries.values())for(const id of referencedLibraries(library))if(id!==map.id)referenced.add(id);
 const declared=startup.libraryIds,missing=declared.filter(id=>!referenced.has(id));
 return {...base,status:missing.length?'SOURCE_STARTUP_NOT_BACKED_BY_GUI_REFERENCES':'SOURCE_STARTUP_GUI_REFERENCES_COVERED',
  passed:missing.length===0,sourceStage:startup.stage,sourceLibraries:declared,
  guiReferencedLibraries:[...referenced].sort(),missingGuiStartupLibraries:missing,
  generatedCapabilityDoesNotProveEditorSerialization:true};
}
