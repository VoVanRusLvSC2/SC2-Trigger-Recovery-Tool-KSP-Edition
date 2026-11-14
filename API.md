# Conversion API

Prepare the pinned dependencies as described in [BUILDING.md](BUILDING.md).
The supported API is `src/conversion/index.mjs`. It loads without the historical
workspace or its SDK configuration files. Required game/library data is supplied
explicitly; it is not fabricated when omitted.

```js
import {
  convertGalaxyToTriggers,
  convertTriggersToGalaxy,
  createTriggerConversionContext,
} from './src/conversion/index.mjs';

const conversionContext = createTriggerConversionContext({
  maxDependencyCacheEntries: 0,
  maxDependencyCacheSourceBytes: 0,
});
try {
  const input = {
    libraryId: 'Map',
    documentKind: 'map',
    script: originalMapScript,
    header: originalOwnedHeader ?? '',
    dependencyLibraries, // actual loaded TriggerLib/SC2Lib XML and localized tables
    galaxyDeclarations, // actual external { fileName, text } declarations
    strictSymbols: true,
    guiRecoveryMode: 'preserve-source',
    conversionContext,
    // existingTriggerData: originalTriggersXml, // optional incremental completion
    // triggerStrings, gameStrings, locale, localizedStrings
  };
  const recovered = await convertGalaxyToTriggers(input);
  const regenerated = await convertTriggersToGalaxy(recovered.output.triggerData, {
    ...input,
    ...recovered.output.generationOptions,
    triggerStrings: recovered.output.triggerStrings ?? '',
    gameStrings: recovered.output.gameStrings ?? '',
  });
  // Inspect fidelity/diagnostics and compare the complete regenerated program
  // with its source. Creating XML or compiling code is not equivalence proof.
} finally {
  conversionContext.clear();
}
```

`dependencyLibraries` contains objects with `triggerData`, and optional
`sourcePath`, `triggerStrings`, `gameStrings`. Supply the actual transitive
dependency chain in its mounted order. A nearby GUI name or another version's
library is not a qualified substitute. `galaxyDeclarations` must include the
actual native/header/helper sources used by that chain. Missing standard GUI
bindings are rejected instead of being hidden by new Native or raw wrappers.

For an explicit library, use its real `libraryId` and `documentKind: 'library'`.
For maps, supply `header: ''` when there is no separate owned header. The original
startup graph is part of the program; do not remove it merely to simplify input.

With authored XML, unchanged input returns `incremental.mode: 'UNCHANGED'` and
preserves XML bytes. Changed/new functions use `INCREMENTAL`; genuinely absent or
empty markup uses `FULL_REBUILD`. Inspect the change list and timing fields rather
than assuming every existing tree is complete. Preserve the returned generation
options for forward conversion.

This API operates on components. It does not overwrite a supplied archive. The
[prepared-job CLI](CLI.md) adds archive identity, dependency authority, attribute
provenance, packaging and offline evidence. Verified attribute namespace contexts
are opaque in-process capabilities; they must not be invented from a numeric ID
or serialized as a plain JSON claim.

## Reproduce integration checks

Supply a directory containing matching `NativeLib.TriggerLib`, `natives.galaxy`,
`NativeLib_h.galaxy` and `NativeLib.galaxy`, and the pinned benchmark distribution:

```sh
npm run verify:integration -- --native-root /path/to/TriggerLibs --benchmark-root /path/to/distribution
npm run verify:attribute-integration -- --native-root /path/to/TriggerLibs --benchmark-root /path/to/distribution
```

The benchmark root contains `benchmark/MANIFEST.json`. Its original SHA and all
304 asset fingerprints remain enforced. These checks cover fresh map/library
recovery, unchanged XML, added/modified functions, empty markup, startup
preservation and separate attribute document/GUI/runtime failures. They do not
promote corpus records or certify Editor/gameplay behavior.
