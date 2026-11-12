import {RecoverySession as OriginalRecoverySession} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/recovery-session.js';



import {FunctionCandidateIndex} from './function-candidates.mjs';



export {recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/recovery-session.js';



// Preserve the original element-store registry for every imported AST helper.



export class RecoverySession extends OriginalRecoverySession {



  constructor(program,libraries,plan){super(program,libraries,plan);this.candidates=new FunctionCandidateIndex(libraries);}



}



