import {compareAttributeDocuments,compareAttributePrograms,inspectAttributeGui} from './attribute-contract.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
/** Additive gate over actual packed components. It cannot turn an older FAIL or
 * REVIEW into success and does not certify Editor or gameplay. */
export async function auditAttributeRecovery(input) {
 const documents=compareAttributeDocuments(input.referenceModel,input.candidateXml,input);
 const gui=inspectAttributeGui({xml:input.triggerXml,parseXml:input.parseXml,schema:input.schema,
   model:input.referenceModel,ownedOwners:input.ownedOwners});
 let oracle;
 const runtime=await compareAttributePrograms(input.originalScripts,input.candidateScripts,{
   apiNames:input.schema.bindings.map(b=>b.apiName),
   compare:async(a,b)=>{oracle??=await openPinnedUserOracle();return oracle.compare(a,b);}
 });
 if(oracle)await oracle.verify();
 const dependencyReferencesPreserved=input.sourceDocumentInfo===input.candidateDocumentInfo;
 const issues=[...documents.issues,...gui.issues,...runtime.issues];
 if(!dependencyReferencesPreserved)issues.push({kind:'ATTRIBUTE_DEPENDENCY_REFERENCES_CHANGED'});
 // Namespaced references not bound to a verified own source stay visible. A
 // whole-script match proves unchanged use, not existence of the external mod.
 const externalOwnersVerified=gui.external.length===0;
 const passed=issues.length===0&&externalOwnersVerified;
 return {passed,verdict:passed?'STATIC_ATTRIBUTE_CONTRACT_PASSED':'ATTRIBUTE_REVIEW_REQUIRED',issues,
   documents,gui,runtime,dependencyReferencesPreserved,externalOwnersVerified,
   benchmark:oracle?{manifestSha256:oracle.manifestSha256,assets:oracle.assets,unchanged:true}:undefined,
   wholeMapAccepted:false,editorVerified:false,namespaceRelocationAssumed:false};
}
