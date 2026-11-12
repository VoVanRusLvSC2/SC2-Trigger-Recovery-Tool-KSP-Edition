import { parseXml } from '@rgrove/parse-xml';
import * as dataSdk from '@modkit/sdk/data';
import { openStarcraft2DataSource, openStarcraft2SubjectCalculationsSource, openStarcraft2SubjectFactsSource, } from '../projections/data-sources.js';
import { resolveStarcraft2SchemaFields, resolveStarcraft2StructureFields, starcraft2NamespaceForType, starcraft2ResolutionField, STARCRAFT2_CATALOG_FILES, STARCRAFT2_DATA_SCHEMAS, STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, STARCRAFT2_SCHEMA_BY_TYPE, } from '../schema/full-data-schema.js';
import { normalizeStarcraft2ResolvedSnapshot } from './resolved-data-normalization.js';
import { applyStarcraft2StructureDefaults, isStarcraft2StructureDefaultTag, mergeStructureDefault, starcraft2StructureDefaultNamespace, } from './struct-defaults.js';
import { EMPTY_EDITOR_CATEGORIES, mergeEditorCategories, parseEditorCategories, } from '../../shared/catalog-engine/sc2-editor-core/editor-categories-runtime.js';
import { planStarcraft2DataEdit, planStarcraft2GraphIsolation, resolveStarcraft2DataEditTarget, } from '../editing/edit-target.js';
import { analyzeStarcraft2GraphIsolation } from '../editing/graph-isolation.js';
export { STARCRAFT2_DATA_SCHEMA_REVISION } from '../schema/data-schema-identity.js';
export { STARCRAFT2_DATA_NAMESPACES, STARCRAFT2_DATA_SCHEMAS, STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, STARCRAFT2_TYPE_NAMESPACES, } from '../schema/full-data-schema.js';
const ANALYZER_ID = 'blizzard.starcraft2.data';
const GAME_ID = 'blizzard/starcraft-2';
const { DATA_CATALOG_ANALYSIS_CONTRACT, RESOLVED_DATA_WORKSPACE_CONTRACT, resolveDataCatalog } = dataSdk;
const resolveDataAuthoringIndex = Reflect.get(dataSdk, 'resolveDataAuthoringIndex');
const MAXIMUM_DOCUMENTS = 16_384;
const MAXIMUM_TEXT_BYTES = 536_870_912;
const MAXIMUM_DOCUMENT_BYTES = 67_108_864;
const MAXIMUM_ENTITIES = 100_000;
const MAXIMUM_DEPTH = 256;
const MAXIMUM_QUERIES = 256;
const MAXIMUM_LOCALIZATION_DOCUMENTS = 256;
const MAXIMUM_LOCALES = 8;
const MAXIMUM_LOCALIZATION_KEYS = 10_000;
const MAXIMUM_REQUIREMENTS = 16_384;
const MAXIMUM_PAGE_SIZE = 1_000;
const MAXIMUM_SNAPSHOTS = 4;
const MAXIMUM_AUTHORING_INDEX_BYTES = 48 * 1_024 * 1_024;
const MAXIMUM_AUTHORING_INDEX_CACHE_BYTES = 64 * 1_024 * 1_024;
const PRIORITY_CATALOG_FILES = Object.freeze([
    'sc2data.xml',
    'abildata.xml',
    'actordata.xml',
    'behaviordata.xml',
    'buttondata.xml',
    'effectdata.xml',
    'unitdata.xml',
    // Placed units' and doodads' footprints: what a map preview draws as blocked ground.
    'footprintdata.xml',
    'upgradedata.xml',
    'weapondata.xml',
    'modeldata.xml',
    'lightdata.xml',
    'terraindata.xml',
    'terraintexdata.xml',
    'waterdata.xml',
    'cliffdata.xml',
    'cliffdoodaddata.xml',
    'cliffmeshdata.xml',
    'terrainobjectdata.xml',
    'texturedata.xml',
]);
const CATALOG_FILES = STARCRAFT2_CATALOG_FILES;
const EDITOR_CATEGORIES_PATH = 'base.sc2data/editordata/editorcategories.xml';
/** Canonical schemas in their resolution shape (positional lists as indexed slots). */
const RESOLUTION_SCHEMAS = Object.freeze(STARCRAFT2_DATA_SCHEMAS.map(schema => Object.freeze({ ...schema, fields: Object.freeze(schema.fields.map(starcraft2ResolutionField)) })));
const SCHEMA_BY_TYPE = STARCRAFT2_SCHEMA_BY_TYPE;
const encoder = new TextEncoder();
const projectionFacet = contract => Object.freeze({ contract, major: 1 });
const LIVE_DEFINITION_FACETS = Object.freeze([
    projectionFacet('common.view/tree-data-source'),
    projectionFacet('common.view/table-data-source'),
    projectionFacet('common.view/relation-graph-source'),
]);
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function nonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
}
function positiveLimit(value, label, maximum) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
        throw new TypeError(`${label} must be a positive safe integer no greater than ${maximum}`);
    }
    return value;
}
function normalizeLogicalPath(value, label) {
    nonEmptyString(value, label);
    if (value.includes('\0') || /^[a-z]:[\\/]/iu.test(value) || /^[\\/]/u.test(value)) {
        throw new TypeError(`${label} must be a confined logical path`);
    }
    const parts = [];
    for (const part of value.replace(/\\/gu, '/').split('/')) {
        if (part === '' || part === '.')
            continue;
        if (part === '..')
            throw new TypeError(`${label} must not escape its workspace root`);
        parts.push(part.toLowerCase());
    }
    if (parts.length === 0)
        throw new TypeError(`${label} must name a logical path`);
    return parts.join('/');
}
function isEditorCategoriesDocument(document) {
    return document.path.replaceAll('\\', '/').toLowerCase().endsWith(EDITOR_CATEGORIES_PATH);
}
function editorCategoriesMetadata(data) {
    if (data.categories.size === 0 && data.objectUsage.size === 0)
        return undefined;
    const categories = Object.freeze(Object.fromEntries([...data.categories.entries()].map(([name, values]) => [name, Object.freeze([...values])])));
    const objectUsage = Object.freeze(Object.fromEntries([...data.objectUsage.entries()].map(([namespace, usage]) => [
        namespace,
        Object.freeze({
            objects: Object.freeze(usage.objects.map(item => Object.freeze({ ...item }))),
            fields: Object.freeze(usage.fields.map(item => Object.freeze({ ...item }))),
        }),
    ])));
    return Object.freeze({
        starcraft2: Object.freeze({
            editorCategories: Object.freeze({ categories, objectUsage }),
        }),
    });
}
function withOwnerMetadata(value, ownerMetadata) {
    return ownerMetadata === undefined || value.ownerMetadata === ownerMetadata
        ? value
        : Object.freeze({ ...value, ownerMetadata });
}
function localeId(value, label) {
    nonEmptyString(value, label);
    if (!/^[a-z]{2}(?:[-_]?[a-z]{2})?$/iu.test(value)) {
        throw new TypeError(`${label} must be a bounded language or language-region id`);
    }
    const normalized = value.replace(/[-_]/gu, '');
    return normalized.length === 2
        ? normalized.toLowerCase()
        : `${normalized.slice(0, 2).toLowerCase()}${normalized.slice(2).toUpperCase()}`;
}
function validateWorkspacePlanRequest(request) {
    const value = recordOf(request);
    if (value === undefined)
        throw new TypeError('workspace data plan request must be an object');
    const workspace = recordOf(value.workspace);
    if (workspace === undefined || workspace.schemaVersion !== 1) {
        throw new TypeError('workspace data plan requires a ModWorkspaceLock v1');
    }
    if (workspace.gameId !== GAME_ID) {
        throw new TypeError(`StarCraft II data planning cannot inspect ${String(workspace.gameId)}`);
    }
    if (workspace.complete !== true) {
        throw new TypeError('workspace data plan requires a complete ModWorkspaceLock');
    }
    nonEmptyString(workspace.workspaceId, 'workspace.workspaceId');
    if (!Array.isArray(workspace.loadOrder) || !Array.isArray(workspace.sources)) {
        throw new TypeError('workspace data plan requires immutable loadOrder and sources');
    }
    const logicalRoots = Array.isArray(workspace.logicalRoots)
        ? workspace.logicalRoots
        : [...workspace.loadOrder].reverse();
    if (!Array.isArray(value.locales) ||
        value.locales.length === 0 ||
        value.locales.length > MAXIMUM_LOCALES) {
        throw new TypeError(`locales must contain between one and ${MAXIMUM_LOCALES} entries`);
    }
    const locales = value.locales.map((locale, index) => localeId(locale, `locales[${index}]`));
    if (new Set(locales).size !== locales.length)
        throw new TypeError('locales must be unique');
    const maxRequirements = positiveLimit(value.maxRequirements, 'maxRequirements', MAXIMUM_REQUIREMENTS);
    const rootIds = new Set();
    for (const [index, root] of workspace.loadOrder.entries()) {
        const item = recordOf(root);
        if (item === undefined)
            throw new TypeError(`workspace.loadOrder[${index}] must be an object`);
        nonEmptyString(item.rootId, `workspace.loadOrder[${index}].rootId`);
        normalizeLogicalPath(item.sourcePath, `workspace.loadOrder[${index}].sourcePath`);
        if (rootIds.has(item.rootId))
            throw new TypeError(`workspace root ${item.rootId} is duplicated`);
        rootIds.add(item.rootId);
    }
    const logicalRootIds = logicalRoots.map(root => root?.rootId);
    const logicalRootSet = new Set(logicalRootIds);
    if (logicalRoots.length !== workspace.loadOrder.length ||
        logicalRootSet.size !== logicalRoots.length ||
        logicalRootIds.some(rootId => !rootIds.has(rootId)) ||
        [...rootIds].some(rootId => !logicalRootSet.has(rootId))) {
        throw new TypeError('workspace.logicalRoots must contain exactly the loadOrder roots');
    }
    return { workspace, logicalRoots, locales, maxRequirements };
}
export async function planStarcraft2DataWorkspace(request) {
    request.signal?.throwIfAborted();
    const { workspace, logicalRoots, locales, maxRequirements } = validateWorkspacePlanRequest(request);
    const planned = [];
    const localizationRequirementCount = locales.length * logicalRoots.length;
    const fullCatalogRequirementCount = workspace.loadOrder.length * (CATALOG_FILES.length + 1);
    const fullCatalogCoverage = fullCatalogRequirementCount + localizationRequirementCount <= maxRequirements;
    const catalogFiles = fullCatalogCoverage
        ? CATALOG_FILES
        : PRIORITY_CATALOG_FILES;
    for (const root of workspace.loadOrder) {
        const rootPath = normalizeLogicalPath(root.sourcePath, `${root.rootId}.sourcePath`);
        for (const file of catalogFiles) {
            planned.push(Object.freeze({
                requirementId: `catalog:${root.rootId}:${file}`,
                rootId: root.rootId,
                path: `${rootPath}/base.sc2data/gamedata/${file}`,
                kind: 'catalog',
                required: false,
            }));
        }
        planned.push(Object.freeze({
            requirementId: `editor-categories:${root.rootId}`,
            rootId: root.rootId,
            path: `${rootPath}/${EDITOR_CATEGORIES_PATH}`,
            kind: 'catalog',
            required: false,
        }));
    }
    // Locale priority is stronger than root priority; within one locale lookup is winner-first.
    for (const locale of locales) {
        for (const root of logicalRoots) {
            const rootPath = normalizeLogicalPath(root.sourcePath, `${root.rootId}.sourcePath`);
            planned.push(Object.freeze({
                requirementId: `localization:${locale}:${root.rootId}`,
                rootId: root.rootId,
                path: `${rootPath}/${locale.toLowerCase()}.sc2data/localizeddata/gamestrings.txt`,
                kind: 'localization',
                locale,
                required: false,
            }));
        }
    }
    const truncated = planned.length > maxRequirements;
    const requirements = Object.freeze(planned.slice(0, maxRequirements));
    return Object.freeze({
        schemaVersion: 1,
        workspaceId: workspace.workspaceId,
        gameId: workspace.gameId,
        analyzerId: ANALYZER_ID,
        requirements,
        diagnostics: Object.freeze([
            ...(fullCatalogCoverage
                ? []
                : [
                    Object.freeze({
                        severity: 'warning',
                        code: 'blizzard.starcraft2/data-plan-full-catalog-budget-unavailable',
                        message: `full catalog planning needs ${fullCatalogRequirementCount + localizationRequirementCount} requirements; the ${maxRequirements}-requirement budget uses EditorCategories.xml, the official sc2data.xml bootstrap and ${PRIORITY_CATALOG_FILES.length - 1} Product-GA gameplay/render priority catalogs per root`,
                    }),
                ]),
            ...(truncated
                ? [
                    Object.freeze({
                        severity: 'error',
                        code: 'blizzard.starcraft2/data-plan-truncated',
                        message: `workspace data plan requires ${planned.length} reads but maxRequirements is ${maxRequirements}`,
                    }),
                ]
                : []),
        ]),
        complete: !truncated,
    });
}
function validateRequest(request) {
    const value = recordOf(request);
    if (value === undefined)
        throw new TypeError('catalog analysis request must be an object');
    nonEmptyString(value.workspaceId, 'workspaceId');
    if (value.gameId !== GAME_ID) {
        throw new TypeError(`StarCraft II catalog analysis cannot inspect ${String(value.gameId)}`);
    }
    const maxDocuments = positiveLimit(value.maxDocuments, 'maxDocuments', MAXIMUM_DOCUMENTS);
    const maxTextBytes = positiveLimit(value.maxTextBytes, 'maxTextBytes', MAXIMUM_TEXT_BYTES);
    positiveLimit(value.maxEntities, 'maxEntities', MAXIMUM_ENTITIES);
    positiveLimit(value.maxDepth, 'maxDepth', MAXIMUM_DEPTH);
    if (!Array.isArray(value.documents) || value.documents.length > maxDocuments) {
        throw new TypeError(`documents must be an array with at most maxDocuments (${maxDocuments}) entries`);
    }
    if (!Array.isArray(value.queries) || value.queries.length > MAXIMUM_QUERIES) {
        throw new TypeError(`queries must be an array with at most ${MAXIMUM_QUERIES} entries`);
    }
    const localizationDocuments = value.localizationDocuments ?? [];
    if (!Array.isArray(localizationDocuments) ||
        localizationDocuments.length > MAXIMUM_LOCALIZATION_DOCUMENTS) {
        throw new TypeError(`localizationDocuments must contain at most ${MAXIMUM_LOCALIZATION_DOCUMENTS} entries`);
    }
    const locales = value.locales ?? [];
    if (!Array.isArray(locales) || locales.length > MAXIMUM_LOCALES) {
        throw new TypeError(`locales must contain at most ${MAXIMUM_LOCALES} entries`);
    }
    const normalizedLocales = locales.map((locale, index) => localeId(locale, `locales[${index}]`));
    if (new Set(normalizedLocales).size !== normalizedLocales.length) {
        throw new TypeError('locales must be unique');
    }
    const localizationKeys = value.localizationKeys ?? [];
    if (!Array.isArray(localizationKeys) ||
        localizationKeys.length > MAXIMUM_LOCALIZATION_KEYS ||
        !localizationKeys.every(key => typeof key === 'string' && key.length > 0)) {
        throw new TypeError(`localizationKeys must contain at most ${MAXIMUM_LOCALIZATION_KEYS} non-empty strings`);
    }
    let totalBytes = 0;
    const validateDocument = (document, index, label) => {
        const item = recordOf(document);
        if (item === undefined)
            throw new TypeError(`${label}[${index}] must be an object`);
        nonEmptyString(item.rootId, `${label}[${index}].rootId`);
        nonEmptyString(item.path, `${label}[${index}].path`);
        if (typeof item.text !== 'string')
            throw new TypeError(`${label}[${index}].text must be a string`);
        const size = encoder.encode(item.text).byteLength;
        if (size > MAXIMUM_DOCUMENT_BYTES) {
            throw new TypeError(`${label}[${index}] exceeds ${MAXIMUM_DOCUMENT_BYTES} bytes`);
        }
        totalBytes += size;
        return item;
    };
    value.documents.forEach((document, index) => validateDocument(document, index, 'documents'));
    localizationDocuments.forEach((document, index) => {
        const item = validateDocument(document, index, 'localizationDocuments');
        localeId(item.locale, `localizationDocuments[${index}].locale`);
    });
    if (totalBytes > maxTextBytes) {
        throw new TypeError(`document text exceeds maxTextBytes (${totalBytes} > ${maxTextBytes})`);
    }
    value.queries.forEach((query, index) => {
        const item = recordOf(query);
        if (item === undefined)
            throw new TypeError(`queries[${index}] must be an object`);
        nonEmptyString(item.namespace, `queries[${index}].namespace`);
        nonEmptyString(item.entityId, `queries[${index}].entityId`);
    });
    if (value.snapshotId !== undefined)
        nonEmptyString(value.snapshotId, 'snapshotId');
    return {
        ...value,
        localizationDocuments,
        locales: normalizedLocales,
        localizationKeys,
    };
}
function elementChildren(node) {
    return (node.children ?? []).filter(child => child.type === 'element');
}
function entityTokens(element) {
    const tokens = [];
    for (const child of element.children ?? []) {
        if (child.type !== 'pi' || child.name !== 'token')
            continue;
        try {
            const parsed = parseXml(`<token ${child.content ?? ''}/>`);
            const token = parsed.children?.find(item => item.type === 'element');
            const id = token?.attributes?.id;
            if (typeof id !== 'string' || id.length === 0)
                continue;
            const type = token.attributes?.type;
            const value = token.attributes?.value;
            tokens.push(Object.freeze({
                id,
                ...(typeof type === 'string' ? { type } : {}),
                ...(typeof value === 'string' ? { value } : {}),
            }));
        }
        catch {
            // A malformed processing instruction must not discard the surrounding catalog entity.
        }
    }
    return Object.freeze(tokens);
}
const ENTITY_METADATA_ATTRIBUTES = new Set(['id', 'parent', 'default']);
function entityFieldElements(element) {
    const attributeFields = Object.entries(element.attributes ?? {})
        .filter(([name]) => !ENTITY_METADATA_ATTRIBUTES.has(name))
        .map(([name, value]) => ({
        type: 'element',
        name,
        attributes: { value: String(value) },
        children: [],
    }));
    return [...attributeFields, ...elementChildren(element)];
}
/**
 * Slot of a repeated field element. Positional lists follow the SC2 running index: a bare element
 * takes the next slot and an explicit numeric `index="N"` resets the counter to N + 1. Other
 * repeated fields keep their plain occurrence count.
 */
