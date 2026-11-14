# Architecture

## Purpose

The converter translates Galaxy behavior into editable SC2 trigger markup and completes existing markup without rebuilding unchanged parts of the tree.
The common AST is the basis for analysis, type resolution, GUI binding and guarded transformations. Map-specific names and IDs are not a substitute for general conversion rules.

## Entry points

- [Conversion job entry](src/cli/convert.mjs): consumes a prepared job configuration and coordinates archive, source, dependency and markup processing.
- [Conversion library](src/conversion/index.mjs): exposes the conversion-stage interface.

Real map archives, matching SDK dependencies and qualified source inputs are required. This publication is not a self-contained installer, and some dependencies remain unavailable.

The [release roadmap](ROADMAP.md) lists integration blockers and completion criteria. Literal imports of the public entry point now resolve after local setup, but computed historical SDK paths still block execution. It is not currently a runnable example.

## Code reading guide

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

1. Read the map source, available trigger markup, libraries and localized strings.
2. Establish the AST, symbol ownership, types and initialization relationships.
3. Resolve GUI functions and presets by library, element type, ID and expected parameter contract.
4. Reconstruct missing sections or update changed sections of the existing tree.
5. Keep attribute identities and their Galaxy references consistent when confirmed source data exists.
6. Apply semantic safeguards before accepting the output for further Editor and equivalence verification.

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

## Source-only publication

The public tree intentionally omits test suites, benchmark distributions, raw exports, worker jobs, historical run reports, binaries and caches. The `verification` module contains production safeguards, not a bundled test project.
Historical benchmark rules have not been relaxed or replaced. Their original distributions and qualification inputs are external to this source-only tree.
The directory migration updates module/resource references; it is not a new correctness qualification for the maps. Missing dependencies and old hash-bound qualification inputs still require integration work before a standalone release.

## Map records

[Verified maps](maps/verified.md) contains the 103 last recorded strict passes. [Previously accepted maps](maps/previously-accepted.md) contains the 222 historical acceptances.
These levels remain separate. Original published names are retained, including non-English titles, because they identify the actual maps.
