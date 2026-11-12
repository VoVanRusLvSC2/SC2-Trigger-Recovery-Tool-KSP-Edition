import {bindNativeLibraryDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v294_shared_native_formal_abi_2026-10-22/graph/3f2bfb75364e-native-library-declaration-binding.mjs';
import {SyntaxKind as NativeBindingK} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {declaredCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d47b1c49befb-galaxy-program-context.js';
import {RecoverySession as OriginalRecoverySession} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/63fa7142cea6--b83fe67fcf37-4c31b5ee2404-77d04ff83b81-1aab20ef3b27-4f328c3710a2b421-recovery-session.mjs';







import {FunctionCandidateIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/ffe973da2409-9509435a0471-5ebadf13fba0-1ed8433b7367-function-candidates.mjs';







export {recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/63fa7142cea6--b83fe67fcf37-4c31b5ee2404-77d04ff83b81-1aab20ef3b27-4f328c3710a2b421-recovery-session.mjs';







// Preserve the original element-store registry for every imported AST helper.







export class RecoverySession extends OriginalRecoverySession {







  constructor(program,libraries,plan){super(program,libraries,plan);this.candidates=new FunctionCandidateIndex(libraries);}
  resolveCall(call,ctx,guiUse){
    if(guiUse===undefined)return super.resolveCall(call,ctx);
    const name=call.expression?.name;
    if(!name)return {status:'UNRESOLVED',candidateKeys:[],rejected:[]};
    const declaration=this.program.declarationAt(call.expression);
    const query={name,guiUse,ancestor:ctx.structuredAncestorDefinitions??[],...(declaration?.parameters?{declaration:{returnType:declaredCarrier(declaration.type),parameters:declaration.parameters.map(p=>declaredCarrier(p.type))}}:{})};
    const rawResolution = this.candidates.resolve(query);
        const nativeDeclaration = !!this.sourceNativeApis.declaration(call, ctx.nativeLibrary?.id);
        const resolution = nativeDeclaration ? bindNativeLibraryDeclaration(this.candidates, query, rawResolution, ctx.nativeLibrary?.id) : rawResolution;
    if(resolution.status==='AMBIGUOUS')this.record(call,ctx,'UNRESOLVED_OR_AMBIGUOUS','ambiguous-function-candidates',resolution.candidateKeys);
    return resolution;
  }








}