function nextOccurrence(counters, child, field) {
    const current = counters.get(child.name) ?? 0;
    const explicit = child.attributes?.[field.indexKey ?? 'index'];
    const slot = field.positional === true && explicit !== undefined && /^\d+$/u.test(String(explicit))
        ? Number(explicit)
        : current;
    counters.set(child.name, slot + 1);
    return slot;
}
function attributeValue(value) {
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
        const number = Number(value);
        if (Number.isFinite(number))
            return number;
    }
    return value;
}
function structuredValue(element, field, depth, maxDepth) {
    if (depth > maxDepth)
        throw new RangeError(`catalog XML exceeds nested field depth ${maxDepth}`);
    const ignored = new Set([field.indexKey ?? 'index', 'removed']);
    const attributes = Object.fromEntries(Object.entries(element.attributes ?? {})
        .filter(([key]) => !ignored.has(key))
        .map(([key, value]) => [key, attributeValue(String(value))]));
    const nestedSchemas = new Map((field.fields ?? []).map(item => [item.fieldId, item]));
    const nested = {};
    const occurrences = new Map();
    for (const child of elementChildren(element)) {
        const childSchema = nestedSchemas.get(child.name);
        if (childSchema === undefined)
            continue;
        const occurrence = nextOccurrence(occurrences, child, childSchema);
        const value = fieldValue(child, childSchema, occurrence, depth + 1, maxDepth);
        if (childSchema.cardinality === 'append' || childSchema.cardinality === 'indexed') {
            const current = Array.isArray(nested[child.name]) ? nested[child.name] : [];
            current.push(value);
            nested[child.name] = current;
        }
        else {
            nested[child.name] = value;
        }
    }
    const combined = { ...attributes, ...nested };
    const keys = Object.keys(combined);
    if (keys.length === 1 && keys[0] === 'value')
        return combined.value;
    if (keys.length > 0)
        return combined;
    const text = typeof element.text === 'string' ? element.text.trim() : '';
    return text.length > 0 ? text : '';
}
function fieldValue(element, field, occurrence, depth, maxDepth) {
    const value = structuredValue(element, field, depth, maxDepth);
    if (field.cardinality !== 'indexed')
        return value;
    const indexKey = field.indexKey ?? 'index';
    const explicit = element.attributes?.[indexKey];
    const removed = element.attributes?.removed;
    return {
        [indexKey]: explicit === undefined ? String(occurrence) : String(explicit),
        value,
        ...(removed === '1' || removed === 'true' ? { removed: true } : {}),
    };
}
function inferField(fieldId, elements, depth, maxDepth) {
    if (depth > maxDepth)
        throw new RangeError(`catalog XML exceeds inferred schema depth ${maxDepth}`);
    const indexed = elements.some(element => element.attributes?.index !== undefined);
    const nestedElements = elements.flatMap(element => elementChildren(element));
    const nested = inferFields(nestedElements, depth + 1, maxDepth);
    return Object.freeze({
        fieldId,
        cardinality: indexed ? 'indexed' : elements.length > 1 ? 'append' : 'scalar',
        ...(indexed ? { indexKey: 'index' } : {}),
        ...(nested.length === 0 ? {} : { fields: nested }),
        unverified: true,
    });
}
function inferFields(elements, depth, maxDepth) {
    if (depth > maxDepth)
        throw new RangeError(`catalog XML exceeds inferred schema depth ${maxDepth}`);
    const grouped = new Map();
    for (const element of elements) {
        const current = grouped.get(element.name) ?? [];
        current.push(element);
        grouped.set(element.name, current);
    }
    return Object.freeze([...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([fieldId, values]) => inferField(fieldId, values, depth, maxDepth)));
}
function mergeFieldShape(canonical, inferred, fieldPath, unverifiedFields, depth, maxDepth) {
    if (depth > maxDepth)
        throw new RangeError(`catalog schema exceeds nested field depth ${maxDepth}`);
    if (canonical === undefined) {
        unverifiedFields.add(fieldPath);
        return inferred;
    }
    // Blizzard serializes flag sets as repeated `<Field index="Flag" value="0|1"/>` entries even
    // though the generated type schema describes the logical value as one flags field. Preserve the
    // wire-level index during patch merge; collapsing it to a scalar loses which flag was changed.
    const effectiveCanonical = canonical.valueKind === 'flags' && inferred.cardinality === 'indexed'
        ? Object.freeze({ ...canonical, cardinality: 'indexed', indexKey: inferred.indexKey ?? 'index' })
        : canonical;
    const canonicalNested = new Map((effectiveCanonical.fields ?? []).map(field => [field.fieldId, field]));
    const inferredNested = new Map((inferred.fields ?? []).map(field => [field.fieldId, field]));
    if (inferredNested.size === 0)
        return effectiveCanonical;
    const mergedNested = [];
    for (const fieldId of new Set([...canonicalNested.keys(), ...inferredNested.keys()])) {
        const known = canonicalNested.get(fieldId);
        const discovered = inferredNested.get(fieldId);
        if (discovered === undefined)
            mergedNested.push(known);
        else {
            mergedNested.push(mergeFieldShape(known, discovered, `${fieldPath}.${fieldId}`, unverifiedFields, depth + 1, maxDepth));
        }
    }
    return Object.freeze({
        ...effectiveCanonical,
        fields: Object.freeze(mergedNested
            .filter(field => field !== undefined)
            .sort((left, right) => left.fieldId.localeCompare(right.fieldId))),
    });
}
function parseFieldsForEntity(typeId, elements, unverifiedFields, maxDepth) {
    return parseFieldsForShape(typeId, resolveStarcraft2SchemaFields(typeId).map(starcraft2ResolutionField), elements, unverifiedFields, maxDepth);
}
function parseFieldsForShape(typeId, canonicalFields, elements, unverifiedFields, maxDepth) {
    const canonical = new Map(canonicalFields.map(field => [field.fieldId, field]));
    const inferred = inferFields(elements, 0, maxDepth);
    const parsed = new Map(canonical);
    const extensions = new Map();
    for (const field of inferred) {
        const known = canonical.get(field.fieldId);
        const merged = mergeFieldShape(known, field, `${typeId}.${field.fieldId}`, unverifiedFields, 0, maxDepth);
        parsed.set(field.fieldId, merged);
        if (known === undefined || merged !== known)
            extensions.set(field.fieldId, merged);
    }
    return { fields: Object.freeze([...parsed.values()]), extensions };
}
function parseEntity(element, schema, namespace, source, syntheticId, unverifiedFields, maxDepth) {
    const declaredId = element.attributes?.id;
    const entityId = typeof declaredId === 'string' && declaredId.length > 0 ? declaredId : syntheticId;
    // SC2 catalogs serialize many scalar fields directly on the entity declaration, notably
    // CWater material properties. Project them through the same schema-driven field parser as
    // child elements; a later child spelling remains the deterministic winner for scalar fields.
    const children = entityFieldElements(element);
    const parsing = parseFieldsForEntity(schema.typeId, children, unverifiedFields, maxDepth);
    const fieldSchemas = new Map(parsing.fields.map(field => [field.fieldId, field]));
    const fields = {};
    const occurrences = new Map();
    for (const child of children) {
        const field = fieldSchemas.get(child.name);
        if (field === undefined)
            throw new TypeError(`${schema.typeId}.${child.name} was not inferred`);
        const occurrence = nextOccurrence(occurrences, child, field);
        const value = fieldValue(child, field, occurrence, 0, maxDepth);
        if (field.cardinality === 'append' || field.cardinality === 'indexed') {
            const current = Array.isArray(fields[child.name]) ? fields[child.name] : [];
            current.push(value);
            fields[child.name] = current;
        }
        else {
            fields[child.name] = value;
        }
    }
    const parent = element.attributes?.parent;
    const defaultValue = element.attributes?.default;
    const tokens = entityTokens(element);
    return Object.freeze({
        namespace,
        typeId: schema.typeId,
        entityId,
        ...(typeof parent === 'string' && parent.length > 0 ? { parentEntityId: parent } : {}),
        fields: Object.freeze(fields),
        source: Object.freeze(source),
        schemaExtensions: parsing.extensions,
        synthetic: declaredId === undefined || declaredId.length === 0,
        defaultTemplate: defaultValue === '1' || defaultValue === 'true',
        ...(tokens.length === 0 ? {} : { tokens }),
    });
}
/** Layer each catalog's structure defaults under its resolved entities (lowest precedence). */
function withStructureDefaults(snapshot, structureDefaults) {
    if (structureDefaults.size === 0)
        return snapshot;
    const apply = entity => {
        const byType = structureDefaults.get(entity.namespace);
        if (byType === undefined)
            return entity;
        const fields = applyStarcraft2StructureDefaults(entity.typeId, entity.entityId, entity.fields, structureType => byType.get(structureType)?.value, { wrapsIndexed: true });
        return fields === entity.fields ? entity : Object.freeze({ ...entity, fields: Object.freeze(fields) });
    };
    return Object.freeze({
        ...snapshot,
        ...(snapshot.definitions === undefined ? {} : { definitions: Object.freeze(snapshot.definitions.map(apply)) }),
        ...(snapshot.entities === undefined ? {} : { entities: Object.freeze(snapshot.entities.map(apply)) }),
    });
}
/** Lowest synthetic deltas used by the compact index before parent and authored values. */
function authoringStructureDefaultPatches(patches, structureDefaults) {
    if (structureDefaults.size === 0)
        return [];
    const entities = new Map();
    for (const patch of patches) {
        entities.set(`${patch.namespace}\0${patch.entityId}`, patch);
    }
    const defaults = [];
    for (const patch of entities.values()) {
        const byType = structureDefaults.get(patch.namespace);
        if (byType === undefined)
            continue;
        const fields = applyStarcraft2StructureDefaults(patch.typeId, patch.entityId, {}, structureType => byType.get(structureType)?.value, { wrapsIndexed: true });
        if (Object.keys(fields).length === 0)
            continue;
        const source = [...byType.values()].at(-1)?.source ?? patch.source;
        defaults.push(Object.freeze({
            namespace: patch.namespace,
            typeId: patch.typeId,
            entityId: patch.entityId,
            fields: Object.freeze(fields),
            source,
        }));
    }
    return Object.freeze(defaults);
}
function parseDocument(document, documentIndex, signal, maxDepth) {
    signal?.throwIfAborted();
    if (/<!DOCTYPE|<!ENTITY/iu.test(document.text)) {
        throw new TypeError(`${document.path}: DTD and custom entities are forbidden`);
    }
    const parsed = parseXml(document.text);
    const root = parsed.children?.find(child => child.type === 'element');
    if (root === undefined)
        throw new TypeError(`${document.path}: XML root element is missing`);
    const patches = [];
    const schemaExtensions = new Map();
    const unverifiedTypes = new Set();
    const unverifiedFields = new Set();
    const unsupportedElements = new Set();
    let anonymousEntities = 0;
    const diagnostics = [];
    const seen = new Set();
    const structureDefaults = [];
    const constants = [];
    const rootElements = elementChildren(root);
    for (const [elementIndex, element] of rootElements.entries()) {
        signal?.throwIfAborted();
        const source = {
            rootId: document.rootId,
            path: document.path,
            documentIndex,
            ...(document.revision === undefined ? {} : { revision: document.revision }),
        };
        if (element.name === 'const' && typeof element.attributes?.id === 'string' && typeof element.attributes?.value === 'string') {
            constants.push([element.attributes.id, element.attributes.value]);
            continue;
        }
        if (isStarcraft2StructureDefaultTag(element.name)) {
            const namespace = starcraft2StructureDefaultNamespace(document.path, rootElements.map(item => item.name));
            if (namespace === undefined)
                unsupportedElements.add(element.name);
            else {
                // Same wire-shape inference as entity fields (flags spelled as indexed entries).
                const parsing = parseFieldsForShape(element.name, resolveStarcraft2StructureFields(element.name).map(starcraft2ResolutionField), entityFieldElements(element), unverifiedFields, maxDepth);
                structureDefaults.push({
                    namespace,
                    structureType: element.name,
                    value: structuredValue(element, { fields: parsing.fields }, 0, maxDepth),
                    source: Object.freeze(source),
                });
            }
            continue;
        }
        const canonicalSchema = SCHEMA_BY_TYPE.get(element.name);
        const namespace = starcraft2NamespaceForType(element.name);
        if (namespace === undefined) {
            unsupportedElements.add(element.name);
            continue;
        }
        if (canonicalSchema === undefined)
            unverifiedTypes.add(element.name);
        const schema = canonicalSchema ??
            Object.freeze({ typeId: element.name, parentTypeId: 'CBase', fields: Object.freeze([]) });
        const patch = parseEntity(element, schema, namespace, {
            ...source,
        }, `@default:${element.name}:${documentIndex}:${elementIndex}`, unverifiedFields, maxDepth);
        if (patch.synthetic)
            anonymousEntities += 1;
        const key = `${patch.namespace}\0${patch.entityId}`;
        if (seen.has(key)) {
            diagnostics.push(Object.freeze({
                severity: 'error',
                code: 'blizzard.starcraft2/catalog-id-duplicate',
                message: `${document.path} declares ${patch.namespace}/${patch.entityId} more than once`,
                namespace: patch.namespace,
                typeId: patch.typeId,
                entityId: patch.entityId,
                source: patch.source,
            }));
        }
        seen.add(key);
        const extensions = schemaExtensions.get(patch.typeId) ?? new Map();
        for (const [fieldId, field] of patch.schemaExtensions)
            extensions.set(fieldId, field);
        schemaExtensions.set(patch.typeId, extensions);
        patches.push(Object.freeze({
            namespace: patch.namespace,
            typeId: patch.typeId,
            entityId: patch.entityId,
            ...(patch.parentEntityId === undefined ? {} : { parentEntityId: patch.parentEntityId }),
            fields: patch.fields,
            source: patch.source,
            ...(patch.defaultTemplate ? { defaultTemplate: true } : {}),
            ...(patch.tokens === undefined ? {} : { tokens: patch.tokens }),
            ...(patch.synthetic ? { synthetic: true } : {}),
        }));
    }
    return {
        patches,
        structureDefaults,
        constants,
        schemaExtensions,
        unverifiedTypes,
        unverifiedFields,
        unsupportedElements,
        anonymousEntities,
        diagnostics,
    };
}
function combineSchemaField(left, right) {
    if (left === undefined)
        return right;
    const leftNested = new Map((left.fields ?? []).map(field => [field.fieldId, field]));
    for (const field of right.fields ?? []) {
        leftNested.set(field.fieldId, combineSchemaField(leftNested.get(field.fieldId), field));
    }
    const cardinality = left.cardinality === 'indexed' || right.cardinality === 'indexed'
        ? 'indexed'
        : left.cardinality === 'append' || right.cardinality === 'append'
            ? 'append'
            : 'scalar';
    return Object.freeze({
        ...right,
        ...left,
        cardinality,
        ...(cardinality === 'indexed' ? { indexKey: left.indexKey ?? right.indexKey ?? 'index' } : {}),
        ...(leftNested.size === 0
            ? {}
            : {
                fields: Object.freeze([...leftNested.values()].sort((a, b) => a.fieldId.localeCompare(b.fieldId))),
            }),
    });
}
function mergeSchemaExtensions(target, incoming) {
    for (const [typeId, fields] of incoming) {
        const current = target.get(typeId) ?? new Map();
        for (const [fieldId, field] of fields) {
            current.set(fieldId, combineSchemaField(current.get(fieldId), field));
        }
        target.set(typeId, current);
    }
}
function effectiveSchemas(extensions) {
    const schemas = [];
    for (const canonical of RESOLUTION_SCHEMAS) {
        const additions = extensions.get(canonical.typeId);
        if (additions === undefined || additions.size === 0) {
            schemas.push(canonical);
            continue;
        }
        const fields = new Map(canonical.fields.map(field => [field.fieldId, field]));
        for (const [fieldId, field] of additions) {
            fields.set(fieldId, combineSchemaField(fields.get(fieldId), field));
        }
        schemas.push(Object.freeze({
            ...canonical,
            fields: Object.freeze([...fields.values()].sort((a, b) => a.fieldId.localeCompare(b.fieldId))),
        }));
    }
    for (const [typeId, additions] of extensions) {
        if (SCHEMA_BY_TYPE.has(typeId))
            continue;
        schemas.push(Object.freeze({
            typeId,
            parentTypeId: 'CBase',
            fields: Object.freeze([...additions.values()].sort((a, b) => a.fieldId.localeCompare(b.fieldId))),
        }));
    }
    return Object.freeze(schemas);
}
function resolvedFieldsForSchemas(typeId, schemas, visiting = new Set()) {
    if (visiting.has(typeId))
        throw new TypeError(`SC2 effective schema cycle includes ${typeId}`);
    const schema = schemas.get(typeId);
    if (schema === undefined)
        return Object.freeze([]);
    const next = new Set(visiting);
    next.add(typeId);
    const fields = new Map();
    if (schema.parentTypeId !== undefined) {
        for (const field of resolvedFieldsForSchemas(schema.parentTypeId, schemas, next)) {
            fields.set(field.fieldId, field);
        }
    }
    for (const field of schema.fields)
        fields.set(field.fieldId, field);
    return Object.freeze([...fields.values()]);
}
function addResolvedFieldSources(snapshot, patches) {
    const patchesByEntity = new Map();
    for (const patch of patches) {
        const key = `${patch.namespace}\0${patch.entityId}`;
        const current = patchesByEntity.get(key) ?? [];
        current.push(patch);
        patchesByEntity.set(key, current);
    }
    const enrich = entity => {
        const fieldSources = {};
        for (const ref of entity.inheritanceChain ?? []) {
            for (const patch of patchesByEntity.get(`${ref.namespace}\0${ref.entityId}`) ?? []) {
                for (const fieldId of Object.keys(patch.fields))
                    fieldSources[fieldId] = patch.source;
            }
        }
        return Object.freeze({
            ...entity,
            fieldSources: Object.freeze(fieldSources),
        });
    };
    return Object.freeze({
        ...snapshot,
        ...(snapshot.definitions === undefined
            ? {}
            : { definitions: Object.freeze(snapshot.definitions.map(enrich)) }),
        entities: Object.freeze(snapshot.entities.map(enrich)),
    });
}
/** Anonymous class defaults are implicit parents, not unrelated catalog entries. Keep them in
 * the common resolver so indexed removals, field provenance and dependency order still apply. */
