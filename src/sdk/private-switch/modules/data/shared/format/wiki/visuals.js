/**
 * Unit → model visual resolution (battle-scene B3 / replay R5).
 *
 * Resolves catalog unit type names (replay tracker names, sim unit types) to
 * renderable model assets. Units don't reference models directly — actors do:
 * a `CActorUnit` subscribes to the unit's lifecycle in its `On` event table
 * and carries the `Model` link. In shipped data both live TOKENIZED on base
 * templates (core.sc2mod `GenericUnitMinimal`: `Model value="##unitName##"`,
 * `On Terms="UnitBirth.##unitName##" Send="Create"` + `UnitRevive`/
 * `UnitConstruction.*.Start` variants) and concrete actors only set the
 * `unitName` token — so association MUST read the RESOLVED entity data
 * (parent chain merged, tokens substituted), not raw declared fields. This
 * module indexes every actor's resolved model + creation events once and
 * resolves whole type lists against that index. Unresolved types keep a
 * deterministic placeholder color so the scene renders capsules and never
 * blocks playback.
 *
 * Browser-safe by construction: no node/vscode/ops imports — everything works
 * off the loaded `SC2Mod` catalog.
 */
import { coerceEntity } from "./wiki.js";
const num = (v) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? n : undefined;
};
const str = (v) => (typeof v === 'string' && v ? v : undefined);
/** Actor events that create the standing unit actor (resolved `On` terms). */
const CREATION_EVENTS = new Set(['unitbirth', 'unitconstruction', 'unitrevive']);
const DEATH_EVENT = 'unitdeath';
/**
 * Index every model-carrying actor by the units it is associated with, from
 * RESOLVED actor data: self-`Create` entries in the `On` table (the event arg
 * names the unit; `*` falls back to the actor's `unitName`) plus the
 * `unitName` token itself. Build once per mod and reuse across resolutions.
 */
export function buildUnitVisualIndex(mod) {
    const index = new Map();
    for (const actorEntity of mod.all('Actor')) {
        if (!actorEntity.id)
            continue;
        const actor = coerceEntity(actorEntity, mod);
        const modelLink = str(actor['Model']);
        if (!modelLink)
            continue;
        const modelEntity = mod.get('Model', modelLink);
        if (!modelEntity)
            continue;
        const file = str(coerceEntity(modelEntity, mod)['Model']);
        if (!file)
            continue;
        const unitNameLc = str(actor['unitName'])?.toLowerCase();
        // Unit id (lc) → {creation, death} accumulated over the On table.
        const events = new Map();
        let otherCreate = false;
        const on = actor['On'];
        if (Array.isArray(on)) {
            for (const entry of on) {
                if (entry === null || typeof entry !== 'object')
                    continue;
                if (str(entry['Send'])?.trim().toLowerCase() !== 'create')
                    continue;
                const terms = str(entry['Terms']);
                if (!terms)
                    continue;
                // `Event[.Arg[.Sub]][; ConditionTerm …]` — first term triggers.
                const [event, arg] = terms.split(';')[0].trim().split('.');
                const eventLc = event?.toLowerCase() ?? '';
                const creation = CREATION_EVENTS.has(eventLc);
                const death = eventLc === DEATH_EVENT;
                if (!creation && !death) {
                    otherCreate = true;
                    continue;
                }
                const unitLc = arg && arg !== '*' ? arg.toLowerCase() : unitNameLc;
                if (!unitLc)
                    continue;
                const slot = events.get(unitLc) ?? { creation: false, death: false };
                if (creation)
                    slot.creation = true;
                if (death)
                    slot.death = true;
                events.set(unitLc, slot);
            }
        }
        if (unitNameLc && !events.has(unitNameLc))
            events.set(unitNameLc, { creation: false, death: false });
        const scale = num(actor['Scale']);
        for (const [unitLc, slot] of events) {
            let list = index.get(unitLc);
            if (!list)
                index.set(unitLc, (list = []));
            list.push({
                actorId: actorEntity.id,
                actorClass: actorEntity.class,
                file,
                scale,
                otherCreate,
                association: { ...slot, viaUnitName: unitLc === unitNameLc },
            });
        }
    }
    return index;
}
function candidateScore(candidate) {
    const { creation, death, viaUnitName } = candidate.association;
    let score = 0;
    if (creation)
        score += 100;
    if (death && !creation && !candidate.otherCreate)
        score -= 50;
    if (candidate.actorClass === 'CActorUnit')
        score += 10;
    if (viaUnitName)
        score += 5;
    return score;
}
/**
 * Resolve many unit type names at once (the index is amortized over the whole
 * timeline/army). Every requested name gets an entry — failures degrade to a
 * placeholder resolution with diagnostics, never an error.
 */
