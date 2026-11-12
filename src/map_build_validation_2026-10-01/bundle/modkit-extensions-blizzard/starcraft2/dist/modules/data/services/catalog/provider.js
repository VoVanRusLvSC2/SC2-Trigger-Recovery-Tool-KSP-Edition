import { parseCatalogXmlElements } from '@modkit/blizzard-starcraft2/data/xml';
import { createEngineCatalog } from '@modkit/blizzard-starcraft2/data/engine-resolution';
import { gameDataIncludePaths } from '@modkit/blizzard-starcraft2/data/gamedata-order';
import { buildStarcraft2AuthoringIndex } from '@modkit/blizzard-starcraft2/data/authoring-index';
import * as dataSdk from '@modkit/sdk/data';
import { openStarcraft2DataSource, openStarcraft2SubjectCalculationsSource, openStarcraft2SubjectFactsSource, provenanceDeclarations, } from '../projections/data-sources.js';
import { resolveStarcraft2SchemaFields, resolveStarcraft2StructureFields, starcraft2NamespaceForType, starcraft2ResolutionField, STARCRAFT2_CATALOG_FILES, STARCRAFT2_DATA_SCHEMAS, STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, STARCRAFT2_SCHEMA_BY_TYPE, } from '../schema/full-data-schema.js';
import { normalizeStarcraft2ResolvedSnapshot } from './resolved-data-normalization.js';
import { isStarcraft2StructureDefaultTag, mergeStructureDefault, starcraft2StructureDefaultNamespace, } from './struct-defaults.js';
import { EMPTY_EDITOR_CATEGORIES, mergeEditorCategories, parseEditorCategories, } from '../../shared/catalog-engine/sc2-editor-core/editor-categories-runtime.js';
import { planStarcraft2DataEdit, planStarcraft2GraphIsolation, resolveStarcraft2DataEditTarget, } from '../editing/edit-target.js';
import { analyzeStarcraft2GraphIsolation } from '../editing/graph-isolation.js';
import { mapCatalogUsages } from '@modkit/blizzard-starcraft2/map/catalog-usages';
export { STARCRAFT2_DATA_SCHEMA_REVISION } from '../schema/data-schema-identity.js';
export { STARCRAFT2_DATA_NAMESPACES, STARCRAFT2_DATA_SCHEMAS, STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, STARCRAFT2_TYPE_NAMESPACES, } from '../schema/full-data-schema.js';
const ANALYZER_ID = 'blizzard.starcraft2.data';
const GAME_ID = 'blizzard/starcraft-2';
const { DATA_CATALOG_ANALYSIS_CONTRACT, RESOLVED_DATA_WORKSPACE_CONTRACT, resolveDataCatalog } = dataSdk;
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
/** A map's documents that name catalog entities; their usages become relations. */
const MAP_USAGE_FILES = Object.freeze(['objects', 'preload.xml']);
const isMapRoot = rootPath => /\.sc2map$/iu.test(rootPath);
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
const GAMEDATA_DIRECTORY = 'base.sc2data/gamedata';
const KNOWN_CATALOG_FILES = new Set(STARCRAFT2_CATALOG_FILES);
// The host lists at most 64 directories per plan (`DATA_WORKSPACE_LISTING_LIMITS`).
const MAXIMUM_LISTING_QUERIES = 64;
const GAMEDATA_INCLUDES_PATH = 'base.sc2data/gamedata.xml';
/**
 * What a complete listing of a root's GameData folder shows: the standard catalogs it holds, and
 * every other `*.xml` under it (flat or nested). The others are candidates only: the game loads them
 * when the root's `GameData.xml` declares them (Liberty declares CollectionSkin, SC2Events and its
 * WarChest seasons), which analysis checks against that file — a plan has no file text. Roots
 * without a complete listing keep the fixed list.
 */
