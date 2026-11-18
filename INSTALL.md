# Install SC2 Trigger Recovery KSP

## Windows x64 application

Download the **3.0.0-rc.9 Setup.exe** or portable ZIP from this repository's
[Releases](https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition/releases).
Both contain this reworked converter, Node.js 24.14.1, the public ModKit runtime,
mpqcli and their notices. No Node, npm, Python, Git, private archive or K: drive
is required on the target machine. Windows 10/11 x64 is the supported target.
The installer runs per user and does not need administrator rights.
The MPQ tool uses a static C++ runtime, so it does not depend on a separately
installed Visual C++ Redistributable. Its source revision, reproduction script
and binary fingerprint are included in the repository.

Install StarCraft II separately. Its actual CASC data supplies the correct GUI
libraries and Galaxy declarations. Custom mod dependencies must also be available.
Neither game binaries nor game data are included in this application.

Open **SC2 Trigger Recovery KSP** from the Start menu, choose a packed `.SC2Map`,
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
maps; explicit mod-library conversion is available through [the component API](API.md).

## Strict benchmark and attributes

The Windows application includes the original hash-verified strict benchmark and
enables it by default. It detects StarCraft II automatically; normally you only
select a map, choose **GENERATE TRIGGERS**, then **SAVE TRIGGERS** to download the
recovered map. **EXPORT FILE** saves standalone Triggers XML. Settings provides
manual overrides under **Advanced settings**. The in-app chooser selects one
`.SC2Map` file, never a game folder, and supports Cancel and Escape. Generation is
available only after a map opens successfully. Settings contains no generation action.
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

The application is currently a release candidate. Corpus-wide requalification,
actual Editor exports and gameplay acceptance are separate remaining work.
