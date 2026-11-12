# Galaxy ↔ Triggers benchmark

Black-box benchmark runner for Galaxy-to-Triggers converters. Each converter is
started separately and receives the same declared input content; package inputs
are copied into an isolated per-attempt workspace.

Current milestone:

- external command adapters;
- per-run timeout and isolated output directory;
- per-attempt copies of inputs with role `package`, so converters cannot mutate the original or another converter's copy;
- package-linked file inputs (for example a Galaxy script inside an isolated map copy);
- SHA-256 hashes for every declared input and output artifact;
- append-only `events.jsonl`, machine-readable `summary.json` and `report.json`, plus an interactive `report.html` opened after each run;
- alternating converter order across repetitions;
- crash/error isolation so the next case still runs;
- declared-case coverage by document kind, conversion direction, and feature tags;
- optional pre-run minimum coverage requirements, rejected before converter launch when unmet;
- per-case and overall min/median/max wall time and memory across repetitions;
- all-attempt wall time and peak-memory summaries (including failed runs), kept separate from successful-conversion performance and ranking;
- converter-reported conversion time and, for round trips, per-direction stage time, kept separate from process wall time;
- Windows peak working set and peak paged memory counters for the converter process.
- a correctness-first converter ranking: fewer failures, more passes, less inconclusive evidence, fewer warnings, then faster and lower-memory execution.

`completed` means the process produced its required output artifact:
`trigger-data` for Galaxy→Triggers, `script` for Triggers→Galaxy, and both
`trigger-data` and `roundtrip-script` for a roundtrip, plus any other declared
artifacts. Empty or incomplete output is `invalid-output`, not a semantic PASS.
`correctness` is reported separately: `fail` for launch/process failure,
timeout, invalid output, diagnostics errors, partial fidelity,
unsupported/dropped items, or AST/GUI-structure mismatch; `pass` requires
complete fidelity plus equivalent AST checks and, for Galaxy→Triggers or
roundtrip, an equivalent TriggerData-structure baseline;
`warning` denotes that same evidence with diagnostics; otherwise the result is
`inconclusive`. A failed Galaxy validation is a failure; an `incomplete` one is
inconclusive and cannot be promoted to a warning or pass by the converter. GUI
comparison hashes normalized Trigger Document structures,
including ordered trigger members and referenced elements, while ignoring local
generated IDs. It also hashes unreferenced element semantics, respects
library-qualified references, and falls back to resolved root `items` only when
`rootRefs` is absent. Category wrappers are flattened for logic equivalence;
category names and organization are not scored yet. When semantic parsing is
unavailable, equal counts remain inconclusive, while observed differences in
editable-trigger, CustomScript, or available trigger-local-variable counts are
scored as mismatches. This is still not proof of
runtime equivalence; Editor diagnostics are not yet included. A Galaxy→Triggers
case without GUI-structure evidence can never receive `pass`.

No third-party packages are required. Windows memory fields are populated when
`powershell.exe` is available; on other systems those values are `null`.
Set `coverageRequirements` in a full manifest to reject an undersized corpus
before any converter launches, for example `{"minCases": 100,
"minUniquePackages": 100}`. The latter hashes package inputs so 100 cases
reusing a smaller package set do not meet the gate. Optional minimum counts can
also be declared for document kinds, operations, and feature/complexity tags.

## Run

```powershell
npm test
npm run demo
npm run pilot:real-mod
```

The demo writes a uniquely named run below `.benchmark-runs`, containing a
compact per-attempt JSON report and a searchable HTML view with overall
converter rankings and a row for each case/converter pair. Rows show the
source package name, document kind, package size, feature tags, process
status separately from correctness, AST similarity and component-level
differences, restored GUI trigger counts, and a diagnostics count — filter by
correctness, document kind, or "failed/errored only" to zero in on problems.
Expanding a row's Details shows the full error text, a breakdown of converter
diagnostics by code (not just a bare `fail`), and links straight to that
attempt's input/output artifacts and stdout/stderr logs on disk. AST
differences open a side-by-side, function-level Galaxy diff with changed
lines highlighted (computed in the browser on demand, not precomputed for
every function, so large runs stay a reasonable size). AST similarity is the
Dice/F1 score over exact functions, signatures, and declarations; call
differences are reported separately. The HTML is self-contained so it can be
opened directly; `report.json` is also linked from the page. Diagnostics and
text-diff samples are capped per attempt (with a "+N more" note) so a 100-case
run stays tens of megabytes instead of hundreds — the underlying per-attempt
`result.json`, logs, and artifacts on disk are always the full-detail source
of truth and are one click away from a row's Details. Use `--no-open` to
generate both reports without launching a browser.