export function resolveUnitVisuals(mod, typeNames, options = {}) {
    const defaultRadius = options.defaultRadius ?? 0.5;
    const index = options.index ?? buildUnitVisualIndex(mod);
    const results = new Map();
    let lowercaseUnitIds;
    for (const typeName of typeNames) {
        if (results.has(typeName))
            continue;
        const diagnostics = [];
        let unitId;
        let unitEntity = mod.get('Unit', typeName);
        if (unitEntity) {
            unitId = typeName;
        }
        else {
            // Tracker names occasionally differ from catalog ids only by case.
            if (!lowercaseUnitIds) {
                lowercaseUnitIds = new Map();
                for (const entity of mod.all('Unit')) {
                    const id = entity.id;
                    if (id && !lowercaseUnitIds.has(id.toLowerCase()))
                        lowercaseUnitIds.set(id.toLowerCase(), id);
                }
            }
            const corrected = lowercaseUnitIds.get(typeName.toLowerCase());
            if (corrected) {
                unitId = corrected;
                unitEntity = mod.get('Unit', corrected);
            }
        }
        let modelPath;
        let actorId;
        let deathModelPath;
        let scale = 1;
        let radius = defaultRadius;
        if (!unitEntity || !unitId) {
            diagnostics.push(`unit-not-found: ${typeName}`);
        }
        else {
            const unit = coerceEntity(unitEntity, mod);
            radius = num(unit['Radius']) ?? defaultRadius;
            const candidates = [...(index.get(unitId.toLowerCase()) ?? [])].sort((a, b) => candidateScore(b) - candidateScore(a));
            const best = candidates[0];
            if (best) {
                modelPath = best.file;
                actorId = best.actorId;
                scale = best.scale ?? 1;
                if (options.hasAsset) {
                    const resolved = resolveModelFile(modelPath, options.hasAsset);
                    if (resolved)
                        modelPath = resolved;
                    else {
                        diagnostics.push(`unit-model-asset-missing: ${modelPath}`);
                        modelPath = undefined;
                    }
                }
            }
            else {
                diagnostics.push(`no-actor-model: ${unitId}`);
            }
            // Separate death model: only unit/model actor classes qualify — units also
            // spawn death LIGHTING actors (CActorLightSpotModel…) that carry models.
            const death = candidates.find(c => c.association.death &&
                !c.association.creation &&
                c.actorId !== actorId &&
                (c.actorClass === 'CActorModel' || c.actorClass === 'CActorUnit'));
            if (death)
                deathModelPath = death.file;
        }
        results.set(typeName, {
            typeName,
            unitId,
            modelPath,
            actorId,
            deathModelPath,
            scale,
            radius,
            placeholderColor: placeholderColorFor(typeName),
            diagnostics,
        });
    }
    return results;
}
/**
 * Resolve map doodad placement types (B8 / P15 placements). A doodad's `Type`
 * is an Actor id; shipped doodad actors almost never DECLARE a `Model` link —
 * the game defaults it to the like-named `CModel` entry. The resolved entity
 * data can't be trusted here: implicit class defaults inject a bogus
 * `Model=ActorLightSpot` on every modelless actor, so this walks the EXPLICIT
 * parent chain's declared data for a real link and otherwise uses the same-id
 * convention. With `hasAsset`, the catalog stem is resolved to the concrete
 * variation file on disk (v1: one canonical file per type — variations draw
 * the same model). Failures degrade to diagnostics, never an error.
 */
export function resolveDoodadVisuals(mod, typeNames, options = {}) {
    const { hasAsset } = options;
    const results = new Map();
    for (const typeName of typeNames) {
        if (results.has(typeName))
            continue;
        const diagnostics = [];
        const actorEntity = mod.get('Actor', typeName);
        if (!actorEntity)
            diagnostics.push(`doodad-actor-not-found: ${typeName}`);
        // Leaf-most declared Model/Scale along the explicit parent chain.
        let declaredModel;
        let declaredScale;
        const guard = new Set();
        let cursor = actorEntity;
        while (cursor && !guard.has(cursor.id)) {
            guard.add(cursor.id);
            const data = cursor.data;
            if (declaredModel === undefined)
                declaredModel = str(data?.['Model']);
            if (declaredScale === undefined)
                declaredScale = num(data?.['Scale']);
            cursor = cursor.parent !== undefined ? mod.get('Actor', cursor.parent) : undefined;
        }
        // Tokenized declarations (##unitName##…) never appear on doodad actors;
        // treat them as undeclared rather than resolving tokens here.
        if (declaredModel?.includes('##'))
            declaredModel = undefined;
        let modelPath;
        for (const modelId of declaredModel ? [declaredModel, typeName] : [typeName]) {
            const modelEntity = mod.get('Model', modelId);
            if (!modelEntity)
                continue;
            modelPath = str(coerceEntity(modelEntity, mod)['Model']);
            if (modelPath)
                break;
        }
        const catalogModelPath = modelPath;
        if (!modelPath) {
            diagnostics.push(`doodad-model-not-found: ${declaredModel ?? typeName}`);
        }
        else if (hasAsset) {
            const resolved = resolveModelFile(modelPath, hasAsset);
            if (resolved)
                modelPath = resolved;
            else {
                diagnostics.push(`doodad-asset-missing: ${modelPath}`);
                modelPath = undefined;
            }
        }
        results.set(typeName, {
            typeName,
            actorId: actorEntity?.id,
            modelPath,
            catalogModelPath,
            scale: declaredScale ?? 1,
            diagnostics,
        });
    }
    return results;
}
/**
 * Rewrite a catalog model stem to the concrete asset that exists: the bare
 * name first (doodads without variations), then `<stem>_00`…`_19` (variation
 * files) — or, with `preferredVariation`, that specific `_NN` file first.
 * Returns the winning path (original directory + resolved filename) or
 * undefined when none are present.
 */
