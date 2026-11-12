const GAME_ID = 'blizzard/starcraft-2';
const DEFAULT_MAX_ENTITIES = 100_000;
const MAXIMUM_MAX_ENTITIES = 100_000;
const DEFAULT_MAX_RELATIONS = 250_000;
const MAXIMUM_MAX_RELATIONS = 1_000_000;
const DEFAULT_MAX_RESULTS = 256;
const MAXIMUM_MAX_RESULTS = 256;
const DEFAULT_MAX_EFFECT_DEPTH = 12;
const MAXIMUM_MAX_EFFECT_DEPTH = 32;
export const STARCRAFT2_UNIT_PRODUCTION_FORMULA = Object.freeze({
    id: 'blizzard.starcraft2/unit-production-route',
    name: 'StarCraft II catalog production route',
    version: '1.0.0',
    expression: 'Unit.AbilArray -> production ability output -> Unit',
});
export const STARCRAFT2_ABILITY_EFFECT_CHAIN_FORMULA = Object.freeze({
    id: 'blizzard.starcraft2/ability-effect-chain',
    name: 'StarCraft II authored ability effect chain',
    version: '1.0.0',
    expression: 'Unit.AbilArray -> Abil effect field -> supported Effect links',
});
const PRODUCTION_RULES = Object.freeze([
    ['CAbilArmMagazine', 'InfoArray.*.Unit', 'arm-magazine', 'ammo'],
    ['CAbilBuild', 'InfoArray.*.Unit', 'build', 'production'],
    ['CAbilMerge', 'Info.Unit', 'merge', 'morph'],
    ['CAbilMorph', 'InfoArray.*.Unit', 'morph', 'morph'],
    ['CAbilMorph', 'InfoArrayUnmorph.*.Unit', 'unmorph', 'morph'],
    ['CAbilMorphPlacement', 'InfoArray.*.Unit', 'morph', 'morph'],
    ['CAbilMorphPlacement', 'InfoArrayUnmorph.*.Unit', 'unmorph', 'morph'],
    ['CAbilTrain', 'InfoArray.*.Unit.*', 'train', 'production'],
    ['CAbilWarpTrain', 'InfoArray.*.Unit', 'warp-train', 'production'],
]);
const SUPPORTED_EFFECT_LINK_FIELDS = Object.freeze(new Set([
    'Effect',
    'EffectArray',
    'InitialEffect',
    'PeriodicEffect',
    'FinalEffect',
    'ExpireEffect',
    'ImpactEffect',
    'LaunchEffect',
    'SearchEffect',
    'CaseArray.Effect',
    'AreaArray.Effect',
]));
const SUPPORTED_EFFECT_CLASSES = Object.freeze(new Set([
    'CEffectApplyBehavior',
    'CEffectCreateUnit',
    'CEffectDamage',
    'CEffectEnumArea',
    'CEffectIssueOrder',
    'CEffectLaunchMissile',
    'CEffectModifyUnit',
    'CEffectPersistent',
    'CEffectRemoveBehavior',
    'CEffectSearch',
    'CEffectSet',
    'CEffectSwitch',
    'CEffectTeleport',
]));
const recordOf = value => typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
function nonEmptyString(value, label) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
        throw new TypeError(`${label} must contain between 1 and 512 characters`);
    }
    return value;
}
function positiveInteger(value, label, fallback, maximum) {
    if (value === undefined)
        return fallback;
    if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
        throw new RangeError(`${label} must be a positive integer no greater than ${maximum}`);
    }
    return value;
}
const abort = signal => signal?.throwIfAborted();
const keyOf = ref => `${ref.namespace}/${ref.entityId}`;
function normalizedRole(role) {
    return String(role)
        .replace(/\[(?:[^\]]+)\]/gu, '.*')
        .replace(/\.Link$/u, '');
}
function productionRule(typeId, role) {
    const normalized = normalizedRole(role);
    return PRODUCTION_RULES.find(([candidateType, candidateRole]) => {
        if (candidateType !== typeId)
            return false;
        if (candidateRole === normalized)
            return true;
        // Single Unit values in resolved train records may omit the final array index.
        return candidateRole.endsWith('.*') && candidateRole.slice(0, -2) === normalized;
    });
}
function normalizedEffectRole(role) {
    return normalizedRole(role)
        .split("./index.js")
        .filter(segment => segment !== '*')
        .join("./index.js");
}
function warning(code, message) {
    return Object.freeze({ code: `blizzard.starcraft2/${code}`, message });
}
function sourceReceipt(relation) {
    return Object.freeze({
        from: Object.freeze({ ...relation.from }),
        to: Object.freeze({ ...relation.to }),
        fieldPath: relation.role,
        ...(relation.source === undefined ? {} : { source: Object.freeze({ ...relation.source }) }),
    });
}
function entityReceipt(entity) {
    return Object.freeze({
        ref: Object.freeze({ namespace: entity.namespace, entityId: entity.entityId }),
        typeId: entity.typeId,
        sources: Object.freeze((entity.sources ?? []).map(source => Object.freeze({ ...source }))),
    });
}
function collectEffectChain(root, entities, outgoing, maxDepth, signal) {
    const nodes = [];
    const edges = [];
    const warnings = [];
    const queue = [{ ref: root, depth: 0 }];
    const seen = new Set();
    let status = 'computed';
    while (queue.length > 0) {
        abort(signal);
        const current = queue.shift();
        const currentKey = keyOf(current.ref);
        if (seen.has(currentKey))
            continue;
        seen.add(currentKey);
        const entity = entities.get(currentKey);
        if (entity === undefined) {
            status = 'incomplete';
            warnings.push(warning('calculation-effect-missing', `${currentKey} is unresolved`));
            nodes.push(Object.freeze({ ...current.ref, status: 'missing' }));
            continue;
        }
        const supported = SUPPORTED_EFFECT_CLASSES.has(entity.typeId);
        nodes.push(Object.freeze({
            namespace: entity.namespace,
            entityId: entity.entityId,
            typeId: entity.typeId,
            status: supported ? 'supported' : 'unsupported',
        }));
        if (!supported) {
            status = 'unsupported';
            warnings.push(warning('calculation-effect-class-unsupported', `${entity.typeId} is retained in the chain but has no verified traversal rule`));
            continue;
        }
        const childEdges = outgoing.get(currentKey) ?? [];
        for (const relation of childEdges) {
            if (relation.to.namespace !== 'Effect')
                continue;
            const role = normalizedEffectRole(relation.role);
            if (!SUPPORTED_EFFECT_LINK_FIELDS.has(role)) {
                status = 'unsupported';
                warnings.push(warning('calculation-effect-field-unsupported', `${currentKey}.${relation.role} targets an Effect but is not a verified execution edge`));
                continue;
            }
            edges.push(sourceReceipt(relation));
            if (current.depth >= maxDepth) {
                status = 'incomplete';
                warnings.push(warning('calculation-effect-depth-capped', `effect traversal reached maxDepth ${maxDepth}`));
                continue;
            }
            queue.push({ ref: relation.to, depth: current.depth + 1 });
        }
    }
    return Object.freeze({
        status,
        nodes: Object.freeze(nodes),
        edges: Object.freeze(edges),
        warnings: Object.freeze(warnings),
    });
}
/**
 * Produces auditable, non-simulated semantic receipts for a resolved Unit.
 * Every claimed route is backed by exact relation roles from the snapshot.
 */
