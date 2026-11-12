/**
 * Snapshot-bound StarCraft II Unit -> Weapon -> Damage Effect calculation.
 *
 * The DisplayEffect/Effect precedence, implicit single attack and one-decimal card value are
 * adapted from Modkit's SC2 data card builder:
 * extensions/blizzard/starcraft-2/codecs/sc2-data/src/wiki/cards.ts at
 * 1a14ba4eddd0ae88de273348ebd44cfb98a0581d. This module deliberately does not carry over the
 * old best-effort traversal through arbitrary effect chains: only a direct CEffectDamage is a
 * supported Product-GA calculation.
 */
const GAME_ID = 'blizzard/starcraft-2';
const DEFAULT_MAX_ENTITIES = 100_000;
const MAXIMUM_MAX_ENTITIES = 100_000;
const DEFAULT_MAX_WEAPONS = 32;
const MAXIMUM_MAX_WEAPONS = 256;
const MAXIMUM_PROVENANCE_SOURCES = 256;
export const STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA = Object.freeze({
    id: 'blizzard.starcraft2/simple-weapon-dps',
    name: 'StarCraft II simple displayed weapon DPS',
    version: '1.0.0',
    expression: 'damage * attacks / period',
    rounding: 'value is rounded to the nearest 0.1; rawValue retains the formula result',
    scope: 'A weapon whose selected DisplayEffect, or Effect fallback, directly resolves to CEffectDamage',
    units: Object.freeze({
        damage: 'damage',
        attacks: 'attacks-per-period',
        period: 'game-second',
        result: 'damage-per-game-second',
    }),
});
const ALGORITHM_PROVENANCE = Object.freeze({
    kind: 'adapted',
    repository: 'modkit',
    revision: '1a14ba4eddd0ae88de273348ebd44cfb98a0581d',
    path: 'extensions/blizzard/starcraft-2/codecs/sc2-data/src/wiki/cards.ts',
    symbols: Object.freeze(['resolveDamageEffect', 'buildWeapons']),
    adaptation: 'Retains display-effect precedence, implicit one attack and card rounding; replaces best-effort effect traversal with an explicit direct-damage support boundary.',
});
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function nonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
}
function boundedPositiveInteger(value, label, fallback, maximum) {
    const resolved = value === undefined ? fallback : value;
    if (!Number.isSafeInteger(resolved) || resolved <= 0 || resolved > maximum) {
        throw new TypeError(`${label} must be a positive safe integer no greater than ${maximum}`);
    }
    return resolved;
}
function throwIfAborted(signal) {
    signal?.throwIfAborted();
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
function linkedId(value) {
    if (typeof value === 'string' && value.length > 0)
        return value;
    const record = recordOf(value);
    if (record === undefined)
        return undefined;
    if (typeof record.Link === 'string' && record.Link.length > 0)
        return record.Link;
    if (typeof record.value === 'string' && record.value.length > 0)
        return record.value;
    const nested = recordOf(record.value);
    if (nested === undefined)
        return undefined;
    if (typeof nested.Link === 'string' && nested.Link.length > 0)
        return nested.Link;
    return typeof nested.value === 'string' && nested.value.length > 0 ? nested.value : undefined;
}
function entityKey(namespace, entityId) {
    return `${namespace}\0${entityId}`;
}
function warning(code, message, subject, fieldPath) {
    return Object.freeze({
        code,
        message,
        ...(subject === undefined ? {} : { subject: Object.freeze({ ...subject }) }),
        ...(fieldPath === undefined ? {} : { fieldPath }),
    });
}
function sourceCopy(source) {
    return Object.freeze({
        rootId: source.rootId,
        path: source.path,
        documentIndex: source.documentIndex,
        ...(source.revision === undefined ? {} : { revision: source.revision }),
    });
}
function entityProvenance(entity) {
    const sources = Array.isArray(entity.sources) ? entity.sources : [];
    return Object.freeze({
        ref: Object.freeze({ namespace: entity.namespace, entityId: entity.entityId }),
        typeId: entity.typeId,
        sources: Object.freeze(sources.slice(0, MAXIMUM_PROVENANCE_SOURCES).map(source => sourceCopy(source))),
        sourcesTruncated: sources.length > MAXIMUM_PROVENANCE_SOURCES,
    });
}
function input(name, value, unit, entity, fieldPath, origin = 'resolved-field') {
    return Object.freeze({
        name,
        state: value === undefined ? 'missing' : 'resolved',
        value: value ?? null,
        unit,
        origin,
        ...(entity === undefined
            ? {}
            : {
                entity: Object.freeze({ namespace: entity.namespace, entityId: entity.entityId }),
                fieldPath,
            }),
    });
}
function resultCompleteness(state, missingFields = [], unsupportedReasons = []) {
    return Object.freeze({
        state,
        missingFields: Object.freeze(missingFields),
        unsupportedReasons: Object.freeze(unsupportedReasons),
    });
}
function resultForWeapon(unit, weaponId, index, entityIndex, signal) {
    throwIfAborted(signal);
    const resultWarnings = [];
    const weaponRef = Object.freeze({ namespace: 'Weapon', entityId: weaponId });
    const weapon = entityIndex.get(entityKey('Weapon', weaponId));
    if (weapon === undefined) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-weapon-missing', `Unit/${unit.entityId} references missing Weapon/${weaponId}`, weaponRef));
        return Object.freeze({
            weapon: weaponRef,
            unitWeaponIndex: index,
            status: 'missing-data',
            unit: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.units.result,
            inputs: Object.freeze({
                damage: input('damage', undefined, 'damage'),
                attacks: input('attacks', undefined, 'attacks-per-period'),
                period: input('period', undefined, 'game-second'),
            }),
            provenance: Object.freeze({ entities: Object.freeze([entityProvenance(unit)]) }),
            warnings: Object.freeze(resultWarnings),
            completeness: resultCompleteness('incomplete', ['Weapon']),
        });
    }
    const fields = recordOf(weapon.fields) ?? {};
    const displayEffectId = linkedId(fields.DisplayEffect);
    const actualEffectId = linkedId(fields.Effect);
    const effectId = displayEffectId ?? actualEffectId;
    const effectFieldPath = displayEffectId === undefined ? 'Effect' : 'DisplayEffect';
    if (displayEffectId !== undefined &&
        actualEffectId !== undefined &&
        displayEffectId !== actualEffectId) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-display-effect-selected', `Weapon/${weaponId} has distinct DisplayEffect and Effect links; the displayed-effect value was selected and is not a runtime simulation`, weaponRef, 'DisplayEffect'));
    }
    const effect = effectId === undefined ? undefined : entityIndex.get(entityKey('Effect', effectId));
    const effectRef = effectId === undefined ? undefined : Object.freeze({ namespace: 'Effect', entityId: effectId });
    if (effectId === undefined) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-effect-link-missing', `Weapon/${weaponId} has no DisplayEffect or Effect link`, weaponRef, effectFieldPath));
    }
    else if (effect === undefined) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-effect-missing', `Weapon/${weaponId} references missing Effect/${effectId}`, effectRef, effectFieldPath));
    }
    else if (effect.typeId !== 'CEffectDamage') {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-effect-chain-unsupported', `Effect/${effectId} is ${effect.typeId}; set, persistent, area, missile and other indirect chains are not reduced to DPS by this formula`, effectRef, effectFieldPath));
    }
    const period = finiteNumber(fields.Period);
    const explicitAttacks = finiteNumber(fields.DisplayAttackCount);
    const attacks = explicitAttacks === undefined ? 1 : explicitAttacks;
    const damage = effect?.typeId === 'CEffectDamage' ? finiteNumber(effect.fields?.Amount) : undefined;
    if (period === undefined) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-period-missing', `Weapon/${weaponId} has no finite Period`, weaponRef, 'Period'));
    }
    else if (period <= 0) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-period-invalid', `Weapon/${weaponId} Period must be greater than zero`, weaponRef, 'Period'));
    }
    if (explicitAttacks !== undefined && explicitAttacks <= 0) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-attack-count-invalid', `Weapon/${weaponId} DisplayAttackCount must be greater than zero`, weaponRef, 'DisplayAttackCount'));
    }
    if (effect?.typeId === 'CEffectDamage' && damage === undefined) {
        resultWarnings.push(warning('blizzard.starcraft2/calculation-damage-missing', `Effect/${effectId} has no finite Amount`, effectRef, 'Amount'));
    }
    const inputs = Object.freeze({
        damage: input('damage', damage, 'damage', effect, 'Amount'),
        attacks: input('attacks', explicitAttacks === undefined ? 1 : explicitAttacks, 'attacks-per-period', explicitAttacks === undefined ? undefined : weapon, explicitAttacks === undefined ? undefined : 'DisplayAttackCount', explicitAttacks === undefined ? 'implicit-sc2-default' : 'resolved-field'),
        period: input('period', period, 'game-second', weapon, 'Period'),
    });
    const provenanceEntities = [entityProvenance(unit), entityProvenance(weapon)];
    if (effect !== undefined)
        provenanceEntities.push(entityProvenance(effect));
    const provenance = Object.freeze({
        selectedEffectField: effectFieldPath,
        ...(effectRef === undefined ? {} : { selectedEffect: effectRef }),
        entities: Object.freeze(provenanceEntities),
    });
    if (effect !== undefined && effect.typeId !== 'CEffectDamage') {
        return Object.freeze({
            weapon: weaponRef,
            unitWeaponIndex: index,
            status: 'unsupported',
            unit: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.units.result,
            inputs,
            provenance,
            warnings: Object.freeze(resultWarnings),
            completeness: resultCompleteness('unsupported', [], [`Effect type ${effect.typeId}`]),
        });
    }
    const missingFields = [];
    if (effect === undefined)
        missingFields.push(effectId === undefined ? effectFieldPath : 'Effect');
    if (damage === undefined)
        missingFields.push('Effect.Amount');
    if (period === undefined || period <= 0)
        missingFields.push('Weapon.Period');
    if (attacks <= 0)
        missingFields.push('Weapon.DisplayAttackCount');
    if (missingFields.length > 0) {
        return Object.freeze({
            weapon: weaponRef,
            unitWeaponIndex: index,
            status: 'missing-data',
            unit: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.units.result,
            inputs,
            provenance,
            warnings: Object.freeze(resultWarnings),
            completeness: resultCompleteness('incomplete', missingFields),
        });
    }
    const rawValue = (damage * attacks) / period;
    if (!Number.isFinite(rawValue)) {
        const overflowWarning = warning('blizzard.starcraft2/calculation-result-non-finite', `Weapon/${weaponId} produced a non-finite DPS result`, weaponRef);
        resultWarnings.push(overflowWarning);
        return Object.freeze({
            weapon: weaponRef,
            unitWeaponIndex: index,
            status: 'missing-data',
            unit: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.units.result,
            inputs,
            provenance,
            warnings: Object.freeze(resultWarnings),
            completeness: resultCompleteness('incomplete', ['result']),
        });
    }
    return Object.freeze({
        weapon: weaponRef,
        unitWeaponIndex: index,
        status: 'computed',
        rawValue,
        value: Math.round(rawValue * 10) / 10,
        unit: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA.units.result,
        inputs,
        provenance,
        warnings: Object.freeze(resultWarnings),
        completeness: resultCompleteness('complete'),
    });
}
function overallCompleteness(results, truncated, snapshotComplete, usedDefinitions) {
    const computed = results.filter(result => result.status === 'computed').length;
    const unsupported = results.filter(result => result.status === 'unsupported').length;
    const missing = results.length - computed - unsupported;
    let state = results.length === 0 ? 'incomplete' : 'complete';
    if (computed === 0 && unsupported > 0 && missing === 0)
        state = 'unsupported';
    else if (computed === 0 && missing > 0)
        state = 'incomplete';
    else if (unsupported > 0 || missing > 0 || truncated || !snapshotComplete || !usedDefinitions) {
        state = 'partial';
    }
    return Object.freeze({
        state,
        computedWeapons: computed,
        unsupportedWeapons: unsupported,
        incompleteWeapons: missing,
        truncated,
        snapshotComplete,
        usedDefinitions,
    });
}
/**
 * Calculate simple displayed DPS for every bounded weapon link on one resolved Unit.
 *
 * This is a pure read operation. It requires a revision-pinned DataCatalogSnapshot and performs
 * no I/O. Complex effect chains are reported as unsupported instead of being guessed.
 *
 * @param {import('@modkit/sdk/data').DataCatalogSnapshot} snapshot
 * @param {{ unitId: string, maxEntities?: number, maxWeapons?: number, signal?: AbortSignal }} request
 */
