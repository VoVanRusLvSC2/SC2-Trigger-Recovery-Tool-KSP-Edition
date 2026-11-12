import assert from 'node:assert/strict';
import {createNativeGuiSourceInterfaces} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v523_dependency_document_root_2026-10-29/a09ae916183e-1fa8dfaa9a42-b39cc08931be-a866130f01d6-native-gui-source-interfaces.naming-index.r1820.mjs';
import {validateGalaxyPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v523_dependency_document_root_2026-10-29/6ee1a5b9f0e1-1ce8ab-b640b1613fd2-b282a4600674-galaxy-source-interface-validation.naming-index.r1820.mjs';

/** Optional call-form qualification is supplied by a trusted caller which owns
 * its qualifier instance and authenticated capability. No filesystem evidence,
 * JSON receipts or native execution are authenticated by this dispatcher.
 * Concrete declaration/form coverage never proves current source expressions,
 * source-native declarations, whole-root logic, or a static acceptance gate. */
export function validateCatalogBackedGalaxy(primary, declarations, installedCatalogs, options) {
  const sourceDocuments = [...declarations,...primary];
  const interfaces = installedCatalogs?.verifiedCASCCatalogAuthority.files.length
    ? createNativeGuiSourceInterfaces({...installedCatalogs,sourceDocuments}) : undefined;
  const languageCheck = validateGalaxyPair(primary,declarations,true,interfaces ? {nativeGuiInterfaces:interfaces} : {});
  const needsCatalogApiQualification = (interfaces?.records.length ?? 0) > 0;
  const baseline = {languageCheck,interfaces,needsCatalogApiQualification,
    typedSourceDeclarationsComplete:languageCheck.verification.status === 'passed' && !needsCatalogApiQualification,
    catalogApiQualification:needsCatalogApiQualification ? 'NOT_RUN' : 'NOT_NEEDED_FOR_DERIVED_INTERFACES'};
  const callForms = options?.nativeCatalogCallForms;
  // No evidence and no derived-record cases preserve the previous result shape
  // exactly; an unused qualifier cannot alter ordinary source-only checking.
  if (!needsCatalogApiQualification || callForms?.evidence == null) return baseline;
  assert(typeof callForms.qualifier?.qualify === 'function','TRUSTED_CALL_FORM_QUALIFIER_REQUIRED');
  const coverage = callForms.qualifier.qualify({interfaces,sourceDocuments,evidence:callForms.evidence});
  assert(coverage?.kind === 'NATIVE_CATALOG_CALL_FORM_COVERAGE','CALL_FORM_COVERAGE_REQUIRED');
  assert(coverage.sourceDeclaration === false && coverage.typedSourceDeclarationsComplete === false
    && coverage.exactEngineSignatureProved === false && coverage.fullProof === false
    && coverage.currentSourceNativeCompiled === false,'CALL_FORM_SCOPE_MUST_REMAIN_LIMITED');
  return {...baseline,catalogCallFormCoverage:coverage,
    remainingCatalogApiQualification:coverage.allFreshRecordsCovered
      ? 'CURRENT_SOURCE_EXPRESSION_NATIVE_COMPILE_NOT_RUN' : 'UNCOVERED_CATALOG_INTERFACES',
    currentSourceExpressionsNativeCompiled:false,wholeMapAccepted:false};
}
