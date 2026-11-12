import {alignAttributeCallOwners} from './attribute-call-owner-alignment.mjs';

// Compose already verified components without changing the raw verdict. A
// callback rename is usable only with the independent root qualification;
// selector bytes, lexical order and multiplicity are never normalized.
export function qualifyAttributeRuntime({root, native, contract, rootFile}) {
 const owners=alignAttributeCallOwners(native.attributeCalls.original,
  native.attributeCalls.native,root.transforms.sourceBoundTriggerAliases,rootFile);
 const requirements={
  actualNativeCompile:native.actualEditor===true&&native.compiledSuccessfully===true&&native.errorCount===0,
  fullRootEquivalent:root.generatedRootEquivalent===true&&root.comparison?.exact===true&&
   root.sourceOrCandidateChanged===false&&root.benchmarkChanged===false&&native.generatedRootEquivalent===true,
  sdkAndCallbacks:native.sdkPassed===true&&native.callbacks?.status==='PASSED',
  exactSelectorsAfterProvedOwnerBinding:owners.exact===true,
  attributeDocuments:contract.documents?.passed===true&&contract.documents.referenceModelPreserved===true,
  guiCoverage:contract.gui?.passed===true&&contract.gui.coverageComplete===true,
  dependencyOwners:contract.dependencyReferencesPreserved===true&&contract.externalOwnersVerified===true,
 };
 return {kind:'COMPOSED_NATIVE_ATTRIBUTE_RUNTIME_COMPONENT',
  runtimeProved:Object.values(requirements).every(Boolean),requirements,owners,
  fullOriginalLobbyProved:contract.documents?.originalLobbyPreserved===true,
  rawAttributeUseProved:native.attributeUseProved,rawSelectorsExact:native.selectorsExact,
  rawPrimaryVerdict:native.rawPrimaryVerdict,rawAttributeVerdict:native.rawAttributeVerdict,
  rawVerdictsUnchanged:true,benchmarkChanged:false,accepted:false};
}
