const HASH_TOKEN = /##([A-Za-z_][A-Za-z0-9_]*)##/gu;
const DOLLAR_TOKEN = /\$([A-Za-z_][A-Za-z0-9_]*)/gu;
function entityKey(namespace, entityId) {
    return `${namespace}\0${entityId}`;
}
function containsTokenPlaceholder(value) {
    HASH_TOKEN.lastIndex = 0;
    if (HASH_TOKEN.test(value))
        return true;
    DOLLAR_TOKEN.lastIndex = 0;
    return DOLLAR_TOKEN.test(value);
}
function substituteBuiltInId(value, entityId) {
    return value.replaceAll('##id##', entityId).replace(/\$id\b/gu, entityId);
}
/**
 * The SC2 part of the relation graph after the common merge. Field values are catalog-engine's
 * (it substitutes tokens, `##id##` included, and leaves an abstract template's placeholders), so
 * only relations are adjusted here.
 *
 * Parity source: clean legacy modkit@1a14ba4eddd0ae88de273348ebd44cfb98a0581d,
 * `extensions/blizzard/starcraft-2/codecs/sc2-data/src/relations.ts` (`addRef`).
 *
 * Token placeholders are declarations, not concrete catalog IDs; leaving them in the relation graph
 * creates fake missing nodes. Concrete targets are retained and have their dead state
 * recalculated, so a real missing dependency still lowers relation completeness.
 */
export function normalizeStarcraft2ResolvedSnapshot(snapshot, options = {}) {
    const templateEntityKeys = new Set(options.templateEntityKeys ?? []);
    const definitions = snapshot.definitions ?? [];
    const resolvedKeys = new Set(definitions.map(entity => entityKey(entity.namespace, entity.entityId)));
    const definitionsByKey = new Map(definitions.map(entity => [entityKey(entity.namespace, entity.entityId), entity]));
    const seenRelations = new Set();
    const relations = [];
    let deferredTemplateRelations = 0;
    for (const relation of snapshot.relations ?? []) {
        const sourceKey = entityKey(relation.from.namespace, relation.from.entityId);
        const targetHadPlaceholder = containsTokenPlaceholder(relation.to.entityId);
        if (targetHadPlaceholder && templateEntityKeys.has(sourceKey)) {
            deferredTemplateRelations += 1;
            continue;
        }
        const targetEntityId = substituteBuiltInId(relation.to.entityId, relation.from.entityId);
        if (containsTokenPlaceholder(targetEntityId)) {
            deferredTemplateRelations += 1;
            continue;
        }
        const relationKey = `${sourceKey}\0${relation.to.namespace}\0${targetEntityId}\0${relation.role}`;
        if (seenRelations.has(relationKey))
            continue;
        seenRelations.add(relationKey);
        const dead = !resolvedKeys.has(entityKey(relation.to.namespace, targetEntityId));
        relations.push(Object.freeze({
            ...relation,
            to: Object.freeze({ namespace: relation.to.namespace, entityId: targetEntityId }),
            dead,
        }));
    }
    const diagnostics = snapshot.diagnostics.filter(diagnostic => diagnostic.code !== 'common.data/relation-target-unavailable');
    for (const relation of relations) {
        if (!relation.dead)
            continue;
        const source = definitionsByKey.get(entityKey(relation.from.namespace, relation.from.entityId));
        diagnostics.push(Object.freeze({
            severity: 'warning',
            code: 'common.data/relation-target-unavailable',
            message: `${relation.from.namespace}/${relation.from.entityId} ${relation.role} names unavailable ${relation.to.namespace}/${relation.to.entityId}`,
            namespace: relation.from.namespace,
            ...(source?.typeId === undefined ? {} : { typeId: source.typeId }),
            entityId: relation.from.entityId,
            fieldId: relation.role,
            ...(relation.source === undefined ? {} : { source: relation.source }),
        }));
    }
    if (deferredTemplateRelations > 0) {
        diagnostics.push(Object.freeze({
            severity: 'information',
            code: 'blizzard.starcraft2/data-template-relations-deferred',
            message: `${deferredTemplateRelations} unresolved SC2 token-template relation(s) were preserved in field values and excluded from the concrete relation graph`,
        }));
    }
    return Object.freeze({
        ...snapshot,
        relations: Object.freeze(relations),
        diagnostics: Object.freeze(diagnostics),
    });
}
//# sourceMappingURL=resolved-data-normalization.js.map