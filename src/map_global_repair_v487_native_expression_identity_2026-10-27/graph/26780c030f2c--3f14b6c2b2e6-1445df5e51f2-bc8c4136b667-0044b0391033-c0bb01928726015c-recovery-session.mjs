import {RecoverySession as OriginalRecoverySession} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/63fa7142cea6--b83fe67fcf37-4c31b5ee2404-77d04ff83b81-1aab20ef3b27-4f328c3710a2b421-recovery-session.mjs';







import {FunctionCandidateIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/388d1648bf28-ab830ad19fe0-02aba04cf088-6c1290b43e6fcc81-function-candidates.mjs';







export {recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/63fa7142cea6--b83fe67fcf37-4c31b5ee2404-77d04ff83b81-1aab20ef3b27-4f328c3710a2b421-recovery-session.mjs';







// Preserve the original element-store registry for every imported AST helper.







export class RecoverySession extends OriginalRecoverySession {







  constructor(program,libraries,plan){super(program,libraries,plan);this.candidates=new FunctionCandidateIndex(libraries);}







}