If a long run is interrupted, resume its existing directory with the same
manifest and converter build. Finished attempts stay unchanged; an unfinished
attempt is preserved with an `-interrupted-...` suffix and rerun:

```powershell
node src/benchmark.mjs benchmark.real-mixed-100-fix-check.json --resume .benchmark-runs/real-mixed-100-complex-dual-<timestamp> --no-open
```

To compare two or more runs — typically the same manifest against different
ModKit builds — point `compare-runs` at their run directories:

```powershell
node src/compare-runs.mjs .benchmark-runs/real-mixed-100-<old> .benchmark-runs/real-mixed-100-<new>
```

It writes `.benchmark-runs/compare-<timestamp>.html` with a per-case,
per-converter status table across all given runs, and flags regressions
(status got worse) separately from improvements. Exits non-zero when any
case regressed, so it can gate a build.

To turn a run's `report.json` into a plain-English Markdown summary of why the
converter failed (process crashes, scored fidelity failures, the most common
diagnostic codes, and the worst-scoring cases):

```powershell
node src/error-report.mjs .benchmark-runs/<run>/report.json .benchmark-runs/<run>/converter-errors.md
```
Use `--validate-only` to verify manifest coverage, package hashes, and every
package-linked source path without starting a converter or creating a run. It
does not check semantic dependency resolution or conversion correctness:

```powershell
node src/benchmark.mjs benchmark.real-mixed-100.json --validate-only
```

To census extracted user packages and build a deterministic 100-map manifest:

```powershell
npm run census -- --root ../artifacts/corpus-installed-2026-09-16/originals --root ../artifacts/test-mods-vovan/originals --output corpus/package-census.json
npm run manifest:real-maps -- corpus/package-census.json benchmark.real-map-100.json 100
npm run manifest:real-mixed -- corpus/package-census.json benchmark.real-mixed-100.json 100 - 10 complex
npm run manifest:real-pilot -- corpus/package-census.json benchmark.real-mixed-pilot.json 2 - 1
npm run pilot:real-mixed
```

Roundtrip cases now record two independent comparisons when the package has a
`Triggers` file: editor Galaxy → ModKit Triggers → Galaxy, and original editor
Triggers → ModKit Galaxy. The report shows the second conversion's status,
duration, AST similarity, and function diff beside the roundtrip AST result.
If the original package has no non-empty `Triggers` graph, those columns show `—`.
Set `MODKIT_SC2_CONTENT_ROOT` to the installed SC2 root before real runs so
the ModKit loader can resolve NativeLib and package dependencies. Isolated
converter builds can point `MODKIT_SC2_LOADER_MODULE` at the regular built
conversion module to reuse its current content-source loader.

The census reads directory entries, file sizes, and `Triggers` contents. A
`Triggers` XML shell with no `<Element>` is recorded separately as empty and
does not qualify as an original-triggers or GUI baseline. The 100-map manifest
remains size-stratified. The mixed manifest now selects the 90 largest map
scripts and the 10 largest representative mod libraries, replacing tiny cases
while requiring 100 distinct primary packages. Its `complex-` case IDs keep
reports from being matched to older, differently selected cases by accident.
The uniqueness threshold is increased by the number of shared dependencies,
preventing those repeated packages from masking a duplicate primary package.
Source size is a rough complexity proxy; the synthetic pilot covers explicit
features. The mixed manifest uses the largest Galaxy library in each selected
mod as its representative;
only packages with exactly one Galaxy source file are scored against the
whole-package GUI baseline. Maps or mods containing multiple source libraries
remain useful AST/performance cases but have no independent GUI pass. Add
further library-specific cases when dependency-aware multi-library conversion
is available. Coverage tags also record package-level multi-library structure,
Galaxy headers, and TriggerStrings so corpus reports expose these dimensions
separately from the rough script-size complexity tiers.
Some low-level converter APIs need dependency documents explicitly. The
benchmark can attach a shared dependency export when one is genuinely required;
this is optional and should not duplicate a converter's built-in resolver.
For ModKit, `NativeLib.TriggerLib` is the source file whose parsed library ID is
`Ntve`—these are not two separate dependency libraries. Its localized
`TriggerStrings.txt` is keyed to `Ntve` as well. ModKit's public conversion
functions accept dependency libraries; its CLI loads NativeLib for its own
conversion path. The benchmark adapter uses the bundled NativeLib automatically
when that asset is present next to the ModKit module. Pass other shared
dependencies as a JSON array in the optional fourth positional argument:

