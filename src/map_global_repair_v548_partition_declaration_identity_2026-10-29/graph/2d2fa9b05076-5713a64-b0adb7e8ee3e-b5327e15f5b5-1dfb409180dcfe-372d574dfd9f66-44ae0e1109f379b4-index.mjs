import { convertGalaxyToTriggers, convertTriggersToGalaxy, createTriggerConversionContext, triggerConversionBounds, } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/2eff0f1daa7b-122a4-4b69ae44dcbc-b14f2dd207c7-c437278fb691b4-9916389b975fc8-c4f05f329230cac1-service.mjs';
export { convertGalaxyToTriggers, convertTriggersToGalaxy, createTriggerConversionContext, triggerConversionBounds };
export { compareGalaxyPrograms, pairedFunctionLocalNames } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/95e96b2172da-f44b6af731d4-e08c08356269a445-galaxy-comparison.mjs';
/** Stable SC2-domain facade over the shared Galaxy AST and TriggerData model. */
export function createTriggerGalaxyConversionService(defaults = {}) {
    const { cache, conversionContext: suppliedContext, ...defaultOptions } = defaults;
    const conversionContext = suppliedContext ?? createTriggerConversionContext(cache);
    const options = Object.freeze({ ...defaultOptions, conversionContext });
    return Object.freeze({
        triggersToGalaxy(primaryText, input = {}, signal) {
            return convertTriggersToGalaxy(primaryText, { ...options, ...input, conversionContext }, signal);
        },
        galaxyToTriggers(input, signal) {
            return convertGalaxyToTriggers({ ...options, ...input, conversionContext }, signal);
        },
        clearCache() {
            conversionContext.clear();
        },
        cacheStats() {
            return conversionContext.stats();
        },
    });
}
//# sourceMappingURL=index.js.map