export function calculateStarcraft2UnitSemantics(snapshot, request) {
    const snapshotValue = recordOf(snapshot);
    if (snapshotValue === undefined || snapshotValue.schemaVersion !== 1) {
        throw new TypeError('snapshot must be a DataCatalogSnapshot v1 object');
    }
    if (snapshotValue.gameId !== GAME_ID) {
        throw new TypeError(`StarCraft II calculation cannot inspect ${String(snapshotValue.gameId)}`);
    }
    const requestValue = recordOf(request);
    if (requestValue === undefined)
        throw new TypeError('request must be an object');
    const unitId = nonEmptyString(requestValue.unitId, 'request.unitId');
    const maxEntities = positiveInteger(requestValue.maxEntities, 'request.maxEntities', DEFAULT_MAX_ENTITIES, MAXIMUM_MAX_ENTITIES);
    const maxRelations = positiveInteger(requestValue.maxRelations, 'request.maxRelations', DEFAULT_MAX_RELATIONS, MAXIMUM_MAX_RELATIONS);
    const maxResults = positiveInteger(requestValue.maxResults, 'request.maxResults', DEFAULT_MAX_RESULTS, MAXIMUM_MAX_RESULTS);
    const maxEffectDepth = positiveInteger(requestValue.maxEffectDepth, 'request.maxEffectDepth', DEFAULT_MAX_EFFECT_DEPTH, MAXIMUM_MAX_EFFECT_DEPTH);
    const signal = requestValue.signal;
    abort(signal);
    if (!Array.isArray(snapshotValue.definitions) || snapshotValue.definitions.length > maxEntities) {
        throw new RangeError(`snapshot definitions must contain at most ${maxEntities} entries`);
    }
    if (!Array.isArray(snapshotValue.relations) || snapshotValue.relations.length > maxRelations) {
        throw new RangeError(`snapshot relations must contain at most ${maxRelations} entries`);
    }
    const entities = new Map(snapshotValue.definitions.map(entity => [keyOf(entity), entity]));
    const unit = entities.get(`Unit/${unitId}`);
    if (unit === undefined)
        throw new RangeError(`Unit/${unitId} is absent from the snapshot`);
    const outgoing = new Map();
    for (const relation of snapshotValue.relations) {
        abort(signal);
        const values = outgoing.get(keyOf(relation.from)) ?? [];
        values.push(relation);
        outgoing.set(keyOf(relation.from), values);
    }
    const abilityEdges = (outgoing.get(`Unit/${unitId}`) ?? []).filter(relation => relation.to.namespace === 'Abil' && /^AbilArray(?:\[|\.|$)/u.test(relation.role));
    const results = [];
    for (const ownership of abilityEdges) {
        abort(signal);
        const ability = entities.get(keyOf(ownership.to));
        if (ability === undefined) {
            results.push(Object.freeze({
                kind: 'ability-effect-chain',
                id: `ability-${ownership.to.entityId}-effect-chain`,
                label: `${ownership.to.entityId} effect chain`,
                status: 'incomplete',
                formula: STARCRAFT2_ABILITY_EFFECT_CHAIN_FORMULA,
                value: Object.freeze({ abilityId: ownership.to.entityId, roots: Object.freeze([]) }),
                inputs: Object.freeze([sourceReceipt(ownership)]),
                provenance: Object.freeze({
                    entities: Object.freeze([entityReceipt(unit)]),
                    edges: Object.freeze([sourceReceipt(ownership)]),
                }),
                warnings: Object.freeze([
                    warning('calculation-ability-missing', `Abil/${ownership.to.entityId} is unresolved`),
                ]),
            }));
            continue;
        }
        const abilityOutgoing = outgoing.get(keyOf(ownership.to)) ?? [];
        for (const relation of abilityOutgoing) {
            if (relation.to.namespace !== 'Unit')
                continue;
            const rule = productionRule(ability.typeId, relation.role);
            if (rule === undefined)
                continue;
            const [, , kind, category] = rule;
            const target = entities.get(keyOf(relation.to));
            results.push(Object.freeze({
                kind: 'production',
                id: `production-${ownership.to.entityId}-${relation.to.entityId}-${kind}`,
                label: `${unitId} ${kind} ${relation.to.entityId}`,
                status: target === undefined ? 'incomplete' : 'computed',
                formula: STARCRAFT2_UNIT_PRODUCTION_FORMULA,
                value: Object.freeze({
                    producerUnitId: unitId,
                    abilityId: ownership.to.entityId,
                    producedUnitId: relation.to.entityId,
                    kind,
                    category,
                    route: Object.freeze([sourceReceipt(ownership), sourceReceipt(relation)]),
                }),
                inputs: Object.freeze([sourceReceipt(ownership), sourceReceipt(relation)]),
                provenance: Object.freeze({
                    entities: Object.freeze([unit, ability, target].filter(Boolean).map(entityReceipt)),
                    edges: Object.freeze([sourceReceipt(ownership), sourceReceipt(relation)]),
                }),
                warnings: Object.freeze(target === undefined
                    ? [warning('calculation-produced-unit-missing', keyOf(relation.to))]
                    : []),
            }));
        }
        const rootEdges = abilityOutgoing.filter(relation => relation.to.namespace === 'Effect');
        if (rootEdges.length === 0) {
            results.push(Object.freeze({
                kind: 'ability-effect-chain',
                id: `ability-${ownership.to.entityId}-effect-chain`,
                label: `${ownership.to.entityId} effect chain`,
                status: 'unsupported',
                formula: STARCRAFT2_ABILITY_EFFECT_CHAIN_FORMULA,
                value: Object.freeze({ abilityId: ownership.to.entityId, roots: Object.freeze([]) }),
                inputs: Object.freeze([sourceReceipt(ownership)]),
                provenance: Object.freeze({
                    entities: Object.freeze([entityReceipt(unit), entityReceipt(ability)]),
                    edges: Object.freeze([sourceReceipt(ownership)]),
                }),
                warnings: Object.freeze([
                    warning('calculation-ability-effect-unsupported', `${ability.typeId} has no resolved Effect execution edge; no effect was inferred`),
                ]),
            }));
            continue;
        }
        for (const rootEdge of rootEdges) {
            const chain = collectEffectChain(rootEdge.to, entities, outgoing, maxEffectDepth, signal);
            results.push(Object.freeze({
                kind: 'ability-effect-chain',
                id: `ability-${ownership.to.entityId}-${rootEdge.to.entityId}-effect-chain`,
                label: `${ownership.to.entityId} → ${rootEdge.to.entityId} effect chain`,
                status: chain.status,
                formula: STARCRAFT2_ABILITY_EFFECT_CHAIN_FORMULA,
                value: Object.freeze({
                    abilityId: ownership.to.entityId,
                    rootEffectId: rootEdge.to.entityId,
                    nodes: chain.nodes,
                    edges: chain.edges,
                }),
                inputs: Object.freeze([sourceReceipt(ownership), sourceReceipt(rootEdge)]),
                provenance: Object.freeze({
                    entities: Object.freeze([
                        entityReceipt(unit),
                        entityReceipt(ability),
                        ...chain.nodes.flatMap(node => {
                            const entity = entities.get(keyOf(node));
                            return entity === undefined ? [] : [entityReceipt(entity)];
                        }),
                    ]),
                    edges: Object.freeze([
                        sourceReceipt(ownership),
                        sourceReceipt(rootEdge),
                        ...chain.edges,
                    ]),
                }),
                warnings: chain.warnings,
            }));
        }
    }
    const truncated = results.length > maxResults;
    const bounded = Object.freeze(results.slice(0, maxResults));
    const unsupported = bounded.filter(result => result.status === 'unsupported').length;
    const incomplete = bounded.filter(result => result.status === 'incomplete').length;
    return Object.freeze({
        schemaVersion: 1,
        snapshotId: snapshotValue.snapshotId,
        workspaceId: snapshotValue.workspaceId,
        analyzerId: snapshotValue.analyzerId,
        subject: Object.freeze({ namespace: 'Unit', entityId: unitId }),
        results: bounded,
        completeness: Object.freeze({
            state: truncated || snapshotValue.complete !== true || unsupported > 0 || incomplete > 0
                ? 'partial'
                : 'complete',
            truncated,
            unsupported,
            incomplete,
            abilityCount: abilityEdges.length,
            snapshotComplete: snapshotValue.complete === true,
        }),
    });
}
//# sourceMappingURL=unit-semantics.js.map