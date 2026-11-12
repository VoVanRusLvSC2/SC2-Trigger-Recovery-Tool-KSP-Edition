import { convertGalaxyToTriggers, convertTriggersToGalaxy, createTriggerConversionContext, triggerConversionBounds, } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/a4869a230f14-60897-54c0833791ed-4c2f400279c2-49a7e6ffa13c10-314b67aaa13f42-5549b617a994d392-service.mjs';
export { convertGalaxyToTriggers, convertTriggersToGalaxy, createTriggerConversionContext, triggerConversionBounds };
export { compareGalaxyPrograms, pairedFunctionLocalNames } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/0e93db7137a4-d79adc171d00-1f03cd2a2a62a456-galaxy-comparison.mjs';
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