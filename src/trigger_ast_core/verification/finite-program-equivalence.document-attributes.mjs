import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-equivalence.private-counters.guarded.mjs';
import {qualifyDocumentAttributeView} from './document-attribute-selector-view.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');

export async function proveClosedFiniteProgramEquivalence(before, after, options = {}) {
  if (!options.documentAttributes) return previous(before, after, options);
  const oracle = await openPinnedUserOracle(), rawComparison = oracle.compare(before, after);
  const qualified = await qualifyDocumentAttributeView(before, {...options.closedContext, ...options.documentAttributes});
  const result = await previous(qualified.text, after, options);
  await oracle.verify();
  const implementations = [...result.implementations];
  for (const name of ['document-attribute-selector-view.mjs', 'finite-program-equivalence.document-attributes.mjs',
    '../../map_attributes/attribute_identity_context.mjs', '../../map_attributes/attribute_identity.mjs',
    '../../map_attributes/attribute_gui.mjs', '../model/verified-conversion-program.mjs',
    '../passes/owned-include-closure.mjs', '../model/source-ownership.mjs', '../types/string-literal-value.mjs']) {
    const url = new URL(name, import.meta.url);
    implementations.push({path: url.href, sha256: sha(await readFile(url))});
  }
  return {...result, kind: 'DOCUMENT_ATTRIBUTE_IDENTITY_AND_FINITE_PROGRAM_EQUIVALENCE',
    inputSha256: {before: sha(before), after: sha(after)}, rawComparison,
    rawVerdict: rawComparison.exact ? 'MATCH' : rawComparison.syntaxValid ? 'REVIEW' : 'INVALID_SYNTAX',
    documentAttributeSelectorStage: qualified.proof, documentAttributeTierInputSha256: result.inputSha256,
    newEquivalenceRules: (result.newEquivalenceRules ?? 0) + 1, implementations,
    equivalenceScope: 'BUSINESS_PROGRAM_UNDER_VERIFIED_DOCUMENT_ATTRIBUTE_OWNER_IDENTITY',
    fullOriginalLobbyProved: false, sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false};
}
