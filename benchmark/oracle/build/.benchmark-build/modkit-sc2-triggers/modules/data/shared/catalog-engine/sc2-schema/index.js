export { SchemaRegistry } from './types.js';
export { CATALOG_NAMESPACES, typeToNamespace, isCatalogTypeName } from './namespaces.js';
export { BUILTIN_SCHEMAS, createBuiltinRegistry } from './builtin.js';
export { createLinkRegistry } from './link-registry.js';
export { DATA_CLASS_SCHEMA } from './structure-types/schema.classes.js';
export { EAbilAttackCmd, EAbilBuildCmd, EAbilHarvestCmd, EAbilMoveCmd, EAbilResearchCmd, EAbilStopCmd, EAbilTrainCmd, NAMESPACE_CLASS_MAP, } from './structure-types/schema.enums.js';
// ─── structure-types runtime classes (for schema-driven walkers in @modkitx/ops + wiki coercion) ───
export { CScalar, CNumber, CBoolean, CSObject, CLink, CFile, CString, } from './structure-types/schema.primitives.js';
export { CEnum, CFlags, CTuple, CWTuple, CDTuple, CCTuple, CSTuple, COTuple, CStringArray, CCArray, CSArray, CWArray, CRecord, CObject, CVariator, } from './structure-types/schema.core.js';
export { CStringLink } from './structure-types/schema.links.js';
export { CCatalogReference, CGameContentCreationData, CDataEntryPath, CUserReference, CQuery, CActorKey, CDataSoupKey, CActorMsgPayloadPtr, CRefKey, CActorTerm, CActorTerms, TEditorCategories, } from './structure-types/schema.complex.js';
export { CActorLinks, CActorSiteOps } from './structure-types/schema.types.js';
export { tokenTypeNamespace } from './token-types.js';
export { LINK_CLASS_NAMESPACES } from './structure-types/schema.links.js';
