export * from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/c7fb2b544860-f5647e66d7da-701ab5fdb888-189652cc1dc7-core.mjs";
import { sanitizeIdentifier, libraryPrefix } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
/** Explicit editor Identifiers can begin with a digit because gt_ is already
 * legal. A default display name still uses the editor's ordinary sanitizer. */
export function recoveredTriggerScriptStem(trigger) {
    const raw = trigger.identifier ?? trigger.name ?? trigger.id;
    if (trigger.identifier !== undefined && /^[0-9][A-Za-z0-9_]*$/u.test(raw))
        return raw;
    return sanitizeIdentifier(raw);
}
export function triggerFuncName(libId, trigger) { return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}_Func`; }
export function triggerHandleName(libId, trigger) { return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}`; }
export function triggerInitFuncName(libId, trigger) { return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}_Init`; }
