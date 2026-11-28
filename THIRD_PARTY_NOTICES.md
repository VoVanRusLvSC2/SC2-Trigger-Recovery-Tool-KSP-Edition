# Third-party notices

This project uses source from [hometlt/modkit-extensions-blizzard](https://github.com/hometlt/modkit-extensions-blizzard) and its included dependencies.

- [Upstream license](licenses/modkit/LICENSE.upstream)
- [Original ModKit notices](licenses/modkit/)
- [Dependency licenses](licenses/dependencies/)

Read the license and notices applicable to each component. This publication does not replace them with a new blanket permission.
Game maps, Blizzard binaries and locally generated game API asset distributions are not included.

The build uses the original ModKit platform bundles under the owner's public
MIT grant at revision `d4218ef890064108384e8b871081a02acaa86c87`. The
[fingerprint-pinned runtime mirror](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases/download/runtime-tools-v1/modkit-runtime-d4218ef.zip)
contains the four required source packages, seven unmodified platform tarballs,
and the original `LICENSE`, `licenses/` and `vendor/README.md`. Test fixtures
are omitted. The license and notices accompany the application under
`licenses/public-modkit`. Original third-party grants retain their scope.

Windows builds bundle Node.js 24.14.1 and its complete LICENSE, plus
[mpqcli 0.10.0](https://github.com/thegraydot/mpqcli) with its MIT, StormLib and
CLI11 notices in [licenses/mpqcli](licenses/mpqcli). Inno Setup is a build tool
downloaded from its publisher, not included in the application runtime.

## Localization Editor SC2 KSP UI

The Open File layout and visual conventions are adapted from Localization Editor
SC2 KSP (2026, vlencmanissc-dotcom), distributed under the MIT License. The
TypeScript implementation does not ship Java code or proprietary game textures.
See [the retained license](licenses/LOCALIZATION_EDITOR_UI_LICENSE.txt).
