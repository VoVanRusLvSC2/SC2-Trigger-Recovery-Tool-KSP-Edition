# Prepared map recovery jobs

The worker executes a hash-bound preparation. The user-facing
`trigger-recovery recover <map> --sc2 <installation> --out <new-directory>`
command now creates that preparation automatically from the archive and actual
installed libraries, then runs this worker. See [INSTALL.md](INSTALL.md).
It does not automate the Editor. Prepare source dependencies with
[BUILDING.md](BUILDING.md) or use the bundled Windows application.

```sh
node src/cli/convert.mjs --help
node src/cli/convert.mjs /path/to/job.json
```

Paths in the job JSON resolve relative to that file. The worker exits nonzero for
failed input validation or failed variants. `GENERATED` means candidate creation
and recorded offline checks; inspect variant/comparison/attribute evidence before
claiming equivalence. It is not an Editor or gameplay acceptance.

## Job document

| Field | Meaning |
| --- | --- |
| `id`, `name` | Job identity and a candidate filename, without a directory path |
| `original`, `originalSha256` | Immutable original archive and exact SHA-256 |
| `archive`, `archiveSha256` | Verified working input; may be the same original |
| `package` | Extracted, original component directory |
| `config` | JSON containing `installation` and the component `entries` census |
| `preparationResult`, `preparationResultSha256` | Exact prepared dependency/source observation and SHA-256 |
| `job` | Isolated candidate/evidence directory below `outputRoot` |
| `outputRoot` | Explicit output boundary; default is `<checkout>/output` |
| `mpq` | Path to the compatible MPQ CLI used to add candidate components |
| `guiRecoveryMode` | Optional `preserve-source` (default) or explicit `full-gui` |
| `attributeIndex` | Optional exact archive-bound attribute-header index |
| `localizations` | Optional verified localization-update document |
| `editorVersion` | Optional explicit `{major, minor, patch, build}`; must match the pinned installed build |

Original/archive/package/config/preparation paths must not overlap the output
job. Output inside the source tree is rejected. Existing parents are resolved
through symlinks/junctions before those checks, including a not-yet-created job.
Use a fresh job directory for an independently reviewable run.

The config's `installation` points to the actual StarCraft II directory and is
relative to the config file when not absolute. `.build.info` is verified against
preparation and again after conversion. New component-version records use that
active build tuple; existing version records remain unchanged. This is target
metadata, not proof that the Editor compiled the candidate.

Preparation records `attributeUseEvidence` from all parsed Galaxy sources in
the resolved include closure. With no original Attributes component and no
direct `GameAttribute*` calls, it records an explicit assumption that no
attributes are used. This does not prove that unused lobby definitions were
absent, or rule out dynamic calls or behavior in unavailable external data.
Original attribute components are always retained.

## Preparation contract

Preparation is an input artifact, not a success flag that bypasses verification.
It supplies:

- `cascBuildInfoSha256`, `originalScriptSha256` and the actual ordered mounted
  `actualChain`, including source/layer identities.
- `declarationInputs`: actual external sources with `path`, `sha256`, `sourceLabel`.
- `dependencyInputs`: each library's `group`, `triggerData`, and optional
  `triggerStrings`/`gameStrings`, each bound to its source path and SHA. The unique
  NativeLib group is named `NativeLib`.
- `omittedEmptyDependencyDocuments` when genuinely empty dependency XML was
  excluded, and `includeEvidence` for resolved owned/external includes.
- For a separately verified local dependency adaptation: `localDependencyProof`
  and its `actualMods`, with original/adapted archive and closure fingerprints.

`config.entries` is the original component census: `{path, sha256, ...}` records.
The extracted package and original MapScript must match it. Root declaration and
include closure must be available; missing input is an error or review case.
`trigger-recovery prepare` creates these artifacts without running conversion.
It verifies the original archive, dependency chain and complete actual include
closure, refuses existing output directories, and never edits the input map.
The automatic archive preparation currently supports packed `.SC2Map` inputs.

An optional attribute index contains exact source-archive matches and header
fingerprints. Without it, the worker preserves original Attributes and reports
the absence of verified recovery evidence. It does not create map definitions
from stock queries or invent defaults. Historical map-specific pilot policies
are disconnected from the default worker path.

If a fresh reconstruction reaches the GUI binding gate with unresolved raw
constructs, the job remains `FAILED` and exits nonzero. It also writes an
`UNVERIFIED_PREVIEW` with diagnostic markup and a report. When the original had
no Triggers, a separately named `UNVERIFIED-*.SC2Map` inspection copy may be
created after original payloads and original Galaxy are checked. This draft may
contain generated Native definitions, raw templates and extra GUI condition
functions; its localization, Editor compilation and behavior are not proved.
No existing authored Triggers are overwritten by this fallback. The strict
benchmark and PASS criteria are unchanged. Ordinary condition functions are
used only when a condition region otherwise cannot be represented; prepared
jobs can set `allowTransparentConditionFunctions` to `false` to refuse them.

Pass it during automatic preparation with
`trigger-recovery recover <map> --sc2 <installation> --out <new-folder> --attribute-index <index.json>`.
The same flag is supported by `prepare`. The index is optional evidence, not a
switch that authorizes invented attributes. `run` uses the prepared job's
`attributeIndex` field. The GUI exposes the same optional input.

When attribute comparison requires the external benchmark, set
`SC2_TRIGGER_BENCHMARK_ROOT` to the pinned distribution root containing
`benchmark/MANIFEST.json`. Missing evidence remains explicit. The benchmark's
manifest fingerprint and all asset checks are unchanged.

### Download the complete public snapshot

```powershell
trigger-recovery download-resources 'K:\SC2-Public-Resources'
```

This downloads the full pinned public repository snapshot (about 1.17 GB expanded), verifies every file against its Git blob hash, and records a manifest. The output folder must not already exist. The archived community snapshot is not a Blizzard installation and does not provide custom dependencies or prove an Editor version. Files are verified at download, not rechecked against the full Git tree at preparation.

A diagnostic recovery can use it without installing SC2:

```powershell
trigger-recovery recover 'C:\Maps\Input.SC2Map' --resources 'K:\SC2-Public-Resources' --out 'K:\Recovery-Output'
```

Alternatively replace `--resources` with `--download-resources 'K:\SC2-Public-Resources'` to download before preparing. Both output directories must be new.

**This is an experimental preview, not a finished or validated recovery.** It refuses maps with existing GUI markup, cannot restore attributes, and cannot run the strict benchmark. It may contain generated Native or Custom Script. Its status is `UNVERIFIED_PUBLIC_SNAPSHOT`, the process exits nonzero, and an optional draft map retains original Galaxy. Saving or compiling the draft in Editor may change behavior. Use `--sc2` for the established installed-data workflow; Editor/gameplay verification remains separate.