function resolveModelFile(modelPath, hasAsset, preferredVariation) {
    const norm = modelPath.replace(/\\/g, '/');
    const slash = norm.lastIndexOf('/');
    const dir = slash === -1 ? '' : norm.slice(0, slash + 1);
    const base = norm.slice(slash + 1);
    const stem = base.replace(/\.m3$/i, '');
    if (preferredVariation !== undefined && preferredVariation >= 0) {
        const candidate = `${stem}_${String(preferredVariation).padStart(2, '0')}.m3`;
        if (hasAsset(candidate.toLowerCase()))
            return `${dir}${candidate}`;
    }
    if (hasAsset(base.toLowerCase()))
        return modelPath;
    for (let variation = 0; variation < 20; variation += 1) {
        const candidate = `${stem}_${String(variation).padStart(2, '0')}.m3`;
        if (hasAsset(candidate.toLowerCase()))
            return `${dir}${candidate}`;
    }
    return undefined;
}
/**
 * Resolve ONE placement's `variation` index to its concrete asset file
 * (`<stem>_NN.m3` matching the map's `Variation` field) instead of
 * `resolveDoodadVisuals`'s type-level "first file found" `modelPath` — lets
 * every instance of a multi-variation doodad (rocks, trees, rubble…) draw its
 * own model instead of all instances collapsing onto one canonical file.
 * Falls back to whatever `resolveDoodadVisuals` already resolved when the
 * exact `_NN` file isn't present (never fails harder than the type-level
 * resolve). `catalogModelPath` is `DoodadVisualResolution.catalogModelPath`.
 */
export function resolveDoodadVariationAsset(catalogModelPath, variation, hasAsset) {
    return resolveModelFile(catalogModelPath, hasAsset, variation);
}
/**
 * Cards fallback: best model-carrying actor referencing `ns/id` through the
 * relation graph (any namespace — effects, missiles, doodads). The unit path
 * above does NOT use this: graph edges cover declared fields only and miss
 * template-inherited actor wiring.
 */
export function deriveActorModel(mod, graph, ns, id, maxActors = 24) {
    if (!graph)
        return undefined;
    let checked = 0;
    for (const ref of graph.incoming(ns, id)) {
        if (ref.to.namespace !== 'Actor' || checked++ > maxActors)
            continue;
        const actorEntity = mod.get('Actor', ref.to.id);
        if (!actorEntity)
            continue;
        const modelLink = str(coerceEntity(actorEntity, mod)['Model']);
        if (!modelLink)
            continue;
        const modelEntity = mod.get('Model', modelLink);
        if (!modelEntity)
            continue;
        const file = str(coerceEntity(modelEntity, mod)['Model']);
        if (file)
            return { file, actorId: ref.to.id };
    }
    return undefined;
}
/** Deterministic, well-spread capsule color for a type name (linear RGB 0–1). */
export function placeholderColorFor(typeName) {
    let hash = 2166136261;
    for (let index = 0; index < typeName.length; index += 1) {
        hash ^= typeName.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    const hue = ((hash >>> 8) % 360) / 360;
    return hslToRgb(hue, 0.65, 0.55);
}
function hslToRgb(h, s, l) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
        let x = t;
        if (x < 0)
            x += 1;
        if (x > 1)
            x -= 1;
        if (x < 1 / 6)
            return p + (q - p) * 6 * x;
        if (x < 1 / 2)
            return q;
        if (x < 2 / 3)
            return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}
//# sourceMappingURL=visuals.js.map