/**
 * The catalog engine's view of the Data schema. Merge and reference discovery must
 * not choose different schemas depending on the entry point used to open a mod.
 * These records are derived from the same versioned fields as the resolved-data API.
 */
import { SchemaRegistry } from '../../shared/catalog-engine/sc2-schema/types.js';
import { STARCRAFT2_DATA_SCHEMAS, resolveStarcraft2StructureFields, starcraft2ResolutionField, } from './full-data-schema.js';
const structures = new Map();
const fields = new WeakMap();
function fieldView(source) {
    const cached = fields.get(source);
    if (cached !== undefined)
        return cached;
    const resolved = starcraft2ResolutionField(source);
    // CFlags is logically scalar, but SC2 XML patches it as named index/value slots.
    // The raw catalog engine must merge those slots rather than replace the whole flag set.
    const isArray = resolved.valueKind === 'flags' || resolved.cardinality !== 'scalar';
    const view = {
        isArray,
        isLink: resolved.linkNamespace !== undefined,
        ...(resolved.linkNamespace === undefined ? {} : { linkNamespace: resolved.linkNamespace }),
        ...(isArray
            ? {
                arrayMerge: resolved.cardinality === 'append' ? 'append' : 'indexed',
                ...(resolved.cardinality === 'append' ? {} : { indexAttr: resolved.indexKey ?? 'index' }),
            }
            : {}),
    };
    // Resolve recursive structures lazily by identity, without truncating reference paths.
    if (source.structureType !== undefined) {
        Object.defineProperty(view, 'fields', {
            enumerable: true,
            get: () => structureView(source.structureType),
        });
    }
    else if (source.fields !== undefined) {
        view.fields = fieldsView(source.fields);
    }
    fields.set(source, view);
    return Object.freeze(view);
}
function fieldsView(source) {
    return Object.freeze(Object.fromEntries(source.map(field => [field.fieldId, fieldView(field)])));
}
function structureView(typeId) {
    const cached = structures.get(typeId);
    if (cached !== undefined)
        return cached;
    const source = resolveStarcraft2StructureFields(typeId);
    if (source === undefined)
        return undefined;
    const view = fieldsView(source);
    structures.set(typeId, view);
    return view;
}
export const STARCRAFT2_CATALOG_SCHEMAS = Object.freeze(STARCRAFT2_DATA_SCHEMAS.map(schema => Object.freeze({
    name: schema.typeId,
    ...(schema.parentTypeId === undefined ? {} : { parent: schema.parentTypeId }),
    fields: fieldsView(schema.fields),
})));
/** Each catalog may add its own types without mutating another catalog's registry. */
export function createStarcraft2CatalogRegistry() {
    const registry = new SchemaRegistry();
    for (const schema of STARCRAFT2_CATALOG_SCHEMAS)
        registry.register(schema);
    return registry;
}
