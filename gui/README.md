# TypeScript recovery interface

The TypeScript interface follows the original JavaFX Trigger Revize KSP layout:
two toolbar rows, **Trigger Markup** on the left, **Galaxy Source** on the right,
a resizable divider, green frames and orange hover/selection. It is not a Java
runtime wrapper. Decorative frames are recreated in CSS; the distribution does
not bundle proprietary game textures. The browser UI and local bridge are written in TypeScript.
The existing converter remains the only conversion implementation.

```powershell
npm run setup:public
npm run gui
```

In an installed/portable build, open `Open Recovery.cmd`. The browser displays
a loopback-only local application. No cloud service or Java is required. Use
the **X** button to stop its server; closing a tab alone does not stop a job.

## Workflow

1. Choose **OPEN FILE**, or open **SETTINGS** and enter the original packed `.SC2Map` path. The original Galaxy and any existing markup are shown immediately. The **StarCraft II** adapter is selected by default.
2. In **SETTINGS**, select the actual game installation and a **new** output directory. Opening a map proposes a new sibling output folder.
3. Leave expanded script translation off to preserve authored GUI and source.
4. Optionally supply the original strict benchmark distribution and an exact,
   verified attribute-header index. Existing attributes are retained automatically;
   missing attribute values are never invented.
5. Choose **GENERATE TRIGGERS**. Open **GEN INFO** for live activity and unchanged worker evidence.
6. Inspect the two code panels. **VIEW TREE** opens the literal XML hierarchy;
   each panel has **SEARCH**. **SAVE TRIGGERS** downloads the displayed markup;
   **EXPORT FILE** downloads the completed candidate copy. Other artifacts are
   available in **GEN INFO**. Exports over 128 MiB stay in the output folder.
7. Find the candidate path and the applicable verdict in `RESULT.json`.

Cancellation stops the job's process tree on Windows. A partial output directory
is retained for diagnosis and must not be reused. `finished` means the process
exited successfully, not that Editor equivalence or gameplay was proved.

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
