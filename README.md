# SC2 Trigger Recovery — KSP Edition

**A reworked Trigger Revizer implementation, developed together with Vise.**

Recover editable StarCraft II GUI triggers from Galaxy and complete existing trigger trees while preserving their structure and behavior.

## Accepted map records

| Verification level | Archive records | Complete list |
| --- | ---: | --- |
| Last recorded strict MapScript pass | **103** | [Verified maps](maps/verified.md) |
| Accepted in the earlier registry | **222** | [Previously accepted maps](maps/previously-accepted.md) |

These are **325 accepted records from the main 339-record corpus**, with two explicitly different verification levels. They are not 325 new strict passes or necessarily 325 distinct publications. Original map names, archive IDs and SHA256 values are preserved in the lists and [machine-readable catalog](maps/catalog.json).

The last strict registry is dated **2026-10-30**. Publication and source reorganization do not constitute a new Editor run. Full gameplay, lobby and attribute acceptance is not claimed for every record.

## Core capabilities

- A shared Galaxy AST for functions, types, scopes and initialization.
- GUI binding resolution using library identity, element type, ID and ownership.
- Reconstruction of missing markup and incremental completion of existing trees.
- Preservation of original folders, separate Galaxy libraries and authored script in `preserve-source` mode.
- Attribute, dependency and localized-string recovery when supported by confirmed source data.
- Semantic safeguards for signatures, event arguments, initialization and exported program completeness.

## Source layout

```text
src/
  cli/            Conversion entry point
  ast/            Galaxy program model and syntax services
  model/          Symbol identity and source ownership
  analysis/       Dependency and initialization analysis
  types/          Type inference and compatibility
  bindings/       Galaxy-to-GUI bindings
  gui/            GUI contracts and representation
  conversion/     Conversion stages
  incremental/    Existing-tree completion
  lowering/       Guarded source transformations
  verification/   Semantic safeguards used by the converter
  archive/        Archive and component handling
  libraries/      Shared library support
  sdk/            Included SDK source modules
  vendor/         Third-party runtime source
maps/             The 103 + 222 accepted-map lists
ARCHITECTURE.md   Design and integration notes
CONTRIBUTORS.md   Contributors and upstream acknowledgements
licenses/         Original third-party license notices
```

See [Architecture](ARCHITECTURE.md) for module responsibilities and entry points. This repository contains production source, accepted-map records and documentation; test suites, benchmark distributions, run logs and generated verification reports are not included.

## Integration status

The conversion core is implemented and has recorded results on real maps. The available source still has missing external dependencies and qualification inputs, so this is **not yet a complete standalone build**. Module paths have been reorganized for readability; historical results remain attached to the previously verified artifacts. No missing implementation is replaced by a stub, and the reorganization does not relax verification rules.

## Contributors and reverse engineering

The reworked implementation was developed together with **Vise**. Thanks to **[hometlt](https://github.com/hometlt)** for the upstream [ModKit/Blizzard libraries](https://github.com/hometlt/modkit-extensions-blizzard) used in this project.

Development included reverse engineering and analysis of SC2 formats, Galaxy, NativeLib, GUI bindings, event ABI and actual Editor exports. [Contributors](CONTRIBUTORS.md) and [third-party notices](THIRD_PARTY_NOTICES.md) document attribution.

Earlier packaged application releases remain available under [Releases](https://github.com/VoVanRusLvSC2/SC2-Trigger-Recovery-Tool-KSP-Edition/releases); they are separate from this reworked source publication.
