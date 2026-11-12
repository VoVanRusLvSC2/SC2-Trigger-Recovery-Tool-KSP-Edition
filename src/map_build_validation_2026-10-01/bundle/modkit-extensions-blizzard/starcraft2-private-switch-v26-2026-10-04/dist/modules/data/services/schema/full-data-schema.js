import schemaAsset from './generated/sc2-data-schema.json' with { type: 'json' };
const structureCache = new Map();
function freezeValueDescriptor(raw) {
    const instructionArguments = raw.instructionArguments === undefined
        ? undefined
        : Object.freeze(Object.fromEntries(Object.entries(raw.instructionArguments).map(([keyword, arguments_]) => [
            keyword,
            Object.freeze(arguments_.map(freezeValueDescriptor)),
        ])));
    return Object.freeze({
        ...raw,
        ...(raw.enumMembers === undefined ? {} : { enumMembers: Object.freeze([...raw.enumMembers]) }),
        ...(raw.instructionKeywords === undefined
            ? {}
            : { instructionKeywords: Object.freeze([...raw.instructionKeywords]) }),
        ...(instructionArguments === undefined ? {} : { instructionArguments }),
        ...(raw.instructionFallback === undefined
            ? {}
            : { instructionFallback: freezeValueDescriptor(raw.instructionFallback) }),
        ...(raw.itemDescriptor === undefined
            ? {}
            : { itemDescriptor: freezeValueDescriptor(raw.itemDescriptor) }),
        ...(raw.fieldsRef === undefined ? {} : { structureType: raw.fieldsRef }),
    });
}
export const STARCRAFT2_VALUE_TYPES = Object.freeze(Object.fromEntries(Object.entries(schemaAsset.valueTypes ?? {}).map(([name, descriptor]) => [
    name,
    freezeValueDescriptor(descriptor),
])));
function freezeField(raw, activeStructures = new Set()) {
    const fieldsRef = raw.fieldsRef;
    const semantic = STARCRAFT2_VALUE_TYPES[raw.valueType] ?? freezeValueDescriptor(raw);
    const fields = typeof fieldsRef !== 'string' || fieldsRef.length === 0
        ? undefined
        : materializeStructure(fieldsRef, activeStructures);
    return Object.freeze({
        fieldId: raw.fieldId,
        cardinality: raw.cardinality,
        ...(raw.indexKey === undefined ? {} : { indexKey: raw.indexKey }),
        ...(raw.linkNamespace === undefined ? {} : { linkNamespace: raw.linkNamespace }),
        ...(raw.valueType === undefined ? {} : { valueType: raw.valueType }),
        ...(semantic.valueKind === undefined ? {} : { valueKind: semantic.valueKind }),
        ...(semantic.enumMembers === undefined
            ? {}
            : { enumMembers: Object.freeze([...semantic.enumMembers]) }),
        ...(semantic.enumUnknown === undefined ? {} : { enumUnknown: semantic.enumUnknown }),
        ...(semantic.numberMin === undefined ? {} : { numberMin: semantic.numberMin }),
        ...(semantic.numberMax === undefined ? {} : { numberMax: semantic.numberMax }),
        ...(semantic.numberFloat === undefined ? {} : { numberFloat: semantic.numberFloat }),
        ...(semantic.instructionKeywords === undefined
            ? {}
            : { instructionKeywords: Object.freeze([...semantic.instructionKeywords]) }),
        ...(semantic.instructionArguments === undefined
            ? {}
            : { instructionArguments: semantic.instructionArguments }),
        ...(semantic.instructionDelimiter === undefined
            ? {}
            : { instructionDelimiter: semantic.instructionDelimiter }),
        ...(semantic.instructionListDelimiter === undefined
            ? {}
            : { instructionListDelimiter: semantic.instructionListDelimiter }),
        ...(semantic.instructionFallback === undefined
            ? {}
            : { instructionFallback: semantic.instructionFallback }),
        ...(semantic.itemDescriptor === undefined
            ? {}
            : { itemDescriptor: semantic.itemDescriptor }),
        ...(raw.assetKind === undefined ? {} : { assetKind: raw.assetKind }),
        ...(raw.externalLinkKind === undefined ? {} : { externalLinkKind: raw.externalLinkKind }),
        ...(fieldsRef === undefined ? {} : { structureType: fieldsRef }),
        ...(fields === undefined || fields.length === 0 ? {} : { fields }),
        ...(fieldsRef !== undefined && fields === undefined ? { recursiveStructure: true } : {}),
    });
}
function materializeStructure(structureType, activeStructures) {
    if (activeStructures.has(structureType))
        return undefined;
    const cached = structureCache.get(structureType);
    if (activeStructures.size === 0 && cached !== undefined)
        return cached;
    const source = schemaAsset.structures[structureType];
    if (!Array.isArray(source))
        return undefined;
    const next = new Set(activeStructures);
    next.add(structureType);
    const fields = Object.freeze(source.map(field => freezeField(field, next)));
    if (activeStructures.size === 0)
        structureCache.set(structureType, fields);
    return fields;
}
/**
 * SC2 catalog lists merge by slot: an element without `index` takes the next slot of a running
 * counter that an explicit `index="N"` resets (MK2 `sc2-catalog/merge.ts`). Only these lists
 * append instead (MK2 `sc2-schema/builtin.ts`).
 */
