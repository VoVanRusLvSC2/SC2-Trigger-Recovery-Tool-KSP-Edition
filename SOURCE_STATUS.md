# Source integration status

**Windows 3.1.1 includes public-source installers, an API and a CLI.**
Public runtime acquisition, automatic map preparation and Windows packaging are
implemented. See [installation](INSTALL.md) and [build instructions](BUILDING.md).
The application bundles Node and runtime dependencies; installed SC2 supplies
game metadata. Historical corpus acceptance levels are unchanged.

## What is restored

- **61 modules** matched historical whole-file SHA-256 pins before relocation.
  Restoration ASTs were checked after import/resource relocation and formatting.
  One later, explicit SDK-loader migration retains the original recovery hash
  and separately verifies unchanged authored-byte/scope/reference guards. See [pinned-source provenance](scripts/recovered-sources.json).
- **11 additional full modules** have matching retained-source algorithm ASTs,
  recorded in [separate provenance](scripts/retained-sources.json). No historical
  missing-destination pin is claimed for them.
  Version 3.1.0 records four later parser or reference-validation updates in
  the two manifests. Each entry keeps its earlier published fingerprint and
  pins the exact bytes in the current release.
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
bootstrap, the unchanged checker now parses **1,348 modules with zero unresolved
literal imports**. All 31 explicitly checked package entry points load. Computed import sites
decreased from 16 to **11**; the default authored runtime now uses static local
modules. Explicit external SDK/oracle and optional runtime routes remain bounded
by their own input contracts.

## Dependencies

The public setup uses licensed ModKit revision
`d4218ef890064108384e8b871081a02acaa86c87`, pinned platform tarballs and locked npm
packages. It emits 761 runtime modules/assets, supplies the public schema and
passes the 31-entry-point runtime check. The old private archive is no longer a
build prerequisite. Its earlier restoration checks remain historical provenance.

The release retains upstream MIT and dependency notices, Node's notices and
mpqcli/StormLib/CLI11 licenses. It includes no maps, installed game binaries,
private recovery transcripts or game-derived native API catalog. Source package
manifest adaptations are documented in the public fetch script and receipt.
Unused legacy `extract-zip` is excluded and `xml2js` is pinned to 0.6.2. The
existing fast-xml-parser compatibility baseline still has a moderate npm advisory.

## Check results and limits

| Check | Result | Scope |
| --- | --- | --- |
| `verify:recovered` | PASS | Published bytes of 61 historically pinned restorations |
| `verify:retained` | PASS | Published bytes of 11 retained full-module restorations |
| `verify:bindings` | PASS | 113 named bindings in 32 reconnected consumers |
| `verify:helpers` | PASS | Exact nondecimal tokens, continue targeting, conservative native include proofs, scoped attribute GUI/quoting and explicit test-policy scope |
| `verify:dependencies` | PASS | 31 package entry points, schema/catalog inputs and in-memory MPQ roundtrip |
| `verify:language -- --with-runtime` | PASS | Six SDK grammars and archived-parser fixtures |
| `verify:attribute-source` | PASS | Stored default tokens, selected variants, localization and invalid-source rejection |
| `format:check` | PASS | Project-owned source formatting |
| `verify:source` | PASS | JavaScript syntax and literal ESM resolution after bootstrap |
| `verify:authored` | PASS | Corrected parser/document scope, SubFunctions, reference inventory and surgical byte preservation |
| `verify:cli` | PASS | Input/output isolation, junction checks, pinned build-version derivation, help and nonzero failures |
| Converter API | PASS | Both conversion directions execute with real NativeLib and declarations |
| `verify:integration` | PASS | Six map/library fresh and incremental cases; unchanged external oracle and negative controls |
| `verify:attribute-integration` | PASS | Real NativeLib plus independent document/GUI/runtime checks and four negative cases |
| Prepared-job CLI | EXECUTED | Real archive candidate packed and payload-verified; conservative REVIEW retained |
| Current corpus / Editor acceptance | NOT REQUALIFIED | No new Editor run or corpus-wide acceptance claim |

## Portable execution checkpoint

The runtime no longer reads historical `graph-sources.json` or `config.json` to
locate executable SDK code. Three retained authored XML/document modules were
restored; their algorithm ASTs match after specifier relocation. Nine consumers
now derive their SDK root from the checkout, with other algorithm ASTs unchanged.
The corrected parser retains SubFunction ownership. External SDK loading remains
an explicit request with its own layout/contract checks.

The worker now validates job paths relative to the job document, checks output
isolation through existing junctions, uses the configured installation for build
identity and derives new component metadata versions from that pinned build.
Failed variants exit nonzero. Optional attribute evidence has an explicit path;
missing evidence stays absent/review and never becomes invented defaults.
Historical per-map attribute pilot policies are disconnected from the default
worker adapter. The original benchmark accepts an explicit root or
`SC2_TRIGGER_BENCHMARK_ROOT`, with all identity checks preserved.

A retained `078_Font_Styles.SC2Map` was processed through the actual worker:
CASC/library authority, complete 227-edge include evidence, GUI preservation,
MPQ packaging, payload checks and cleanup completed. The original archive and
MapScript remained unchanged. The job returned `GENERATED`; its candidate remains
`REVIEW_REQUIRED_EDITOR_PENDING` because three interfaces missing from source
native declarations are present in the loaded catalog. They are unrelated to the
map's displayed function bodies, but the current conservative gate still requires
engine qualification. This result was **not** promoted to PASS.

The original strict oracle reports the raw generated program different by one
redundant `TriggerLibs/natives` include. Applying the existing live-source-verified
include-once proof removes only that already-loaded directive; the unchanged
oracle then reports exact equality. This is recorded separately from raw equality
and from Editor verification. No benchmark code or acceptance rule changed.

Helper checks use controlled XML contracts; the additional integration checks
use real NativeLib and the pinned external oracle. Complete lobby/gameplay
acceptance for corpus maps remains a separate gate. Explicit historical **new test
defaults** stay labeled as new settings, not recovered original defaults or general
map-specific repair rules.

## Remaining release work

1. **Broaden application qualification:** repeat clean install/upgrade and
   representative map jobs on other Windows installations. Automatic preparation
   supports map/mod archives and component folders. Mod-specific missing-attribute
   reconstruction is not qualified; verified header evidence is still required
   for applicable attribute proofs.
2. **Broaden qualification:** recheck corpus inputs with the assembled revision;
   retain the distinction between 103 recorded strict passes and 222 historical
   acceptances. Current integration fixtures are not new corpus passes.
3. **Resolve conservative catalog REVIEW:** distinguish actually required engine
   interfaces from unrelated loaded catalog entries with adequate proof. Do not
   mark catalog-derived prototypes as source declarations or engine evidence.
4. **Editor verification:** compile/export representative exact candidates through
   the Editor service when separately authorized. Offline generation is not
   Editor or gameplay acceptance.

The build's source/runtime loading blockers are resolved and the public dependency
path is executable. Remaining release qualification does not justify weakening
any acceptance gate.
See [API.md](API.md), [CLI.md](CLI.md) and [ROADMAP.md](ROADMAP.md).

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
npm run verify:authored
npm run verify:cli
```

The pinned `fast-xml-parser` baseline retains a reported moderate npm advisory.
Upgrading it needs separate compatibility checks; dependencies were not silently
upgraded during restoration. See [ROADMAP.md](ROADMAP.md).