function listedCatalogFiles(listings) {
    const byRoot = new Map();
    for (const listing of Array.isArray(listings) ? listings : []) {
        const item = recordOf(listing);
        if (item?.complete !== true || typeof item.rootId !== 'string' || !Array.isArray(item.paths) ||
            String(item.prefix).toLowerCase() !== GAMEDATA_DIRECTORY)
            continue;
        const standard = new Set();
        const candidates = new Set();
        for (const path of item.paths) {
            const match = typeof path === 'string'
                ? /^base\.sc2data\/gamedata\/(.+\.xml)$/iu.exec(path.replaceAll('\\', '/'))
                : null;
            if (match === null)
                continue;
            const file = match[1].toLowerCase();
            if (KNOWN_CATALOG_FILES.has(file))
                standard.add(file);
            else
                candidates.add(file);
        }
        byRoot.set(item.rootId, { standard, candidates: [...candidates].sort() });
    }
    return byRoot;
}
function isGameDataIncludesDocument(document) {
    const path = document.path.replaceAll('\\', '/').toLowerCase();
    return path === GAMEDATA_INCLUDES_PATH || path.endsWith(`/${GAMEDATA_INCLUDES_PATH}`);
}
/**
 * The catalog documents the game loads, in its order: the standard catalogs as planned, then each
 * root's declared catalogs in the order its `GameData.xml` declares them. A candidate the root does
 * not declare is dropped, as the loader's own catalog (`context-catalog.ts`) drops it. A root whose
 * `GameData.xml` is not among the documents keeps its documents as given.
 * ponytail: a root without GameData.xml keeps undeclared flat catalogs, as `SC2ModReader` does; the
 * stock ones (ActorSupportData.xml, ErrorData.xml) are empty `<Catalog/>`.
 */
