import assert from 'node:assert/strict';
import {createNativeGuiSourceInterfaces} from '../bindings/native-gui-source-interfaces.r1752.mjs';
import {validateGalaxyPair} from './galaxy-source-interface-validation.r1752.mjs';

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
