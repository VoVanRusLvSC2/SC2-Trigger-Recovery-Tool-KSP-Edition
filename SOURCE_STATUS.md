# Source integration status

This is a source recovery snapshot, **not a standalone converter release**. The current public API and retained CLI both stop at a missing array-values SDK `scanner.js`. No map acceptance status was changed by this work.

## Recovered and checked

- **59 missing source modules restored**, including recovery/session models, the reverse-conversion core, exact attribute identity and localization helpers.
- Every restored module matched a historical SHA-256 pin before relocation. Eleven pinned modules were reproducible from retained TypeScript; the historical compiler/options reproduced their JavaScript bytes. Some modules occur in more than one SDK family.
- Restored source ASTs matched their recovered originals after excluding relocated module/resource specifiers. In **18 existing modules**, only import/export wiring changed; their algorithm ASTs were unchanged. This does not by itself qualify the runtime bindings.
- The public API now points to the same retained conversion chain as the CLI. Collapsed utility-directory imports were rebound only when a recovered module exported all requested names.
- All **1324 JavaScript modules parsed successfully**. Focused local checks passed for disjoint XML patch safety, long-script transport, conservative wait matching and per-map analysis isolation. These are not full converter or map-equivalence tests.
- Five historical runtime package versions and their npm integrity data are now explicit. Acorn and Prettier are pinned development tools.

The [recovered-source manifest](scripts/recovered-sources.json) records original and published hashes. It contains no maps, game binaries, historical chat data or old run outputs.

## Additional recovery evidence

Four further missing modules were recovered from retained Git blob objects in the original local workspace: the array-values SAX reader and three SDK-family copies of attribute recovery. All four matched historical SHA-256 pins. Original and restored algorithm ASTs matched; only line endings were normalized. No Git objects were pruned or modified.

Six checkers now import `vscode-languageserver-types` and `vscode-uri` through their existing pinned npm package exports. The installed ESM files matched the supplied archive byte for byte, and package imports resolved to the identical ESM module objects. This removes two unnecessary vendor-copy targets and twelve broken import edges without adding packages or changing checker algorithm ASTs.

A separate local trial restored the archived ModKit packages and their available transitive dependencies from the supplied `mk-revizer.zip`. Actual Node ESM imports succeeded for all 29 previously unresolved package specifiers. This establishes recoverability of external dependencies, not converter equivalence or a reproducible public installation. Those trial packages are not part of this checkout's dependency manifest or publication; the counts below describe the checkout itself.

The original local v569 conversion candidate also currently fails to load at an absent SDK `lossless-xml.js`; the older modular entry separately references a missing v193 overlay. A currently working complete local conversion chain has not been established.

## Remaining work at a glance

The unresolved targets below are files and package entry points, not unverified map counts.

| Area | Missing files | Required work |
| --- | ---: | --- |
| Array-values SDK | 22 | Recover the scanner, conversion/type/template stages, XML/catalog helpers and schema entry point for the retained revision. |
| Other SDK families | 11 | Recover four scanner variants, four Custom AI modules and three schema JSON files. |
| Project utilities | 8 | Restore attribute display/GUI/policy helpers, dependency policy, source handling and the correct AI-data resource path. |
| Conversion types | 1 | Restore `preset-reference-use/types/core.mjs`. |
| **Total** | **42** | Recover compatible implementations; the exact paths are listed below. |

There is also **one invalid directory target** (`src/utilities`, referenced three times): bind native-include normalization to its actual implementation. No directory barrel or stub should be used to silence it.

The external dependency set comprises **nine packages with 29 imported entry points**, not 29 separate libraries:

| Package | Version in the retained archive |
| --- | --- |
| `@modkit/blizzard-casc` | `1.0.0` |
| `@modkit/blizzard-common-formats` | `0.1.0` |
| `@modkit/blizzard-mpq` | `1.0.0` |
| `@modkit/blizzard-starcraft2` | `1.0.0` |
| `@modkit/codec-kit` | `1.0.0` |
| `@modkit/core` | `0.1.0` |
| `@modkit/sdk` | `0.1.0` |
| `@modkit/vfs` | `0.1.0` |
| `modkit-extension-archives` | `1.0.0` |

Their archived module-load trial passed. Public installation still needs a reproducible acquisition/build procedure, transitive version pins and per-component redistribution review. Archive packages marked `UNLICENSED` were not added to the public source tree. A matching package version alone does not qualify the locally modified SDK families.

After source closure, validate **16 computed imports**, runtime metadata/configuration paths and both API/CLI entry points from a fresh installation. Then run incremental-GUI, attribute and business-logic checks with the unchanged benchmark, followed by Editor compilation/export validation. No new map PASS follows from resolving imports alone.

## Remaining build gaps

The same static source checker found **339 broken relative-import edges to 89 targets** before recovery. It now reports **191 edges to 43 unresolved relative targets**: 42 missing files and one invalid utility-directory target. This count includes newly exposed transitive dependencies.

There are also **169 unresolved bare-package import occurrences**, representing **29 distinct specifiers**. These include local ModKit package exports; installing the five public npm dependencies does not supply those SDK packages. Sixteen imports resolve paths at runtime and need separate execution/configuration checks.

Current source verification deliberately exits with code **1 / INCOMPLETE**. Its rules were not changed to hide unresolved references. It checks JavaScript syntax and literal ESM resolution, not named-export contracts, all computed resources, CommonJS dependency closure or program behavior.

### Missing relative targets