```json
[
  {
    "id": "shared-lib",
    "group": "ExampleLib",
    "packagePath": "corpus/dependencies/ExampleLib.SC2Mod",
    "triggerDataPath": "Triggers",
    "triggerStringsPath": "enUS.SC2Data/LocalizedData/TriggerStrings.txt",
    "gameStringsPath": "enUS.SC2Data/LocalizedData/GameStrings.txt"
  }
]
```

Paths are relative to the benchmark working directory; package contents are
staged separately for each attempt. Use `group` to preserve the library's
TriggerData grouping (it defaults to `id`). Only dependencies genuinely
available to both converters should be included; a common dependency list is
not a substitute for map-specific requirements.

## ModKit adapter

Build the sibling ModKit repository, then point the adapter at its public
conversion module:

```powershell
$env:MODKIT_CONVERSION_MODULE = "../modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/index.js"
node src/benchmark.mjs benchmark.modkit-pilot.json --output .benchmark-runs
node src/oracle.mjs --self-test
node src/oracle.mjs compare original.galaxy regenerated.galaxy --library-id Map
```

Supported input roles are `script`, `header`, `trigger-strings`, `game-strings`,
`galaxy-declaration`, and grouped `dependency-trigger-data`,
`dependency-trigger-strings`, `dependency-game-strings` records.
Forward conversion uses `operation: "triggers-to-galaxy"` and accepts
`trigger-data` plus optional `expected-script` / `expected-header` inputs;
`operation: "galaxy-triggers-roundtrip"` runs Galaxy→TriggerData→Galaxy in one
attempt, retaining both intermediate TriggerData and regenerated Galaxy so
the AST comparison measures the full round trip;
golden checks normalize line endings and trailing whitespace and also record
byte exactness. When the loaded ModKit module exposes its Galaxy parser and
AST comparator, the adapter additionally records per-file `equivalent`,
`different`, or `invalid-syntax` results and mismatch samples. Summary keeps
these AST counts separate from byte/text golden matches, process completion,
and converter-reported completeness. TriggerData type counts and semantic GUI
structure comparisons are reported separately; diagnostic severities and
diagnostic codes are also aggregated in `qualityCounts` so large runs show not
only the volume but the recurring failure categories, including cases that
create definitions but no GUI triggers.
The ModKit adapter also parses TriggerData through its Trigger Document API
when available and reports editable trigger, embedded ScriptCode, and local
variable-reference counts; these are telemetry, not yet correctness thresholds.
The current manifests use one repetition for quick feedback. Increase the count
for more stable performance comparisons, keeping cases, repetition counts, and
machine conditions identical across converters.
The CLI oracle returns `equivalent`, `different`, or `invalid-syntax`; a
structural match remains evidence rather than a proof of runtime equivalence.
The summary's `ranking` is a transparent ordering for this exact manifest and
run, not a universal quality score. Correctness outcomes take precedence over
performance; use identical cases/repetitions and machine conditions when
comparing converters. A `pass` still means only that all available declared
checks passed.

## Converter protocol

The runner starts the configured command after replacing these argument tokens:

- `{request}` — absolute path to the generated request JSON;
- `{output}` — absolute path to the converter output directory;
- `{caseId}` — benchmark case ID.

Set `astOracleModule` in the manifest to a ModKit module exposing
`compareGalaxyPrograms` and `parseGalaxySource`. The runner recomputes AST
comparisons from declared source/golden inputs and output artifacts, and
recomputes GUI-structure comparisons from expected and actual TriggerData using
the shared Trigger Document API when available. These shared oracles override
converter-reported equivalence, so a Java converter cannot pass by merely
claiming its own output is correct. A Java CLI can be configured as an ordinary
converter in the same `converters` array as ModKit:

```json
{
  "id": "java-candidate",
  "command": "java",
  "args": ["-jar", "../path/to/converter.jar", "{request}"]
}
```

It must read the request JSON and atomically write the standard result JSON
and artifacts. Keep the oracle module identical for every converter in a comparison.
When a JDK is installed, the test suite compiles and launches a small Java
protocol fixture through the same runner; this checks Java process support, not
the absent production Java converter.
If no independent TriggerData baseline is declared, the runner forces GUI
correctness to `inconclusive` even when a converter claims equivalence. If no
shared oracle is configured, converter-reported positive AST/GUI claims are
retained for diagnostics but cannot produce a correctness pass.

