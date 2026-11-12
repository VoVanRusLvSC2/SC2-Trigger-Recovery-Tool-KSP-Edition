// Additive evidence only: preserve the raw per-file oracle verdict verbatim.
// Artifact hashes are measured independently by the archive-reading caller.
export function composeAttributeRuntimeProof({contract, root, artifacts, gui, sdk}) {
 const issues=[],need=(ok,kind)=>{if(!ok)issues.push({kind});};
 need(['originalArchiveSha256','originalRootSha256','generatedRootSha256','candidateSha256','attributesSha256'].every(k=>/^[0-9a-f]{64}$/u.test(artifacts[k]??''))&&typeof artifacts.rootFile==='string'&&artifacts.rootFile.length>0,'MALFORMED_ARTIFACT_IDENTITY');
 need(contract.documents?.passed===true&&contract.documents.referenceModelPreserved===true,'ATTRIBUTE_DOCUMENT_NOT_PROVED');
 need(contract.gui?.passed===true&&contract.gui.coverageComplete===true,'ATTRIBUTE_GUI_NOT_PROVED');
 need(contract.dependencyReferencesPreserved===true&&contract.externalOwnersVerified===true,'ATTRIBUTE_EXTERNAL_OWNER_NOT_PROVED');
 need(gui.preEditorGuiGatePassed===true&&gui.rawCodeFields?.length===0&&gui.syntheticNativeDefinitions?.length===0,'PACKED_GUI_NOT_PROVED');
 need(sdk.passed===true&&sdk.callbacks?.status==='PASSED'&&sdk.candidate?.sha256===artifacts.candidateSha256&&sdk.generated?.sha256===artifacts.generatedRootSha256,'SDK_NOT_PROVED');
 need(root.generatedRootEquivalent===true&&root.comparison?.exact===true&&root.comparison.syntaxValid===true&&
  root.sourceOrCandidateChanged===false&&root.benchmarkChanged===false&&root.benchmarkAssetsVerified>0,'ROOT_NOT_PROVED');
 need(root.sourceSha256===artifacts.originalRootSha256&&root.generatedSha256===artifacts.generatedRootSha256&&
  root.candidateSha256===artifacts.candidateSha256&&gui.candidateSha256===artifacts.candidateSha256,'ROOT_ARTIFACT_MISMATCH');
 need(contract.sourceArchiveSha256===artifacts.originalArchiveSha256&&contract.originalGalaxySha256===artifacts.originalRootSha256&&
  contract.generatedGalaxySha256===artifacts.generatedRootSha256&&contract.packedAttributesSha256===artifacts.attributesSha256,'ATTRIBUTE_ARTIFACT_MISMATCH');
 need(artifacts.originalReferenceByteExact===true&&artifacts.inputPinsVerified===true,'SOURCE_REFERENCE_NOT_PROVED');
 const failed=(contract.runtime?.checks??[]).filter(c=>!c.exact||c.syntaxValid===false),rootFiles=new Set([artifacts.rootFile]);
 need(failed.length>0&&failed.every(c=>rootFiles.has(c.file)&&c.syntaxValid===true),'ATTRIBUTE_CLOSURE_NOT_COVERED');
 const allowedIssue=i=>i.kind==='ATTRIBUTE_PROGRAM_REQUIRES_PROOF'&&rootFiles.has(i.file);
 need((contract.issues??[]).every(allowedIssue)&&(contract.runtime?.issues??[]).every(allowedIssue),'OTHER_ATTRIBUTE_ISSUE');
 const checks=contract.runtime?.checks??[],owned=artifacts.ownedScripts??[];
 need(new Set(checks.map(c=>c.file)).size===checks.length&&
  new Set(owned.map(c=>c.file)).size===owned.length&&
  checks.length===owned.length+1&&checks.every(c=>rootFiles.has(c.file)||owned.some(f=>f.file===c.file&&c.exact===true&&c.syntaxValid===true&&f.beforeSha256===f.afterSha256)),
 'OTHER_OWNED_SCRIPT_NOT_PROVED');
 // Direct selectors remain byte-identical. Relocations and indirect flows need
 // their own proof and are deliberately outside this composition rule.
 const fingerprint=p=>JSON.stringify((p?.calls??[]).map(c=>[c.file,c.api,c.selector,c.indirect]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 for(const side of ['original','candidate']){
  const p=contract.runtime?.[side];
  need(p&&p.issues?.length===0&&p.references?.length===0&&p.calls?.every(c=>!c.indirect&&typeof c.selector==='string'),'ATTRIBUTE_FLOW_NOT_DIRECT');
 }
 need(fingerprint(contract.runtime?.original)===fingerprint(contract.runtime?.candidate),'ATTRIBUTE_SELECTORS_CHANGED');
 return {attributeRuntimeProved:issues.length===0,issues,
  rawAttributeVerdict:contract.verdict,rawAttributePassed:contract.passed,
  referenceModelPreserved:contract.documents?.referenceModelPreserved===true,
  fullOriginalLobbyProved:contract.documents?.originalLobbyPreserved===true,
  sourceBoundRootRequired:true,namespaceRelocationAssumed:false,wholeMapAccepted:false,editorVerified:false};
}
