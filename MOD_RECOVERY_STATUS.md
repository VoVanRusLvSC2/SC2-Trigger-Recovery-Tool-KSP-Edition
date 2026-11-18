# Mod archive recovery: diagnosis and qualification

Version 3.0.0-rc.13 enables recovery attempts for every opened map or mod and
dispatches mod libraries to the explicit-library archive worker.
Availability of Generate Triggers is not a claim that recovery passes validation.

## Installed application, tested through the browser

Input: `Campaing Imperia KSP Custom Galaxy UI.SC2Mod`, stored as components inside
one duplicate-name extraction wrapper.

- Open File selects the package and loads 18,036 lines of original Triggers.
- The two real Galaxy body/header files can be selected (1,613 / 149 lines).
- View Tree opens and its library node expands (3 to 7 loaded nodes).
- Export File downloads the original XML, byte for byte: 963,518 bytes,
  SHA-256 `9921b334fa44331f074180aca19a8822c4f9f376d47e5123b0466b6e455edd3f`.
- No browser console errors or warnings occurred.
- Published RC12 disabled Generate Triggers for mods. Version 3.0.0-rc.13 removes that
  restriction, including packages without a complete library pair or MapScript.
  The worker reports missing source and conversion errors after starting validation.

## Full recovery experiment

The archive worker prepares actual installed SC2 dependencies and the mod's 49 components,
resolves 337 include edges, and sends library `17E432E7` to the existing conversion API.
It never invents a MapScript or InitMap wrapper. The source package remains unchanged.

## Diagnosed causes and general fixes

The first failure was a locale selection bug in the new mod archive worker,
not missing thread support. It chose the first archive table (`deDE` here).
That table lacks two FunctionDef names; `enUS` contains them. The forward emitter
then skipped the unnamed definitions and their six generated thread globals.
A minimal named-through-TriggerStrings thread fixture reproduces the failure with
the sparse locale and completes unchanged with the authoritative compiler locale.
The shared map/mod locale selector now follows the existing map compiler policy:
prefer the standard `enUS` table when present. Other translations remain separate.
The same selected locale is used when merging strings and rereading the packed mod.

After that fix, the real mod passed declaration validation and stopped at
`lib17E432E7_InitVariables`. Five structure fields marked GUI Constant had explicit
`DialogControlHookupStandard` defaults. The emitter incorrectly skipped all Constant
structure members. Galaxy structure fields are per-instance storage; their GUI
read-only marker does not cancel runtime initialization. The generic member walk
now processes those defaults without changing standalone constant handling.
A separate fixture verifies a Constant playergroup member initialized with the
existing native `PlayerGroupEmpty`, unchanged XML, and strict round-trip comparison.

The next observed difference was the empty standard Or condition. The source
Galaxy emitted from this GUI contains `(true)`; the converter's template expander
substituted mathematical empty-disjunction identity `false`. Empty boolean role
expansion now uses the existing Editor boolean default, including OR. This changes
the generator, not the benchmark. No raw identity definition or Native was added.

The last mismatch after those fixes was a disabled structure member: the GUI
contains a `Disabled` field that is absent from the original Galaxy header.
Initialization already skipped it, but structure declaration emission included it.
The header now filters disabled members using the same rule; XML is retained.
The runtime-default regression also retains an unused disabled GUI member and
checks that neither its declaration nor its initializer leaks into Galaxy.

The real package now completes with `PASS_OFFLINE_EDITOR_PENDING`. The unchanged
strict oracle compares the original Galaxy with Galaxy regenerated from packed GUI:
all 81 function bodies/signatures, all 47 declarations, 7 includes, 5 global
initializers, calls and trigger registrations match. Incremental mode is UNCHANGED;
the existing GUI was not rebuilt. No new Native or Custom Script was introduced.
Original component/runtime hashes remain unchanged. No Editor or gameplay validation
was performed; this is an offline proof for this package, not acceptance of all mods.
Nine integration scenarios passed against 304 unchanged hash-verified benchmark assets.
The local run evidence is retained outside the source distribution.

## Qualification still required

- Compile/export this candidate in the actual Editor before claiming Editor acceptance.
- Qualify mod-specific missing-attribute reconstruction. The archive worker currently
  preserves existing attribute/runtime components and marks attribute queries REVIEW.

The package-boundary checks pass: scoped library replacement, unchanged
localized keys, rejection of new Native/Custom Script identities, and preservation
of runtime files, Attributes, unrelated assets and the original archive. These checks
are not a successful converter acceptance test.
