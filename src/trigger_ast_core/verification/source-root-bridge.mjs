// Join two independently qualified proofs by actual payload/archive/preparation
// identity. Passing SDK checks for one file must never bless a different root.
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const archivePath = name => String(name).replaceAll('\\','/').toLowerCase();

export function inspectSourceRootBridge({root, source, originalArchiveSha256, preparationSha256}) {
  const issues=[];
  const require=(condition,reason)=>{if(!condition)issues.push(reason);};
  require(root?.id===source?.id && typeof root?.id==='string','SOURCE_ROOT_JOB_MISMATCH');
  require(sha(originalArchiveSha256) && source?.original?.sha256===originalArchiveSha256,'SOURCE_ROOT_ARCHIVE_MISMATCH');
  require(sha(preparationSha256) && source?.preparation?.sha256===preparationSha256 &&
    root?.preparation?.sha256===preparationSha256,'SOURCE_ROOT_PREPARATION_MISMATCH');
  const reference=source?.originalReference;
  require(reference?.status==='ORIGINAL_PAYLOADS_EXACT','ORIGINAL_PAYLOADS_NOT_PROVED');
  const records=reference?.records??[];
  require(records.length>0,'ORIGINAL_PAYLOADS_ABSENT');
  require(records.every(r=>r.exact===true && sha(r.expectedSha256) &&
    r.expectedSha256===r.actualSha256),'ORIGINAL_PAYLOAD_MISMATCH');
  require(new Set(records.map(r=>archivePath(r.path))).size===records.length,'ORIGINAL_PAYLOAD_PATH_AMBIGUOUS');
  const roots=records.filter(r=>['mapscript.galaxy','base.sc2data/mapscript.galaxy'].includes(archivePath(r.path)));
  require(sha(root?.sourceSha256) && roots.length>0 &&
    roots.every(r=>r.actualSha256===root.sourceSha256),'COMPARED_ROOT_NOT_ORIGINAL_PAYLOAD');
  return {passed:issues.length===0,issues,sourceSha256:root?.sourceSha256,
    originalArchiveSha256,preparationSha256,payloadsChecked:records.length,
    scope:'Identity bridge for qualified supplied root/header/owned bytes, not external publication or engine compilation'};
}
