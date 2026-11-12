# Licensing

This repository has more than one license because it contains an attributed third-party format
description.

Except where a file or `THIRD-PARTY-NOTICES.md` says otherwise, the original Modkit source code is
available under the MIT License in `MIT.txt`.

`models/src/m3/native/structures.xml` is derived from the SC2Mapster `m3addon` project and is
distributed under GPL-2.0-only; its license text is in `GPL-2.0-only.txt`.

`blizzard-warcraft-3/src/war3-map-world/cliffs.ts` adapts code of WarsmashModEngine and is
distributed under AGPL-3.0; its license text is in `WarsmashModEngine-AGPL-3.0.txt`. The owner
decided on 2026-09-29 to take Warsmash code now and to settle the repository's license later; the
Warcraft III extension must not be distributed under MIT alone while it contains this file.

`blizzard-common-formats/modules/s2protocol/protocols/data` contains generated protocol tables
derived from Blizzard's `s2protocol` project. Its MIT license is in `s2protocol-MIT.txt`; the
pinned source revisions and generated-file hashes are recorded beside the module.

`starcraft2/modules/galaxy/data/galaxy-script-api.v1.json` and the generated
`starcraft2/modules/galaxy/language/native-api.generated.js` contain a locally generated compatibility index of
StarCraft II API names, signatures and short labels. They are not offered under the repository's
MIT license. Their public redistribution requires a separate review of Blizzard's applicable
terms; the repository remains private meanwhile.

The repository remains private and is not ready for public package publication. Public release
requires provenance decisions for the Galaxy API index and genuine legacy M3A test fixture, plus
distributable licensed versions of the shared Modkit platform packages.

All license grants, third-party notices and trademark notices in this repository live in this one
directory. Repository-level extension artifacts must include `licenses/`; individual workspace
packages are not standalone publication units.
