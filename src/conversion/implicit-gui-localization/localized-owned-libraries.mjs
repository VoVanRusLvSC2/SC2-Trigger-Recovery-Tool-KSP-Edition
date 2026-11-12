import assert from 'node:assert/strict';
import {readOwnedGuiLibraries} from "./read-owned-gui-libraries-alternate.mjs";
import {readTriggerLibrariesFast} from "./sax-reader-alternate-5.js";

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