function loadedCatalogDocuments(documents) {
    const declared = new Map();
    for (const document of documents) {
        if (!isGameDataIncludesDocument(document))
            continue;
        declared.set(document.rootId, gameDataIncludePaths(document.text).map(path => `base.sc2data/${path}`.toLowerCase()));
    }
    const firstOfRoot = new Map();
    const kept = [];
    documents.forEach((document, documentIndex) => {
        if (!firstOfRoot.has(document.rootId))
            firstOfRoot.set(document.rootId, documentIndex);
        if (isGameDataIncludesDocument(document))
            return;
        const path = document.path.replaceAll('\\', '/').toLowerCase();
        const flat = /\/base\.sc2data\/gamedata\/([^/]+)$/u.exec(`/${path}`)?.[1];
        const includes = declared.get(document.rootId);
        if (includes === undefined || isEditorCategoriesDocument(document) || !path.includes('base.sc2data/gamedata/') ||
            (flat !== undefined && KNOWN_CATALOG_FILES.has(flat))) {
            kept.push({ document, documentIndex, order: [firstOfRoot.get(document.rootId), 0, documentIndex] });
            return;
        }
        const position = includes.findIndex(key => path === key || path.endsWith(`/${key}`));
        if (position !== -1)
            kept.push({ document, documentIndex, order: [firstOfRoot.get(document.rootId), 1, position] });
    });
    return kept.sort((left, right) => left.order[0] - right.order[0] || left.order[1] - right.order[1] || left.order[2] - right.order[2]);
}
export async function planStarcraft2DataWorkspace(request) {
    request.signal?.throwIfAborted();
    const { workspace, logicalRoots, locales, maxRequirements } = validateWorkspacePlanRequest(request);
    const listed = listedCatalogFiles(request.listings);
    const planned = [];
    const localizationRequirementCount = locales.length * logicalRoots.length;
    const fullCatalogRequirementCount = workspace.loadOrder.length * (CATALOG_FILES.length + 1);
    const usageRequirementCount = workspace.loadOrder.filter(root => isMapRoot(root.sourcePath)).length * MAP_USAGE_FILES.length;
    const fullCatalogCoverage = fullCatalogRequirementCount + usageRequirementCount + localizationRequirementCount <=
        maxRequirements;
    const catalogFiles = fullCatalogCoverage
        ? CATALOG_FILES
        : PRIORITY_CATALOG_FILES;
    for (const root of workspace.loadOrder) {
        const rootPath = normalizeLogicalPath(root.sourcePath, `${root.rootId}.sourcePath`);
        const present = fullCatalogCoverage ? listed.get(root.rootId) : undefined;
        const files = present === undefined
            ? catalogFiles
            : [...catalogFiles.filter(file => present.standard.has(file)), ...present.candidates];
        if (present !== undefined && present.candidates.length > 0)
            planned.push(Object.freeze({
                requirementId: `gamedata-includes:${root.rootId}`,
                rootId: root.rootId,
                path: `${rootPath}/${GAMEDATA_INCLUDES_PATH}`,
                kind: 'catalog',
                required: false,
            }));
        for (const file of files) {
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
    for (const root of workspace.loadOrder) {
        const rootPath = normalizeLogicalPath(root.sourcePath, `${root.rootId}.sourcePath`);
        if (!isMapRoot(rootPath))
            continue;
        for (const file of MAP_USAGE_FILES) {
            planned.push(Object.freeze({
                requirementId: `usage:${root.rootId}:${file}`,
                rootId: root.rootId,
                path: `${rootPath}/${file}`,
                kind: 'usage',
                required: false,
            }));
        }
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
        // Ask once for each root's GameData folder, so the next plan names the catalogs it holds.
        ...(request.listings === undefined && fullCatalogCoverage &&
            workspace.loadOrder.length <= MAXIMUM_LISTING_QUERIES
            ? {
                listingQueries: Object.freeze(workspace.loadOrder.map(root => Object.freeze({ rootId: root.rootId, prefix: GAMEDATA_DIRECTORY }))),
            }
            : {}),
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
    const usageDocuments = value.usageDocuments ?? [];
    if (!Array.isArray(usageDocuments) || usageDocuments.length > maxDocuments) {
        throw new TypeError(`usageDocuments must contain at most maxDocuments (${maxDocuments}) entries`);
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
    usageDocuments.forEach((document, index) => validateDocument(document, index, 'usageDocuments'));
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
        usageDocuments,
        locales: normalizedLocales,
        localizationKeys,
    };
}
function elementChildren(node) {
    return node.children ?? [];
}
function entityTokens(element) {
    return Object.freeze((element.tokens ?? []).filter(token => token.id.length > 0).map(token => Object.freeze({ ...token })));
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
// The schema is fixed, so each class's resolution fields are computed once, not per declaration.
const resolutionFieldsByType = new Map();
function resolutionFieldsOf(typeId) {
    let fields = resolutionFieldsByType.get(typeId);
    if (fields === undefined) {
        fields = new Map(resolveStarcraft2SchemaFields(typeId).map(field => {
            const resolved = starcraft2ResolutionField(field);
            return [resolved.fieldId, resolved];
        }));
        resolutionFieldsByType.set(typeId, fields);
    }
    return fields;
}
function parseFieldsForEntity(typeId, elements, unverifiedFields, maxDepth) {
    return parseFieldsForShape(typeId, resolutionFieldsOf(typeId), elements, unverifiedFields, maxDepth);
}
/** The shapes of the fields `elements` spell: the schema's, extended by what they show. */
function parseFieldsForShape(typeId, canonicalFields, elements, unverifiedFields, maxDepth) {
    const canonical = canonicalFields instanceof Map
        ? canonicalFields
        : new Map(canonicalFields.map(field => [field.fieldId, field]));
    const inferred = inferFields(elements, 0, maxDepth);
    const parsed = new Map();
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
    const fieldLexemes = {};
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
            if (field.cardinality === 'scalar' && field.valueKind === 'number' &&
                typeof child.attributes?.value === 'string')
                fieldLexemes[child.name] = child.attributes.value;
            else
                delete fieldLexemes[child.name];
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
        fieldLexemes: Object.freeze(fieldLexemes),
        source: Object.freeze(source),
        schemaExtensions: parsing.extensions,
        synthetic: declaredId === undefined || declaredId.length === 0,
        defaultTemplate: defaultValue === '1' || defaultValue === 'true',
        ...(tokens.length === 0 ? {} : { tokens }),
    });
}
function parseDocument(document, documentIndex, signal, maxDepth) {
    signal?.throwIfAborted();
    if (/<!DOCTYPE|<!ENTITY/iu.test(document.text)) {
        throw new TypeError(`${document.path}: DTD and custom entities are forbidden`);
    }
    const elements = parseCatalogXmlElements(document.text);
    const root = elements[0];
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
            fieldLexemes: patch.fieldLexemes,
            source: patch.source,
            ...(patch.defaultTemplate ? { defaultTemplate: true } : {}),
            ...(patch.tokens === undefined ? {} : { tokens: patch.tokens }),
            ...(patch.synthetic ? { synthetic: true } : {}),
        }));
    }
    return {
        elements,
        patches,
        structureDefaults,
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
                value.usageDocuments.length +
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
    // The documents again, for the one Data resolver (catalog-engine) that resolves their values.
    const engineDocuments = [];
    let editorCategories = EMPTY_EDITOR_CATEGORIES;
    loadedCatalogDocuments(value.documents).forEach(({ document, documentIndex }) => {
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
        engineDocuments.push({ rootId: document.rootId, path: document.path, text: document.text, elements: parsed.elements });
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
    const engine = resolveThroughEngine(patches, engineDocuments, value, providerDiagnostics);
    if (authoringIndex) {
        const index = buildStarcraft2AuthoringIndex({
            workspaceId: value.workspaceId,
            gameId: value.gameId,
            analyzerId: ANALYZER_ID,
            snapshotId,
            schemas,
            entities: engine.authoringEntities(structureDefaults),
            patchCount: patches.length,
            diagnostics: providerDiagnostics,
            ...(ownerMetadata === undefined ? {} : { ownerMetadata }),
            complete: unresolvedRequirements === 0 &&
                providerDiagnostics.every(diagnostic => diagnostic.severity !== 'error'),
            maxOutputBytes: value.maxOutputBytes,
        });
        return withOwnerMetadata(index, ownerMetadata);
    }
    const commonSnapshot = withOwnerMetadata(resolveDataCatalog({
        workspaceId: value.workspaceId,
        gameId: value.gameId,
        analyzerId: ANALYZER_ID,
        schemas,
        patches: engine.patches,
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
    const resolvedSnapshot = engine.provenance(commonSnapshot, includeWorkspaceFacets);
    const snapshot = includeWorkspaceFacets
        ? normalizeStarcraft2ResolvedSnapshot(withUsageRelations(resolvedSnapshot, value.usageDocuments), {
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
/**
 * Resolve every entity through catalog-engine, the one SC2 Data resolver (owner decision 26.09),
 * and hand the common snapshot builder one flat declaration per entity: the resolved values typed
 * by the same code as an authored declaration, without a parent, so the common builder shapes
 * fields, relations and localization but inherits nothing itself. Class templates stay their own
 * declarations. `provenance` then restores what inheritance produced — parent, chain, own
 * declaration sites, the declaration behind each field.
 */
function resolveThroughEngine(patches, documents, value, diagnostics) {
    const engine = createEngineCatalog(documents);
    const keyOf = (rootId, path) => `${rootId}\u0000${path}`;
    const documentIndexes = new Map(value.documents.map((document, index) => [keyOf(document.rootId, document.path), index]));
    const sourceOf = source => {
        const index = documentIndexes.get(keyOf(source.rootId, source.path));
        const document = index === undefined ? undefined : value.documents[index];
        return Object.freeze({
            rootId: source.rootId,
            path: source.path,
            ...(index === undefined ? {} : { documentIndex: index }),
            ...(document?.revision === undefined ? {} : { revision: document.revision }),
            // Where the declaration sits in that document (sdk `DataEntitySource.range`).
            ...(source.range === undefined ? {} : { range: Object.freeze({ ...source.range }) }),
        });
    };
    // A class template in the engine's chain is the last `default="1"` declaration of its class;
    // one of its values, the declaration (by class and document) that wrote it.
    const templateOfClass = new Map();
    const templateDeclarations = new Map();
    for (const patch of patches) {
        if (!patch.synthetic || !patch.defaultTemplate)
            continue;
        templateOfClass.set(patch.typeId, patch.entityId);
        templateDeclarations.set(keyOf(patch.typeId, `${patch.source.rootId}\u0000${patch.source.path}`), patch.entityId);
    }
    const resolved = new Map();
    const flat = [];
    const ignoredFields = new Set();
    for (const patch of patches) {
        const key = keyOf(patch.namespace, patch.entityId);
        if (resolved.has(key))
            continue;
        // A class template resolves as its class's template in the engine, whichever of its
        // declarations this is; another anonymous declaration is no template and stays as written.
        const entity = !patch.synthetic
            ? engine.resolve(patch.namespace, patch.entityId)
            : patch.defaultTemplate
                ? engine.resolveTemplate(patch.typeId)
                : undefined;
        if (entity === undefined) {
            // Kept as written: its own declaration is its whole provenance.
            const { parentEntityId: _parent, ...own } = patch;
            resolved.set(key, { own });
            flat.push(Object.freeze(own));
            continue;
        }
        const schema = SCHEMA_BY_TYPE.get(entity.typeId) ??
            Object.freeze({ typeId: entity.typeId, parentTypeId: 'CBase', fields: Object.freeze([]) });
        const parsed = parseEntity(entity.element, schema, patch.namespace, patch.source, patch.entityId, ignoredFields, value.maxDepth);
        const typed = entity.emptyLists.length === 0
            ? parsed
            : { ...parsed, fields: Object.freeze({ ...parsed.fields, ...Object.fromEntries(entity.emptyLists.map(name => [name, Object.freeze([])])) }) };
        const chain = entity.chain.map((link, index) => Object.freeze({
            namespace: patch.namespace,
            entityId: index === entity.chain.length - 1
                ? patch.entityId
                : link.entityId === '' ? (templateOfClass.get(link.typeId) ?? '') : link.entityId,
        }));
        if (entity.missingParent !== undefined) {
            diagnostics.push(Object.freeze({
                severity: 'error',
                code: 'common.data/entity-parent-unavailable',
                message: `${patch.namespace}/${chain[0]?.entityId ?? patch.entityId} names unavailable parent ${entity.missingParent}`,
                namespace: patch.namespace,
                typeId: entity.typeId,
                entityId: patch.entityId,
            }));
        }
        resolved.set(key, { entity, chain, fieldLexemes: typed.fieldLexemes });
        flat.push(Object.freeze({
            namespace: patch.namespace,
            typeId: entity.typeId,
            entityId: patch.entityId,
            fields: typed.fields,
            fieldLexemes: typed.fieldLexemes,
            source: entity.sources.length === 0 ? patch.source : sourceOf(entity.sources.at(-1)),
            ...(patch.defaultTemplate ? { defaultTemplate: true } : {}),
            ...(patch.synthetic ? { synthetic: true } : {}),
            ...(entity.tokens.length === 0 ? {} : { tokens: Object.freeze(entity.tokens.map(token => Object.freeze({ ...token }))) }),
        }));
    }
    const provenance = (snapshot, withFieldSources) => {
        const enrich = definition => {
            const known = resolved.get(keyOf(definition.namespace, definition.entityId));
            if (known === undefined)
                return definition;
            if (known.own !== undefined) {
                const { own } = known;
                return Object.freeze({
                    ...definition,
                    inheritanceChain: Object.freeze([Object.freeze({ namespace: own.namespace, entityId: own.entityId })]),
                    sources: Object.freeze([own.source]),
                    ...(withFieldSources
                        ? {
                            fieldSources: Object.freeze(Object.fromEntries(Object.keys(own.fields).map(field => [field, own.source]))),
                            fieldLexemes: own.fieldLexemes ?? Object.freeze({}),
                        }
                        : {}),
                });
            }
            const { entity, chain, fieldLexemes } = known;
            const parent = chain.at(-2)?.entityId;
            return Object.freeze({
                ...definition,
                ...(parent === undefined || parent === '' ? {} : { parentEntityId: parent }),
                inheritanceChain: Object.freeze(chain),
                sources: Object.freeze(entity.sources.map(sourceOf)),
                ...(withFieldSources
                    ? {
                        fieldSources: Object.freeze(Object.fromEntries(Object.entries(entity.fieldSources).map(([field, source]) => [field, sourceOf(source)]))),
                        fieldLexemes,
                    }
                    : {}),
            });
        };
        return Object.freeze({
            ...snapshot,
            ...(snapshot.definitions === undefined ? {} : { definitions: Object.freeze(snapshot.definitions.map(enrich)) }),
            entities: Object.freeze(snapshot.entities.map(enrich)),
        });
    };
    // A field a structure default completes, at any depth, has an entity-specific value (its
    // `##id##`), so it belongs on the entity's own row even when an ancestor wrote the rest.
    const defaultedByNamespace = new Map();
    const defaultedIn = namespace => {
        let known = defaultedByNamespace.get(namespace);
        if (known === undefined) {
            known = { types: engine.structureDefaultTypes(namespace), completing: new Map() };
            defaultedByNamespace.set(namespace, known);
        }
        return known;
    };
    const completedByDefaults = (field, namespace, seen = new Set()) => {
        const type = field.structureType;
        if (type === undefined || seen.has(type))
            return false;
        const { types, completing } = defaultedIn(namespace);
        if (types.has(type))
            return true;
        const known = completing.get(type);
        if (known !== undefined)
            return known;
        const next = new Set(seen).add(type);
        const result = (resolveStarcraft2StructureFields(type) ?? []).some(child => completedByDefaults(child, namespace, next));
        completing.set(type, result);
        return result;
    };
    // A typed list of `{index, value}` records is addressed by position; the engine keys the same
    // slot by its index (`MismatchFlags/0/value` is `MismatchFlags/Id`).
    const keyedPath = (value, path) => {
        const keyed = [];
        let node = value;
        for (let at = 0; at < path.length; at += 1) {
            const part = path[at];
            const item = Array.isArray(node) && /^\d+$/u.test(part) ? node[Number(part)] : undefined;
            if (item !== null && typeof item === 'object' && !Array.isArray(item) && typeof item.index === 'string') {
                keyed.push(item.index);
                if (path[at + 1] === 'index' || path[at + 1] === 'value') {
                    at += 1;
                    node = item.value;
                }
                else
                    node = item;
                continue;
            }
            keyed.push(part);
            node = node !== null && typeof node === 'object' ? node[part] : undefined;
        }
        return keyed;
    };
    /** Rows of the authoring index: values as typed above, provenance from the engine. */
    const authoringEntities = structureDefaults => flat.map(patch => {
        const key = keyOf(patch.namespace, patch.entityId);
        const known = resolved.get(key);
        const ownSource = patch.source;
        const defaultsSource = [...(structureDefaults.get(patch.namespace)?.values() ?? [])].at(-1)?.source;
        const fallback = { source: defaultsSource ?? ownSource, originEntityId: patch.entityId };
        if (known === undefined || known.own !== undefined) {
            const origin = { source: ownSource, originEntityId: patch.entityId };
            return {
                namespace: patch.namespace, typeId: patch.typeId, entityId: patch.entityId,
                ...(patch.defaultTemplate ? { defaultTemplate: true } : {}),
                ...(patch.tokens === undefined ? {} : { tokens: patch.tokens }),
                source: ownSource, complete: true, fields: patch.fields, rowFields: new Set(Object.keys(patch.fields)), fallback,
                fieldOrigin: () => origin, leafOrigin: () => origin, tombstones: [],
            };
        }
        const { entity, chain } = known;
        const template = patch.synthetic && patch.defaultTemplate;
        const trace = template ? engine.templateProvenance(patch.typeId) : engine.provenance(patch.namespace, patch.entityId);
        // A class template's value names the very declaration that wrote it.
        const idOf = link => link.entityId !== ''
            ? link.entityId
            : templateDeclarations.get(keyOf(link.typeId, `${link.source.rootId}\u0000${link.source.path}`)) ??
                (template && link.typeId === patch.typeId ? patch.entityId : (templateOfClass.get(link.typeId) ?? ''));
        const originOf = link => link === undefined ? undefined : { source: sourceOf(link.source), originEntityId: idOf(link) };
        const rowFields = new Set(trace?.own ?? []);
        // A scalar structure with a default of its own exists on every entity: what no declaration
        // wrote there is the entity's, from the defaults. Defaults inside an authored value follow it.
        const baseFields = new Set();
        const defaulted = defaultedIn(patch.namespace).types;
        for (const field of resolveStarcraft2SchemaFields(patch.typeId)) {
            if (!completedByDefaults(field, patch.namespace))
                continue;
            rowFields.add(field.fieldId);
            if (field.cardinality === 'scalar' && defaulted.has(field.structureType))
                baseFields.add(field.fieldId);
        }
        const parent = chain.at(-2)?.entityId;
        return {
            namespace: patch.namespace, typeId: patch.typeId, entityId: patch.entityId,
            ...(parent === undefined || parent === '' ? {} : { parentEntityId: parent }),
            ...(patch.defaultTemplate ? { defaultTemplate: true } : {}),
            ...(patch.tokens === undefined ? {} : { tokens: patch.tokens }),
            source: patch.source,
            complete: entity.missingParent === undefined,
            fields: patch.fields,
            rowFields,
            fallback,
            fieldOrigin: fieldId => originOf(trace?.field(fieldId)),
            leafOrigin: (fieldId, path) => originOf(trace?.leaf(fieldId, path) ?? trace?.leaf(fieldId, keyedPath(patch.fields[fieldId], path))) ??
                (baseFields.has(fieldId) ? fallback : undefined),
            tombstones: (trace?.tombstones ?? []).map(tombstone => ({ path: tombstone.path, source: sourceOf(tombstone.source) })),
        };
    });
    return { patches: Object.freeze(flat), provenance, authoringEntities };
}
/**
 * The entities a map's placed objects and preload list name, as relations from those documents:
 * an entity lists them among its users, and a name that resolves to nothing is reported like any
 * dead catalog link.
 */
function withUsageRelations(snapshot, usageDocuments) {
    if (usageDocuments.length === 0)
        return snapshot;
    const relations = usageDocuments.flatMap((document, documentIndex) => mapCatalogUsages(document.path, document.text).map(usage => Object.freeze({
        from: Object.freeze({ namespace: usage.document, entityId: usage.owner }),
        to: Object.freeze({ namespace: usage.namespace, entityId: usage.entityId }),
        role: usage.role,
        dead: false,
        source: Object.freeze({
            rootId: document.rootId,
            path: document.path,
            documentIndex,
            ...(document.revision === undefined ? {} : { revision: document.revision }),
        }),
    })));
    return Object.freeze({ ...snapshot, relations: Object.freeze([...snapshot.relations, ...relations]) });
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
    // A card's sources open their declarations: the documents analysed and the roots they came from.
    const declarations = new WeakMap();
    const openSubjectFacts = async (request) => {
        request?.signal?.throwIfAborted();
        const entry = entryFor(request?.snapshotId);
        let declare = declarations.get(entry);
        if (declare === undefined) {
            const analysed = entry.analysisRequest ?? {};
            declare = provenanceDeclarations([...(analysed.documents ?? []), ...(analysed.localizationDocuments ?? [])], entry.workspace);
            declarations.set(entry, declare);
        }
        return openStarcraft2SubjectFactsSource(entry.snapshot, request, declare);
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
        analyzeAuthoringIndex: authoringIndexFor,
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
//# sourceMappingURL=provider.js.map