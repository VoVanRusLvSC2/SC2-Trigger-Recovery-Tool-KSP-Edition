# TypeScript recovery interface

The interface ports the desktop workflow from JavaFX Trigger Revize KSP:
two toolbar rows, Trigger Markup on the left, Galaxy Source on the right,
a resizable divider, green frames and orange hover/selection. The browser UI
and local bridge are TypeScript; the existing converter is the only recovery core.
See the [UX comparison and deliberate differences](UX_PARITY.md).

## Run

```powershell
npm run setup:public
node scripts/bundle-benchmark.mjs <original-benchmark-distribution>
npm run gui
```

Installed/portable builds include Node and the verified benchmark. Open
`Open Recovery.cmd`. No Java or cloud service is required. X stops the local
server; closing the browser tab alone does not stop an active recovery.

## Workflow

1. **OPEN FILE** selects one `.SC2Map` or `.SC2Mod` archive or component folder. Its original Galaxy and existing
   markup appear immediately. Opening a map never starts recovery.
2. **GENERATE TRIGGERS** runs automatic recovery with a separately named output.
   SC2 and the unchanged strict benchmark are discovered automatically.
3. **SAVE TRIGGERS** downloads the separately generated map. It is enabled once
   a candidate exists. The original map is never overwritten.
4. **EXPORT FILE** exports complete standalone Triggers XML with a file-name
   prompt. It is available as soon as markup is loaded.

**GEN INFO** contains live activity, qualified verdicts, artifacts and optional
JSON evidence. A generated candidate or diagnostic preview is not automatically
a strict PASS or Editor acceptance. Failed and unverified outputs retain those labels.
The percentage estimates completed processing stages, not remaining time. 100%
means processing finished; the verdict still determines PASS or REVIEW. Failures
retain their last percentage and show the reason in the footer. Source parser errors
include a file/line/column and a separate `SOURCE_DIAGNOSTICS.json` artifact.

## Settings

The restoration section comes first: Automatic, attribute recovery (on by
default), and optional full GUI recovery of authored/embedded Galaxy (off by
default). Settings never starts generation. Installation, output, benchmark,
format adapter and exact attribute-header index are under Advanced settings.
Disabling attributes preserves existing Attributes and skips reconstruction;
it does not suppress verification or turn missing evidence into PASS.

Music, volume and background opacity apply immediately. Music uses an optional
local audio file; no game soundtrack is bundled. Preferences and enabled library
roots are saved per user under `%APPDATA%/SC2 Trigger Recovery KSP/settings.json`
(on other systems, `~/.config/SC2 Trigger Recovery KSP/settings.json`). They survive
server restarts and port changes. Full access is included; no private license key
or license issuer is shipped.

## Inspectors

- **VIEW TREE** resolves TriggerData Root/Item references and library scopes,
  retains reference order, and identifies cycles and missing definitions. Children
  load on expansion. The counter explicitly counts loaded nodes rather than
  silently truncating a large graph. Use arrows, Home and End to navigate.
- **SEARCH** shows live case-insensitive literal matches, snippets and line
  numbers. Previous/Next wraps through all matches. Ctrl+F, F3 and Shift+F3 work
  in both code panes. Search remains open while selecting a result.
- Search and hierarchy are movable nonmodal inspectors. Escape and Close dismiss
  them. Settings also closes on its dimmed backdrop.
- Code panes retain the complete, read-only recovery inputs with line counts,
  synchronized line gutters and visible-line syntax coloring. Source text is
  inserted as text nodes, never interpreted as HTML. Editing input without
  preparing and verifying that edit would misrepresent the recovery baseline.

## Local libraries

**LIBRARIES** adds SC2 package files or directories containing local packages.
Enable/disable and Remove update the paths used by the next recovery. The CLI
counterpart is repeatable `--library <package-or-folder>`. Preparation and
conversion use the same SDK package locations and dependency identity checks.
Only packages actually referenced by the map are loaded; an unrelated Galaxy
file is not invented as a dependency or a GUI definition. The actual prepared
chain remains available in the dialog. Missing dependencies remain failures.

## File picker

The in-app picker follows the Localization Editor SC2 KSP layout: quick places
and disks, a searchable Name/Type list, path bar, file name, filter and Open/Cancel.
The original MIT UI attribution remains in
`licenses/LOCALIZATION_EDITOR_UI_LICENSE.txt`. Single-click selects; double-click
or Enter opens. Escape and Cancel never leave an invisible native dialog running.
Folder, JSON, local-library and audio fields share this component.

## Architecture and validation

`contracts.ts` describes real adapter capabilities. `adapters.ts` builds literal
CLI argument arrays. `picker.ts`, `hierarchy.ts`, `search.ts`, `code-view.ts` and
`settings-view.ts` own their respective views. `preferences.ts` validates and
atomically stores allowlisted settings. `server.ts` owns job lifecycle and bounded
file access; it binds only loopback, checks Host/Origin and requires a random
session token. The renderer has no Node or filesystem privileges.

Build with `npm run build:gui`; check the bridge with `npm run verify:gui`.
Release staging builds and hashes the GUI; installed users need no compiler.
Only the SC2 adapter exists. Other formats require a real backend, not a new label.

## Mod inspection and recovery

OPEN FILE lists only `.SC2Map` and `.SC2Mod` files, plus navigation folders.
Mods use their actual Galaxy library files rather than a fabricated MapScript.
The source selector switches between the original body/header and other Galaxy
files; line counts, highlighting and search follow the selected file. Mods without
Galaxy, including resource-only mods, open with an empty source panel.
Existing mod Triggers can be inspected as a tree and exported unchanged.

GENERATE TRIGGERS is available after a map or mod opens. Mod archive recovery
uses real library body/header pairs and installed SC2 metadata. No MapScript
or startup wrapper is manufactured. Incomplete packages may start validation,
but missing source is reported rather than fabricated. Source snapshots are
not offered as recovered downloads. Strict verification uses Galaxy regenerated
from the packed GUI. Mod-specific missing-attribute recovery is not qualified;
existing attributes are preserved and owned attribute queries retain REVIEW.
See [qualification details](../MOD_RECOVERY_STATUS.md).

Checkboxes use green KSP frames/checkmarks and orange hover/focus. They remain
native checkbox inputs with keyboard, disabled-state and persistence behavior.
