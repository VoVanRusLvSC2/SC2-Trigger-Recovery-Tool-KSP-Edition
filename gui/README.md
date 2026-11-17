# TypeScript recovery interface

The TypeScript interface follows the original JavaFX Trigger Revize KSP layout:
two toolbar rows, **Trigger Markup** on the left, **Galaxy Source** on the right,
a resizable divider, green frames and orange hover/selection. It is not a Java
runtime wrapper. Decorative frames are recreated in CSS; the distribution does
not bundle proprietary game textures. The browser UI and local bridge are written in TypeScript.
The existing converter remains the only conversion implementation.

```powershell
npm run setup:public
node scripts/bundle-benchmark.mjs <original-benchmark-distribution>
npm run gui
```

In an installed/portable build, open `Open Recovery.cmd`. The browser displays
a loopback-only local application. No cloud service or Java is required. Use
the **X** button to stop its server; closing a tab alone does not stop a job.

## Workflow

1. Choose **OPEN MAP** and select one `.SC2Map` file. This button only opens the map-file chooser. The original Galaxy and any existing markup appear immediately.
2. Choose **GENERATE TRIGGERS**. StarCraft II is detected from environment overrides, the Windows registry and standard installation folders. The unchanged strict benchmark is selected from the application bundle or `SC2_TRIGGER_BENCHMARK_ROOT`. A new output folder beside the map is suggested automatically.
3. Choose **EXPORT FILE** to download the recovered candidate. Open **GEN INFO** to inspect live activity, the verdict and evidence.

**SETTINGS** provides manual overrides for the installation, output and benchmark,
plus an optional exact attribute-header index. Missing or invalid benchmark files
are reported rather than silently disabling verification. Leave **FULL GUI** off
to preserve authored GUI and source.

Inspect the two code panels. **VIEW TREE** opens the literal XML hierarchy;
   each panel has **SEARCH**. **SAVE TRIGGERS** downloads the displayed markup;
   **EXPORT FILE** downloads the completed candidate copy. Other artifacts are
   available in **GEN INFO**. Exports over 128 MiB stay in the output folder.
Find the candidate path and the applicable verdict in `RESULT.json`.

To prepare a source checkout with the original pinned benchmark, run
`node scripts/bundle-benchmark.mjs <original-distribution>`. It copies only the
304 manifest-listed assets and verifies their original hashes. Release staging
includes this verified bundle when available; game data and map corpora are not included.

Cancellation stops the job's process tree on Windows. A partial output directory
is retained for diagnosis and must not be reused. `finished` means the process
exited successfully, not that Editor equivalence or gameplay was proved.
On certain GUI binding failures, **GEN INFO** exposes an explicitly unverified
preview. An `UNVERIFIED-*.SC2Map` is an inspection draft, may contain Native
definitions and raw templates, and is not proof of behavior or Editor validity.

## Migration scope

| Java workflow | TypeScript implementation |
| --- | --- |
| Open map and generate triggers | OPEN FILE preview; GENERATE TRIGGERS calls the public CLI |
| Save/export | SAVE TRIGGERS / EXPORT FILE downloads; separate original-safe candidate |
| Generation information | Live worker log and unchanged JSON evidence |
| View hierarchy and code | Lazy XML tree and read-only source preview |
| Recovery settings | SETTINGS dialog; preserve-source default; FULL GUI explicit |
| Search and split view | Text search in both code panels; draggable divider and fullscreen |
| Libraries | Actual dependency chain after preparation; no invented manual library support |
| Cancel task | Process-tree cancellation; original stays unchanged |
| Inline code editing, manually attached Java libraries, music/license overlays | Not ported |

Only the SC2 adapter is implemented. Other formats need a real backend adapter;
selecting a different game name cannot make the SC2 converter support it.

## Architecture and extension

`contracts.ts` defines serializable fields, jobs and artifacts. `adapters.ts`
registers real format capabilities and argument-array builders. `app.ts` renders
those fields without SC2 conversion logic. `server.ts` owns local dialogs, job
lifecycle and bounded access to job artifacts. The SC2 adapter invokes
`trigger-recovery.mjs`, including its archive guards and verification gates.

The server binds only `127.0.0.1` on a random port, validates Host and Origin,
requires an unpredictable session token for API calls, rejects arbitrary static
paths and serves artifacts only from the current job's output. User paths are
passed as process arguments, never evaluated by a shell. The renderer has no
Node/filesystem privileges and displays source using text nodes or textarea values.

Build: `npm run build:gui`. Verify: `npm run verify:gui`. Compiled output is
ignored by Git, built before release staging and included in the application
file manifest. No compiler is required by the installed application.

## File selection and settings

**OPEN MAP** opens a file picker inside the application. Browse folders or paste a
full path, select one `.SC2Map`, and press **OPEN FILE**. Double-clicking a map also
opens it. **CANCEL**, the close button and Escape dismiss the picker without
leaving the interface locked. Folder and JSON settings use the same visible picker.
No external PowerShell file-dialog process is required.

The main **GENERATE TRIGGERS** button stays disabled until a map opens successfully.
Settings contains parameters and **DONE**, with no recovery action. Installation,
output and benchmark paths are under **Advanced settings** because they are filled
automatically. The strict benchmark remains enabled.

**Recover attributes when available** defaults on. Turning it off preserves
existing Attributes and skips their reconstruction/GUI enrichment; it does not
suppress strict attribute checks or turn missing evidence into PASS. The CLI
counterpart is `--no-attribute-recovery` for `recover` and `prepare`. Prepared jobs
store `recoverAttributes: false` explicitly when this is selected.

## Shared KSP Open File layout

The picker follows the Localization Editor SC2 KSP's `InAppSwingFileChooserDialog`
and `FileOpenDialogStyle`: quick locations and local disks on the left, a
searchable Name/Type file list on the right, a path bar, file-name entry, filter
and explicit Open/Cancel actions. It is implemented in TypeScript in `picker.ts`;
no Java, Swing bridge or game textures are shipped. The original UI project's
MIT attribution is retained in `licenses/LOCALIZATION_EDITOR_UI_LICENSE.txt`.

Single-click selects a row; double-click or Enter opens a directory or file.
The map picker accepts only one packed `.SC2Map`. Search filters the current
folder. Folder and JSON settings use the same component. Both editor headings
always display line counts; character counts are available as tooltips.