The request contains absolute input paths, the output directory, and a
`resultPath`. The converter must atomically write this result file when it has
finished:

For an input with role `package`, the request path points to a fresh per-attempt
copy under the run directory. Its original SHA-256 is recorded separately, and
the converter may edit the copy without changing the source fixture.
Give a package input an `id` to make a file inside its copy available as a
normal input; set that file input's `fromPackage` to the id and its `path` to a
relative path inside the package. The runner hashes the original file and
passes the staged copy, so both package-aware and source-only adapters can use
the same isolated case.

Each result links its captured `stdout.log` and `stderr.log` through
`logFiles.stdout` and `logFiles.stderr` in `summary.json`, including failed
processes. This keeps diagnostics inspectable without copying potentially large
logs into the summary.

```json
{
  "schemaVersion": 1,
  "status": "completed",
  "artifacts": [
    { "role": "trigger-data", "path": "Triggers" },
    { "role": "trigger-strings", "path": "TriggerStrings.txt" }
  ],
  "conversionQuality": { "completeness": "complete", "dropped": 0, "unsupported": 0 },
  "diagnostics": []
}
```

`conversionQuality` is converter-reported, but a pass additionally requires the
runner's shared AST/GUI checks. Report `partial`, any dropped/unsupported items,
and diagnostics honestly; missing completeness evidence remains inconclusive.

Artifact paths are relative to the provided output directory. Paths escaping
that directory are rejected. A converter-reported time or memory value is not
used for scoring; the supervisor owns measurements.

## Validation status and next steps

The ModKit pilot currently exercises eleven source/TriggerData cases, including
one pinned round trip, one metamorphic round trip seeded from a minimal GUI
Trigger fixture, a cross-library dependency call, and a forward case with an
actual Trigger element. The
metamorphic Galaxy source was generated by ModKit from that fixture, so it tests
round-trip stability but is not an independent semantic golden. Each case is run
three times. The runner
and both conversion directions have passing smoke tests, but these cases are
not complete map/mod packages and must not be treated as Editor validation.
The latest synthetic pilot completed all 33 attempts and reported 18 scored
failures, 12 inconclusive results, and 3 warnings; these are attempts across 11
synthetic cases, not 33 independent maps. The six failures removed from the
score were unsupported GUI-baseline comparisons; no correctness checks were
weakened. The remaining failures are ModKit-reported partial fidelity or strict
AST differences and still need case-by-case semantic triage before being called
confirmed behavior defects. In the latest run, median converter-process wall
time was about 393 ms and median peak working set about 34.1 MB on this machine.
The metamorphic
GUI-trigger case exposed a specific `Score`/`score` GUI display-name difference.
The two roundtrip cases
intentionally omit `expected-trigger-data`: the pinned FunctionDef baseline is
not a complete TriggerData tree, and the metamorphic Galaxy input omits
TriggerStrings needed to preserve the original display-name casing. These cases
still test Galaxy AST roundtrip and converter fidelity, but GUI correctness is
inconclusive until independent, well-formed baselines are supplied. The casing
difference is therefore a fixture limitation, not a scored converter defect.
No case in this synthetic run received a correctness `pass`; no result in this
run is SC2 Editor validation. Peak memory here is the converter process only,
not its child processes.
The package census currently finds 180 extracted packages (152 maps, 28 mods),
151 with `MapScript.galaxy`, and 6 with an unambiguous script + non-empty
TriggerData pair. The generated 100-map manifest selects distinct package
contents; just 2 of those selected maps have a TriggerData GUI baseline. The other 98 can still
measure process performance and Galaxy AST roundtrip, but cannot receive a GUI
correctness pass without an independently verified baseline. The census and
manifest are `corpus/package-census.json` and `benchmark.real-map-100.json`.
The mixed 100-case manifest selects 90 maps and 10 mods; all 100 package paths
exist and all 100 package contents are distinct. It has 6 eligible whole-package
GUI baselines. It uses
one largest Galaxy source file per mod, so it is package-diverse, not exhaustive
of every library inside multi-library mods.

