import { analyzeGraphIsolation } from '@modkit/codec-kit/graph/isolation';
const MAXIMUM_FIELD_DEPTH = 64;
const FIELD_SEGMENT = /^[A-Za-z_][\w.:-]*$/u;
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function requiredString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
}
function subjectOf(value, label) {
    const subject = recordOf(value);
    if (subject === undefined)
        throw new TypeError(`${label} must be an object`);
    return Object.freeze({
        namespace: requiredString(subject.namespace, `${label}.namespace`),
        entityId: requiredString(subject.entityId, `${label}.entityId`),
    });
}
function fieldPathOf(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_FIELD_DEPTH) {
        throw new TypeError(`ownerFieldPath must contain between one and ${MAXIMUM_FIELD_DEPTH} segments`);
    }
    return Object.freeze(value.map((segment, index) => {
        const text = requiredString(segment, `ownerFieldPath[${index}]`);
        if (!FIELD_SEGMENT.test(text) && !/^\d+$/u.test(text)) {
            throw new TypeError(`ownerFieldPath[${index}] is not a catalog field or array selector`);
        }
        return text;
    }));
}
const entityKey = subject => `${subject.namespace}/${subject.entityId}`;
const relationKey = relation => `${entityKey(relation.from)}\0${relation.role}\0${entityKey(relation.to)}`;
/**
 * SC2-owned classification over the schema-derived relation graph. The common helper only counts
 * referrers and selected rewrites; this function decides that a live typed catalog relation at the
 * exact requested field path is rewritable. No parent/inheritance edge is synthesized here.
 */
export function analyzeStarcraft2GraphIsolation(snapshot, input) {
    const request = recordOf(input);
    if (request === undefined || request.schemaVersion !== 1) {
        throw new TypeError('SC2 graph isolation requires schemaVersion 1');
    }
    const owner = subjectOf(request.owner, 'owner');
    const target = subjectOf(request.target, 'target');
    const ownerFieldPath = fieldPathOf(request.ownerFieldPath);
    const ownerKey = entityKey(owner);
    const targetKey = entityKey(target);
    const maxEdges = request.maxEdges ?? 250_000;
    if (!Number.isSafeInteger(maxEdges) || maxEdges <= 0) {
        throw new TypeError('maxEdges must be a positive safe integer');
    }
    if (!Array.isArray(snapshot?.definitions) || !Array.isArray(snapshot?.relations)) {
        throw new TypeError('SC2 graph isolation requires resolved definitions and relations');
    }
    if (!snapshot.definitions.some(entity => entity.namespace === owner.namespace && entity.entityId === owner.entityId)) {
        throw new RangeError(`owner ${ownerKey} is not in the resolved snapshot`);
    }
    if (!snapshot.definitions.some(entity => entity.namespace === target.namespace && entity.entityId === target.entityId)) {
        throw new RangeError(`target ${targetKey} is not in the resolved snapshot`);
    }
    const ordered = [...snapshot.relations].sort((left, right) => relationKey(left).localeCompare(relationKey(right)));
    const duplicateOrdinals = new Map();
    const edges = ordered.map(relation => {
        const key = relationKey(relation);
        const ordinal = duplicateOrdinals.get(key) ?? 0;
        duplicateOrdinals.set(key, ordinal + 1);
        return Object.freeze({
            id: `${key}\0${ordinal}`,
            from: entityKey(relation.from),
            to: entityKey(relation.to),
            relation: relation.role,
            rewritable: relation.dead !== true,
        });
    });
    const role = ownerFieldPath.join('.');
    const selectedEdgeIds = edges
        .filter(edge => edge.from === ownerKey && edge.to === targetKey && edge.relation === role)
        .map(edge => edge.id);
    const analysis = analyzeGraphIsolation({
        schemaVersion: 1,
        ownerId: ownerKey,
        targetId: targetKey,
        edges,
        complete: snapshot.complete === true,
        maxEdges,
        selectedEdgeIds,
    });
    if (analysis.state === 'unavailable') {
        return Object.freeze({
            schemaVersion: 1,
            state: 'unavailable',
            owner,
            target,
            ownerFieldPath,
            cloneRequired: false,
            reason: analysis.reason,
        });
    }
    const relationByEdgeId = new Map(edges.map(edge => [edge.id, edge]));
    const referrers = Object.freeze(analysis.referrers.map(referrer => {
        const slash = referrer.nodeId.indexOf('/');
        return Object.freeze({
            subject: Object.freeze({
                namespace: referrer.nodeId.slice(0, slash),
                entityId: referrer.nodeId.slice(slash + 1),
            }),
            fieldPaths: Object.freeze(referrer.edgeIds.map(edgeId => Object.freeze(relationByEdgeId.get(edgeId).relation.split('.')))),
        });
    }));
    return Object.freeze({
        schemaVersion: 1,
        state: 'ready',
        owner,
        target,
        ownerFieldPath,
        shared: analysis.shared,
        cloneRequired: analysis.shared || request.always === true,
        referrers,
        otherReferrers: Object.freeze(referrers.map(item => item.subject).filter(subject => entityKey(subject) !== ownerKey)),
        rewireFieldPaths: Object.freeze(analysis.rewireEdgeIds.map(edgeId => Object.freeze(relationByEdgeId.get(edgeId).relation.split('.')))),
    });
}
