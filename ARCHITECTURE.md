# Architecture

## Purpose

The converter translates Galaxy behavior into editable SC2 trigger markup and completes existing markup without rebuilding unchanged parts of the tree.
The common AST is the basis for analysis, type resolution, GUI binding and guarded transformations. Map-specific names and IDs are not a substitute for general conversion rules.

## Entry points

- [User-facing CLI](trigger-recovery.mjs): `prepare`, `recover`, `run` and `doctor`.
- [Automatic map preparation](src/cli/prepare-map.mjs): reads a packed map and actual SC2 dependencies, verifies include closure, and writes hash-bound job inputs.
- [Conversion job entry](src/cli/convert.mjs): consumes a prepared job configuration and coordinates archive, source, dependency and markup processing.
- [Conversion library](src/conversion/index.mjs): exposes the conversion-stage interface.

The Windows installer and portable application bundle Node and runtime dependencies;
the public build obtains them from pinned public sources. Installed SC2 and any
required custom mods provide the actual game metadata. Automatic archive jobs
currently accept packed `.SC2Map` files; the component API also supports explicit
mod-library inputs. See [INSTALL.md](INSTALL.md).

The [release roadmap](ROADMAP.md) lists integration blockers and completion criteria. The public API and prepared-job CLI execute after local setup; they use portable checkout-relative SDK modules. See [API usage](API.md) and [CLI jobs](CLI.md). Source/input qualification and Editor acceptance remain separate.

## Code reading guide

The [TypeScript front end](gui/README.md) is separate from the conversion core:
typed adapter descriptors → browser form → local bridge → existing CLI/worker.
The bridge adds no alternate GUI generator, attribute inference or benchmark
rules. Its output is the same isolated candidate/evidence tree as a CLI run.

| Start here | What to follow |
| --- | --- |
| [Job orchestration](src/cli/convert.mjs) | Input identity checks, source policy, fresh/incremental routing, packing and final cleanup |
| [Source ownership](src/model/source-ownership.mjs) | Why matching text alone cannot merge library or include identities |
| [Mutable source program](src/conversion/exact-function-signatures/galaxy-program.collections.mjs) | Per-job source documents and explicit syntax transfer/disposal |
| [Immutable syntax views](src/model/conversion-syntax-program.collections.mjs) | Bounded parse reuse within one conversion, never persistent reuse across unrelated jobs |
| [GUI capability catalog](src/bindings/gui-capability-catalog.mjs) | Existing library/type/ID bindings and conservative ambiguity handling |
| [Authored GUI inventory](src/incremental/authored-gui-inventory.mjs) | How nonempty or unfamiliar markup stays on the preservation path |
| [Expression preparation](src/conversion/gui-expression-preparation.mjs) | Ordered transformations against the current shared document |
| [Attribute preparation](src/conversion/document-attribute-preparation.mjs) | Original versus prepared archives and verified attribute provenance |
| [Attribute gate](src/conversion/exact-function-signatures/attribute-recovery-gate.indexed.mjs) | Separate document, GUI and runtime-query contracts |

Project-owned JavaScript follows the pinned formatter configuration. Comments explain ownership, refusal conditions and evidence boundaries rather than restating individual assignments. Copied SDK/vendor modules remain unchanged. The readability pass changes source-file hashes, so old byte-bound qualification artifacts still require release qualification even where normalized executable syntax is unchanged.

## Module responsibilities

| Module | Responsibility |
| --- | --- |
| `ast`, `model` | Syntax, program context, source ownership and symbol identity |
| `analysis`, `types` | Dependency analysis, initialization, inferred types and compatibility |
| `bindings`, `gui` | Library-aware GUI resolution, presets, parameter owners and GUI contracts |
| `conversion`, `passes` | Conversion stages and their orchestration |
| `incremental` | Selection and completion of changed or missing authored sections |
| `lowering` | General transformations with explicit applicability guards |
| `verification` | Semantic safeguards and interfaces used during conversion |
| `archive`, `recovery` | Archive components and source recovery support |
| `libraries`, `sdk`, `vendor` | Shared runtime services and upstream code |

Descriptive namespaces keep distinct implementations separate where their scope or generated behavior differs. Different implementations are not merged solely because their filenames or exports look alike.

## Conversion flow

1. The archive frontend verifies source/build identity, reads components, resolves actual dependency and include closure, and records immutable preparation inputs. Component API callers supply their inputs directly.
2. Establish shared AST/program views, symbol ownership, types and initialization relationships. Source-bound attribute identity/query provenance is prepared before GUI recovery.
3. Resolve GUI functions and presets by library, element type, ID and parameter/event contract; apply guarded source transformations where needed.
4. In preservation mode, reconstruct absent/genuinely empty markup, retain unchanged markup, or complete supported additions/changes. Preserve unknown authoring metadata or refuse unsupported edits instead of silently rebuilding the tree. `full-gui` is a separate explicit mode.
5. Assemble recovered components. The archive worker packs a separate candidate, reopens its actual components and regenerates Galaxy from the packed GUI using the matching metadata.
6. Compare the original and regenerated program and check types, startup, events, applicable attribute contracts and archive payload preservation. Record static-match/review/failure evidence with Editor verification still pending. Any earlier stage can refuse invalid or unsupported input.
7. Actual Editor compilation/export and comparison with the original are separate qualification steps; the offline archive worker does not perform them.

## Preservation rules

- Preserve existing folders and authored GUI identities during incremental completion.
- Preserve separate source files and original Custom Script in `preserve-source` mode. Their full translation belongs to the explicit `full-gui` mode.
- Do not infer GUI compatibility from a matching name or a shared literal such as `null`.
- Preserve initialization order, event ABI, side effects and observable values.
- Keep the original `while` form; use stock `for` representations only when their evaluation behavior is proved compatible.
- Distinguish an existing engine native, its Galaxy declaration and its actual GUI representation.

## Reverse-engineering basis

Development used SC2 archive/format analysis, NativeLib and GUI metadata, comparison with real Editor exports, and small examples to examine event arguments, runtime contexts and initialization behavior.
Matching native names do not prove matching GUI semantics. Successful compilation alone does not prove program equivalence.
Upstream format and Galaxy support comes in part from [hometlt/modkit-extensions-blizzard](https://github.com/hometlt/modkit-extensions-blizzard).

## Source and release boundaries

The source tree contains production safeguards and focused verification/build scripts.
Full external benchmarks, game/map corpora, raw exports, worker jobs, private run
reports, binaries and caches are not checked into source control. Installers,
portable builds and release evidence are separate Release assets.
Historical benchmark rules have not been relaxed or replaced. Their original
distributions and qualification inputs remain external.
The directory migration updates module/resource references; it is not a new correctness qualification for the maps. The public dependency/build path and automatic map preparation are documented in INSTALL.md. Old qualification inputs remain external and must not be treated as fresh release acceptance.

## Map records

[Verified maps](maps/verified.md) contains the 103 last recorded strict passes. [Previously accepted maps](maps/previously-accepted.md) contains the 222 historical acceptances.
These levels remain separate. Original published names are retained, including non-English titles, because they identify the actual maps.
