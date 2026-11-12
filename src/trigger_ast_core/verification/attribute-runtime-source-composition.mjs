import {composeAttributeRuntimeProof} from './attribute-runtime-proof-composition.mjs';

// The old strict-full-GUI rule remains intact. Preserve-source has a different
// representation proof, reconstructed from original bytes by the archive reader.
// It substitutes ONLY for that representation premise, never for program,
// selector, dependency, SDK, document or artifact-identity checks.
export function composeSourceAttributeRuntimeProof(input) {
  const source=input.sourceGui,gui={candidateSha256:source?.candidate?.sha256};
  const strict=composeAttributeRuntimeProof({...input,gui});
  const issues=strict.issues.filter(i=>i.kind!=='PACKED_GUI_NOT_PROVED');
  const need=(ok,kind)=>{if(!ok)issues.push({kind});};
  need(source?.mode==='preserve-source'&&source.passed===true&&source.archivePackingVerified===true,'SOURCE_GUI_ARCHIVE_NOT_PROVED');
  need(source?.original?.sha256===input.artifacts.originalArchiveSha256&&source?.candidate?.sha256===input.artifacts.candidateSha256,'SOURCE_GUI_ARTIFACT_MISMATCH');
  need(source?.gui?.kind==='SOURCE_BOUND_GUI_CODE_PROVENANCE'&&source.gui.newNative===0&&source.gui.newFallbackCustomScript===0&&source.gui.newRuntimeCode===0,'SOURCE_GUI_NEW_RUNTIME_OR_FALLBACK');
  const proof=source?.authoredSections;
  need(proof?.newNative===0&&proof.newRuntimeFunctions===0&&proof.sourceBodyChanged===false,'AUTHORED_SECTION_NOT_PROVED');
  const records=proof?.records??[],keys=values=>values.map(e=>JSON.stringify([e.library,e.type,e.id])).sort();
  need(records.length>0&&records.every(r=>['ORIGINAL_AUTHORED_SECTION','SOURCE_FUNCTION_CALL_INTERFACE'].includes(r.kind)&&/^[a-f0-9]{64}$/u.test(r.scriptCodeSha256??'')), 'AUTHORED_SECTION_RECORDS_INVALID');
  need(JSON.stringify(keys(records))===JSON.stringify(keys(source?.gui?.sourceSectionElements??[])),'AUTHORED_SECTION_TYPED_IDENTITIES_CHANGED');
  return {...strict,attributeRuntimeProved:issues.length===0,issues,
    strictFullGuiPremiseResult:strict,representationMode:'preserve-source',
    sourceRepresentationProved:!issues.some(i=>/^(SOURCE_GUI_|AUTHORED_SECTION_)/u.test(i.kind)),
    rawVerdictsUnchanged:true,wholeMapAccepted:false,editorVerified:false};
}
