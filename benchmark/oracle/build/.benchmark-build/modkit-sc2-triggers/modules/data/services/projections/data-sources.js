import { calculateStarcraft2UnitSemantics, calculateStarcraft2UnitWeaponDps, STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA, } from '../calculations/index.js';
import { STARCRAFT2_DATA_SCHEMA_CONTRACT, STARCRAFT2_DATA_SCHEMA_REVISION, starcraft2ConceptKnowledgeTarget, starcraft2FieldKnowledgeTarget, starcraft2SubjectKnowledgeTarget, } from '../schema/data-schema-identity.js';
import { STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, starcraft2DeclaringTypeForField, } from '../schema/full-data-schema.js';
import { semanticCardProfile } from './semantic-card-profiles.js';
const MAXIMUM_PAGE_SIZE = 1_000;
const MAXIMUM_CELL_CHARACTERS = 65_536;
const DEFAULT_SUBJECT_MAX_ENTITIES = 100_000;
const MAXIMUM_SUBJECT_MAX_ENTITIES = 100_000;
const DEFAULT_SUBJECT_MAX_RELATIONS = 250_000;
const MAXIMUM_SUBJECT_MAX_RELATIONS = 1_000_000;
const MAXIMUM_SUBJECT_MAX_CALCULATIONS = 256;
const MAXIMUM_SUBJECT_FIELDS = 4_096;
const MAXIMUM_PROVENANCE_SOURCES = 256;
const MAXIMUM_RELATION_GRAPH_DEFINITIONS = 100_000;
const MAXIMUM_RELATION_GRAPH_EDGES = 1_000_000;
const schemaFieldKnowledgeTarget = (typeId, canonicalPath) => starcraft2FieldKnowledgeTarget(canonicalPath.length === 1 ? starcraft2DeclaringTypeForField(typeId, canonicalPath[0]) : typeId, canonicalPath);
function boundedText(value) {
    const text = String(value);
    if (text.length <= MAXIMUM_CELL_CHARACTERS)
        return text;
    return `${text.slice(0, MAXIMUM_CELL_CHARACTERS)}…[truncated ${text.length - MAXIMUM_CELL_CHARACTERS} characters]`;
}
function abort(signal) {
    signal?.throwIfAborted();
}
function pageLimit(request, maximum) {
    if (!Number.isSafeInteger(request?.limit) || request.limit <= 0 || request.limit > maximum) {
        throw new RangeError(`page limit must be a positive integer no greater than ${maximum}`);
    }
    return request.limit;
}
function cursorPrefix(kind, snapshotId) {
    return `sc2-data-v1:${kind}:${encodeURIComponent(snapshotId)}:`;
}
function offsetOf(request, kind, snapshotId, length) {
    const prefix = cursorPrefix(kind, snapshotId);
    if (request.cursor === undefined)
        return 0;
    if (!request.cursor.startsWith(prefix)) {
        throw new RangeError('page cursor belongs to another source snapshot or page kind');
    }
    const offset = Number(request.cursor.slice(prefix.length));
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > length) {
        throw new RangeError('page cursor is outside the source snapshot');
    }
    return offset;
}
function page(items, request, kind, snapshotId, maximum, signal) {
    abort(signal);
    const limit = pageLimit(request, maximum);
    const offset = offsetOf(request, kind, snapshotId, items.length);
    const end = Math.min(items.length, offset + limit);
    abort(signal);
    return Object.freeze({
        items: Object.freeze(items.slice(offset, end)),
        ...(end < items.length
            ? { nextCursor: `${cursorPrefix(kind, snapshotId)}${String(end)}` }
            : {}),
    });
}
function lifecycle(source) {
    let released = false;
    const guard = () => {
        if (released)
            throw new Error('StarCraft II data-source lease is released');
    };
    const guarded = Object.fromEntries(Object.entries(source).map(([name, method]) => [
        name,
        (...args) => {
            guard();
            return method(...args);
        },
    ]));
    return Object.freeze({
        value: Object.freeze(guarded),
        async release() {
            released = true;
        },
    });
}
function validateOpen(snapshot, maxPageSize) {
    if (typeof snapshot?.snapshotId !== 'string' || snapshot.snapshotId.length === 0) {
        throw new TypeError('data-source snapshot must carry a non-empty snapshotId');
    }
    if (!Number.isSafeInteger(maxPageSize) || maxPageSize <= 0 || maxPageSize > MAXIMUM_PAGE_SIZE) {
        throw new RangeError(`maxPageSize must be a positive integer no greater than ${MAXIMUM_PAGE_SIZE}`);
    }
}
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function positiveBound(value, label, fallback, maximum) {
    const resolved = value === undefined ? fallback : value;
    if (!Number.isSafeInteger(resolved) || resolved <= 0 || resolved > maximum) {
        throw new RangeError(`${label} must be a positive integer no greater than ${maximum}`);
    }
    return resolved;
}
function entityKey(namespace, entityId) {
    return `${namespace}\0${entityId}`;
}
function finiteNumber(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    const record = recordOf(value);
    return record === undefined ? undefined : finiteNumber(record.value);
}
function immutableJson(value) {
    if (Array.isArray(value))
        return Object.freeze(value.map(immutableJson));
    const record = recordOf(value);
    if (record !== undefined) {
        return Object.freeze(Object.fromEntries(Object.entries(record).map(([key, item]) => [key, immutableJson(item)])));
    }
    return value;
}
function sourceLabel(source) {
    return `${source.rootId}:${source.path}${source.revision === undefined ? '' : `@${String(source.revision)}`}`;
}
function sourceProvenance(source, semanticPath) {
    return Object.freeze({
        label: sourceLabel(source),
        semanticPath: Object.freeze([...semanticPath]),
    });
}
function entityProvenance(entity, semanticPath) {
    const sources = Array.isArray(entity?.sources) ? entity.sources : [];
    return Object.freeze(sources
        .slice(0, MAXIMUM_PROVENANCE_SOURCES)
        .map(source => sourceProvenance(source, semanticPath)));
}
function uniqueProvenance(items) {
    const seen = new Set();
    const values = [];
    for (const item of items) {
        const key = `${item.label}\0${JSON.stringify(item.semanticPath ?? [])}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        values.push(item);
    }
    return Object.freeze(values);
}
function subjectFact(id, label, value, provenance, knowledgeTarget) {
    return Object.freeze({
        id,
        label,
        value: immutableJson(value),
        provenance,
        ...(knowledgeTarget === undefined ? {} : { knowledgeTarget }),
    });
}
function localizationIndex(snapshot) {
    const values = new Map();
    for (const item of Array.isArray(snapshot.localizedStrings) ? snapshot.localizedStrings : []) {
        if (!values.has(item.key))
            values.set(item.key, item);
    }
    return values;
}
function localizedField(entity, fieldId, localizations) {
    const raw = entity.fields?.[fieldId];
    if (typeof raw !== 'string' || raw.length === 0)
        return { value: raw };
    const localized = localizations.get(raw);
    return localized === undefined
        ? { value: raw }
        : {
            value: localized.value,
            provenance: sourceProvenance(localized.source, [
                'localization',
                localized.locale ?? localized.resolvedLocale,
                raw,
            ]),
        };
}
function relatedEntityLabel(entity, localizations, fallback) {
    if (entity === undefined)
        return fallback;
    const resolved = localizedField(entity, 'Name', localizations).value;
    return typeof resolved === 'string' && resolved.length > 0 ? resolved : fallback;
}
function resolvedSnapshotSchemaFields(snapshot, typeId, visiting = new Set()) {
    if (visiting.has(typeId))
        return Object.freeze([]);
    const schema = snapshot.schemas?.find(candidate => candidate.typeId === typeId);
    if (schema === undefined)
        return Object.freeze([]);
    const next = new Set(visiting);
    next.add(typeId);
    const fields = new Map();
    if (schema.parentTypeId !== undefined) {
        for (const field of resolvedSnapshotSchemaFields(snapshot, schema.parentTypeId, next)) {
            fields.set(field.fieldId, field);
        }
    }
    for (const field of schema.fields)
        fields.set(field.fieldId, field);
    return Object.freeze([...fields.values()]);
}
function assetScalarValues(value) {
    if (typeof value === 'string')
        return value.length === 0 ? [] : [value];
    if (Array.isArray(value))
        return value.flatMap(assetScalarValues);
    const record = recordOf(value);
    if (record === undefined || record.value === undefined)
        return [];
    return assetScalarValues(record.value);
}
function visualAssetFacts(snapshot, entity, signal) {
    const values = [];
    const seen = new Set();
    const visit = (value, field, path) => {
        abort(signal);
        if (field.assetKind !== undefined) {
            for (const reference of assetScalarValues(value)) {
                const key = `${path.join('.')}\0${reference}`;
                if (seen.has(key))
                    continue;
                seen.add(key);
                if (values.length >= MAXIMUM_SUBJECT_FIELDS) {
                    throw new RangeError(`visual asset facts must contain at most ${MAXIMUM_SUBJECT_FIELDS} entries`);
                }
                values.push(subjectFact(`asset-${path.map(encodeURIComponent).join('-')}-${values.length}`, `${path.join('.')} asset`, Object.freeze({
                    reference: boundedText(reference),
                    assetKind: field.assetKind,
                    ...(field.valueType === undefined ? {} : { valueType: field.valueType }),
                }), entityProvenance(entity, [entity.namespace, entity.entityId, ...path]), schemaFieldKnowledgeTarget(entity.typeId, path)));
            }
        }
        if (!Array.isArray(field.fields) || field.fields.length === 0)
            return;
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
            const record = recordOf(item);
            if (record === undefined)
                continue;
            const nested = recordOf(record.value) ?? record;
            for (const child of field.fields) {
                if (nested[child.fieldId] === undefined)
                    continue;
                visit(nested[child.fieldId], child, [...path, child.fieldId]);
            }
        }
    };
    const fields = new Map(resolvedSnapshotSchemaFields(snapshot, entity.typeId).map(field => [field.fieldId, field]));
    for (const [fieldId, value] of Object.entries(recordOf(entity.fields) ?? {})) {
        const field = fields.get(fieldId);
        if (field !== undefined)
            visit(value, field, [fieldId]);
    }
    return Object.freeze(values);
}
function schemaTree(snapshot, maxPageSize) {
    const namespaces = snapshot.namespaces.map(item => Object.freeze({ id: `namespace:${encodeURIComponent(item.namespace)}`, hasChildren: true }));
    const schemas = snapshot.schemas.map(item => Object.freeze({ id: `schema:${encodeURIComponent(item.typeId)}`, hasChildren: false }));
    const localizations = snapshot.localizedStrings.map(item => Object.freeze({ id: `localization:${encodeURIComponent(item.key)}`, hasChildren: false }));
    const definitionsByNamespace = new Map();
    for (const item of snapshot.definitions) {
        const values = definitionsByNamespace.get(item.namespace) ?? [];
        values.push(Object.freeze({
            id: `definition:${encodeURIComponent(item.namespace)}:${encodeURIComponent(item.entityId)}`,
            hasChildren: false,
        }));
        definitionsByNamespace.set(item.namespace, values);
    }
    const root = Object.freeze({ id: 'root', hasChildren: true });
    const groups = Object.freeze([
        Object.freeze({ id: 'schemas', hasChildren: schemas.length > 0 }),
        Object.freeze({ id: 'definitions', hasChildren: namespaces.length > 0 }),
        Object.freeze({ id: 'localization', hasChildren: localizations.length > 0 }),
    ]);
    const childrenOf = node => {
        if (node.id === 'root')
            return groups;
        if (node.id === 'schemas')
            return schemas;
        if (node.id === 'definitions')
            return namespaces;
        if (node.id === 'localization')
            return localizations;
        if (node.id.startsWith('namespace:')) {
            return Object.freeze(definitionsByNamespace.get(decodeURIComponent(node.id.slice('namespace:'.length))) ?? []);
        }
        return Object.freeze([]);
    };
    const facts = node => {
        if (node.id === 'root') {
            return Object.freeze({
                kind: 'resolved-definition-workspace',
                label: snapshot.workspaceId,
                preview: `${snapshot.definitions.length} definitions; ${snapshot.localizedStrings.length} localized strings`,
            });
        }
        if (node.id === 'schemas') {
            return Object.freeze({ kind: 'schema-group', label: 'Schemas' });
        }
        if (node.id === 'definitions') {
            return Object.freeze({ kind: 'definition-group', label: 'Effective definitions' });
        }
        if (node.id === 'localization') {
            return Object.freeze({ kind: 'localization-group', label: 'Localization' });
        }
        if (node.id.startsWith('schema:')) {
            const typeId = decodeURIComponent(node.id.slice('schema:'.length));
            const schema = snapshot.schemas.find(item => item.typeId === typeId);
            return Object.freeze({
                kind: 'definition-schema',
                label: typeId,
                preview: `${schema?.fields.length ?? 0} bounded field(s)`,
            });
        }
        if (node.id.startsWith('namespace:')) {
            const namespace = decodeURIComponent(node.id.slice('namespace:'.length));
            return Object.freeze({
                kind: 'definition-namespace',
                label: namespace,
                preview: `${definitionsByNamespace.get(namespace)?.length ?? 0} definition(s)`,
            });
        }
        if (node.id.startsWith('definition:')) {
            const [namespace, entityId] = node.id
                .slice('definition:'.length)
                .split(':')
                .map(decodeURIComponent);
            const entity = snapshot.definitions.find(item => item.namespace === namespace && item.entityId === entityId);
            return Object.freeze({
                kind: 'effective-definition',
                label: entityId ?? '',
                preview: entity === undefined ? 'unavailable' : boundedText(JSON.stringify(entity.fields)),
                semanticPath: Object.freeze([namespace ?? '', entityId ?? '']),
            });
        }
        if (node.id.startsWith('localization:')) {
            const key = decodeURIComponent(node.id.slice('localization:'.length));
            const item = snapshot.localizedStrings.find(value => value.key === key);
            return Object.freeze({
                kind: 'localized-string',
                label: key,
                preview: boundedText(item?.value ?? ''),
                semanticPath: Object.freeze(['localization', key]),
            });
        }
        throw new RangeError(`unknown tree node ${node.id}`);
    };
    return lifecycle({
        root: async () => root,
        children: async (node, request, signal) => page(childrenOf(node), request, `tree:${node.id}`, snapshot.snapshotId, maxPageSize, signal),
        facts: async (node) => facts(node),
        async *search(query, signal) {
            const pattern = String(query?.pattern ?? '').toLocaleLowerCase();
            const candidates = [root, ...groups, ...schemas, ...namespaces, ...localizations];
            for (const values of definitionsByNamespace.values())
                candidates.push(...values);
            for (const node of candidates) {
                abort(signal);
                const item = facts(node);
                if (`${item.label}\n${item.preview ?? ''}`.toLocaleLowerCase().includes(pattern))
                    yield node;
            }
        },
    });
}
function tableSource(snapshot, rows, header, kind, maxPageSize) {
    const frozenRows = Object.freeze(rows.map((cells, index) => Object.freeze({ index, cells: Object.freeze(cells.map(boundedText)) })));
    const prefix = cursorPrefix(kind, snapshot.snapshotId);
    const parseFrom = request => {
        if (request?.kind === 'range')
            return request.from;
        if (request?.kind !== 'cursor' || !request.cursor.startsWith(prefix)) {
            throw new RangeError('table cursor belongs to another source snapshot or table');
        }
        return Number(request.cursor.slice(prefix.length));
    };
    const checked = request => {
        if (!Number.isSafeInteger(request?.count) ||
            request.count <= 0 ||
            request.count > maxPageSize) {
            throw new RangeError(`table page count must be at most ${maxPageSize}`);
        }
        const from = parseFrom(request);
        if (!Number.isSafeInteger(from) || from < 0 || from > frozenRows.length) {
            throw new RangeError('table page starts outside this source snapshot');
        }
        return from;
    };
    return lifecycle({
        shape: async () => Object.freeze({ rows: frozenRows.length, columns: header.length, header }),
        rows: async (request, signal) => {
            abort(signal);
            const from = checked(request);
            const end = Math.min(frozenRows.length, from + request.count);
            return Object.freeze({
                items: Object.freeze(frozenRows.slice(from, end)),
                ...(end < frozenRows.length ? { nextCursor: `${prefix}${String(end)}` } : {}),
            });
        },
        cell: async (coord) => {
            if (!Number.isSafeInteger(coord?.row) ||
                !Number.isSafeInteger(coord?.column) ||
                coord.row < 0 ||
                coord.column < 0 ||
                coord.row >= frozenRows.length ||
                coord.column >= header.length) {
                throw new RangeError('table cell is outside this source snapshot');
            }
            return Object.freeze({ value: frozenRows[coord.row].cells[coord.column] ?? '' });
        },
        async *search(query, signal) {
            const pattern = String(query?.pattern ?? '').toLocaleLowerCase();
            for (const row of frozenRows) {
                abort(signal);
                for (let column = 0; column < row.cells.length; column += 1) {
                    if (row.cells[column].toLocaleLowerCase().includes(pattern)) {
                        yield Object.freeze({ row: row.index, column });
                    }
                }
            }
        },
    });
}
function definitionTable(snapshot, maxPageSize) {
    const header = Object.freeze([
        'namespace',
        'type',
        'id',
        'parent',
        'fields',
        'complete',
        'roots',
        'paths',
    ]);
    const rows = snapshot.definitions.map(item => Object.freeze([
        item.namespace,
        item.typeId,
        item.entityId,
        item.parentEntityId ?? '',
        JSON.stringify(item.fields),
        String(item.complete),
        item.sources.map(source => source.rootId).join('\n'),
        item.sources.map(source => source.path).join('\n'),
    ]));
    return tableSource(snapshot, rows, header, 'definitions', maxPageSize);
}
function localizationTable(snapshot, maxPageSize) {
    const header = Object.freeze([
        'key',
        'value',
        'requestedLocale',
        'resolvedLocale',
        'fallback',
        'root',
        'path',
    ]);
    const rows = snapshot.localizedStrings.map(item => Object.freeze([
        item.key,
        item.value,
        item.requestedLocale,
        item.resolvedLocale,
        String(item.fallback),
        item.source.rootId,
        item.source.path,
    ]));
    return tableSource(snapshot, rows, header, 'localization', maxPageSize);
}
const UNIT_SEMANTIC_FIELDS = Object.freeze([
    Object.freeze({ fieldId: 'Name', label: 'Name', localized: true }),
    Object.freeze({ fieldId: 'Description', label: 'Description', localized: true }),
    Object.freeze({ fieldId: 'LifeMax', label: 'Maximum life' }),
    Object.freeze({ fieldId: 'ShieldsMax', label: 'Maximum shields' }),
    Object.freeze({ fieldId: 'EnergyMax', label: 'Maximum energy' }),
    Object.freeze({ fieldId: 'Speed', label: 'Movement speed' }),
    Object.freeze({ fieldId: 'Food', label: 'Supply' }),
    Object.freeze({ fieldId: 'KillXP', label: 'Kill experience' }),
    Object.freeze({ fieldId: 'Race', label: 'Race' }),
    Object.freeze({
        fieldId: 'DeathType',
        label: 'Death type',
        knowledge: 'missing-description',
    }),
    Object.freeze({ fieldId: 'Attributes', label: 'Attributes' }),
]);
const GENERIC_CARD_NAMESPACES = Object.freeze(new Set(['Weapon', 'Abil', 'Effect', 'Behavior', 'Upgrade', 'Button', 'Actor', 'Model']));
function semanticCardGroups(entity, namespace, localizations, signal) {
    const profile = semanticCardProfile(namespace) ?? [];
    const entityPath = [namespace, entity.entityId];
    const output = [];
    for (const section of profile) {
        abort(signal);
        const entries = [];
        for (const field of section.fields) {
            abort(signal);
            const raw = entity.fields?.[field.fieldId];
            if (raw === undefined)
                continue;
            const resolved = field.fieldId === 'Name' || field.fieldId === 'Description' || field.fieldId === 'Tooltip'
                ? localizedField(entity, field.fieldId, localizations)
                : { value: raw };
            const provenance = [...entityProvenance(entity, [...entityPath, field.fieldId])];
            if (resolved.provenance !== undefined)
                provenance.push(resolved.provenance);
            entries.push(subjectFact(`${section.id}-${field.fieldId.toLocaleLowerCase()}`, field.label, resolved.value, uniqueProvenance(provenance), schemaFieldKnowledgeTarget(entity.typeId, [field.fieldId])));
        }
        if (entries.length > 0)
            output.push(Object.freeze({ ...section, entries }));
    }
    return Object.freeze(output);
}
function genericSubjectFactsSource(snapshot, request, subject) {
    const maxEntities = positiveBound(request.maxEntities, 'maxEntities', DEFAULT_SUBJECT_MAX_ENTITIES, MAXIMUM_SUBJECT_MAX_ENTITIES);
    const maxRelations = positiveBound(request.maxRelations, 'maxRelations', DEFAULT_SUBJECT_MAX_RELATIONS, MAXIMUM_SUBJECT_MAX_RELATIONS);
    if (!Array.isArray(snapshot.definitions) || snapshot.definitions.length > maxEntities) {
        throw new RangeError(`snapshot definitions must contain at most maxEntities ${maxEntities} entries`);
    }
    if (!Array.isArray(snapshot.relations) || snapshot.relations.length > maxRelations) {
        throw new RangeError(`snapshot relations must contain at most maxRelations ${maxRelations} entries`);
    }
    const entities = new Map();
    for (const entity of snapshot.definitions) {
        abort(request.signal);
        entities.set(entityKey(entity.namespace, entity.entityId), entity);
    }
    const entity = entities.get(entityKey(subject.namespace, subject.entityId));
    if (entity === undefined) {
        throw new RangeError(`${subject.namespace}/${subject.entityId} is absent from snapshot ${snapshot.snapshotId}`);
    }
    const fieldEntries = Object.entries(recordOf(entity.fields) ?? {}).sort(([left], [right]) => left.localeCompare(right));
    if (fieldEntries.length > MAXIMUM_SUBJECT_FIELDS) {
        throw new RangeError(`subject fields must contain at most ${MAXIMUM_SUBJECT_FIELDS} top-level entries`);
    }
    const localizations = localizationIndex(snapshot);
    const entityPath = [subject.namespace, entity.entityId];
    const origins = entityProvenance(entity, entityPath);
    const subjectTarget = starcraft2SubjectKnowledgeTarget(subject.namespace);
    const groups = [];
    const facts = new Map();
    const addGroup = (id, label, entries) => {
        if (entries.length === 0)
            return;
        const frozen = Object.freeze(entries);
        facts.set(id, frozen);
        groups.push(Object.freeze({ id, label, factCount: frozen.length }));
    };
    addGroup('identity', 'Identity', [
        subjectFact('catalog-id', 'Catalog id', entity.entityId, origins, subjectTarget),
        subjectFact('catalog-namespace', 'Catalog namespace', entity.namespace, origins, subjectTarget),
        subjectFact('catalog-type', 'Catalog type', entity.typeId, origins),
        ...(entity.parentEntityId === undefined
            ? []
            : [subjectFact('parent', 'Parent', entity.parentEntityId, origins, subjectTarget)]),
        subjectFact('inheritance-chain', 'Inheritance chain', (entity.inheritanceChain ?? []).map(item => `${item.namespace}/${item.entityId}`), origins),
        subjectFact('definition-complete', 'Definition complete', entity.complete === true, origins),
    ]);
    for (const section of semanticCardGroups(entity, subject.namespace, localizations, request.signal)) {
        addGroup(section.id, section.label, section.entries);
    }
    const fieldFacts = [];
    for (const [fieldId, raw] of fieldEntries) {
        abort(request.signal);
        const resolved = fieldId === 'Name' || fieldId === 'Description'
            ? localizedField(entity, fieldId, localizations)
            : { value: raw };
        const provenance = [...entityProvenance(entity, [...entityPath, fieldId])];
        if (resolved.provenance !== undefined)
            provenance.push(resolved.provenance);
        fieldFacts.push(subjectFact(`field-${fieldId}`, fieldId, resolved.value, uniqueProvenance(provenance), schemaFieldKnowledgeTarget(entity.typeId, [fieldId])));
    }
    addGroup('data', `${subject.namespace} data`, fieldFacts);
    addGroup('visual-assets', 'Visual assets', visualAssetFacts(snapshot, entity, request.signal));
    const relations = [];
    let deadRelations = 0;
    for (const relation of snapshot.relations) {
        abort(request.signal);
        const outgoing = relation.from.namespace === subject.namespace && relation.from.entityId === entity.entityId;
        const incoming = relation.to.namespace === subject.namespace && relation.to.entityId === entity.entityId;
        if (!outgoing && !incoming)
            continue;
        const direction = outgoing ? 'outgoing' : 'incoming';
        const ref = outgoing ? relation.to : relation.from;
        const relatedEntity = entities.get(entityKey(ref.namespace, ref.entityId));
        if (relation.dead)
            deadRelations += 1;
        relations.push(Object.freeze({
            role: `${direction}:${relation.role}`,
            subjectId: `${ref.namespace}/${ref.entityId}`,
            label: relatedEntityLabel(relatedEntity, localizations, ref.entityId),
            kind: ref.namespace,
            direction,
            edgeRole: relation.role,
            ...(relation.dead ? { dead: true } : {}),
            ...(relation.source === undefined
                ? {}
                : {
                    provenance: Object.freeze([
                        sourceProvenance(relation.source, [
                            relation.from.namespace,
                            relation.from.entityId,
                            relation.role,
                        ]),
                    ]),
                }),
        }));
    }
    relations.sort((left, right) => `${left.direction}\0${left.edgeRole}\0${left.subjectId}`.localeCompare(`${right.direction}\0${right.edgeRole}\0${right.subjectId}`));
    const frozenGroups = Object.freeze(groups);
    const frozenRelations = Object.freeze(relations);
    const localizedName = localizedField(entity, 'Name', localizations).value;
    const reasons = [];
    if (snapshot.complete !== true)
        reasons.push('snapshot-incomplete');
    if (entity.complete !== true)
        reasons.push('definition-incomplete');
    if (deadRelations > 0)
        reasons.push('dead-relations');
    const warnings = [];
    if (snapshot.complete !== true) {
        warnings.push(Object.freeze({
            code: 'blizzard.starcraft2/subject-facts-snapshot-incomplete',
            message: 'the source resolved-data snapshot is incomplete',
        }));
    }
    if (deadRelations > 0) {
        warnings.push(Object.freeze({
            code: 'blizzard.starcraft2/subject-facts-dead-relations',
            message: `${deadRelations} subject relation(s) point to unresolved definitions`,
        }));
    }
    const summary = Object.freeze({
        snapshotId: snapshot.snapshotId,
        identity: Object.freeze({
            subjectId: `${subject.namespace}/${entity.entityId}`,
            label: typeof localizedName === 'string' && localizedName.length > 0
                ? localizedName
                : entity.entityId,
            kind: 'sc2-catalog-entity',
            type: entity.typeId,
            origins,
        }),
        groupCount: frozenGroups.length,
        relationCount: frozenRelations.length,
        provenance: Object.freeze({
            snapshot: Object.freeze({
                snapshotId: snapshot.snapshotId,
                workspaceId: snapshot.workspaceId,
                analyzerId: snapshot.analyzerId,
            }),
            schema: Object.freeze({
                contract: STARCRAFT2_DATA_SCHEMA_CONTRACT,
                major: 1,
                revision: STARCRAFT2_DATA_SCHEMA_REVISION,
            }),
        }),
        completeness: Object.freeze({
            state: reasons.length === 0 ? 'complete' : 'partial',
            reasons: Object.freeze(reasons),
            snapshotComplete: snapshot.complete === true,
            definitionComplete: entity.complete === true,
            relations: deadRelations === 0 ? 'complete' : 'incomplete',
            knowledge: 'exact-target-or-explicitly-missing',
            bounds: Object.freeze({
                maxEntities,
                maxRelations,
                maxFields: MAXIMUM_SUBJECT_FIELDS,
            }),
        }),
        warnings: Object.freeze(warnings),
    });
    const cursorKind = `subject:${encodeURIComponent(`${subject.namespace}/${entity.entityId}`)}`;
    return lifecycle({
        summary: async (signal) => {
            abort(signal);
            return summary;
        },
        groups: async (pageRequest, signal) => page(frozenGroups, pageRequest, `${cursorKind}:groups`, snapshot.snapshotId, request.maxPageSize, signal),
        facts: async (groupId, pageRequest, signal) => {
            const values = facts.get(groupId);
            if (values === undefined)
                throw new RangeError(`unknown subject fact group: ${groupId}`);
            return page(values, pageRequest, `${cursorKind}:facts:${encodeURIComponent(groupId)}`, snapshot.snapshotId, request.maxPageSize, signal);
        },
        relations: async (pageRequest, signal) => page(frozenRelations, pageRequest, `${cursorKind}:relations`, snapshot.snapshotId, request.maxPageSize, signal),
    });
}
function subjectFactsSource(snapshot, request) {
    abort(request.signal);
    const subject = recordOf(request.subject);
    if (subject === undefined)
        throw new TypeError('subject facts request must name a subject');
    if (subject.namespace !== 'Unit' && !GENERIC_CARD_NAMESPACES.has(subject.namespace)) {
        throw new RangeError(`the current SC2 Product-GA subject card slice does not support ${String(subject.namespace)}`);
    }
    if (typeof subject.entityId !== 'string' ||
        subject.entityId.length === 0 ||
        subject.entityId.length > 512) {
        throw new TypeError('subject.entityId must contain between 1 and 512 characters');
    }
    if (subject.namespace !== 'Unit')
        return genericSubjectFactsSource(snapshot, request, subject);
    const maxEntities = positiveBound(request.maxEntities, 'maxEntities', DEFAULT_SUBJECT_MAX_ENTITIES, MAXIMUM_SUBJECT_MAX_ENTITIES);
    const maxRelations = positiveBound(request.maxRelations, 'maxRelations', DEFAULT_SUBJECT_MAX_RELATIONS, MAXIMUM_SUBJECT_MAX_RELATIONS);
    const maxCalculations = positiveBound(request.maxCalculations, 'maxCalculations', undefined, MAXIMUM_SUBJECT_MAX_CALCULATIONS);
    if (!Array.isArray(snapshot.definitions) || snapshot.definitions.length > maxEntities) {
        throw new RangeError(`snapshot definitions must contain at most maxEntities ${maxEntities} entries`);
    }
    if (!Array.isArray(snapshot.relations) || snapshot.relations.length > maxRelations) {
        throw new RangeError(`snapshot relations must contain at most maxRelations ${maxRelations} entries`);
    }
    const entities = new Map();
    for (const entity of snapshot.definitions) {
        abort(request.signal);
        entities.set(entityKey(entity.namespace, entity.entityId), entity);
    }
    const unit = entities.get(entityKey('Unit', subject.entityId));
    if (unit === undefined) {
        throw new RangeError(`Unit/${subject.entityId} is absent from snapshot ${snapshot.snapshotId}`);
    }
    const localizations = localizationIndex(snapshot);
    const resolvedFieldEntries = Object.entries(recordOf(unit.fields) ?? {}).sort(([left], [right]) => left.localeCompare(right));
    if (resolvedFieldEntries.length > MAXIMUM_SUBJECT_FIELDS) {
        throw new RangeError(`subject fields must contain at most ${MAXIMUM_SUBJECT_FIELDS} top-level entries`);
    }
    const calculation = calculateStarcraft2UnitWeaponDps(snapshot, {
        unitId: subject.entityId,
        maxEntities,
        maxWeapons: maxCalculations,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const facts = new Map();
    const groups = [];
    const addGroup = (id, label, entries) => {
        if (entries.length === 0)
            return;
        const frozenEntries = Object.freeze(entries);
        facts.set(id, frozenEntries);
        groups.push(Object.freeze({ id, label, factCount: frozenEntries.length }));
    };
    const unitPath = ['Unit', unit.entityId];
    const unitOrigins = entityProvenance(unit, unitPath);
    const subjectTarget = starcraft2SubjectKnowledgeTarget('Unit');
    addGroup('identity', 'Identity', [
        subjectFact('catalog-id', 'Catalog id', unit.entityId, unitOrigins, subjectTarget),
        subjectFact('catalog-type', 'Catalog type', unit.typeId, unitOrigins),
        ...(unit.parentEntityId === undefined
            ? []
            : [subjectFact('parent', 'Parent', unit.parentEntityId, unitOrigins, subjectTarget)]),
        subjectFact('inheritance-chain', 'Inheritance chain', (unit.inheritanceChain ?? []).map(item => `${item.namespace}/${item.entityId}`), unitOrigins),
        subjectFact('definition-complete', 'Definition complete', unit.complete === true, unitOrigins),
    ]);
    const unitFacts = [];
    const missingDescriptions = [];
    for (const field of UNIT_SEMANTIC_FIELDS) {
        abort(request.signal);
        const raw = unit.fields?.[field.fieldId];
        if (raw === undefined)
            continue;
        const resolved = field.localized
            ? localizedField(unit, field.fieldId, localizations)
            : { value: raw };
        const provenance = [...entityProvenance(unit, [...unitPath, field.fieldId])];
        if (resolved.provenance !== undefined)
            provenance.push(resolved.provenance);
        if (field.knowledge === 'missing-description') {
            missingDescriptions.push(`CUnit.${field.fieldId}`);
        }
        unitFacts.push(subjectFact(`unit-${field.fieldId.toLocaleLowerCase()}`, field.label, resolved.value, uniqueProvenance(provenance), field.knowledge === 'missing-description'
            ? undefined
            : starcraft2FieldKnowledgeTarget('CUnit', [field.fieldId])));
    }
    addGroup('unit', 'Unit data', unitFacts);
    for (const section of semanticCardGroups(unit, 'Unit', localizations, request.signal)) {
        // The calculated weapon section below supersedes the raw slot list while
        // retaining WeaponArray in the complete resolved-field section.
        if (section.id === 'weapons')
            continue;
        addGroup(section.id, section.label, section.entries);
    }
    const resolvedFieldFacts = [];
    for (const [fieldId, raw] of resolvedFieldEntries) {
        abort(request.signal);
        const resolved = fieldId === 'Name' || fieldId === 'Description'
            ? localizedField(unit, fieldId, localizations)
            : { value: raw };
        const provenance = [...entityProvenance(unit, [...unitPath, fieldId])];
        if (resolved.provenance !== undefined)
            provenance.push(resolved.provenance);
        resolvedFieldFacts.push(subjectFact(`field-${fieldId}`, fieldId, resolved.value, uniqueProvenance(provenance), schemaFieldKnowledgeTarget(unit.typeId, [fieldId])));
    }
    addGroup('resolved-fields', 'All resolved fields', resolvedFieldFacts);
    addGroup('visual-assets', 'Visual assets', visualAssetFacts(snapshot, unit, request.signal));
    const weaponFacts = [];
    for (const result of calculation.results) {
        abort(request.signal);
        const slot = String(result.unitWeaponIndex);
        const weaponId = result.weapon.entityId;
        const weapon = entities.get(entityKey('Weapon', weaponId));
        const weaponPath = ['Weapon', weaponId];
        weaponFacts.push(subjectFact(`weapon-${slot}-link`, `Weapon ${slot}`, weaponId, entityProvenance(unit, [...unitPath, 'WeaponArray', slot, 'Link']), starcraft2FieldKnowledgeTarget('CUnit', ['WeaponArray', 'Link'])));
        if (weapon !== undefined) {
            const range = finiteNumber(weapon.fields?.Range);
            if (range !== undefined) {
                weaponFacts.push(subjectFact(`weapon-${slot}-range`, `Weapon ${slot} range`, range, entityProvenance(weapon, [...weaponPath, 'Range']), starcraft2FieldKnowledgeTarget('CWeapon', ['Range'])));
            }
        }
        const period = result.inputs.period;
        if (period.state === 'resolved') {
            weaponFacts.push(subjectFact(`weapon-${slot}-period`, `Weapon ${slot} period`, period.value, weapon === undefined
                ? Object.freeze([])
                : entityProvenance(weapon, [...weaponPath, 'Period']), starcraft2FieldKnowledgeTarget('CWeapon', ['Period'])));
        }
        const selectedEffect = result.provenance.selectedEffect;
        if (selectedEffect !== undefined) {
            weaponFacts.push(subjectFact(`weapon-${slot}-effect`, `Weapon ${slot} effect`, selectedEffect.entityId, weapon === undefined
                ? Object.freeze([])
                : entityProvenance(weapon, [
                    ...weaponPath,
                    result.provenance.selectedEffectField,
                    'Link',
                ]), starcraft2FieldKnowledgeTarget('CWeapon', [
                result.provenance.selectedEffectField,
                'Link',
            ])));
        }
        const damage = result.inputs.damage;
        if (damage.state === 'resolved' && selectedEffect !== undefined) {
            const effect = entities.get(entityKey('Effect', selectedEffect.entityId));
            weaponFacts.push(subjectFact(`weapon-${slot}-damage`, `Weapon ${slot} damage`, damage.value, effect === undefined
                ? Object.freeze([])
                : entityProvenance(effect, ['Effect', effect.entityId, 'Amount']), starcraft2FieldKnowledgeTarget('CEffectDamage', ['Amount'])));
        }
        if (result.status === 'computed') {
            const dpsProvenance = [];
            for (const entity of result.provenance.entities) {
                for (const source of entity.sources) {
                    dpsProvenance.push(sourceProvenance(source, [
                        entity.ref.namespace,
                        entity.ref.entityId,
                        'simple-weapon-dps',
                    ]));
                }
            }
            weaponFacts.push(subjectFact(`weapon-${slot}-dps`, `Weapon ${slot} simple DPS`, result.value, uniqueProvenance(dpsProvenance), starcraft2ConceptKnowledgeTarget('simple-weapon-dps')));
        }
        weaponFacts.push(subjectFact(`weapon-${slot}-calculation`, `Weapon ${slot} calculation`, Object.freeze({
            status: result.status,
            completeness: result.completeness.state,
            warningCodes: Object.freeze(result.warnings.map(item => item.code)),
        }), uniqueProvenance([
            ...entityProvenance(unit, unitPath),
            ...(weapon === undefined ? [] : entityProvenance(weapon, weaponPath)),
        ]), starcraft2ConceptKnowledgeTarget('simple-weapon-dps')));
    }
    addGroup('weapons', 'Weapons', weaponFacts);
    const related = [];
    let deadRelations = 0;
    for (const relation of snapshot.relations) {
        abort(request.signal);
        const outgoing = relation.from.namespace === 'Unit' && relation.from.entityId === unit.entityId;
        const incoming = relation.to.namespace === 'Unit' && relation.to.entityId === unit.entityId;
        if (!outgoing && !incoming)
            continue;
        const direction = outgoing ? 'outgoing' : 'incoming';
        const ref = outgoing ? relation.to : relation.from;
        const relatedEntity = entities.get(entityKey(ref.namespace, ref.entityId));
        if (relation.dead)
            deadRelations += 1;
        related.push(Object.freeze({
            role: `${direction}:${relation.role}`,
            subjectId: `${ref.namespace}/${ref.entityId}`,
            label: relatedEntityLabel(relatedEntity, localizations, ref.entityId),
            kind: ref.namespace,
            direction,
            edgeRole: relation.role,
            ...(relation.dead ? { dead: true } : {}),
            ...(relation.source === undefined
                ? {}
                : {
                    provenance: Object.freeze([
                        sourceProvenance(relation.source, [
                            relation.from.namespace,
                            relation.from.entityId,
                            relation.role,
                        ]),
                    ]),
                }),
        }));
    }
    related.sort((left, right) => `${left.direction}\0${left.edgeRole}\0${left.subjectId}`.localeCompare(`${right.direction}\0${right.edgeRole}\0${right.subjectId}`));
    const frozenGroups = Object.freeze(groups);
    const frozenRelations = Object.freeze(related);
    const name = localizedField(unit, 'Name', localizations).value;
    const warnings = [...calculation.warnings];
    if (snapshot.complete !== true) {
        warnings.push(Object.freeze({
            code: 'blizzard.starcraft2/subject-facts-snapshot-incomplete',
            message: 'the source resolved-data snapshot is incomplete',
        }));
    }
    if (deadRelations > 0) {
        warnings.push(Object.freeze({
            code: 'blizzard.starcraft2/subject-facts-dead-relations',
            message: `${deadRelations} subject relation(s) point to unresolved definitions`,
        }));
    }
    if (missingDescriptions.length > 0) {
        warnings.push(Object.freeze({
            code: 'blizzard.starcraft2/subject-facts-knowledge-description-missing',
            message: `No confirmed field description is published for: ${missingDescriptions.join(', ')}`,
        }));
    }
    const completenessReasons = [];
    if (snapshot.complete !== true)
        completenessReasons.push('snapshot-incomplete');
    if (calculation.completeness.state !== 'complete') {
        completenessReasons.push(`calculation-${calculation.completeness.state}`);
    }
    if (deadRelations > 0)
        completenessReasons.push('dead-relations');
    const summary = Object.freeze({
        snapshotId: snapshot.snapshotId,
        identity: Object.freeze({
            subjectId: `Unit/${unit.entityId}`,
            label: typeof name === 'string' && name.length > 0 ? name : unit.entityId,
            kind: 'sc2-catalog-entity',
            type: unit.typeId,
            origins: unitOrigins,
        }),
        groupCount: frozenGroups.length,
        relationCount: frozenRelations.length,
        provenance: Object.freeze({
            snapshot: Object.freeze({
                snapshotId: snapshot.snapshotId,
                workspaceId: snapshot.workspaceId,
                analyzerId: snapshot.analyzerId,
            }),
            schema: Object.freeze({
                contract: STARCRAFT2_DATA_SCHEMA_CONTRACT,
                major: 1,
                revision: STARCRAFT2_DATA_SCHEMA_REVISION,
            }),
            calculation: calculation.provenance.algorithm,
        }),
        completeness: Object.freeze({
            state: completenessReasons.length === 0 ? 'complete' : 'partial',
            reasons: Object.freeze(completenessReasons),
            snapshotComplete: snapshot.complete === true,
            calculation: calculation.completeness,
            relations: deadRelations === 0 ? 'complete' : 'incomplete',
            missingDescriptions: Object.freeze(missingDescriptions),
            bounds: Object.freeze({
                maxEntities,
                maxRelations,
                maxCalculations,
                maxFields: MAXIMUM_SUBJECT_FIELDS,
            }),
        }),
        warnings: Object.freeze(warnings),
    });
    const subjectCursorKind = `subject:${encodeURIComponent(`Unit/${unit.entityId}`)}`;
    return lifecycle({
        summary: async (signal) => {
            abort(signal);
            return summary;
        },
        groups: async (requestValue, signal) => page(frozenGroups, requestValue, `${subjectCursorKind}:groups`, snapshot.snapshotId, request.maxPageSize, signal),
        facts: async (groupId, requestValue, signal) => {
            const values = facts.get(groupId);
            if (values === undefined)
                throw new RangeError(`unknown subject fact group: ${groupId}`);
            return page(values, requestValue, `${subjectCursorKind}:facts:${encodeURIComponent(groupId)}`, snapshot.snapshotId, request.maxPageSize, signal);
        },
        relations: async (requestValue, signal) => page(frozenRelations, requestValue, `${subjectCursorKind}:relations`, snapshot.snapshotId, request.maxPageSize, signal),
    });
}
function calculationInputProvenance(snapshot, value) {
    const ref = recordOf(value.entity);
    if (ref === undefined)
        return Object.freeze([]);
    const entity = snapshot.definitions.find(item => item.namespace === ref.namespace && item.entityId === ref.entityId);
    if (entity === undefined)
        return Object.freeze([]);
    const fieldPath = typeof value.fieldPath === 'string' && value.fieldPath.length > 0
        ? value.fieldPath.split('.').filter(Boolean)
        : [];
    return entityProvenance(entity, [entity.namespace, entity.entityId, ...fieldPath]);
}
function commonCalculationInput(snapshot, value, calculationStatus) {
    const unsupported = value.name === 'damage' && calculationStatus === 'unsupported';
    const state = value.origin === 'implicit-sc2-default'
        ? 'defaulted'
        : unsupported
            ? 'unsupported'
            : value.state;
    return Object.freeze({
        id: value.name,
        label: value.name === 'damage'
            ? 'Damage'
            : value.name === 'attacks'
                ? 'Attacks per period'
                : 'Period',
        state,
        ...(value.value === null ? {} : { value: immutableJson(value.value) }),
        unit: value.unit,
        provenance: calculationInputProvenance(snapshot, value),
        ...(value.name === 'damage'
            ? { knowledgeTarget: starcraft2FieldKnowledgeTarget('CEffectDamage', ['Amount']) }
            : value.name === 'period'
                ? { knowledgeTarget: starcraft2FieldKnowledgeTarget('CWeapon', ['Period']) }
                : {}),
    });
}
function commonCalculationProvenance(snapshot, result) {
    const values = [];
    for (const item of result.provenance.entities) {
        const entity = snapshot.definitions.find(candidate => candidate.namespace === item.ref.namespace && candidate.entityId === item.ref.entityId);
        if (entity === undefined)
            continue;
        values.push(...entityProvenance(entity, [
            entity.namespace,
            entity.entityId,
            STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.id,
        ]));
    }
    return uniqueProvenance(values);
}
function semanticCalculationProvenance(result) {
    const values = [];
    for (const entity of result.provenance.entities) {
        for (const source of entity.sources) {
            values.push(sourceProvenance(source, [entity.ref.namespace, entity.ref.entityId, result.formula.id]));
        }
    }
    for (const edge of result.provenance.edges) {
        if (edge.source === undefined)
            continue;
        values.push(sourceProvenance(edge.source, [edge.from.namespace, edge.from.entityId, edge.fieldPath]));
    }
    return uniqueProvenance(values);
}
function commonSemanticCalculation(result) {
    const conceptId = result.kind === 'production' ? 'unit-production-route' : 'ability-effect-chain';
    return Object.freeze({
        id: result.id,
        label: result.label,
        formula: Object.freeze({ ...result.formula }),
        status: result.status,
        value: immutableJson(result.value),
        unit: result.kind === 'production' ? 'production-route' : 'effect-chain',
        inputs: Object.freeze(result.inputs.map((edge, index) => Object.freeze({
            id: `relation-${index}`,
            label: edge.fieldPath,
            state: 'resolved',
            value: Object.freeze({
                from: `${edge.from.namespace}/${edge.from.entityId}`,
                to: `${edge.to.namespace}/${edge.to.entityId}`,
                fieldPath: edge.fieldPath,
            }),
            unit: 'relation-edge',
            provenance: edge.source === undefined
                ? Object.freeze([])
                : Object.freeze([
                    sourceProvenance(edge.source, [
                        edge.from.namespace,
                        edge.from.entityId,
                        edge.fieldPath,
                    ]),
                ]),
        }))),
        provenance: semanticCalculationProvenance(result),
        warnings: Object.freeze(result.warnings.map(item => Object.freeze({ code: item.code, message: item.message }))),
        knowledgeTarget: starcraft2ConceptKnowledgeTarget(conceptId),
    });
}
function subjectCalculationsSource(snapshot, request) {
    abort(request.signal);
    const subject = recordOf(request.subject);
    if (subject === undefined)
        throw new TypeError('subject calculations request must name a subject');
    if (subject.namespace !== 'Unit') {
        throw new RangeError(`the current SC2 Product-GA calculation slice supports Unit, not ${String(subject.namespace)}`);
    }
    if (typeof subject.entityId !== 'string' ||
        subject.entityId.length === 0 ||
        subject.entityId.length > 512) {
        throw new TypeError('subject.entityId must contain between 1 and 512 characters');
    }
    const maxEntities = positiveBound(request.maxEntities, 'maxEntities', DEFAULT_SUBJECT_MAX_ENTITIES, MAXIMUM_SUBJECT_MAX_ENTITIES);
    const maxCalculations = positiveBound(request.maxCalculations, 'maxCalculations', undefined, MAXIMUM_SUBJECT_MAX_CALCULATIONS);
    const calculation = calculateStarcraft2UnitWeaponDps(snapshot, {
        unitId: subject.entityId,
        maxEntities,
        maxWeapons: maxCalculations,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const semanticCalculation = calculateStarcraft2UnitSemantics(snapshot, {
        unitId: subject.entityId,
        maxEntities,
        maxRelations: request.maxRelations,
        maxResults: maxCalculations,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const formula = Object.freeze({
        id: calculation.formula.id,
        name: calculation.formula.name,
        version: calculation.formula.version,
        expression: calculation.formula.expression,
    });
    const dpsValues = calculation.results.map(result => {
        abort(request.signal);
        const inputs = Object.freeze(['damage', 'attacks', 'period'].map(name => commonCalculationInput(snapshot, result.inputs[name], result.status)));
        return Object.freeze({
            id: `weapon-${String(result.unitWeaponIndex)}-simple-dps`,
            label: `Weapon ${String(result.unitWeaponIndex)} simple DPS`,
            formula,
            status: result.status,
            ...(result.value === undefined ? {} : { value: result.value }),
            ...(result.rawValue === undefined ? {} : { rawValue: result.rawValue }),
            unit: result.unit,
            inputs,
            provenance: commonCalculationProvenance(snapshot, result),
            warnings: Object.freeze(result.warnings.map(item => Object.freeze({ code: item.code, message: item.message }))),
            knowledgeTarget: starcraft2ConceptKnowledgeTarget('simple-weapon-dps'),
        });
    });
    const unboundedValues = [
        ...dpsValues,
        ...semanticCalculation.results.map(commonSemanticCalculation),
    ];
    const values = Object.freeze(unboundedValues.slice(0, maxCalculations));
    const resultCapped = unboundedValues.length > maxCalculations;
    const completeness = calculation.completeness.truncated || semanticCalculation.completeness.truncated || resultCapped
        ? 'capped'
        : calculation.completeness.state === 'complete' &&
            semanticCalculation.completeness.state === 'complete'
            ? 'complete'
            : 'partial';
    const summary = Object.freeze({
        snapshotId: snapshot.snapshotId,
        subjectId: `Unit/${subject.entityId}`,
        totalCalculations: values.length,
        completeness,
        ...(completeness === 'complete'
            ? {}
            : {
                reason: `calculation evidence is ${completeness}; unsupported effect semantics and missing inputs are not inferred`,
            }),
    });
    const cursorKind = `subject:${encodeURIComponent(`Unit/${subject.entityId}`)}:calculations`;
    return lifecycle({
        summary: async (signal) => {
            abort(signal);
            return summary;
        },
        calculations: async (pageRequest, signal) => page(values, pageRequest, cursorKind, snapshot.snapshotId, request.maxPageSize, signal),
    });
}
function relationSource(snapshot, maxPageSize, signal) {
    abort(signal);
    if (!Array.isArray(snapshot.definitions) ||
        snapshot.definitions.length > MAXIMUM_RELATION_GRAPH_DEFINITIONS) {
        throw new RangeError(`relation graph definitions must not exceed ${MAXIMUM_RELATION_GRAPH_DEFINITIONS}`);
    }
    if (!Array.isArray(snapshot.relations) ||
        snapshot.relations.length > MAXIMUM_RELATION_GRAPH_EDGES) {
        throw new RangeError(`relation graph edges must not exceed ${MAXIMUM_RELATION_GRAPH_EDGES}`);
    }
    const nodes = [];
    const nodeIds = new Set();
    const counts = new Map();
    const addNode = (id, label, type) => {
        if (nodeIds.has(id))
            return;
        nodeIds.add(id);
        nodes.push(Object.freeze({ id, label, type }));
        counts.set(type, (counts.get(type) ?? 0) + 1);
    };
    for (const entity of snapshot.definitions) {
        abort(signal);
        addNode(`${entity.namespace}/${entity.entityId}`, entity.entityId, entity.namespace);
    }
    const edges = snapshot.relations.map(relation => {
        abort(signal);
        const from = `${relation.from.namespace}/${relation.from.entityId}`;
        const to = `${relation.to.namespace}/${relation.to.entityId}`;
        if (relation.dead)
            addNode(to, relation.to.entityId, `missing-${relation.to.namespace}`);
        return Object.freeze({
            from,
            to,
            role: relation.role,
            ...(relation.dead ? { dead: true } : {}),
            ...(relation.source === undefined
                ? {}
                : {
                    provenance: Object.freeze([
                        sourceProvenance(relation.source, [
                            relation.from.namespace,
                            relation.from.entityId,
                            relation.role,
                        ]),
                    ]),
                }),
        });
    });
    const deadEdges = edges.filter(edge => edge.dead === true).length;
    const complete = snapshot.complete === true && deadEdges === 0;
    const summary = Object.freeze({
        snapshotId: snapshot.snapshotId,
        totalNodes: nodes.length,
        totalEdges: edges.length,
        types: Object.freeze([...counts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([id, count], tone) => Object.freeze({ id, label: id, count, tone }))),
        completeness: complete ? 'complete' : 'partial',
        ...(complete
            ? {}
            : {
                reason: `${snapshot.complete === true ? 0 : 1} snapshot completeness issue(s) and ${deadEdges} unresolved relation target(s)`,
            }),
        schema: Object.freeze({
            typeCount: STARCRAFT2_DATA_SCHEMA_COVERAGE.typeCount,
            linkFieldCount: STARCRAFT2_DATA_SCHEMA_COVERAGE.linkFieldCount,
            digest: STARCRAFT2_DATA_SCHEMA_PROVENANCE.digest,
        }),
    });
    return lifecycle({
        summary: async (signal) => {
            abort(signal);
            return summary;
        },
        nodes: async (request, signal) => page(nodes, request, 'relation-nodes', snapshot.snapshotId, maxPageSize, signal),
        edges: async (request, signal) => page(edges, request, 'relation-edges', snapshot.snapshotId, maxPageSize, signal),
    });
}
export function openStarcraft2DataSource(snapshot, kind, maxPageSize, options = {}) {
    validateOpen(snapshot, maxPageSize);
    if (kind === 'schema-tree')
        return schemaTree(snapshot, maxPageSize);
    if (kind === 'definition-table')
        return definitionTable(snapshot, maxPageSize);
    if (kind === 'localization-table')
        return localizationTable(snapshot, maxPageSize);
    if (kind === 'relations')
        return relationSource(snapshot, maxPageSize, options.signal);
    throw new TypeError(`unknown StarCraft II data-source kind ${String(kind)}`);
}
/**
 * Open the generic card/facts projection over the same immutable resolved-data snapshot.
 * This does not parse or cache another catalog.
 */
export function openStarcraft2SubjectFactsSource(snapshot, request) {
    validateOpen(snapshot, request?.maxPageSize);
    if (request?.snapshotId !== snapshot.snapshotId) {
        throw new RangeError('subject facts request belongs to another data snapshot');
    }
    return subjectFactsSource(snapshot, request);
}
/** Open strict, auditable Unit calculations over the same immutable resolved-data snapshot. */
export function openStarcraft2SubjectCalculationsSource(snapshot, request) {
    validateOpen(snapshot, request?.maxPageSize);
    if (request?.snapshotId !== snapshot.snapshotId) {
        throw new RangeError('subject calculations request belongs to another data snapshot');
    }
    return subjectCalculationsSource(snapshot, request);
}
