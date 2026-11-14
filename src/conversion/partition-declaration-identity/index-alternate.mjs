import {
  convertGalaxyToTriggers,
  convertTriggersToGalaxy,
  createTriggerConversionContext,
  triggerConversionBounds,
} from './service-alternate.mjs';
export {
  convertGalaxyToTriggers,
  convertTriggersToGalaxy,
  createTriggerConversionContext,
  triggerConversionBounds,
};
export {
  compareGalaxyPrograms,
  pairedFunctionLocalNames,
} from '../exact-native-export/galaxy-comparison.mjs';
/** Stable SC2-domain facade over the shared Galaxy AST and TriggerData model. */
export function createTriggerGalaxyConversionService(defaults = {}) {
  const { cache, conversionContext: suppliedContext, ...defaultOptions } = defaults;
  const conversionContext = suppliedContext ?? createTriggerConversionContext(cache);
  const options = Object.freeze({ ...defaultOptions, conversionContext });
  return Object.freeze({
    triggersToGalaxy(primaryText, input = {}, signal) {
      return convertTriggersToGalaxy(
        primaryText,
        { ...options, ...input, conversionContext },
        signal,
      );
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