const APPENDING_LIST_FIELDS = new Set(['ActorInfoArray', 'GlossaryStrongArray', 'Aliases']);
/**
 * The resolution shape of a schema field: positional lists become `indexed` slots (marked
 * `positional`) so inheritance merges slot N of a child into slot N of its parent.
 */
export function starcraft2ResolutionField(field) {
    const nested = field.fields?.map(starcraft2ResolutionField);
    const positional = field.cardinality === 'append' && !APPENDING_LIST_FIELDS.has(field.fieldId);
    const nestedChanged = nested !== undefined && nested.some((item, index) => item !== field.fields[index]);
    if (!positional && !nestedChanged)
        return field;
    return Object.freeze({
        ...field,
        ...(positional ? { cardinality: 'indexed', indexKey: 'index', positional: true } : {}),
        ...(nestedChanged ? { fields: Object.freeze(nested) } : {}),
    });
}
/** Materialized fields of a structure type (`SCost`, …), or undefined when it is not a structure. */
export function resolveStarcraft2StructureFields(structureType) {
    return materializeStructure(structureType, new Set());
}
const generatedSchemas = schemaAsset.types.map(type => Object.freeze({
    typeId: type.typeId,
    parentTypeId: type.parentTypeId,
    fields: Object.freeze(type.fields.map(field => freezeField(field))),
}));
export const STARCRAFT2_DATA_SCHEMAS = Object.freeze([
    Object.freeze({ typeId: 'CBase', fields: Object.freeze([]) }),
    ...generatedSchemas,
]);
export const STARCRAFT2_SCHEMA_BY_TYPE = new Map(STARCRAFT2_DATA_SCHEMAS.map(schema => [schema.typeId, schema]));
export const STARCRAFT2_TYPE_NAMESPACES = Object.freeze(Object.fromEntries(schemaAsset.types.map(type => [type.typeId, type.namespace])));
export const STARCRAFT2_DATA_NAMESPACES = Object.freeze([...schemaAsset.namespaces]);
export const STARCRAFT2_CATALOG_FILES = Object.freeze([
    'sc2data.xml',
    ...schemaAsset.catalogFiles.filter(file => file !== 'sc2data.xml'),
]);
export const STARCRAFT2_DATA_SCHEMA_COVERAGE = Object.freeze({ ...schemaAsset.coverage });
export const STARCRAFT2_DATA_SCHEMA_PROVENANCE = Object.freeze({ ...schemaAsset.provenance });
const namespacePrefixes = Object.freeze([...STARCRAFT2_DATA_NAMESPACES].sort((left, right) => right.length - left.length || left.localeCompare(right)));
export function starcraft2NamespaceForType(typeId) {
    const exact = STARCRAFT2_TYPE_NAMESPACES[typeId];
    if (exact !== undefined)
        return exact;
    if (typeof typeId !== 'string' || !/^C[A-Z]/u.test(typeId))
        return undefined;
    const withoutPrefix = typeId.slice(1);
    return namespacePrefixes.find(namespace => withoutPrefix === namespace || withoutPrefix.startsWith(namespace));
}
const resolvedFieldsCache = new Map();
export function resolveStarcraft2SchemaFields(typeId, visiting = new Set()) {
    const cached = resolvedFieldsCache.get(typeId);
    if (cached !== undefined)
        return cached;
    if (visiting.has(typeId))
        throw new TypeError(`SC2 schema inheritance cycle includes ${typeId}`);
    const schema = STARCRAFT2_SCHEMA_BY_TYPE.get(typeId);
    if (schema === undefined)
        return Object.freeze([]);
    const next = new Set(visiting);
    next.add(typeId);
    const values = new Map();
    if (schema.parentTypeId !== undefined) {
        for (const field of resolveStarcraft2SchemaFields(schema.parentTypeId, next)) {
            values.set(field.fieldId, field);
        }
    }
    for (const field of schema.fields)
        values.set(field.fieldId, field);
    const result = Object.freeze([...values.values()]);
    resolvedFieldsCache.set(typeId, result);
    return result;
}
/** Return the nearest schema type that declares a resolved top-level field. */
export function starcraft2DeclaringTypeForField(typeId, fieldId) {
    const visited = new Set();
    let current = STARCRAFT2_SCHEMA_BY_TYPE.get(typeId);
    while (current !== undefined) {
        if (visited.has(current.typeId)) {
            throw new TypeError(`SC2 schema inheritance cycle includes ${current.typeId}`);
        }
        visited.add(current.typeId);
        if (current.fields.some(field => field.fieldId === fieldId))
            return current.typeId;
        current =
            current.parentTypeId === undefined
                ? undefined
                : STARCRAFT2_SCHEMA_BY_TYPE.get(current.parentTypeId);
    }
    return typeId;
}
//# sourceMappingURL=full-data-schema.js.map