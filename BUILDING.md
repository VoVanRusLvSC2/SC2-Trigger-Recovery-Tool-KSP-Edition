# Build preparation

Literal source imports now resolve after setup. Integration is still incomplete:
historical computed SDK paths prevent converter API and CLI startup.
See [remaining runtime and qualification work](SOURCE_STATUS.md).

## Prerequisites

- Node.js 24 and npm. The checked preparation environment uses Node 24.14.1.
- Python 3.10 or later for the archive bootstrap; it uses only the standard library.
- The retained `mk-revizer.zip` distribution supplied with this project work.
  Its SHA-256 is `aaa8df28cbfb5f61f52a0e38181cf93b938d8cf67fdd9e81a46e8fc7e295f0d4`.
  Another archive or an arbitrary newer ModKit checkout is not automatically
  compatible. Automatic acquisition from public upstream remains unqualified.

## Install dependencies

From the repository root:

```sh
npm ci --ignore-scripts
python scripts/setup-local-dependencies.py --archive /path/to/mk-revizer.zip
```

On Windows, pass the archive's Windows path. The bootstrap verifies the complete
archive fingerprint, extracts the retained compiled runtime under `.runtime`,
shares compatible public npm packages, and links nine ModKit package roots into
`node_modules`. It also installs three pinned generated schema assets. These
local dependencies and assets are ignored by Git; the bootstrap does not grant
redistribution rights or upload them. It executes no package lifecycle scripts.

Run the bootstrap again after `npm ci`, which removes the package links.
Repeated setup verifies existing runtime files and refuses to overwrite a
different file or package location. No maps, Editor sessions or game binaries
are involved.

## Verify the preparation

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

The first two checks cover source provenance and bytes. The language check
compares the shared scanner and all six retained SDK grammars, including the
archived parser as an independent reference. The attribute-source check covers
stored default tokens, selected-variant overrides and invalid-source rejection.
The dependency check loads all 29 imported package entry points and verifies
schema loading, catalog include paths and an MPQ write/read entirely in memory.
These are focused preparation checks, not map-acceptance results.

`verify:source` now passes after bootstrap: 1,342 modules parse with no unresolved
literal imports. Its rules were not relaxed. This does not execute computed imports
or prove complete converter behavior. API/CLI loading remains blocked by historical
SDK paths; incremental recovery, attributes and the unchanged external benchmark
are subsequent release gates.
