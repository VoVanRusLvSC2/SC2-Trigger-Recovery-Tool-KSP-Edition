import assert from 'node:assert/strict';
import {readOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/f98910ad6310-155d45f9a8af-c0d248323679-88f8f88bdc59-0511d3687a2c-read-owned-gui-libraries.mjs';
import {readTriggerLibrariesFast} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/d499e54d8efc-5967f071b663-1c202e4e58b9-738aa3fd7188-sax-reader.js';

// XML does not necessarily contain a script Identifier. Name-based identifiers
// require the packed locale table; falling back to an element ID changes binding.
export async function readLocalizedOwnedGuiLibraries(xml,triggerStrings,implicitLibraryId='Map') {
  assert.equal(typeof triggerStrings,'string','PACKED_TRIGGER_STRINGS_REQUIRED');
  const parsed=readOwnedGuiLibraries(xml,implicitLibraryId),strings=new Map([...parsed.keys()].map(id=>[id,triggerStrings]));
  const loaded=await readTriggerLibrariesFast([parsed],strings),libraries=new Map();
  assert.equal(loaded.size,parsed.size,'LOCALIZED_GUI_LIBRARY_COVERAGE');
  for(const [id,row]of loaded){
    const original=Object.values(parsed.get(id).elements),elements=Object.values(row.library.elements);
    assert.equal(elements.length,original.length,'LOCALIZED_GUI_ELEMENT_COVERAGE');libraries.set(id,row.library);
  }
  return libraries;
}