export function calculateStarcraft2UnitWeaponDps(snapshot, request) {
    const snapshotValue = recordOf(snapshot);
    if (snapshotValue === undefined || snapshotValue.schemaVersion !== 1) {
        throw new TypeError('snapshot must be a DataCatalogSnapshot v1 object');
    }
    if (snapshotValue.gameId !== GAME_ID) {
        throw new TypeError(`StarCraft II calculation cannot inspect ${String(snapshotValue.gameId)}`);
    }
    const snapshotId = nonEmptyString(snapshotValue.snapshotId, 'snapshot.snapshotId');
    const workspaceId = nonEmptyString(snapshotValue.workspaceId, 'snapshot.workspaceId');
    const analyzerId = nonEmptyString(snapshotValue.analyzerId, 'snapshot.analyzerId');
    const requestValue = recordOf(request);
    if (requestValue === undefined)
        throw new TypeError('request must be an object');
    const unitId = nonEmptyString(requestValue.unitId, 'request.unitId');
    const maxEntities = boundedPositiveInteger(requestValue.maxEntities, 'request.maxEntities', DEFAULT_MAX_ENTITIES, MAXIMUM_MAX_ENTITIES);
    const maxWeapons = boundedPositiveInteger(requestValue.maxWeapons, 'request.maxWeapons', DEFAULT_MAX_WEAPONS, MAXIMUM_MAX_WEAPONS);
    const signal = requestValue.signal;
    throwIfAborted(signal);
    const usedDefinitions = Array.isArray(snapshotValue.definitions);
    const entities = usedDefinitions ? snapshotValue.definitions : snapshotValue.entities;
    if (!Array.isArray(entities))
        throw new TypeError('snapshot definitions/entities must be an array');
    if (entities.length > maxEntities) {
        throw new RangeError(`snapshot entity count ${entities.length} exceeds request.maxEntities ${maxEntities}`);
    }
    const entityIndex = new Map();
    for (const entity of entities) {
        throwIfAborted(signal);
        const value = recordOf(entity);
        if (value === undefined)
            throw new TypeError('snapshot entity must be an object');
        nonEmptyString(value.namespace, 'snapshot entity namespace');
        nonEmptyString(value.entityId, 'snapshot entity id');
        entityIndex.set(entityKey(value.namespace, value.entityId), value);
    }
    const subject = Object.freeze({ namespace: 'Unit', entityId: unitId });
    const topWarnings = [];
    if (!usedDefinitions) {
        topWarnings.push(warning('blizzard.starcraft2/calculation-query-subset-used', 'snapshot.definitions is unavailable; calculation used the query subset in snapshot.entities', subject));
    }
    if (snapshotValue.complete !== true) {
        topWarnings.push(warning('blizzard.starcraft2/calculation-snapshot-incomplete', 'the source DataCatalogSnapshot is incomplete', subject));
    }
    const unit = entityIndex.get(entityKey('Unit', unitId));
    if (unit === undefined) {
        topWarnings.push(warning('blizzard.starcraft2/calculation-unit-missing', `Unit/${unitId} is absent from the snapshot`, subject));
        return Object.freeze({
            schemaVersion: 1,
            formula: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA,
            snapshotId,
            workspaceId,
            analyzerId,
            subject,
            inputs: Object.freeze({ maxEntities, maxWeapons }),
            results: Object.freeze([]),
            provenance: Object.freeze({
                snapshot: Object.freeze({ snapshotId, workspaceId, analyzerId }),
                algorithm: ALGORITHM_PROVENANCE,
                entities: Object.freeze([]),
            }),
            warnings: Object.freeze(topWarnings),
            completeness: Object.freeze({
                state: 'incomplete',
                computedWeapons: 0,
                unsupportedWeapons: 0,
                incompleteWeapons: 0,
                truncated: false,
                snapshotComplete: snapshotValue.complete === true,
                usedDefinitions,
            }),
        });
    }
    const rawWeaponArray = unit.fields?.WeaponArray;
    const weaponEntries = Array.isArray(rawWeaponArray)
        ? rawWeaponArray
        : rawWeaponArray === undefined
            ? []
            : [rawWeaponArray];
    const truncated = weaponEntries.length > maxWeapons;
    const weaponLinks = [];
    for (let index = 0; index < Math.min(weaponEntries.length, maxWeapons); index += 1) {
        throwIfAborted(signal);
        const weaponId = linkedId(weaponEntries[index]);
        if (weaponId === undefined) {
            topWarnings.push(warning('blizzard.starcraft2/calculation-weapon-link-malformed', `Unit/${unitId} WeaponArray[${index}] has no link id`, subject, `WeaponArray[${index}]`));
            continue;
        }
        weaponLinks.push(Object.freeze({ weaponId, index }));
    }
    if (weaponEntries.length === 0) {
        topWarnings.push(warning('blizzard.starcraft2/calculation-weapons-missing', `Unit/${unitId} has no WeaponArray entries`, subject, 'WeaponArray'));
    }
    if (truncated) {
        topWarnings.push(warning('blizzard.starcraft2/calculation-weapon-limit-reached', `Unit/${unitId} has ${weaponEntries.length} WeaponArray entries; only the first ${maxWeapons} were inspected`, subject, 'WeaponArray'));
    }
    const results = [];
    for (const link of weaponLinks) {
        throwIfAborted(signal);
        const result = resultForWeapon(unit, link.weaponId, link.index, entityIndex, signal);
        results.push(result);
        topWarnings.push(...result.warnings);
    }
    throwIfAborted(signal);
    const snapshotComplete = snapshotValue.complete === true;
    const completeness = overallCompleteness(results, truncated, snapshotComplete, usedDefinitions);
    return Object.freeze({
        schemaVersion: 1,
        formula: STARCRAFT2_SIMPLE_WEAPON_DPS_FORMULA,
        snapshotId,
        workspaceId,
        analyzerId,
        subject,
        inputs: Object.freeze({ maxEntities, maxWeapons }),
        results: Object.freeze(results),
        provenance: Object.freeze({
            snapshot: Object.freeze({ snapshotId, workspaceId, analyzerId }),
            algorithm: ALGORITHM_PROVENANCE,
            entities: Object.freeze([entityProvenance(unit)]),
        }),
        warnings: Object.freeze(topWarnings),
        completeness,
    });
}
//# sourceMappingURL=unit-weapon-dps.js.map