import { calculateStarcraft2UnitSemantics, calculateStarcraft2UnitWeaponDps, STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA, } from '../calculations/index.js';
import { STARCRAFT2_DATA_SCHEMA_CONTRACT, STARCRAFT2_DATA_SCHEMA_REVISION, starcraft2ConceptKnowledgeTarget, starcraft2FieldKnowledgeTarget, } from '../schema/data-schema-identity.js';
import { STARCRAFT2_DATA_SCHEMA_COVERAGE, STARCRAFT2_DATA_SCHEMA_PROVENANCE, starcraft2DeclaringTypeForField, } from '../schema/full-data-schema.js';
import { snapshotEntityFacts } from '@modkit/blizzard-starcraft2/data/entity-cards';
import { entityDeclarationSpans } from '@modkit/blizzard-starcraft2/data/format';
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
/**
 * The page a request gets: `limit` is the most the caller wants, and a source with a smaller page
 * serves its own page with `nextCursor` rather than refusing (core 7a4d1670).
 */
function pageLimit(request, maximum) {
    if (!Number.isSafeInteger(request?.limit) || request.limit <= 0) {
        throw new RangeError('page limit must be a positive integer');
    }
    return Math.min(request.limit, maximum);
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
/** A path on disk as a file URL, without `node:url` (the service also runs in a worker). */
function fileUri(path) {
    const slashed = path.replace(/\\/gu, '/');
    const segments = slashed
        .split('/')
        .map((segment, index) => (index === 0 && /^[a-z]:$/iu.test(segment) ? segment : encodeURIComponent(segment)));
    return `file://${slashed.startsWith('/') ? '' : '/'}${segments.join('/')}`;
}
/**
 * Where a provenance entry's file is and where it declares the entity (parity plan 5.2), for a card
 * to open the declaration: the layer file's address — a file URL on disk, `content-source://` in a
 * content source — and the span of the entity's opening tag (`semanticPath` is `[namespace, id,
 * …]`). The label names the file, as `sourceLabel` spells it for the documents analysed. A root on
 * disk, and a map nested under one, has a logical `sourcePath` and its real path in `location`.
 */
export function provenanceDeclarations(documents, workspace) {
    const byLabel = new Map(documents.map(document => [sourceLabel(document), document]));
    const roots = new Map((workspace?.loadOrder ?? []).map(root => [root.rootId, root]));
    const spans = new Map();
    const addressOf = (root, path) => {
        // A root on disk states its real path (`location`, core e4decaa7); `sourcePath` is then a prefix.
        const base = root.location ?? root.sourcePath;
        if (/^[a-z]:[\\/]|^[\\/]/iu.test(base))
            return fileUri(`${base}/${path}`);
        if (/^context-layers\//u.test(base))
            return undefined;
        const segments = [...base.split('/'), ...path.split('/')].filter(segment => segment !== '');
        return `content-source://${encodeURIComponent(root.sourceId)}/${segments.map(encodeURIComponent).join('/')}`;
    };
    return provenance => {
        const document = byLabel.get(provenance.label);
        const root = document === undefined ? undefined : roots.get(document.rootId);
        const uri = root === undefined ? undefined : addressOf(root, document.path);
        if (uri === undefined)
            return provenance;
        const id = provenance.semanticPath?.[1];
        let declared = spans.get(provenance.label);
        if (id !== undefined && declared === undefined && /\.xml$/iu.test(document.path)) {
            declared = entityDeclarationSpans(document.text ?? '');
            spans.set(provenance.label, declared);
        }
        const range = id === undefined ? undefined : declared?.get(id);
        return Object.freeze({
            ...provenance,
            source: Object.freeze({ id: uri, uri }),
            ...(range === undefined ? {} : { range }),
        });
    };
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
function resolvedFieldFacts(entity, localizations, signal) {
    const entries = Object.entries(recordOf(entity.fields) ?? {}).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length > MAXIMUM_SUBJECT_FIELDS) {
        throw new RangeError(`subject fields must contain at most ${MAXIMUM_SUBJECT_FIELDS} top-level entries`);
    }
    const entityPath = [entity.namespace, entity.entityId];
    return entries.map(([fieldId, raw]) => {
        abort(signal);
        const resolved = fieldId === 'Name' || fieldId === 'Description'
            ? localizedField(entity, fieldId, localizations)
            : { value: raw };
        const provenance = [...entityProvenance(entity, [...entityPath, fieldId])];
        if (resolved.provenance !== undefined)
            provenance.push(resolved.provenance);
        return subjectFact(`field-${fieldId}`, fieldId, resolved.value, uniqueProvenance(provenance), schemaFieldKnowledgeTarget(entity.typeId, [fieldId]));
    });
}
/** A Unit's weapons as the calculations service computes them: DPS with its formula and inputs. */
function unitWeaponFacts(unit, byKey, calculation, signal) {
    const unitPath = ['Unit', unit.entityId];
    const facts = [];
    for (const result of calculation.results) {
        abort(signal);
        const slot = String(result.unitWeaponIndex);
        const weaponId = result.weapon.entityId;
        const weapon = byKey.get(entityKey('Weapon', weaponId));
        const weaponPath = ['Weapon', weaponId];
        facts.push(subjectFact(`weapon-${slot}-link`, `Weapon ${slot}`, weaponId, entityProvenance(unit, [...unitPath, 'WeaponArray', slot, 'Link']), starcraft2FieldKnowledgeTarget('CUnit', ['WeaponArray', 'Link'])));
        const range = weapon === undefined ? undefined : Number(weapon.fields?.Range);
        if (range !== undefined && Number.isFinite(range)) {
            facts.push(subjectFact(`weapon-${slot}-range`, `Weapon ${slot} range`, range, entityProvenance(weapon, [...weaponPath, 'Range']), starcraft2FieldKnowledgeTarget('CWeapon', ['Range'])));
        }
        const period = result.inputs.period;
        if (period.state === 'resolved') {
            facts.push(subjectFact(`weapon-${slot}-period`, `Weapon ${slot} period`, period.value, weapon === undefined ? Object.freeze([]) : entityProvenance(weapon, [...weaponPath, 'Period']), starcraft2FieldKnowledgeTarget('CWeapon', ['Period'])));
        }
        const selectedEffect = result.provenance.selectedEffect;
        if (selectedEffect !== undefined) {
            facts.push(subjectFact(`weapon-${slot}-effect`, `Weapon ${slot} effect`, selectedEffect.entityId, weapon === undefined
                ? Object.freeze([])
                : entityProvenance(weapon, [...weaponPath, result.provenance.selectedEffectField, 'Link']), starcraft2FieldKnowledgeTarget('CWeapon', [result.provenance.selectedEffectField, 'Link'])));
        }
        const damage = result.inputs.damage;
        if (damage.state === 'resolved' && selectedEffect !== undefined) {
            const effect = byKey.get(entityKey('Effect', selectedEffect.entityId));
            facts.push(subjectFact(`weapon-${slot}-damage`, `Weapon ${slot} damage`, damage.value, effect === undefined
                ? Object.freeze([])
                : entityProvenance(effect, ['Effect', effect.entityId, 'Amount']), starcraft2FieldKnowledgeTarget('CEffectDamage', ['Amount'])));
        }
        if (result.status === 'computed') {
            const dpsProvenance = [];
            for (const entity of result.provenance.entities) {
                for (const source of entity.sources) {
                    dpsProvenance.push(sourceProvenance(source, [entity.ref.namespace, entity.ref.entityId, 'simple-weapon-dps']));
                }
            }
            facts.push(subjectFact(`weapon-${slot}-dps`, `Weapon ${slot} simple DPS`, result.value, uniqueProvenance(dpsProvenance), starcraft2ConceptKnowledgeTarget('simple-weapon-dps')));
        }
        facts.push(subjectFact(`weapon-${slot}-calculation`, `Weapon ${slot} calculation`, Object.freeze({
            status: result.status,
            completeness: result.completeness.state,
            warningCodes: Object.freeze(result.warnings.map(item => item.code)),
        }), uniqueProvenance([
            ...entityProvenance(unit, unitPath),
            ...(weapon === undefined ? [] : entityProvenance(weapon, weaponPath)),
        ]), starcraft2ConceptKnowledgeTarget('simple-weapon-dps')));
    }
    return Object.freeze(facts);
}
/**
 * A card whose page cursors belong to it: a cursor names this snapshot, subject and page, so one
 * card's cursor cannot page another's, and a cancelled request fails with its signal's reason.
 */
function subjectBoundPages(source, subjectKey, snapshotId, maxPageSize) {
    const bound = (kind, read) => async (request, signal) => {
        abort(signal);
        const limit = pageLimit(request, maxPageSize);
        const prefix = cursorPrefix(`subject:${encodeURIComponent(subjectKey)}:${kind}`, snapshotId);
        if (request.cursor !== undefined && !request.cursor.startsWith(prefix)) {
            throw new RangeError('page cursor belongs to another source snapshot or page kind');
        }
        const cursor = request.cursor?.slice(prefix.length);
        const result = await read({ limit, ...(cursor === undefined ? {} : { cursor }) }, signal);
        return Object.freeze({
            items: result.items,
            ...(result.nextCursor === undefined ? {} : { nextCursor: `${prefix}${result.nextCursor}` }),
        });
    };
    const groups = bound('groups', (request, signal) => source.groups(request, signal));
    const relations = bound('relations', (request, signal) => source.relations(request, signal));
    return Object.freeze({
        summary: async (signal) => {
            abort(signal);
            return source.summary(signal);
        },
        groups,
        facts: (groupId, request, signal) => bound(`facts:${encodeURIComponent(groupId)}`, (page, pageSignal) => source.facts(groupId, page, pageSignal))(request, signal),
        relations,
    });
}
/**
 * One entity of the snapshot as its card.
 *
 * The card is the one SC2 entity projection — the sc2data codec's, over the ported wiki assembler —
 * fed the values resolved along the whole mod chain, so a card opened from a map, a mod or a
 * GameData file shows the same groups (parity plan 5.6). What only a resolved workspace knows
 * travels with it: every layer that declares a value (the provenance the host turns into edit
 * targets), field help, every resolved field, visual assets, and the snapshot's completeness.
 * Weapon DPS with its formula is the calculations source's, not a fact group here.
 */
function subjectFactsSource(snapshot, request, declare) {
    abort(request.signal);
    const subject = recordOf(request.subject);
    if (subject === undefined)
        throw new TypeError('subject facts request must name a subject');
    if (typeof subject.namespace !== 'string' || subject.namespace.length === 0) {
        throw new TypeError('subject.namespace must be a non-empty string');
    }
    if (typeof subject.entityId !== 'string' ||
        subject.entityId.length === 0 ||
        subject.entityId.length > 512) {
        throw new TypeError('subject.entityId must contain between 1 and 512 characters');
    }
    const maxEntities = positiveBound(request.maxEntities, 'maxEntities', DEFAULT_SUBJECT_MAX_ENTITIES, MAXIMUM_SUBJECT_MAX_ENTITIES);
    const maxRelations = positiveBound(request.maxRelations, 'maxRelations', DEFAULT_SUBJECT_MAX_RELATIONS, MAXIMUM_SUBJECT_MAX_RELATIONS);
    if (!Array.isArray(snapshot.definitions) || snapshot.definitions.length > maxEntities) {
        throw new RangeError(`snapshot definitions must contain at most maxEntities ${maxEntities} entries`);
    }
    if (!Array.isArray(snapshot.relations) || snapshot.relations.length > maxRelations) {
        throw new RangeError(`snapshot relations must contain at most maxRelations ${maxRelations} entries`);
    }
    const entity = snapshot.definitions.find(item => item.namespace === subject.namespace && item.entityId === subject.entityId);
    if (entity === undefined) {
        throw new RangeError(`${subject.namespace}/${subject.entityId} is absent from snapshot ${snapshot.snapshotId}`);
    }
    const maxCalculations = subject.namespace === 'Unit'
        ? positiveBound(request.maxCalculations, 'maxCalculations', undefined, MAXIMUM_SUBJECT_MAX_CALCULATIONS)
        : undefined;
    const calculation = maxCalculations === undefined
        ? undefined
        : calculateStarcraft2UnitWeaponDps(snapshot, {
            unitId: entity.entityId,
            maxEntities,
            maxWeapons: maxCalculations,
            ...(request.signal === undefined ? {} : { signal: request.signal }),
        });
    const entityPath = [subject.namespace, entity.entityId];
    const localizations = localizationIndex(snapshot);
    const byKey = new Map(snapshot.definitions.map(item => [entityKey(item.namespace, item.entityId), item]));
    // The snapshot's own edges, with their direction, field and declaration, stand for the card's
    // references: a dead one stays visible and lowers the card's relation completeness.
    const edges = [];
    let deadRelations = 0;
    for (const relation of snapshot.relations) {
        abort(request.signal);
        const outgoing = relation.from.namespace === subject.namespace && relation.from.entityId === entity.entityId;
        const incoming = relation.to.namespace === subject.namespace && relation.to.entityId === entity.entityId;
        if (!outgoing && !incoming)
            continue;
        const direction = outgoing ? 'outgoing' : 'incoming';
        const ref = outgoing ? relation.to : relation.from;
        if (relation.dead)
            deadRelations += 1;
        edges.push(Object.freeze({
            role: `${direction}:${relation.role}`,
            subjectId: `${ref.namespace}/${ref.entityId}`,
            label: relatedEntityLabel(byKey.get(entityKey(ref.namespace, ref.entityId)), localizations, ref.entityId),
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
    edges.sort((left, right) => `${left.direction}\0${left.edgeRole}\0${left.subjectId}`.localeCompare(`${right.direction}\0${right.edgeRole}\0${right.subjectId}`));
    const reasons = [];
    if (snapshot.complete !== true)
        reasons.push('snapshot-incomplete');
    if (entity.complete !== true)
        reasons.push('definition-incomplete');
    if (calculation !== undefined && calculation.completeness.state !== 'complete')
        reasons.push(`calculation-${calculation.completeness.state}`);
    if (deadRelations > 0)
        reasons.push('dead-relations');
    const warnings = [...(calculation?.warnings ?? [])];
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
    const facts = snapshotEntityFacts(snapshot, subject.namespace, entity.entityId, {
        snapshotId: snapshot.snapshotId,
        source: Object.freeze({
            id: `resolved-data:${snapshot.workspaceId}`,
            uri: `resolved-data:${encodeURIComponent(snapshot.workspaceId)}`,
        }),
        // The host's selector names an entity `Namespace/id`; the card and its links keep that id.
        subjectIdOf: (namespace, id) => `${namespace}/${id}`,
        provenanceOf: path => entityProvenance(entity, [...entityPath, ...path]),
        ...(declare === undefined ? {} : { declare }),
        parentChain: (entity.inheritanceChain ?? []).map(item => Object.freeze({ namespace: item.namespace, id: item.entityId })),
        resolvedParentChain: true,
        edgeRelations: Object.freeze(edges),
        ...(calculation === undefined
            ? {}
            : { weaponFacts: unitWeaponFacts(entity, byKey, calculation, request.signal) }),
        extraGroups: [
            Object.freeze({
                id: 'resolved-fields',
                label: 'All resolved fields',
                facts: resolvedFieldFacts(entity, localizations, request.signal),
            }),
            Object.freeze({
                id: 'visual-assets',
                label: 'Visual assets',
                facts: visualAssetFacts(snapshot, entity, request.signal),
            }),
        ].filter(group => group.facts.length > 0),
        summaryExtras: Object.freeze({
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
                ...(calculation === undefined ? {} : { calculation: calculation.provenance.algorithm }),
            }),
            completeness: Object.freeze({
                state: reasons.length === 0 ? 'complete' : 'partial',
                reasons: Object.freeze(reasons),
                snapshotComplete: snapshot.complete === true,
                definitionComplete: entity.complete === true,
                ...(calculation === undefined ? {} : { calculation: calculation.completeness }),
                relations: deadRelations === 0 ? 'complete' : 'incomplete',
                bounds: Object.freeze({
                    maxEntities,
                    maxRelations,
                    ...(maxCalculations === undefined ? {} : { maxCalculations }),
                    maxFields: MAXIMUM_SUBJECT_FIELDS,
                }),
            }),
            warnings: Object.freeze(warnings),
        }),
    });
    if (facts === undefined) {
        throw new RangeError(`${subject.namespace}/${subject.entityId} has no card in snapshot ${snapshot.snapshotId}`);
    }
    return lifecycle(subjectBoundPages(facts, `${subject.namespace}/${entity.entityId}`, snapshot.snapshotId, request.maxPageSize));
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
    const addNode = (id, label, type, subject) => {
        if (nodeIds.has(id))
            return;
        nodeIds.add(id);
        nodes.push(Object.freeze({ id, label, type, ...(subject === undefined ? {} : { subject }) }));
        counts.set(type, (counts.get(type) ?? 0) + 1);
    };
    // A node is labelled with the name a player reads when the context read its strings (5.22).
    const localizations = localizationIndex(snapshot);
    for (const entity of snapshot.definitions) {
        abort(signal);
        const id = `${entity.namespace}/${entity.entityId}`;
        const nameKey = typeof entity.fields?.Name === 'string' ? entity.fields.Name : `${entity.namespace}/Name/${entity.entityId}`;
        const name = localizations.get(nameKey)?.value;
        // A node opens its entity's card, under the id the cards link by.
        addNode(id, typeof name === 'string' && name !== '' ? name : entity.entityId, entity.namespace, id);
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
/** `declare`: `provenanceDeclarations` over the documents analysed, when the caller has them. */
export function openStarcraft2SubjectFactsSource(snapshot, request, declare) {
    validateOpen(snapshot, request?.maxPageSize);
    if (request?.snapshotId !== snapshot.snapshotId) {
        throw new RangeError('subject facts request belongs to another data snapshot');
    }
    return subjectFactsSource(snapshot, request, declare);
}
/** Open strict, auditable Unit calculations over the same immutable resolved-data snapshot. */
export function openStarcraft2SubjectCalculationsSource(snapshot, request) {
    validateOpen(snapshot, request?.maxPageSize);
    if (request?.snapshotId !== snapshot.snapshotId) {
        throw new RangeError('subject calculations request belongs to another data snapshot');
    }
    return subjectCalculationsSource(snapshot, request);
}
//# sourceMappingURL=data-sources.js.map