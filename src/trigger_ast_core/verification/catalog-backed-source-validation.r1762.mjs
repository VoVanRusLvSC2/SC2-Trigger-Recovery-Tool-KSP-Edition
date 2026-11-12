import {createNativeGuiSourceInterfaces} from '../bindings/native-gui-source-interfaces.r1752.mjs';
import {validateGalaxyPair} from './galaxy-source-interface-validation.r1752.mjs';

/** A view gets its own exact source-closure witness. Catalog-derived typing
 * never supplies source declarations or evidence of engine API availability. */
export function validateCatalogBackedGalaxy(primary, declarations, installedCatalogs) {
  const interfaces = installedCatalogs?.verifiedCASCCatalogAuthority.files.length
    ? createNativeGuiSourceInterfaces({...installedCatalogs, sourceDocuments:[...declarations, ...primary]})
    : undefined;
  const languageCheck = validateGalaxyPair(primary, declarations, true, interfaces ? {nativeGuiInterfaces:interfaces} : {});
  const needsCatalogApiQualification = (interfaces?.records.length ?? 0) > 0;
  return {languageCheck, interfaces, needsCatalogApiQualification,
    typedSourceDeclarationsComplete: languageCheck.verification.status === 'passed' && !needsCatalogApiQualification,
    catalogApiQualification: needsCatalogApiQualification ? 'NOT_RUN' : 'NOT_NEEDED_FOR_DERIVED_INTERFACES'};
}
