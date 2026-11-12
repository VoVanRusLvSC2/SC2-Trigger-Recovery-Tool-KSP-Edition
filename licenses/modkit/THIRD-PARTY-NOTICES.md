# Third-party notices

- `models/src/m3/native/structures.xml` names
  [SC2Mapster/m3addon](https://github.com/SC2Mapster/m3addon) as its original source; that project
  is licensed under GPL-2.0.
- `models/src/m3/native/{encoder,structural,lossless,document}.js` and the preserving writer adapt
  the repository-local Modkit M3 authoring implementation at exact revision
  `6a1f728413c8bc1effde56e9efb79c07a77a02cd`; the port has no runtime dependency on that repository.
- `blizzard-warcraft-3/src/lib/war3-model` vendors the MDX/MDL parser and generator of
  [4eb0da/war3-model](https://github.com/4eb0da/war3-model) 4.0.1 (MIT) as TypeScript sources:
  `model.ts`, `mdx/{parse,generate}.ts`, `mdl/{parse,generate}.ts`, plus the two layer-texture
  maps from its `renderer/util.ts`. Only module specifiers were changed, so the parsers do not
  pull in the upstream WebGL renderer or its `gl-matrix` dependency. The license is reproduced
  in `licenses/war3-model-MIT.txt`.
- `blizzard-warcraft-3/src/lib/mdx-m3-viewer` vendors the Warcraft III map-document parsers
  (`parsers/w3x/{doo,imp,mmp,shd,unitsdoo,w3c,w3d,w3e,w3i,w3o,w3r,w3s,w3u,wpm}`) and the binary
  stream they read with (`common/{binarystream,bytesof,searches,typecast,utf8}`) of
  [flowtsohg/mdx-m3-viewer](https://github.com/flowtsohg/mdx-m3-viewer) at commit `2ff0bc00` (MIT).
  Module specifiers were changed and three typed-array fields annotated; every file and edit is
  recorded in `blizzard-warcraft-3/MDX-PORT-PROVENANCE.json`. The license is reproduced in
  `licenses/mdx-m3-viewer-MIT.txt`.
- `blizzard-warcraft-3/src/war3-map-world/cliffs.ts` adapts the cliff, ramp and ramp-height rules
  of [Retera/WarsmashModEngine](https://github.com/Retera/WarsmashModEngine) at commit `f9e0aeed`
  (`core/src/com/etheller/warsmash/viewer5/handlers/w3x/environment/Terrain.java`: the cliff
  flags, `updateCliffMeshes`, `isCornerRampEntrance`, `getRampLetter`, `updateGroundHeights`,
  `realTileTexture`) from Java to TypeScript, by the owner's decision of 2026-09-29. Warsmash is
  licensed under AGPL-3.0; its license is reproduced in `licenses/WarsmashModEngine-AGPL-3.0.txt`.
- `blizzard-warcraft-3/src/war3-mdx/{detect,render-model}.ts` is the MK2 Warcraft III model
  adapter copied from the repository-local Modkit MK2 tree and carried into MK3: it now compiles
  under the package's strict profile and imports the render-model vocabulary from
  `@modkit/codec-kit/legacy/models`. Every edit is recorded in `MDX-PORT-PROVENANCE.json`.
- `fflate` is licensed under MIT.
- `@xmldom/xmldom` is licensed under MIT.
- `@rgrove/parse-xml` is licensed under ISC.
- The TriggerData semantic reader bundles `sax` 1.6.0 by Isaac Z. Schlueter under the Blue Oak
  Model License 1.0.0; the license is reproduced in
  `licenses/sax-BlueOak-1.0.0.md`.
- `starcraft2/modules/galaxy/language-core`, `language/galaxy-checker.js`, `language/language-service.js`, and
  `workspace-index.js` adapt the MIT-licensed
  [sc2-arcade-watcher/sc2-galaxy-toolkit](https://github.com/sc2-arcade-watcher/sc2-galaxy-toolkit)
  compiler and semantic service at revision `44ba5892cb52b5ace5d1d1fa23521aec2a82bacf`; its license is reproduced in
  `licenses/plaxtony-MIT.txt`.
- `starcraft2/src/sc2-layout` is a new dependency-free JavaScript adaptation of the semantic
  SC2Layout analysis and preview work from the MIT-licensed Modkit source at revision
  `1a14ba4eddd0ae88de273348ebd44cfb98a0581d`. Its compact schema hints were checked against
  [SC2Mapster/sc2layout-schema](https://github.com/SC2Mapster/sc2layout-schema) revision
  `80ff763e735e20da8b826b1fa7e62e8ea49b92ed`; that repository does not declare a license, so no
  schema files or prose from it are redistributed here.
- `starcraft2/modules/galaxy/data/galaxy-script-api.v1.json` is a locally generated compatibility index from
  the installed `Core.SC2Mod` Galaxy headers, implementations, TriggerLib metadata and enUS labels;
  the artifact records every input path, byte size and SHA-256 digest. The generated runtime module
  contains the corresponding API declarations and short labels. These two artifacts are excluded
  from the repository's MIT grant pending a separate public-redistribution review.

No raw file from an installed StarCraft II game is included in this repository; the generated API
index above is the only locally derived game-data artifact currently retained.

The research projects pinned in `REFERENCES.md` are not copied or linked into this repository.
Their licenses describe those upstream projects and do not add a runtime dependency or broaden the
license of Modkit's independent implementation.
