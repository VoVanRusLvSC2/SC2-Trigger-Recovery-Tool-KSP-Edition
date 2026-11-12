import {bindNativeLibraryDeclaration} from "../shared-native-formal-abi/native-library-declaration-binding.mjs";
import {SyntaxKind as NativeBindingK} from "../exact-function-signatures/index-alternate-3.js";
import {declaredCarrier} from "../exact-function-signatures/galaxy-program-context.js";
import {RecoverySession as OriginalRecoverySession} from "./recovery-session-alternate-2.mjs";







import {FunctionCandidateIndex} from "./function-candidates-alternate-4.mjs";







export {recoverySessionFor} from "./recovery-session-alternate-2.mjs";







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







