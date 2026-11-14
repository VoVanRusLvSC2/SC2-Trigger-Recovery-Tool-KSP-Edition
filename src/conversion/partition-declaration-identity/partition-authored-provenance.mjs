import {
  sameAuthoredSectionSource,
  authoredSectionDeclarationIndex,
} from '../../bindings/authored-section-declaration-identity.mjs';
import assert from 'node:assert/strict';

// Only called with live converter-owned scopes after the child frontier check.
// Match the complete authored section and its public ABI against the parent.
export function adoptVerifiedPartitionProvenance(parent, child) {
  if (!child.plan.length) return { adopted: 0 };
  assert(
    parent?.active &&
      child.frontierProof?.kind === 'EXACT_ACTUAL_AUTHORED_GUI_FRONTIER' &&
      child.frontierProof.selectedSections === child.plan.length,
    'PARTITION_FRONTIER_REQUIRED',
  );
  const matched = [];
  for (const section of child.plan) {
    const candidates = parent.plan.filter((p) => sameAuthoredSectionSource(p, section));
    assert.equal(candidates.length, 1, 'PARTITION_SOURCE_SECTION_MISMATCH');
    matched.push(candidates[0]);
  }
  const pending = [];
  for (const [identity, record] of child.records) {
    if (record.kind === 'ORIGINAL_AUTHORED_SECTION')
      assert(
        matched.some(
          (s) =>
            s.library === record.library &&
            s.sha256 === record.sectionSha256 &&
            s.code.replace(/\r\n?/gu, '\n') === record.code.replace(/\r\n?/gu, '\n'),
        ),
        'PARTITION_RAW_SOURCE_MISMATCH',
      );
    else if (record.kind === 'SOURCE_FUNCTION_CALL_INTERFACE')
      assert.equal(
        matched.filter(
          (s) =>
            s.library === record.library &&
            authoredSectionDeclarationIndex(s).has(record.sourceFunction),
        ).length,
        1,
        'PARTITION_INTERFACE_SOURCE_MISMATCH',
      );
    else throw new Error('PARTITION_UNSUPPORTED_RECORD_KIND');
    const prior = parent.records.get(identity);
    assert(
      !prior || JSON.stringify(prior) === JSON.stringify(record),
      'PARTITION_GUI_IDENTITY_COLLISION',
    );
    pending.push([identity, record]);
  }
  assert(pending.length > 0, 'PARTITION_NO_VERIFIED_GUI_RECORDS');
  for (const [id, library] of child.dependencyLibraries) {
    const prior = parent.dependencyLibraries.get(id);
    assert(!prior || prior === library, 'PARTITION_DEPENDENCY_COLLISION');
  }
  for (const [id, library] of child.emittedLibraries) {
    const prior = parent.emittedLibraries.get(id);
    assert(!prior || prior === library, 'PARTITION_LIBRARY_COLLISION');
  }
  for (const [identity, record] of pending) parent.records.set(identity, record);
  for (const [id, library] of child.dependencyLibraries)
    parent.dependencyLibraries.set(id, library);
  for (const [id, library] of child.emittedLibraries) parent.emittedLibraries.set(id, library);
  parent.adoptedPartitionRecords = true;
  return {
    adopted: pending.length,
    sections: matched.length,
    ownership: 'EXACT_SECTION_BYTES_AND_ACTUAL_DECLARATION_ABI',
    publicFrontierScopeDependent: true,
    finalParentGuiFrontierStillRequired: true,
  };
}