- `src/conversion/preset-reference-use/types/core.mjs`
- `src/sdk/array-values/modules/data/services/schema/full-data-schema.js`
- `src/sdk/array-values/modules/data/shared/catalog-engine/gamedata-order.js`
- `src/sdk/array-values/modules/data/shared/catalog-engine/xml/parser.js`
- `src/sdk/array-values/modules/galaxy/language-core/scanner.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/function-candidates.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/dependency-functions.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/explicit-zero-initializer.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/external-structure-fields.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-initialization.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/galaxy-type-resolution.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/imported-local-scope.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/legacy-native-while-template.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/nondecimal-literal.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ordinal-preset-owners.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/owned-raw-struct-member.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/parameter-script-name.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/script-template.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/single-call-template-alias.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ttg-core.js`
- `src/sdk/array-values/modules/triggers/services/galaxy-conversion/internal/unreachable-gui-tail.js`
- `src/sdk/array-values/modules/triggers/shared/trigger-document/trigger-xml.js`
- `src/sdk/core/modules/data/services/schema/generated/sc2-data-schema.json`
- `src/sdk/literal-native/modules/galaxy/language-core/scanner.js`
- `src/sdk/lossless-colors/modules/galaxy/language-core/scanner.js`
- `src/sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/custom-ai-recovery.js`
- `src/sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/custom-ai-script.js`
- `src/sdk/private-switch/modules/data/services/schema/generated/sc2-data-schema.json`
- `src/sdk/production-preparation/modules/data/services/schema/generated/sc2-data-schema.json`
- `src/sdk/production-preparation/modules/galaxy/language-core/scanner.js`
- `src/sdk/production-preparation/modules/triggers/services/galaxy-conversion/internal/custom-ai-recovery.js`
- `src/sdk/production-preparation/modules/triggers/services/galaxy-conversion/internal/custom-ai-script.js`
- `src/sdk/thread-analysis/modules/galaxy/language-core/scanner.js`
- `src/utilities/attribute-display-text.mjs`
- `src/utilities/attribute-gui.mjs`
- `src/utilities/attribute-literal-quotes.canonical-only.mjs`
- `src/utilities/attribute-literal-quotes.mjs`
- `src/utilities/attributes-policy.mjs`
- `src/utilities/dependency_ai_pack_policy_v1285.mjs`
- `src/utilities/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-raw-local-structure-scope-v1368-2026-10-07/dist/modules/map/shared/format/formats/ai-data.js`
- `src/utilities/s2mh-source.mjs`

The remaining directory import is `src/utilities`, used by unresolved native-include normalization. A permissive barrel or stub was not added.

### Unresolved package specifiers

- `@modkit/blizzard-casc/installation-node`
- `@modkit/blizzard-common-formats/content-address/cache-handle`
- `@modkit/blizzard-common-formats/s2protocol`
- `@modkit/blizzard-mpq/header-protection`
- `@modkit/blizzard-mpq/reader`
- `@modkit/blizzard-starcraft2/data/authoring-index`
- `@modkit/blizzard-starcraft2/data/catalog`
- `@modkit/blizzard-starcraft2/data/engine-resolution`
- `@modkit/blizzard-starcraft2/data/entity-cards`
- `@modkit/blizzard-starcraft2/data/format`
- `@modkit/blizzard-starcraft2/data/gamedata-order`
- `@modkit/blizzard-starcraft2/data/xml`
- `@modkit/blizzard-starcraft2/galaxy/analysis/language-service.js`
- `@modkit/blizzard-starcraft2/galaxy/language-core`
- `@modkit/blizzard-starcraft2/layout/runtime`
- `@modkit/blizzard-starcraft2/map/catalog-usages`
- `@modkit/blizzard-starcraft2/schema`
- `@modkit/codec-kit`
- `@modkit/codec-kit/audio`
- `@modkit/codec-kit/compression`
- `@modkit/codec-kit/compression/bounded`
- `@modkit/codec-kit/crypto`
- `@modkit/codec-kit/graph/isolation`
- `@modkit/core`
- `@modkit/sdk`
- `@modkit/sdk/data`
- `@modkit/vfs`
- `@modkit/vfs/content-sources/node`
- `modkit-extension-archives/formats/zip/codec`

## Reproduce source checks

The preparation environment was Windows with Node.js **24.14.1**. Use Node 24 for these checks:

```sh
npm ci --ignore-scripts
npm run format:check
npm run verify:recovered
npm run verify:source
```

`verify:recovered` checks published file bytes against the recovery manifest. It cannot independently reproduce the unavailable original workspace. `verify:source` currently reports INCOMPLETE and exits nonzero. Neither command substitutes for the unchanged external benchmark or Editor export comparison.

For a detailed local report:

```sh
node scripts/check-source.mjs --report source-status.local.json
```

Do not commit generated reports. Runtime package versions preserve the historical baseline rather than silently upgrading its behavior. `npm audit` currently reports a moderate advisory for the pinned `fast-xml-parser`; a dependency upgrade requires its own compatibility checks before a usable release.

## Next qualification gates

1. Recover the exact remaining SDK generation and its local package exports. Same-named upstream files were examined but not substituted when their fingerprints differed.
2. Make SDK, metadata, benchmark and output configuration portable. Resolve runtime assets and dynamic imports, then load both entry points from a fresh checkout.
3. Qualify incremental completion, attributes, complete initialization/event composition and equivalence with the original strict benchmark.
4. Validate the exact assembled candidate using Editor compilation and exported Galaxy. Only then publish an install-and-run release.

The [release roadmap](ROADMAP.md) defines completion criteria. The 103 recorded strict passes and 222 historical acceptances remain historical evidence with separate verification levels.
