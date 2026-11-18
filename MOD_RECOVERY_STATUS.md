# Experimental mod archive worker: acceptance failed

This local branch is not a published release. The local RC12 patch enables recovery
attempts for every opened map or mod and dispatches mod libraries to the worker.
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
- Published RC12 disabled Generate Triggers for mods. The local patch removes that
  restriction, including packages without a complete library pair or MapScript.
  The worker reports missing source and conversion errors after starting validation.

## Full recovery experiment

The prototype prepares actual installed SC2 dependencies and the mod's 49 components,
resolves 337 include edges, and sends library `17E432E7` to the existing conversion API.
It never invents a MapScript or InitMap wrapper. The source package remains unchanged.

Acceptance fails at incremental declaration validation. The internal baseline has
8 nonfunction statements; the source body has 14. Six auxiliary globals for generated
YouTube helper triggers are missing from that internal baseline. Actual source include
paths must be supplied, but doing so does not resolve this remaining ownership issue.
Reusing the preserved-Custom-Script predicate did not qualify these globals; that
experimental core change was reverted. The strict guard was not removed.

An independent direct GUI-to-Galaxy baseline contains all 81 functions and signatures,
but the unchanged strict benchmark rejects it. It reports 12 differing function bodies,
one differing structure layout, and five missing `DialogControlHookupStandard` calls.
Some structural differences may be code-generation choices; the lost calls cannot
be dismissed without proof. No recovered mod or equivalence PASS was produced.

## Remaining work before qualifying full mod recovery

1. Carry authoritative ownership for template-generated auxiliary storage through
   the forward emission and incremental comparison stages. Do not filter by helper
   names or permit missing declarations on the basis of a checkpoint alone.
2. Preserve source-qualified initializers, member identities and compiler-local
   bindings. Confirm that every missing call survives regeneration from packed GUI.
3. Complete real-mod recovery and a deliberately incomplete-GUI fixture through the
   UI, download the resulting mod, reopen it and run the unchanged benchmark.
4. Qualify mod-specific missing-attribute reconstruction; the prototype currently
   preserves existing attribute/runtime components and marks queries as REVIEW.

The prototype's package-boundary checks pass: scoped library replacement, unchanged
localized keys, rejection of new Native/Custom Script identities, and preservation
of runtime files, Attributes, unrelated assets and the original archive. These checks
are not a successful converter acceptance test.
