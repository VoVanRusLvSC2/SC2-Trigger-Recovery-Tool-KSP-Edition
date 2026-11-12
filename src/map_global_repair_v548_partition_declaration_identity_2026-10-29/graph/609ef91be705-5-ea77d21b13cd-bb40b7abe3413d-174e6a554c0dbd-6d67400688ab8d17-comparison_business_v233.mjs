import {normalizeBooleanLogicForms} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/a119333d4fd8-342edeebf75a-251cec0fd48c3abb-boolean_logic_forms_v232.mjs';
import {normalizePrototypeParameterNames} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/ebfcd0c2f3ad-453e0a6328d9-2e91c78f3f69ee70-prototype_parameter_names_v223.mjs';
import {normalizeConstantArrayDimensions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/d55b944ecfb1-fdff8e484c36-968ce8b9ec804ec7-constant_array_dimensions_v218.mjs';
import {normalizeGuardedStartupNoops} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/e4ca0812b20a-45c792ba6451-e2c1bab86a5627cc-guarded_startup_noops_v211.mjs';
import {normalizeImmutableGlobalConstants} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/54d7ce665853-390cfa45550c-63057948729df2a0-immutable_global_constants_v221.mjs';
/** Additional, evidence-bound static comparison. This is NOT Editor evidence.
 * Executable calls, values, public symbols and registration order remain strict.
 */
import {normalizeLeadingInitializers} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/7ff370b65003-3b9c346ee2b5-d5fe6ae67f172746-declaration_initializers_v149.mjs';
import {normalizeLoopCounterBindings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/a515e6a2a496-8fc872253872-b28fe8c1b09978bb-loop_counter_binding_v193.mjs';
import {normalizeControlFlowForms} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/7f4a5f53b673-1e7b0dda720f-3cc40bb533dbf723-control_flow_forms_v159.mjs';
import {normalizePrivateThreadCaptures} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/ccbabb694383-4b283a34ef51-abdf5099decf-526992534cafeb-7b3d4835d804089e-private_thread_captures_v158.mjs';
import {normalizeVerifiedNativeIncludes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/native_include_proof_v205.mjs';
import {compareGalaxyPrograms} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/72b2982f8b7b-c41528f-d642645f44da-0e9133fe7166-3c0b32018a2105-d5ee5d17af60d7-71e2f96ac0263cbb-index.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/ecf43456b87f-index.js';
import {normalizeIndependentOrder} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/steep17_recovery_2026-10-02/independent_order.mjs';
import {normalizeSemanticPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
import {expandLocalScripts} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_autonomous_recovery_v157_2026-10-05/local_scripts.mjs';

export function compareGalaxyBusiness(leftText,rightText,{parseGalaxy,nativeProof,declarations,leftAi=[],rightAi=[]}={}){
 let aiProof;
 try{const a=expandLocalScripts(leftText,leftAi,parseGalaxy),b=expandLocalScripts(rightText,rightAi,parseGalaxy);leftText=a.text;rightText=b.text;aiProof={original:a.proof,generated:b.proof};}
 catch(e){return {equivalent:false,verdict:'INVALID_LOCAL_SCRIPT',error:String(e),editorVerified:false};}
 const left=parseGalaxy(leftText,'original.galaxy'),right=parseGalaxy(rightText,'generated.galaxy');
 if(left.parseDiagnostics.length||right.parseDiagnostics.length)return {equivalent:false,verdict:'INVALID',syntaxErrors:[left.parseDiagnostics.length,right.parseDiagnostics.length],editorVerified:false};
 const strict=compareGalaxyPrograms(left,right,{libraryId:'Map',sampleLimit:40});
 // Recognize compiler machinery before lowering local initializer syntax;
 // that lowering intentionally changes the recognizer's exact callback shape.
 const captures=normalizePrivateThreadCaptures(left,right,K,forEachChild,{foreignCode:declarations});
 const leading=[normalizeLeadingInitializers(captures.original,K,forEachChild),normalizeLeadingInitializers(captures.generated,K,forEachChild)];
 const startup=leading.map(v=>normalizeGuardedStartupNoops(v.source,K,forEachChild,{declarations}));
 const native=startup.map(v=>normalizeVerifiedNativeIncludes(v.source,K,{declarations,nativeProof,parseGalaxy}));
 const flow=native.map(v=>normalizeControlFlowForms(v.source,K,forEachChild));
 const counters=flow.map(v=>normalizeLoopCounterBindings(v.source,K,forEachChild));
 const constants=counters.map(v=>normalizeImmutableGlobalConstants(v.source,K,{declarations,parseGalaxy}));
 const arrays=constants.map(v=>normalizeConstantArrayDimensions(v.source,K,forEachChild,{declarations,parseGalaxy}));
 const prototypes=arrays.map(v=>normalizePrototypeParameterNames(v.source,K));
 const booleans=prototypes.map(v=>normalizeBooleanLogicForms(v.source,K,forEachChild));
 const a=normalizeIndependentOrder(booleans[0].source,K,{nativeIncludesNatives:false}),b=normalizeIndependentOrder(booleans[1].source,K,{nativeIncludesNatives:false});
 let comparison=compareGalaxyPrograms(a.source,b.source,{libraryId:'Map',sampleLimit:40}),forms;
 if(!comparison.exact){forms=normalizeSemanticPair(a.source,b.source,K,forEachChild);comparison=compareGalaxyPrograms(forms.original.source,forms.exported.source,{libraryId:'Map',sampleLimit:40});}
 return {equivalent:comparison.exact,verdict:comparison.exact?'EQUIVALENT_ROOT':'DIFFERENT',strictExact:strict.exact,strict,comparison,aiProof,
  allowedTransforms:{original:[...leading[0].notes,...startup[0].notes,...native[0].notes,...flow[0].notes,...counters[0].notes,...constants[0].notes,...arrays[0].notes,...prototypes[0].notes,...booleans[0].notes,...captures.notes,...a.notes,...(forms?.original.notes??[])],generated:[...leading[1].notes,...startup[1].notes,...native[1].notes,...flow[1].notes,...counters[1].notes,...constants[1].notes,...arrays[1].notes,...prototypes[1].notes,...booleans[1].notes,...b.notes,...(forms?.exported.notes??[])]},
  nativeProof,nativeGraphProof:native.map(v=>v.proof??{refused:v.refused}),privateCaptureForeignSourceProof:captures.foreignSourceProof,
  scope:'Static root plus actual map-owned include bodies; actual foreign source proof. Types, attribute metadata, packed AI compatibility and native compilation are separate gates.',editorVerified:false};
}
