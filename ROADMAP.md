# From source snapshot to a working converter

**Updated: 2026-11-14. Current status: source integration, not a standalone release.**

The recovery pipeline is implemented in the published source, and earlier artifacts have recorded map results. A fresh clone still cannot run the complete converter. The goal of this plan is a reproducible working release with a clear supported scope, useful diagnostics and a small, explicit list of remaining bugs. Silent changes to map behavior are not an acceptable beta limitation.

## What is implemented and what remains open

| Area | Present in this checkout | Remaining release work |
| --- | --- | --- |
| Galaxy analysis | Shared AST, ownership, types and transformation passes | Restore the complete dependency closure and qualify the selected implementation chain |
| GUI recovery | Binding catalogs, fresh reconstruction and incremental completion | Exercise both paths end to end and prove preservation of existing GUI |
| Attributes | Provenance preparation, GUI/document checks and runtime query comparison | Supply portable verified inputs and qualify all three contracts together |
| Verification | Production safeguards and an adapter to a pinned external oracle | Make the exact oracle and qualification inputs reproducibly available |
| Distribution | Source modules and earlier packaged releases | Provide one supported entry point, declared runtime dependencies and a repeatable package build |
| Map evidence | 103 recorded strict passes and 222 historical acceptances | Requalify the release build; do not relabel historical records as new passes |

## Confirmed blockers in the published source

The 2026-11-14 audit parsed 1,265 JavaScript modules and checked literal relative imports and re-exports, including literal dynamic imports. It found 339 unresolved references to 89 distinct targets. This is a source-resolution audit, not a complete runtime or resource audit; computed imports and data loaded from configuration need separate checks.

- The public [conversion entry point](src/conversion/index.mjs) re-exports a missing `preset-reference-use/index.standard-getter-overlay.mjs` module. Matching export names in another overlay are not sufficient grounds to substitute it.
- Shared utility imports such as `src/utilities/attribute-identity-context.mjs`, `src/utilities/attribute-gui.mjs` and `src/utilities` are unresolved.
- Included SDK code still references missing scanner and conversion-internal modules, including `conversion-model.js`, `g2t-core.js` and `ttg-core.js`.
- External runtime package imports are not represented by a complete root dependency manifest. The current root installation supports the formatting tools, not the converter runtime.
- [SDK configuration](src/ast/config.json) contains machine-local paths. The CLI also assumes local game installation and job paths.
- The [pinned oracle adapter](src/verification/pinned-user-oracle.mjs) expects benchmark assets at an old workspace-relative location. Their identity checks remain required; the published tree does not contain those assets.
- Earlier qualification data refers to prior source artifacts. Directory migration and formatting change file hashes, even when executable syntax is preserved. That evidence must be regenerated or explicitly rebound through an appropriate qualification process, not silently updated to match new hashes.

## Source recovery checkpoint - 2026-11-14

59 missing modules have been restored against historical SHA-256 pins. Their algorithm ASTs were preserved; 18 existing modules received specifier-only wiring changes. Source completeness improved, but the SDK/runtime graph still has unresolved targets and both entry points remain blocked. See [the exact remaining gaps and reproducible source checks](SOURCE_STATUS.md). This checkpoint does not complete phase 1 or promote any map status.

## 1. Restore a complete, explicit build graph

- Recover the missing project and SDK modules from authoritative source or appropriately licensed upstream revisions.
- Choose and qualify the intended conversion chain, then connect the public library and CLI entry points to it. Preserve distinct implementations until their contracts are understood.
- Declare the runtime packages actually needed by the supported entry points, pin compatible versions and commit their lockfile. Do not include unrelated SDK subsystems merely to silence import failures.
- Document the supported Node.js and Windows environment. Report missing components before opening or writing a user archive.

**Done when:** a fresh clone installs its declared dependencies and loads both supported entry points without missing imports. No stub implementation, permissive fallback or disabled assertion is used to reach that result.

## 2. Make configuration and evidence portable

