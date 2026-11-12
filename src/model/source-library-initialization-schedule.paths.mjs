import assert from 'node:assert/strict';
import {logicalSourcePath} from "./source-ownership.mjs";
import {planSourceLibraryInitialization as plan} from "./source-library-initialization-schedule.mjs";
export {readSourceLibraryInitialization} from "./source-library-initialization-schedule.mjs";

// Archive paths are case-insensitive logical identities. Preserve the program's
// own file key, and reject two source views claiming one archive path.
export function planSourceLibraryInitialization(input){
 assert(input.program?.documents instanceof Map&&!input.program.closed,'LIBRARY_SCHEDULE_BOUND_PROGRAM_REQUIRED');
 const owner=logicalSourcePath(input.fileName),matches=[...input.program.documents.keys()].filter(name=>logicalSourcePath(name)===owner);
 assert.equal(matches.length,1,'LIBRARY_SCHEDULE_UNIQUE_LOGICAL_ROOT');
 return plan({...input,fileName:matches[0]});
}
