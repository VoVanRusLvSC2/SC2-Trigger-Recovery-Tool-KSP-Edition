import { buildCatalogRelations, } from './relations.js';
/**
 * Engine-semantic Unit outputs. This intentionally excludes Unit links which only
 * describe an existing unit (inventory items, placement previews, train
 * proxies, and display-only ProducedUnitArray annotations).
 */
export const UNIT_PRODUCTION_RULES = [
    {
        namespace: 'Abil',
        className: 'CAbilArmMagazine',
        kind: 'arm-magazine',
        category: 'ammo',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilBuild',
        kind: 'build',
        category: 'production',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilMerge',
        kind: 'merge',
        category: 'morph',
        field: 'Info.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilMorph',
        kind: 'morph',
        category: 'morph',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilMorph',
        kind: 'unmorph',
        category: 'morph',
        field: 'InfoArrayUnmorph.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilMorphPlacement',
        kind: 'morph',
        category: 'morph',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilMorphPlacement',
        kind: 'unmorph',
        category: 'morph',
        field: 'InfoArrayUnmorph.*.Unit',
    },
    {
        namespace: 'Abil',
        className: 'CAbilTrain',
        kind: 'train',
        category: 'production',
        field: 'InfoArray.*.Unit.*',
    },
    {
        namespace: 'Abil',
        className: 'CAbilWarpTrain',
        kind: 'warp-train',
        category: 'production',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Effect',
        className: 'CEffectCreateUnit',
        kind: 'create-unit',
        category: 'production',
        field: 'SpawnUnit.*',
    },
    {
        namespace: 'Effect',
        className: 'CEffectMorph',
        kind: 'effect-morph',
        category: 'morph',
        field: 'MorphUnit',
    },
    {
        namespace: 'Effect',
        className: 'CEffectLaunchMissile',
        kind: 'launch-missile',
        category: 'ammo',
        field: 'AmmoUnit',
    },
    {
        namespace: 'Effect',
        className: 'CEffectUseMagazine',
        kind: 'use-magazine',
        category: 'ammo',
        field: 'AmmoUnit',
    },
    {
        namespace: 'Behavior',
        className: 'CBehaviorSpawn',
        kind: 'behavior-spawn',
        category: 'production',
        field: 'InfoArray.*.Unit',
    },
    {
        namespace: 'Behavior',
        className: 'CBehaviorResource',
        kind: 'resource-empty-unit',
        category: 'morph',
        field: 'EmptyUnit',
    },
];
function entity(entity) {
    return { namespace: entity.namespace, id: entity.id, className: entity.class };
}
function edge(ref) {
    return { from: entity(ref.from), to: entity(ref.to), path: ref.path };
}
function key(value) {
    return `${value.namespace}/${value.id}`;
}
function pathMatches(path, pattern) {
    const actual = path.split('.');
    const expected = pattern.split('.');
    return (actual.length === expected.length &&
        expected.every((part, i) => part === '*' || part === actual[i]));
}
function productionRule(ref) {
    return UNIT_PRODUCTION_RULES.find(rule => ref.from.namespace === rule.namespace &&
        ref.from.class === rule.className &&
        pathMatches(ref.path, rule.field));
}
const UPSTREAM_NAMESPACES = new Set(['Abil', 'Behavior', 'Effect', 'Weapon']);
function isUnitOwnership(ref) {
    if (ref.from.namespace !== 'Unit')
        return false;
    if (ref.to.namespace === 'Abil')
        return /^AbilArray(?:\.|$)/.test(ref.path);
    if (ref.to.namespace === 'Behavior')
        return /^BehaviorArray(?:\.|$)/.test(ref.path);
    if (ref.to.namespace === 'Weapon')
        return /^WeaponArray(?:\.|$)/.test(ref.path);
    return false;
}
function traceOwners(graph, creator, direct, maxDepth) {
    const routes = [];
    const upstream = new Map([[key(creator), creator]]);
    const queue = [
        { node: creator, chain: [], seen: new Set([key(creator)]) },
    ];
    while (queue.length) {
        const current = queue.shift();
        if (!current)
            break;
        if (current.chain.length >= maxDepth)
            continue;
        for (const incoming of graph.incoming(current.node.namespace, current.node.id)) {
            if (isUnitOwnership(incoming)) {
                routes.push({
                    producer: entity(incoming.from),
                    chain: [...current.chain, incoming].reverse().map(edge).concat(edge(direct)),
                });
                continue;
            }
            if (!UPSTREAM_NAMESPACES.has(incoming.from.namespace))
                continue;
            const incomingKey = key(incoming.from);
            if (current.seen.has(incomingKey))
                continue;
            upstream.set(incomingKey, incoming.from);
            queue.push({
                node: incoming.from,
                chain: [...current.chain, incoming],
                seen: new Set([...current.seen, incomingKey]),
            });
        }
    }
    const unique = new Map();
    for (const route of routes) {
        const routeKey = `${key(route.producer)}|${route.chain.map(e => `${key(e.from)}:${e.path}`).join('>')}`;
        unique.set(routeKey, route);
    }
    return { routes: [...unique.values()], upstream: [...upstream.values()] };
}
/**
 * Find resolved catalog producers for a Unit without reading Trigger XML or mod opaque files.
 */
export function findCatalogUnitProducers(source, unitId, options = {}) {
    const target = source.get('Unit', unitId);
    if (!target)
        return [];
    const graph = options.graph ?? buildCatalogRelations(source);
    const maxDepth = options.maxDepth ?? 8;
    const direct = graph
        .incoming('Unit', unitId)
        .map(ref => ({ ref, rule: productionRule(ref) }))
        .filter((item) => item.rule !== undefined);
    const findings = direct.map(({ ref, rule }) => ({
        ref,
        rule,
        traced: traceOwners(graph, ref.from, ref, maxDepth),
    }));
    return findings.map(({ ref, rule, traced }) => {
        return {
            target: entity(target),
            creator: entity(ref.from),
            kind: rule.kind,
            category: rule.category,
            path: ref.path,
            routes: traced.routes,
            upstream: traced.upstream.map(entity),
        };
    });
}
//# sourceMappingURL=producers.js.map