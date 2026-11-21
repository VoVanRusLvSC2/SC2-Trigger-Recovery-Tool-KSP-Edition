# Install SC2 Trigger Recovery KSP

## Windows x64 application

Choose one Windows x64 installer from the [3.0.2 release](https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition/releases/tag/v3.0.2).

| Installer | Metadata used for recovery |
| --- | --- |
| **Installed-SC2** | Detects your StarCraft II installation and reads its current CASC data. |
| **Standalone** | Setup downloads a pinned public SC2GameData snapshot once (1.17 GB expanded). After setup, map and mod recovery work offline. Each snapshot result stays in REVIEW because the target Editor version is unknown. |

Both editions include Node.js, ModKit, the MPQ tool and the strict benchmark.
Use **Libraries** to add any custom dependencies required by your map or mod.
The standard portable ZIP uses the installed-game defaults and also accepts an explicit resource snapshot on the command line.
The installer runs per user and does not need administrator rights.
The MPQ tool uses a static C++ runtime, so it does not depend on a separately
installed Visual C++ Redistributable. Its source revision, reproduction script
and binary fingerprint are included in the repository.

Standalone obtains its metadata directly from SC2Mapster/SC2GameData and verifies the downloaded files against the pinned Git tree. It preserves existing attributes. Missing attribute reconstruction and verification against installed game metadata require Installed-SC2.

Open **SC2 Trigger Recovery KSP** from the Start menu, choose a `.SC2Map` or `.SC2Mod` archive or component folder,
then select **GENERATE TRIGGERS**. The game installation and strict benchmark are
detected automatically; a new output folder is suggested beside the map.
The portable edition opens the same local TypeScript interface with `Open Recovery.cmd`.
It runs in your browser on a loopback address; Java is not required. Use the **X** button to stop the local server. See the [GUI guide](gui/README.md).
Original maps are read-only. Recovery runs once in the background and writes
progress, a candidate map and evidence under the chosen output directory.

Command line:

```bat
trigger-recovery.cmd doctor
trigger-recovery.cmd recover "C:\Maps\Example.SC2Map" --sc2 "C:\Program Files (x86)\StarCraft II" --out "C:\Maps\Example-Recovered"
```

The output contains `job.json`, hash-bound preparation inputs, and
`candidates/recovered/RESULT.json`. Candidate maps are under the variant directory
shown in that result. `GENERATED` means the candidate was assembled; inspect the
variant verdict. `REVIEW_REQUIRED_EDITOR_PENDING` is not an equivalence PASS.
Errors return a nonzero process exit code. Unresolved dependencies are refused.

The default mode preserves existing authored GUI, folders and script. `--full-gui`
requests the separate expanded recovery mode; it does not permit fabricated
Native definitions, stubs or raw wrappers. The archive worker supports packed
maps and mods as packed archives or component folders. Mods use their real library
body/header pairs. No artificial MapScript is
created. Mod-specific missing-attribute reconstruction is not yet qualified;
original attributes are preserved, and owned attribute queries retain REVIEW.

GENERATE TRIGGERS is available after any map or mod opens. Source incompleteness
is reported by the worker instead of disabling the button. For component
folders, recovery creates a separate packed source snapshot and checks each component
against its original SHA-256. MPQ container tables are regenerated; the original folder
is never written. The normal strict benchmark then checks the candidate.

Progress percentages are estimates by processing stage, not elapsed-time predictions.
A failed job retains the last reached percentage and shows its reason in the footer
and GEN INFO. Invalid input Galaxy produces `SOURCE_DIAGNOSTICS.json` with source
locations; recovery does not silently rewrite invalid code or call it a PASS.

## Strict benchmark and attributes

The Windows application includes the original hash-verified strict benchmark and
enables it by default. It detects StarCraft II automatically; normally you only
select a map, choose **GENERATE TRIGGERS**, then **SAVE TRIGGERS** to download the
recovered map. **EXPORT FILE** saves standalone Triggers XML. Settings provides
manual overrides under **Advanced settings**. The in-app chooser selects one
`.SC2Map` or `.SC2Mod` package, never a game folder, and supports Cancel and Escape. Generation is
available after a map or mod opens successfully. Settings contains no generation action.
**Recover attributes when available** defaults on; disabling it preserves existing
Attributes without reconstructing missing definitions or their GUI. Strict
verification is unchanged. The CLI equivalent is `--no-attribute-recovery`.

For CLI use, pass `--benchmark <distribution>` or set
`SC2_TRIGGER_BENCHMARK_ROOT`. That benchmark checks the whole regenerated program;
its report is `STRICT_BENCHMARK.json`. A difference keeps the result in REVIEW.
Missing required proof remains an error/review;
the application does not replace or weaken that oracle. Original attributes are
preserved, and missing defaults are never guessed. Recovery from an external
attribute header still requires the separately verified header evidence. Supply
it with `--attribute-index <index.json>` or the corresponding GUI field. An
attribute query alone does not reveal the original definitions or defaults.

## Build from public source

Build prerequisites: Git, Node.js 24 with npm, Python 3.10+, Windows PowerShell.
No private `mk-revizer.zip` is needed:

```powershell
git clone https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition.git
cd SC2-Trigger-Recovery-Tool-KSP-Edition
npm run setup:public
python scripts/fetch-release-tools.py
node trigger-recovery.mjs doctor
```

To build both release artifacts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File packaging/build-windows.ps1
```

This downloads fingerprint-pinned public ModKit source, platform bundles, Node,
mpqcli and Inno Setup, installs locked npm packages without lifecycle scripts,
emits runtime JavaScript, runs checks and assembles a fresh release directory.
Upstream TypeScript emission is not an upstream typecheck. Executable conversion
checks and the unchanged external oracle remain separate qualifications.
All download identities, manifests and build steps are in source control.
Rebuilding the optional MPQ tool itself additionally needs MSVC C++ Build Tools
and CMake; see `packaging/build-mpq-static.ps1`. Ordinary application builds fetch
its pinned, licensed static binary.

Corpus-wide requalification, actual Editor exports and gameplay acceptance are tracked separately.
