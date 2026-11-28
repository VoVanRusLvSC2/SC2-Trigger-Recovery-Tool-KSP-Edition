# SC2 Galaxy Trigger Recovery

**Galaxy to GUI trigger recovery for StarCraft II.** Convert `MapScript.galaxy` into editable `Triggers` XML for the SC2 Editor. The tool works with `.SC2Map` maps and `.SC2Mod` mods and preserves existing trigger folders and Custom Script where possible.

## Version 3.1.6

[Download 3.1.6 for Windows x64](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases/tag/v3.1.6)

- **Installed-SC2** uses data from your StarCraft II installation and can recover missing map lobby attributes.
- **Standalone** downloads a pinned metadata snapshot during setup and runs without StarCraft II. Its recovered output is marked for Editor review.

Open **`Open Recovery.cmd`** from the installed or extracted folder. Select a map or mod and click **Generate Triggers**. For a map, **Insert Triggers Into Map** downloads a recovered copy. The interface also offers a separate Triggers XML download. [Installation and launch guide](INSTALL.md)

Version 3.1.6 displays stored attribute defaults and can optionally fill missing defaults in recovered game attributes with their first known value. It also restores supported embedded helper libraries as editable map functions.

## How recovery works

```mermaid
flowchart TD
    map["SC2 map or mod"] --> input["Galaxy, existing Triggers XML, strings and attributes"]
    game["Installed SC2 or Standalone metadata"] --> model["Parse Galaxy and resolve library bindings"]
    input --> model
    model --> recovery["Restore missing GUI or update existing triggers"]
    recovery --> xml["Editable Triggers XML"]
    recovery --> candidate["Pack and verify a separate map or mod"]
    candidate -.-> editor["Open and compile in StarCraft II Editor"]
```

The original archive is read-only. Offline checks compare the recovered program and verify archive contents. Open the recovered copy in StarCraft II Editor to verify compilation. Names, comments and folders missing from all available source files may be unrecoverable.

## Documentation

- [Architecture](ARCHITECTURE.md) and [mod recovery](MOD_RECOVERY_STATUS.md)
- [CLI](CLI.md), [API](API.md) and [build instructions](BUILDING.md)
- [Verified map records](maps/verified.md), [historical acceptance records](maps/previously-accepted.md) and [source provenance](SOURCE_STATUS.md)
- [Release history](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases)
- [Contributors](CONTRIBUTORS.md) and [third-party notices](THIRD_PARTY_NOTICES.md)
