import { TUpgradeEffectValue, CTokenType, CConstType, CNamespaceClassLink, TEditorCategories, CTokenValues, CTokenDefinitions, SEditorCategoriesFields, STokenFields, STokenValueFields } from './schema.complex.js';
import { SUpgradeEffect, SConst } from './schema.struct.js';
import { DATA_CLASS_SCHEMA } from './schema.classes.js';
TUpgradeEffectValue.prototype.dynamic = (data) => data.Reference?.value;
CTokenType.prototype.dynamic = (data, mod) => mod.getTokenType(data.id);
CConstType.prototype.dynamic = (data) => DATA_CLASS_SCHEMA[data.type];
CNamespaceClassLink.prototype.dynamic = (data) => DATA_CLASS_SCHEMA[data.class]?.namespace;
TEditorCategories.prototype.schema = SEditorCategoriesFields;
CTokenValues.prototype.value = STokenFields;
CTokenDefinitions.prototype.value = STokenValueFields;
//# sourceMappingURL=schema.init.js.map