- Replace historical workspace paths with explicit, validated SDK, game-data, benchmark and output locations.
- Define the supported CLI job schema and output-directory contract. Keep source archives immutable and separate from generated candidates.
- Provide a documented way to obtain required SDK/game metadata without redistributing material whose license does not permit it.
- Load the original benchmark through a configurable manifest location while retaining its integrity checks and strict comparison rules.
- Regenerate qualification inputs for the assembled release and record the source revision, dependency versions and game-data identity.

**Done when:** a second machine can prepare the same supported environment without recreating the author's drive layout. Missing required evidence produces an explicit incomplete/review result, never a pass.

## 3. Qualify fresh recovery and incremental completion

- Cover missing markup, a genuinely empty markup envelope, an intact authored tree and a tree with changed or missing functions.
- Verify that incremental completion retains unchanged IDs, folder order, foreign libraries, comments and unknown metadata. Only the intended authored sections should change.
- Check library/type/ID ownership, parameter types, presets, localized values and event argument ABI. A similar GUI name is not sufficient evidence of equivalence.
- Preserve authored Custom Script and separate Galaxy libraries in `preserve-source` mode. Unsupported `full-gui` conversions must be reported explicitly instead of being hidden by new Native definitions, wrappers or raw code.
- Keep original `while` behavior and only apply guarded source transformations whose evaluation order and side effects remain valid.

**Done when:** small, focused regression cases and a representative external map set pass the unchanged strict comparison. Readable output alone is not acceptance.

## 4. Qualify attributes and program behavior together

- Distinguish original custom attributes, stock/dependency attributes, verified recovered data and genuinely absent definitions. A query against a stock attribute does not authorize inventing a map-owned definition.
- Check the attribute document, GUI selectors and exported Galaxy queries as separate contracts. Preserve values, defaults, player/game scope and verified owner identity.
- Permit a namespace relocation only with a proved mapping that preserves the affected queries and values. Require unchanged behavior outside those justified differences.
- Check complete program composition: owned includes, library startup, `InitMap`, initialization order, event registrations and callback arguments. Successful compilation or matching function counts cannot prove this.

**Done when:** maps without custom attributes and maps with original or verified recovered attributes pass their applicable contracts. Unresolved external owners remain review cases.

## 5. Validate and package a usable release

- Build a release candidate from a tagged source revision and the pinned dependency/evidence manifests.
- Run the offline benchmark on that exact candidate, then compile and export representative recovered maps through the Editor service. Preserve the connection between each result and its tested artifact.
- Recheck every available input in the declared validation set. Mark missing historical artifacts as unavailable instead of carrying their old acceptance status forward to the new build.
- Compare actual Editor exports with the originals. Keep compilation status, program-equivalence status and gameplay observations separate.
- Provide documented library and CLI usage, a repeatable package build and clear errors for unsupported input or missing dependencies.
- Publish a short known-issues list and focused regression checks. Keep large map corpora, generated exports and old run logs outside the source repository.
- Consolidate redundant overlay layers only after the supported path has regression coverage. Simplification should follow proved contracts, not filename similarity.

**Done when:** a fresh installation can recover a supported map or mod, preserve its original file, produce editable markup and an inspectable result, and reproduce the release's declared verification outcome. Small documented interface or presentation bugs may remain; silent business-logic changes may not.

## Evidence and non-goals

The [103 recorded strict-pass records](maps/verified.md) and [222 historical acceptance records](maps/previously-accepted.md) remain separate. Neither list is a claim that the current source snapshot has just passed a new Editor run. The English source reorganization and readability work do not promote map statuses.

This plan does not promise universal reversal of arbitrary Galaxy into the exact original folders, comments or GUI authoring choices. It targets supported behavioral reconstruction, conservative preservation and explicit results when equivalence is not proved.


The local dependency bootstrap and shared language-core checks are now available; see [BUILDING.md](BUILDING.md). Three more utilities were recovered from retained source with separate provenance. Source closure and complete API/CLI execution remain pending.
