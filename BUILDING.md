# Build preparation

The component API and prepared-job CLI run after this setup. See [API.md](API.md)
and [CLI.md](CLI.md) for inputs, and [SOURCE_STATUS.md](SOURCE_STATUS.md) for actual
check results and remaining release qualification. This is not a bundled app.

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
npm run verify:authored
npm run verify:cli
```

The first two checks cover source provenance and bytes. The language check
compares the shared scanner and all six retained SDK grammars, including the
archived parser as an independent reference. The attribute-source check covers
stored default tokens, selected-variant overrides and invalid-source rejection.
The dependency check loads all 31 checked package entry points and verifies
schema loading, catalog include paths and an MPQ write/read entirely in memory.
These are focused preparation checks, not map-acceptance results.

`verify:source` passes after bootstrap: 1,348 modules parse with no unresolved
literal imports. Its rules were not relaxed. Actual API conversion and prepared
CLI execution are checked separately; static resolution alone cannot prove them.

The [integration commands](API.md#reproduce-integration-checks) require matching
external NativeLib data and the pinned benchmark distribution. Both six-case
converter integration and five-case attribute integration passed; the oracle's
manifest and all 304 asset fingerprints remain unchanged. An actual CLI map job
completed packaging and preservation checks while retaining its conservative
REVIEW status. No new corpus-wide or Editor acceptance is claimed.
