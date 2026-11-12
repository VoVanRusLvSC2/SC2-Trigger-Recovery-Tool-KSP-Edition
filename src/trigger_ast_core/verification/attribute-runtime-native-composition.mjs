// Preserve every existing attribute/document/artifact obligation. A complete
// compiled native root proof supplies the actual callback/runtime premise;
// it does not invent a successful SDK callback receipt or change raw verdicts.
import {composeAttributeRuntimeProof} from './attribute-runtime-proof-composition.mjs';
export function composeNativeAttributeRuntimeProof(input){
 const source=input.sourceGui,native=input.native,root=input.nativeRoot;
 const strict=composeAttributeRuntimeProof({...input,gui:{candidateSha256:source?.candidate?.sha256}});
 const replaced=new Set(['PACKED_GUI_NOT_PROVED','SDK_NOT_PROVED']);
 const issues=strict.issues.filter(i=>!replaced.has(i.kind));
 const need=(ok,kind)=>{if(!ok)issues.push({kind});};
 const a=input.artifacts;
 need(source?.mode==='preserve-source'&&source.passed===true&&source.references?.valid===true&&source.archivePackingVerified===true,'NATIVE_SOURCE_GUI_NOT_PROVED');
 need(source?.candidate?.sha256===a.candidateSha256&&source?.original?.sha256===a.originalArchiveSha256,'NATIVE_SOURCE_GUI_ARTIFACT_MISMATCH');
 need(source?.gui?.kind==='SOURCE_BOUND_GUI_CODE_PROVENANCE'&&source.gui.sourceCodeByteExact===true&&
      source.gui.newRuntimeCode===0&&source.gui.newFallbackCustomScript===0,'NATIVE_SOURCE_GUI_RUNTIME_OR_FALLBACK');
 need(source?.authoredSections?.newNative===0&&source.authoredSections.newRuntimeFunctions===0&&
      source.authoredSections.sourceBodyChanged===false,'NATIVE_AUTHORED_SOURCE_NOT_PRESERVED');
 const descriptions=source?.gui?.authorizedNativeDescriptions,count=source?.gui?.newNative;
 need(Number.isInteger(count)&&count>=0,'NATIVE_DESCRIPTION_COUNT_INVALID');
 if(count>0){
  need(descriptions?.passed===true&&descriptions.newNativeDescriptions===count&&descriptions.records?.length===count&&
       descriptions.newRuntimeFunctions===0&&descriptions.newCustomScript===0&&
       descriptions.inputSha256===a.originalRootSha256&&descriptions.outputXmlSha256===source?.packedTriggersSha256&&
       descriptions.records.every(r=>r.newRuntimeFunctions===0&&r.newCustomScript===0&&r.fullNativeExportAndOracleRequired===true),
       'NATIVE_API_DESCRIPTIONS_NOT_SOURCE_BOUND');
 }
 need(input.sdk?.passed===true&&input.sdk.candidate?.sha256===a.candidateSha256&&
      input.sdk.generated?.sha256===a.generatedRootSha256,'NATIVE_SDK_LANGUAGE_ARTIFACT_NOT_PROVED');
 need(native?.nativeCompilePassed===true&&native.nativeGenerationVerified===true&&native.sourceUnchanged===true&&
      native.actualEditor===true&&native.exportCompleteness?.bytesMatch===true&&native.exportCompleteness.sha256Matches===true&&
      native.exportCompleteness.syntaxValid===true,'ACTUAL_NATIVE_ROOT_COMPILE_NOT_PROVED');
 need(native?.candidateSha256===a.candidateSha256&&native.originalArchiveSha256===a.originalArchiveSha256&&
      native.originalRootSha256===a.originalRootSha256,'ACTUAL_NATIVE_ROOT_ARTIFACT_MISMATCH');
 need(root?.finiteProgramEquivalent===true&&root.comparison?.exact===true&&root.comparison.syntaxValid===true&&
      root.rawOracleReplaced===false&&root.sourceOrExportChanged===false&&root.oracleFilesVerified>0,
      'NATIVE_ROOT_COMPLETE_EQUIVALENCE_NOT_PROVED');
 need(root?.inputSha256?.before===a.originalRootSha256&&root?.inputSha256?.after===native?.nativeRootSha256,
      'NATIVE_ROOT_PROOF_ARTIFACT_MISMATCH');
 return {attributeRuntimeProved:issues.length===0,issues,strictOriginalPremiseResult:strict,
  replacedPremises:['SDK callback receipt by complete original-Editor compile and source-bound native root equivalence',
                    'Strict zero-code GUI by independently verified preserved source and authorized existing-API descriptions'],
  rawAttributeVerdict:input.contract.verdict,rawAttributePassed:input.contract.passed,
  fullOriginalLobbyProved:input.contract.documents?.originalLobbyPreserved===true,
  referenceModelPreserved:input.contract.documents?.referenceModelPreserved===true,
  namespaceRelocationAssumed:false,rawVerdictsUnchanged:true,nativeCompileVerified:native?.nativeCompilePassed===true,
  wholeMapAccepted:false,editorVerified:false,gameplayTested:false};
}
