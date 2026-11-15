# Build and verify

See [INSTALL.md](INSTALL.md) for the Windows installer, portable application and full build steps.
The public build no longer needs the private mk-revizer.zip or the author workspace.

## Clean public setup

Requirements: Node.js 24 with npm, Python 3.10+, Git. Windows x64 is the qualified target.

```sh
npm run setup:public
node trigger-recovery.mjs doctor
npm run gui
```

Setup verifies public ModKit revision d4218ef890064108384e8b871081a02acaa86c87, installs locked npm packages without lifecycle scripts, emits the SC2/archive runtime, and downloads fingerprint-pinned mpqcli. Run setup before npm ci on a fresh checkout: four runtime packages are local file links below .runtime. Keep that directory. The public schema replaces the former private schema after compatibility checks; the generated native API catalog is not downloaded. TypeScript emission is not a full upstream typecheck.

## Checks

```sh
npm run verify:recovered
npm run verify:retained
npm run verify:bindings
npm run verify:helpers
npm run verify:dependencies
npm run verify:language -- --with-runtime
npm run verify:attribute-source
npm run verify:authored
npm run verify:string-append
npm run verify:cli
npm run verify:preparation
npm run verify:source
npm run format:check
```

The [integration checks](API.md#reproduce-integration-checks) additionally need real matching NativeLib and the original pinned benchmark. All 304 oracle assets remain hash-checked. Game metadata and qualification evidence are external inputs; missing proof never becomes PASS.

String append recovery also has an end-to-end public API check against matching game metadata:

```powershell
npm run verify:string-append -- --native-root "<TriggerLibs directory>"
```

It checks standard GUI recovery of global and record-field appends without expression helpers, including conservative refusal of effectful calls and indexed targets.

## Windows artifacts

```powershell
npm run release:windows
```

The script repeats setup/checks and builds Setup.exe, portable ZIP and SHA256SUMS.txt under ignored release/. It downloads verified Node 24.14.1, mpqcli 0.10.0 and Inno Setup 6.7.4. All package junctions become ordinary files; an installation manifest checks the payload. The installed application needs no build tools or build-machine paths.

The legacy setup:local script is retained for historical recovery only. It is not the public release path and must not be mixed with the public npm layout.