A first real-package pilot is recorded in
`benchmark.modkit-package-pilot.json`; package isolation worked, but the
low-level ModKit conversion API stopped before producing output because the
benchmark adapter supplied no dependency documents. NativeLib is needed for
some Galaxy→Triggers operations; the CLI's NativeLib loading is not currently
used by this adapter. This is an adapter integration gap, not proof that
separate `NativeLib` and `Ntve` exports are required.
The one-attempt `Folders.SC2Mod` smoke in `benchmark.real-mod-pilot.json`
completed Triggers→Galaxy, but scored `fail`: the converter reported an
unresolved `libNtve_InitVariables`, Galaxy validation was `incomplete`, and the
shared AST oracle found a script difference (the header was equivalent). Treat
this as a dependency-blocked regression candidate, not a confirmed converter
defect, until the same dependency library is supplied and the case is rerun.
The generated two-case pilot (`benchmark.real-mixed-pilot.json`) checks one
map and one mod. Its earlier run preceded adapter-side loading of the bundled
NativeLib TriggerLib (parsed as library `Ntve`); rerun it before interpreting
the previous dependency-related failures.
All three `CNCC` mod attempts completed after the ModKit adapter mapped the
benchmark `mod` kind to the API's `library` kind, but correctly scored `fail`:
the output was partial with 2 unsupported items, 976 diagnostics and 92 distinct
unresolved symbols; the GUI baseline had 10 triggers versus 2 after roundtrip,
and CustomScript tags rose from 0 to 130. Script and header ASTs differed.
Median completed-attempt wall time was about 2.07 s and peak working set about
36.9 MB in the initial run. A rerun after adding bounded stderr excerpts to
`result.error` still detected the same map failure directly in `summary.json`;
the mod median was about 1.76 s / 34.4 MB. Full stderr remains in the separate
log file. This establishes that the mixed runner detects fidelity loss, but
the adapter's missing dependency resolution prevents attributing all
differences to the converter itself.
The mixed 100-case corpus has now been run through ModKit three times per case.
The completed report is
`.benchmark-runs/real-mixed-100-2026-09-23T19-51-14-539Z/report.html`.
With `MODKIT_SC2_CONTENT_ROOT` pointing to the extracted `references/casc`
content and `MODKIT_SC2_BASE_MOD=mods/liberty.sc2mod`, 156/300 attempts produced
output, 127 failed in the converter process, and 17 timed out. All 300 scored
`fail`: every completed output was partial and had a Galaxy AST mismatch.
The most frequent process errors were missing executable subfunction roles
(67 attempts) and unresolved Trigger references (33). A converter's own
resolver remains part of the converter under test; the benchmark does not
impose these dependency files on another implementation. These are benchmark
observations, not proof that every difference originates in the converter.
No real map has completed the SC2 Editor open/edit/save/reopen loop yet.
The structural Galaxy comparison oracle has a mutation self-test; because it
uses ModKit's parser/comparator, it is a regression check, not an independent
oracle.

For a map whose original Galaxy declarations are inline, the AST oracle now
compares them with the regenerated header plus script, instead of reporting
every moved declaration as missing. The ModKit adapter writes a generated
`GameStrings.txt` when the converter returns one and passes it into the
Triggers-to-Galaxy leg. Its JSON metrics also contain per-phase timings for
Galaxy-to-Triggers; these are diagnostic timings, not independent speed
samples. A map with no `game-strings` input cannot prove that an external text
key has a localized value, so missing `StringExternal` values remain a known
round-trip risk rather than a solved result.
When `MODKIT_SC2_BASE_MOD` is set, the adapter opens that mod separately and
merges it with the subject package's declared chain: ModKit intentionally does
not inject `baseMods` into an already recognized `.SC2Map` package.

The workspace's extracted package inventory is captured, and deterministic
100-map and 100-mixed manifests are prepared; the mixed corpus has process,
performance, and AST results but no Editor-validated results. A SC2 Editor automation
worker is not implemented yet; when available, it must open only the per-attempt copies,
record load/diagnostic state, make a known reversible Galaxy edit, save, reopen,
and compare the resulting Galaxy AST and GUI-trigger structure. Do not treat `*`
in the title as an error signal: the edit itself may mark a document dirty, so
use Editor messages/logs plus successful save/reopen checks. Keep Editor
pass/fail separate from converter process completion and from the converter's
own fidelity report. The Windows
Editor executable discovered on this machine is
`C:\Apps\StarCraft II\Support64\SC2Editor_x64.exe`; make its path configurable
so the benchmark remains portable.

Treat the mixed run as a baseline for improving the ModKit adapter and
converter, not a completed quality benchmark: hand-verify a small subset in
Editor before interpreting the results as converter-quality evidence. Peak memory currently measures the converter process only, not its descendants;
process-tree accounting and Job Object limits remain follow-up work.
