import {bindNativeLibraryDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/native-library-declaration-binding.mjs';
import {SyntaxKind as NativeBindingK} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';
import {RecoverySession as OriginalRecoverySession} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/4f328c3710a2b421-recovery-session.mjs';







import {FunctionCandidateIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v265_attribute_scalar_codec_2026-10-21/function-candidates.mjs';







export {recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/4f328c3710a2b421-recovery-session.mjs';







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
        const nativeDeclaration = declaration?.kind === NativeBindingK.FunctionDeclaration && !declaration.body && declaration.modifiers?.some(m => m.kind === NativeBindingK.NativeKeyword) && !(this.program.globals.get(name)?.declarations ?? []).some(d => d.body);
        const resolution = nativeDeclaration ? bindNativeLibraryDeclaration(this.candidates, query, rawResolution, ctx.nativeLibrary?.id) : rawResolution;
    if(resolution.status==='AMBIGUOUS')this.record(call,ctx,'UNRESOLVED_OR_AMBIGUOUS','ambiguous-function-candidates',resolution.candidateKeys);
    return resolution;
  }








}