function withClassDefaultParents(patches, schemas) {
    const defaults = new Map(), entities = new Map();
    for (const patch of patches) {
        const key = `${patch.namespace}\0${patch.entityId}`;
        const entity = entities.get(key) ?? { typeId: patch.typeId, parent: undefined };
        entity.typeId = patch.typeId;
        entity.parent ??= patch.parentEntityId;
        entities.set(key, entity);
        if (patch.synthetic && patch.defaultTemplate) {
            const values = defaults.get(patch.typeId) ?? [];
            values.push(patch);
            defaults.set(patch.typeId, values);
        }
    }
    const nearest = typeId => {
        const seen = new Set();
        while (typeId !== undefined && !seen.has(typeId)) {
            seen.add(typeId);
            const value = defaults.get(typeId)?.at(-1);
            if (value !== undefined)
                return value.entityId;
            typeId = schemas.get(typeId)?.parentTypeId;
        }
        return undefined;
    };
    return patches.map(patch => {
        const entity = entities.get(`${patch.namespace}\0${patch.entityId}`);
        if (entity.parent !== undefined)
            return patch;
        let parent;
        if (patch.synthetic && patch.defaultTemplate) {
            const values = defaults.get(patch.typeId);
            const previous = values[values.indexOf(patch) - 1];
            parent = previous?.entityId ?? nearest(schemas.get(patch.typeId)?.parentTypeId);
        }
        else if (!patch.synthetic)
            parent = nearest(entity.typeId);
        return parent === undefined ? patch : Object.freeze({ ...patch, parentEntityId: parent });
    });
}
function expandCatalogConstants(value, constants, depth = 0) {
    if (typeof value === 'string') {
        return value.replace(/\$[A-Za-z_][A-Za-z0-9_]*/gu, name => {
            const replacement = constants.get(name);
            if (replacement === undefined)
                return name;
            if (depth >= 16)
                throw new RangeError('catalog constant expansion exceeds depth budget');
            return expandCatalogConstants(replacement, constants, depth + 1);
        });
    }
    if (Array.isArray(value))
        return value.map(item => expandCatalogConstants(item, constants, depth));
    if (recordOf(value) !== undefined)
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandCatalogConstants(item, constants, depth)]));
    return value;
}
function parseLocalizationDocument(document, documentIndex) {
    const locale = localeId(document.locale, `localizationDocuments[${documentIndex}].locale`);
    const patches = [];
    const diagnostics = [];
    const seen = new Set();
    const source = Object.freeze({
        rootId: document.rootId,
        path: document.path,
        documentIndex,
        ...(document.revision === undefined ? {} : { revision: document.revision }),
    });
    for (const [lineIndex, line] of document.text.split(/\r\n|\n|\r/u).entries()) {
        if (line.trim() === '' || /^\s*(?:#|\/\/)/u.test(line))
            continue;
        const equals = line.indexOf('=');
        if (equals <= 0) {
            diagnostics.push(Object.freeze({
                severity: 'warning',
                code: 'blizzard.starcraft2/localization-line-malformed',
                message: `${document.path}:${lineIndex + 1} has no non-empty key before '='`,
                source,
            }));
            continue;
        }
        const key = line.slice(0, equals).trim();
        if (key.length === 0 || key.includes('\0')) {
            diagnostics.push(Object.freeze({
                severity: 'warning',
                code: 'blizzard.starcraft2/localization-key-refused',
                message: `${document.path}:${lineIndex + 1} has an invalid localization key`,
                source,
            }));
            continue;
        }
        if (seen.has(key)) {
            diagnostics.push(Object.freeze({
                severity: 'error',
                code: 'blizzard.starcraft2/localization-key-duplicate',
                message: `${document.path} declares localization key ${key} more than once`,
                fieldId: key,
                source,
            }));
            continue;
        }
        seen.add(key);
        patches.push(Object.freeze({ locale, key, value: line.slice(equals + 1), source }));
    }
    return { patches, diagnostics };
}
function collectLocalizationValues(value, field, keys) {
    if (field.linkNamespace === '') {
        if (typeof value === 'string' && value.length > 0)
            keys.add(value);
        if (Array.isArray(value)) {
            for (const item of value)
                collectLocalizationValues(item, field, keys);
        }
    }
    if (field.fields === undefined)
        return;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
        const record = recordOf(item);
        if (record === undefined)
            continue;
        const nested = recordOf(record.value) ?? record;
        for (const child of field.fields) {
            if (nested[child.fieldId] !== undefined) {
                collectLocalizationValues(nested[child.fieldId], child, keys);
            }
        }
    }
}
function localizationKeysFromPatches(patches, schemas) {
    const keys = new Set();
    for (const patch of patches) {
        const schema = schemas.get(patch.typeId);
        if (schema === undefined)
            continue;
        const fields = new Map(resolvedFieldsForSchemas(patch.typeId, schemas).map(field => [field.fieldId, field]));
        for (const [fieldId, value] of Object.entries(patch.fields)) {
            const field = fields.get(fieldId);
            if (field !== undefined)
                collectLocalizationValues(value, field, keys);
        }
    }
    return keys;
}
function hashText(value) {
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= BigInt(value.charCodeAt(index));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, '0');
}
function snapshotIdentity(value) {
    const source = [
        value.snapshotId ?? '',
        value.workspaceId,
        ...value.documents.flatMap(document => [
            document.rootId,
            document.path,
            document.revision ?? '',
            hashText(document.text),
        ]),
        ...value.localizationDocuments.flatMap(document => [
            document.locale,
            document.rootId,
            document.path,
            document.revision ?? '',
            hashText(document.text),
        ]),
    ].join('\0');
    return `provider-token:sc2-data-${hashText(source)}`;
}
function projectionEvidence(value, snapshotId, catalogDocuments, localizationDocuments, unresolvedRequirements) {
    const adapter = Object.freeze({ id: ANALYZER_ID, version: '1.1.0' });
    const projectionPlan = Object.freeze({
        adapter,
        subjectRevision: snapshotId,
        facets: Object.freeze(LIVE_DEFINITION_FACETS.map(ref => Object.freeze({ ref, state: 'published' }))),
    });
    const projectionReceipt = Object.freeze({
        form: 'local',
        adapter,
        subjectRevision: snapshotId,
        companions: Object.freeze([]),
        basis: Object.freeze({
            handedness: 'right',
            upAxis: 'z',
            forwardAxis: '-y',
            unit: 'source-unit',
            sourceUnit: 'sc2-game-unit',
        }),
        planes: Object.freeze([
            Object.freeze({
                planeId: 'schema',
                state: 'normalized',
                note: `${STARCRAFT2_DATA_SCHEMA_COVERAGE.typeCount} native catalog schema types across ${STARCRAFT2_DATA_SCHEMA_COVERAGE.namespaceCount} namespaces from ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.legacySchemaCommit}; ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.digest}`,
            }),
            Object.freeze({
                planeId: 'effective-definitions',
                state: catalogDocuments === 0 ? 'lost' : 'normalized',
                note: `${catalogDocuments} ordered native catalog document(s); ${unresolvedRequirements} planned resource(s) unresolved`,
            }),
            Object.freeze({
                planeId: 'localization',
                state: localizationDocuments === 0 ? 'lost' : 'normalized',
                note: localizationDocuments === 0
                    ? 'no requested localization resource resolved'
                    : `${localizationDocuments} winner-first localization document(s); values may use an explicitly recorded locale fallback`,
            }),
            Object.freeze({
                planeId: 'relations',
                state: 'normalized',
                note: `${STARCRAFT2_DATA_SCHEMA_COVERAGE.linkFieldCount} generated typed link declarations normalize to relation edges, including explicit dead targets`,
            }),
        ]),
        evidence: Object.freeze([
            Object.freeze({
                kind: 'observed',
                statement: `${catalogDocuments} catalog and ${localizationDocuments} localization document(s) parsed through a revision-pinned workspace snapshot`,
            }),
            Object.freeze({
                kind: 'declared',
                statement: `schema provenance is pinned to legacy repository ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.legacyRepositoryCommit} and schema source ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.legacySchemaCommit}`,
            }),
        ]),
        confidence: unresolvedRequirements === 0 ? 'high' : 'partial',
    });
    return { projectionPlan, projectionReceipt };
}
async function analyzeStarcraft2DataInternal(request, includeWorkspaceFacets, authoringIndex = false) {
    request.signal?.throwIfAborted();
    const value = validateRequest(request);
    if (authoringIndex) {
        positiveLimit(value.maxOutputBytes, 'maxOutputBytes', MAXIMUM_AUTHORING_INDEX_BYTES);
    }
    const patches = [];
    const localizationPatches = [];
    const providerDiagnostics = [];
    const schemaExtensions = new Map();
    const unverifiedTypes = new Set();
    const unverifiedFields = new Set();
    const unsupportedElements = new Set();
    let unresolvedRequirements = 0;
    if (includeWorkspaceFacets) {
        const plannedDocumentCount = positiveLimit(value.plannedDocumentCount, 'plannedDocumentCount', MAXIMUM_REQUIREMENTS);
        if (!Array.isArray(value.unresolvedRequirementIds) ||
            !value.unresolvedRequirementIds.every(item => typeof item === 'string' && item.length > 0) ||
            new Set(value.unresolvedRequirementIds).size !== value.unresolvedRequirementIds.length ||
            value.documents.length +
                value.localizationDocuments.length +
                value.unresolvedRequirementIds.length !==
                plannedDocumentCount) {
            throw new TypeError('resolved workspace analysis requires exact bounded resource-plan accounting');
        }
        unresolvedRequirements = value.unresolvedRequirementIds.length;
        if (unresolvedRequirements > 0) {
            providerDiagnostics.push(Object.freeze({
                severity: 'error',
                code: 'blizzard.starcraft2/data-plan-resources-unresolved',
                message: `${unresolvedRequirements} planned workspace data resource(s) did not resolve: ${value.unresolvedRequirementIds.join(', ')}`,
            }));
        }
    }
    let anonymousEntities = 0;
    // namespace → structure type → default, later documents (dependents) layered over earlier ones.
    const structureDefaults = new Map();
    const constants = new Map();
    let editorCategories = EMPTY_EDITOR_CATEGORIES;
    value.documents.forEach((document, documentIndex) => {
        request.signal?.throwIfAborted();
        if (isEditorCategoriesDocument(document)) {
            editorCategories = mergeEditorCategories(editorCategories, parseEditorCategories(document.text));
            return;
        }
        let parsed;
        try {
            parsed = parseDocument(document, documentIndex, request.signal, value.maxDepth);
        }
        catch (error) {
            request.signal?.throwIfAborted();
            if (!includeWorkspaceFacets)
                throw error;
            providerDiagnostics.push(Object.freeze({
                severity: 'error',
                code: 'blizzard.starcraft2/data-document-invalid',
                message: `${document.path}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 2_048),
                source: Object.freeze({
                    rootId: document.rootId,
                    path: document.path,
                    documentIndex,
                    ...(document.revision === undefined ? {} : { revision: document.revision }),
                }),
            }));
            return;
        }
        patches.push(...parsed.patches);
        for (const [name, replacement] of parsed.constants)
            constants.set(name, replacement);
        for (const item of parsed.structureDefaults) {
            const byType = structureDefaults.get(item.namespace) ?? new Map();
            byType.set(item.structureType, {
                value: mergeStructureDefault(byType.get(item.structureType)?.value, item.value),
                source: item.source,
            });
            structureDefaults.set(item.namespace, byType);
        }
        providerDiagnostics.push(...parsed.diagnostics);
        mergeSchemaExtensions(schemaExtensions, parsed.schemaExtensions);
        for (const typeId of parsed.unverifiedTypes)
            unverifiedTypes.add(typeId);
        for (const fieldId of parsed.unverifiedFields)
            unverifiedFields.add(fieldId);
        for (const elementName of parsed.unsupportedElements)
            unsupportedElements.add(elementName);
        anonymousEntities += parsed.anonymousEntities;
        if (patches.length > value.maxEntities) {
            throw new TypeError(`parsed entities exceeds maxEntities (${patches.length} > ${value.maxEntities})`);
        }
    });
    value.localizationDocuments.forEach((document, documentIndex) => {
        const parsed = parseLocalizationDocument(document, documentIndex);
        localizationPatches.push(...parsed.patches);
        providerDiagnostics.push(...parsed.diagnostics);
    });
    request.signal?.throwIfAborted();
    if (unverifiedTypes.size > 0) {
        providerDiagnostics.push(Object.freeze({
            severity: 'warning',
            code: 'blizzard.starcraft2/data-schema-type-unverified',
            message: `${unverifiedTypes.size} installed catalog type(s) were preserved through an inferred schema extension: ${[...unverifiedTypes].sort().slice(0, 32).join(', ')}`,
        }));
    }
    if (unverifiedFields.size > 0) {
        providerDiagnostics.push(Object.freeze({
            severity: 'warning',
            code: 'blizzard.starcraft2/data-schema-field-unverified',
            message: `${unverifiedFields.size} installed catalog field path(s) were preserved without claiming typed-link semantics: ${[...unverifiedFields].sort().slice(0, 32).join(', ')}`,
        }));
    }
    if (unsupportedElements.size > 0) {
        providerDiagnostics.push(Object.freeze({
            severity: 'warning',
            code: 'blizzard.starcraft2/data-catalog-element-unsupported',
            message: `${unsupportedElements.size} non-catalog root element kind(s) were explicitly excluded: ${[...unsupportedElements].sort().slice(0, 32).join(', ')}`,
        }));
    }
    if (anonymousEntities > 0) {
        providerDiagnostics.push(Object.freeze({
            severity: 'information',
            code: 'blizzard.starcraft2/data-default-definitions-preserved',
            message: `${anonymousEntities} anonymous/default catalog declaration(s) were preserved with deterministic @default identities`,
        }));
    }
    if (includeWorkspaceFacets) {
        providerDiagnostics.push(Object.freeze({
            severity: 'information',
            code: 'blizzard.starcraft2/data-schema-full-coverage',
            message: `${STARCRAFT2_DATA_SCHEMA_COVERAGE.typeCount} types, ${STARCRAFT2_DATA_SCHEMA_COVERAGE.directFieldCount + STARCRAFT2_DATA_SCHEMA_COVERAGE.structureFieldCount} direct/structured fields, ${STARCRAFT2_DATA_SCHEMA_COVERAGE.linkFieldCount} typed links and ${STARCRAFT2_DATA_SCHEMA_COVERAGE.namespaceCount} namespaces loaded from ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.legacySchemaCommit}; ${STARCRAFT2_DATA_SCHEMA_PROVENANCE.digest}`,
        }));
    }
    const schemas = effectiveSchemas(schemaExtensions);
    const schemasByType = new Map(schemas.map(schema => [schema.typeId, schema]));
    const localizationKeys = localizationKeysFromPatches(patches, schemasByType);
    for (const key of value.localizationKeys)
        localizationKeys.add(key);
    const snapshotId = snapshotIdentity(value);
    const projection = projectionEvidence(value, snapshotId, value.documents.length, value.localizationDocuments.length, unresolvedRequirements);
    const ownerMetadata = includeWorkspaceFacets ? editorCategoriesMetadata(editorCategories) : undefined;
    const templateEntityKeys = patches
        .filter(patch => patch.defaultTemplate === true)
        .map(patch => `${patch.namespace}\0${patch.entityId}`);
    const resolutionPatches = withClassDefaultParents(patches, schemasByType).map(patch => Object.freeze({
        namespace: patch.namespace,
        typeId: patch.typeId,
        entityId: patch.entityId,
        ...(patch.parentEntityId === undefined ? {} : { parentEntityId: patch.parentEntityId }),
        ...(patch.defaultTemplate === true ? { defaultTemplate: true } : {}),
        ...(patch.tokens === undefined ? {} : { tokens: patch.tokens }),
        fields: constants.size === 0 ? patch.fields : expandCatalogConstants(patch.fields, constants),
        source: patch.source,
    }));
    if (authoringIndex) {
        if (typeof resolveDataAuthoringIndex !== 'function') {
            throw new TypeError('the active Modkit SDK does not support resolved Data authoring indexes');
        }
        const index = resolveDataAuthoringIndex({
            workspaceId: value.workspaceId,
            gameId: value.gameId,
            analyzerId: ANALYZER_ID,
            snapshotId,
            schemas,
            patches: resolutionPatches,
            basePatches: authoringStructureDefaultPatches(resolutionPatches, structureDefaults),
            applyDefaults: (namespace, typeId, entityId, fields) => {
                const byType = structureDefaults.get(namespace);
                if (byType === undefined)
                    return fields;
                return applyStarcraft2StructureDefaults(typeId, entityId, fields, structureType => byType.get(structureType)?.value, { wrapsIndexed: true });
            },
            diagnostics: providerDiagnostics,
            ...(ownerMetadata === undefined ? {} : { ownerMetadata }),
            complete: unresolvedRequirements === 0 &&
                providerDiagnostics.every(diagnostic => diagnostic.severity !== 'error'),
            maxEntities: value.maxEntities,
            maxDepth: value.maxDepth,
            maxOutputBytes: value.maxOutputBytes,
        });
        return withOwnerMetadata(index, ownerMetadata);
    }
    const commonSnapshot = withOwnerMetadata(resolveDataCatalog({
        workspaceId: value.workspaceId,
        gameId: value.gameId,
        analyzerId: ANALYZER_ID,
        schemas,
        patches: resolutionPatches,
        queries: value.queries,
        ...(includeWorkspaceFacets
            ? {
                localizationPatches,
                localePreferences: value.locales,
                localizationKeys: [...localizationKeys],
                diagnostics: providerDiagnostics,
                snapshotId,
                projectionPlan: projection.projectionPlan,
                projectionReceipt: projection.projectionReceipt,
                includeWorkspaceFacets: true,
                includeFieldSources: true,
                ...(ownerMetadata === undefined ? {} : { ownerMetadata }),
            }
            : {}),
        maxEntities: value.maxEntities,
        maxDepth: value.maxDepth,
    }), ownerMetadata);
    const resolvedSnapshot = withStructureDefaults(commonSnapshot, structureDefaults);
    const snapshot = includeWorkspaceFacets
        ? normalizeStarcraft2ResolvedSnapshot(addResolvedFieldSources(resolvedSnapshot, resolutionPatches), {
            templateEntityKeys,
        })
        : resolvedSnapshot;
    if (includeWorkspaceFacets || providerDiagnostics.length === 0)
        return snapshot;
    return Object.freeze({
        ...snapshot,
        diagnostics: Object.freeze([...snapshot.diagnostics, ...providerDiagnostics]),
        complete: snapshot.complete && providerDiagnostics.every(diagnostic => diagnostic.severity !== 'error'),
    });
}
/** Existing catalog-analysis@1 behavior: no workspace/live additions on the wire. */
export const analyzeStarcraft2Data = request => analyzeStarcraft2DataInternal(request, false);
export const analyzeStarcraft2ResolvedData = request => analyzeStarcraft2DataInternal(request, true);
export const analyzeStarcraft2DataAuthoringIndex = request => analyzeStarcraft2DataInternal(request, true, true);
export const abiVersion = 1;
export const provides = Object.freeze([
    DATA_CATALOG_ANALYSIS_CONTRACT,
    RESOLVED_DATA_WORKSPACE_CONTRACT,
]);
function createResolvedWorkspaceProvider() {
    const workspaces = new Map();
    const snapshots = new Map();
    const authoringIndexes = new Map();
    let authoringIndexCacheBytes = 0;
    const rememberWorkspace = (workspace, dataPlan) => {
        workspaces.delete(workspace.workspaceId);
        workspaces.set(workspace.workspaceId, Object.freeze({ workspace, dataPlan }));
        while (workspaces.size > MAXIMUM_SNAPSHOTS)
            workspaces.delete(workspaces.keys().next().value);
    };
    const remember = (snapshot, analysisRequest) => {
        if (typeof snapshot.snapshotId !== 'string') {
            throw new TypeError('resolved workspace analyzer returned no snapshot identity');
        }
        const planned = workspaces.get(snapshot.workspaceId);
        snapshots.delete(snapshot.snapshotId);
        snapshots.set(snapshot.snapshotId, Object.freeze({
            snapshot,
            analysisRequest: Object.freeze({ ...analysisRequest }),
            ...(planned === undefined ? {} : planned),
        }));
        while (snapshots.size > MAXIMUM_SNAPSHOTS)
            snapshots.delete(snapshots.keys().next().value);
        return snapshot;
    };
    const authoringIndexFor = async (request) => {
        request?.signal?.throwIfAborted();
        const key = typeof request?.snapshotId === 'string'
            ? `${request.snapshotId}\0${String(request?.maxOutputBytes ?? '')}`
            : undefined;
        const cached = key === undefined ? undefined : authoringIndexes.get(key);
        if (cached !== undefined) {
            authoringIndexes.delete(key);
            authoringIndexes.set(key, cached);
            return cached.value;
        }
        const value = await analyzeStarcraft2DataAuthoringIndex(request);
        request?.signal?.throwIfAborted();
        if (key === undefined)
            return value;
        const bytes = encoder.encode(JSON.stringify(value)).byteLength;
        const previous = authoringIndexes.get(key);
        if (previous !== undefined)
            authoringIndexCacheBytes -= previous.bytes;
        authoringIndexes.set(key, Object.freeze({ value, bytes }));
        authoringIndexCacheBytes += bytes;
        while (authoringIndexCacheBytes > MAXIMUM_AUTHORING_INDEX_CACHE_BYTES) {
            const oldest = authoringIndexes.keys().next().value;
            if (oldest === undefined)
                break;
            const removed = authoringIndexes.get(oldest);
            authoringIndexes.delete(oldest);
            authoringIndexCacheBytes -= removed?.bytes ?? 0;
        }
        return value;
    };
    const entryFor = snapshotId => {
        nonEmptyString(snapshotId, 'snapshotId');
        const entry = snapshots.get(snapshotId);
        if (entry === undefined) {
            throw new RangeError(`snapshot ${snapshotId} is stale, unknown or evicted from this provider lease`);
        }
        return entry;
    };
    const editingEntryFor = snapshotId => {
        const entry = entryFor(snapshotId);
        if (entry.workspace === undefined || entry.dataPlan === undefined) {
            throw new RangeError(`snapshot ${snapshotId} has no pinned workspace plan; call plan before analyze`);
        }
        return entry;
    };
    const open = async (request, kind) => {
        request?.signal?.throwIfAborted();
        const maxPageSize = positiveLimit(request.maxPageSize, 'maxPageSize', MAXIMUM_PAGE_SIZE);
        const entry = entryFor(request?.snapshotId);
        return openStarcraft2DataSource(entry.snapshot, kind, maxPageSize, {
            ...(request.signal === undefined ? {} : { signal: request.signal }),
        });
    };
    const openSubjectFacts = async (request) => {
        request?.signal?.throwIfAborted();
        return openStarcraft2SubjectFactsSource(entryFor(request?.snapshotId).snapshot, request);
    };
    const openSubjectCalculations = async (request) => {
        request?.signal?.throwIfAborted();
        return openStarcraft2SubjectCalculationsSource(entryFor(request?.snapshotId).snapshot, request);
    };
    return Object.freeze({
        contract: RESOLVED_DATA_WORKSPACE_CONTRACT,
        providerId: ANALYZER_ID,
        gameIds: Object.freeze([GAME_ID]),
        plan: async (request) => {
            const dataPlan = await planStarcraft2DataWorkspace(request);
            rememberWorkspace(request.workspace, dataPlan);
            return dataPlan;
        },
        analyze: async (request) => remember(await analyzeStarcraft2ResolvedData(request), request),
        ...(typeof resolveDataAuthoringIndex === 'function'
            ? { analyzeAuthoringIndex: authoringIndexFor }
            : {}),
        openSchemaTree: request => open(request, 'schema-tree'),
        openDefinitionTable: request => open(request, 'definition-table'),
        openLocalizationTable: request => open(request, 'localization-table'),
        openRelations: request => open(request, 'relations'),
        /** Additive extension projection; it does not create another catalog or host registry. */
        openSubjectFacts,
        /** Strict read-only calculation projection over the same pinned catalog snapshot. */
        openSubjectCalculations,
        /** One resolver is shared by cards/tables/trees, code actions and MCP adapters. */
        resolveEditTarget: async (request) => resolveStarcraft2DataEditTarget(editingEntryFor(request?.snapshotId), request),
        /** Prospective bytes plus a fresh resolution; commit remains a host responsibility. */
        planEdit: async (request) => planStarcraft2DataEdit(editingEntryFor(request?.snapshotId), request, analyzeStarcraft2ResolvedData),
        /** Read-only shared-object impact over the pinned resolved graph. */
        analyzeIsolation: async (request) => analyzeStarcraft2GraphIsolation(entryFor(request?.snapshotId).snapshot, request),
        /** Prospective clone plus exact-owner rewire; commit remains a host responsibility. */
        planIsolation: async (request) => planStarcraft2GraphIsolation(editingEntryFor(request?.snapshotId), request, analyzeStarcraft2ResolvedData),
    });
}
export function createProvider(selection) {
    if (selection.major !== 1 ||
        (selection.contract !== DATA_CATALOG_ANALYSIS_CONTRACT &&
            selection.contract !== RESOLVED_DATA_WORKSPACE_CONTRACT)) {
        throw new TypeError(`unsupported data-catalog selection ${selection.contract}@${selection.major}`);
    }
    const value = selection.contract === DATA_CATALOG_ANALYSIS_CONTRACT
        ? Object.freeze({
            contract: DATA_CATALOG_ANALYSIS_CONTRACT,
            analyzerId: ANALYZER_ID,
            gameIds: Object.freeze([GAME_ID]),
            analyze: analyzeStarcraft2Data,
        })
        : createResolvedWorkspaceProvider();
    return Object.freeze({
        value,
        release: async () => undefined,
    });
}
