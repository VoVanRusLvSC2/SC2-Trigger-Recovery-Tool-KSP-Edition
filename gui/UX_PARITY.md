# Trigger Revize KSP: desktop UX parity

Reference: the local JavaFX application in `E:/SK2/Trigger Revize KSP`.
This is a behavioral port, not a redistribution of its private source or game assets.

| Area | Previous web UI | Target behavior |
| --- | --- | --- |
| Main window | Extra instruction band; FULL GUI toolbar toggle | Two toolbar rows, equal code panes and status footer; full access is always included |
| Settings | Paths first; no persistent appearance preferences | Restoration first, Automatic card, attribute and embedded-script options, music/volume/opacity, Close; paths under Advanced |
| Hierarchy | Raw XML nesting, truncated child lists | Resolve Root/Item references, scope IDs by Library, preserve order, show cycles and missing references, keyboard navigation and node count |
| Search | Find next only; closes after a match | Live literal search, result snippets and line numbers, Previous/Next/Clear/Close, Ctrl+F and F3/Shift+F3 |
| Code panes | Plain unnumbered read-only text | Synchronized line gutters, visible-line syntax coloring, stable selection and line counts |
| Save / Export | Standalone XML / map download, respectively | SAVE TRIGGERS obtains the separate recovered map; EXPORT FILE exports standalone Triggers XML |
| Local libraries | Read-only dependency JSON | Add, enable, remove local dependency search roots; show actual resolved dependencies |
| Information | JSON-first modal | Generation status and issues, live activity, optional detailed evidence, OK |
| Windows | Modal only; no backdrop dismissal | Search and hierarchy stay open while inspecting code; movable headers, Escape, explicit Close; settings dismisses on its backdrop |

## Deliberate differences

- Source maps are never overwritten. Save obtains the separately generated map;
  Export is available whenever markup is loaded.
- Attribute recovery and the strict benchmark are enabled by default, as requested.
  SC2 and the benchmark are discovered automatically.
- Full access is always included in the public edition; no access button or license login is needed.
- Music uses an optional user-selected local audio file. No Blizzard soundtrack is bundled.
- Galaxy remains a read-only view of the actual recovery input. Editing an input
  without passing that edit through preparation and proof would be misleading.
  The public UI must not silently ignore edits or present them as verified.
- Local library roots supply real SC2 package dependencies through the existing
  SDK resolver. Arbitrary standalone Galaxy files are not injected as invented GUI
  definitions. Missing dependencies remain explicit failures.
- Styling is recreated with CSS rather than proprietary textures. Browser file
  selection uses the KSP in-app picker to avoid hidden native dialog deadlocks.

## Validation

Test library scoping, repeated references, cycles, missing roots, search wrapping,
settings persistence across ports/restarts, picker cancellation, action enablement,
source immutability and large-document rendering. Preserve strict benchmark rules.

OPEN FILE accepts packed `.SC2Map` and `.SC2Mod` files and their component folders. Mod inspection uses
real Galaxy components and preserves existing Triggers. Archive generation is
still map-only; explicit library recovery remains in the component API. Checkboxes
use the shared KSP green/orange styling while retaining native input semantics.

Map component folders are snapshotted into a separate archive, verified against source
component hashes and sent through the same strict recovery pipeline. Progress uses
estimated stage percentages, retains the reached percentage on failure and exposes
the error directly in the footer. Full access is always included.
