// Build-time provenance for the Trigger/Galaxy converter's imported source lineage.
// The canonical TypeScript sources in this package are the runtime implementation.
// Source provenance: modkit commit 1a14ba4eddd0ae88de273348ebd44cfb98a0581d.
// This file deliberately has no runtime imports, so publishing cannot reach the historical checkout.
export const triggerConverterProvenance = Object.freeze({
    repository: 'local:modkit',
    commit: '1a14ba4eddd0ae88de273348ebd44cfb98a0581d',
    entrypoints: Object.freeze([
        'extensions/blizzard/starcraft-2/codecs/galaxy/src/core/trigger-to-galaxy.ts',
        'extensions/blizzard/starcraft-2/codecs/sc2-triggers/src/core/galaxy-to-trigger.ts',
        'extensions/blizzard/starcraft-2/codecs/sc2-triggers/src/core/sax-reader.ts',
    ]),
});
