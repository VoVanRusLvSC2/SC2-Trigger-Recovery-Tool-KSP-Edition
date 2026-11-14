# Source integration status

**2026-11-14: static import closure reached; converter execution still blocked.**
This is a source recovery checkpoint, not an install-and-run release. No historical
map acceptance was promoted by restoring or reconnecting source modules.

## What is restored

- **61 modules** matched historical whole-file SHA-256 pins before relocation.
  Original/restored algorithm ASTs match after import/resource relocation and
  formatting. See [pinned-source provenance](scripts/recovered-sources.json).
- **8 additional full modules** have matching retained-source algorithm ASTs,
  recorded in [separate provenance](scripts/retained-sources.json). No historical
  missing-destination pin is claimed for them.
- **3 component restorations** have narrower evidence: nondecimal literal
  transport, legacy loop helpers and explicit historical test-policy construction.
  See [component provenance](scripts/recovered-components.json). The loop module
  combines original helpers with a separately recovered nested-loop continue guard;
  full-file historical equality is not claimed.
- **18 missing module targets** now use retained shared implementations for types,
  templates, initialization, parameter names, imported structures, XML output and
  Custom AI. This reconnects 32 consumers without duplicate implementations.
  The focused static check verifies **113 named binding contracts**; export
  availability does not prove runtime state identity or behavior.
- In **35 existing modules**, only specifier wiring changed; algorithm ASTs match.
  One intentional refactor moves the existing historical test-policy alias
  allowlist into data. Its allowed input remains unchanged.
- Five SDK scanners share the retained core. Parser/types bytes match across six
  families; focused AST, range and diagnostic comparisons include the archived parser.

The last checkpoint had **27 missing source files and one invalid directory
import**, affecting 150 relative-import occurrences. After the documented local
bootstrap, the unchanged checker now parses **1,342 modules with zero unresolved
literal imports**. All 29 external package entry points load. **Sixteen computed
imports still require runtime qualification.**

## Dependencies

The [local bootstrap](BUILDING.md) verifies the supplied `mk-revizer.zip`, restores
1,981 archived runtime files under ignored `.runtime`, links nine ModKit package
roots and installs three pinned generated schemas. Matching public npm packages
are shared to preserve module/class identity. Archived packages, generated assets,
maps and private recovery transcripts are not redistributed here.

This reduces missing source requirements and duplicate internal module targets.
It does **not** remove all nine external ModKit dependencies. Public acquisition
and standalone packaging remain unqualified; setup still requires the pinned
user-supplied archive.

## Check results and limits

| Check | Result | Scope |
| --- | --- | --- |
| `verify:recovered` | PASS | Published bytes of 61 historically pinned restorations |
| `verify:retained` | PASS | Published bytes of 8 retained full-module restorations |
| `verify:bindings` | PASS | 113 named bindings in 32 reconnected consumers |
| `verify:helpers` | PASS | Exact nondecimal tokens, continue targeting, conservative native include proofs, scoped attribute GUI/quoting and explicit test-policy scope |
| `verify:dependencies` | PASS | 29 package entry points, schema/catalog inputs and in-memory MPQ roundtrip |
| `verify:language -- --with-runtime` | PASS | Six SDK grammars and archived-parser fixtures |
| `verify:attribute-source` | PASS | Stored default tokens, selected variants, localization and invalid-source rejection |
| `format:check` | PASS | Project-owned source formatting |
| `verify:source` | PASS | JavaScript syntax and literal ESM resolution after bootstrap |
| Converter API load | BLOCKED | JSON-driven historical SDK/parser path escapes the checkout |
| CLI startup | BLOCKED | Same historical runtime path |
| Complete conversion / map equivalence | NOT REQUALIFIED | Requires a running assembled converter and the unchanged external oracle |

The first runtime failure starts in `src/ast/read-authored.scope.mjs`:
`graph-sources.json` points to an old corrected SAX parser outside this checkout.
That parser imports an absent historical `sax` path. Installing the current `sax`
package does not repair this configuration. Adding files at the old drive location
would conceal the portability problem.

Focused GUI checks use controlled XML contracts; live NativeLib compatibility and
complete lobby recovery remain separate gates. Explicit historical **new test
defaults** stay labeled as new settings, not recovered original defaults or general
map-specific repair rules.

## Exact remaining release work

1. **Portable SDK runtime:** separate historical provenance JSON from live
   configuration; derive SDK roots from the checkout or validated explicit inputs.
   Qualify all 16 computed imports, preserving corrected authored-parser scope and
   SubFunction behavior.
2. **Actual API/CLI execution:** load both entry points from a clean installation;
   check re-export contracts, cyclic initialization and SDK state across the full
   chain. Static resolution alone cannot establish this.
3. **Complete conversion and incremental recovery:** exercise both directions;
   preserve folders, IDs, foreign libraries, authored script and unknown metadata.
   Prove startup/event completeness.
4. **Attributes with Galaxy:** qualify definition/default provenance, GUI ownership
   and runtime query equivalence together. A justified namespace relocation must
   leave unrelated behavior unchanged.
5. **Unchanged external benchmark:** configure its pinned location without changing
   identity checks or acceptance rules. Requalify the assembled build; retain the
   distinction between 103 recorded strict passes and 222 historical acceptances.
6. **Usable distribution:** document runtime/metadata acquisition and supported
   input contracts; validate representative Editor exports and package a tested
   revision. This checkpoint claims no new Editor or gameplay acceptance.

## Reproduce

Use Node.js 24 (checked locally with 24.14.1) and [BUILDING.md](BUILDING.md).
Integrity manifests do not independently reproduce the unavailable original
workspace or replace the external oracle.

```sh
npm run verify:recovered
npm run verify:retained
npm run verify:bindings
npm run verify:helpers
npm run verify:dependencies
npm run verify:language -- --with-runtime
npm run verify:attribute-source
npm run format:check
npm run verify:source
```

The pinned `fast-xml-parser` baseline retains a reported moderate npm advisory.
Upgrading it needs separate compatibility checks; dependencies were not silently
upgraded during restoration. See [ROADMAP.md](ROADMAP.md).
