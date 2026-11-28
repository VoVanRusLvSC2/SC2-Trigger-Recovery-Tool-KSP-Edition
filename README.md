# SC2 Galaxy Trigger Recovery

**Galaxy to GUI trigger recovery for StarCraft II.** Convert `MapScript.galaxy` into editable `Triggers` XML for the SC2 Editor. The tool works with `.SC2Map` maps and `.SC2Mod` mods and preserves existing trigger folders and Custom Script where possible.

## Version 3.1.6

[Download 3.1.6 for Windows x64](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases/tag/v3.1.6)

- **Installed-SC2** uses data from your StarCraft II installation and can recover missing map lobby attributes.
- **Standalone** downloads a pinned metadata snapshot during setup and runs without StarCraft II. Its recovered output is marked for Editor review.

Open **`Open Recovery.cmd`** from the installed or extracted folder. Select a map or mod and click **Generate Triggers**. For a map, **Insert Triggers Into Map** downloads a recovered copy. The interface also offers a separate Triggers XML download. [Installation and launch guide](INSTALL.md)

Version 3.1.6 displays stored attribute defaults and can optionally fill missing defaults in recovered game attributes with their first known value. It also restores supported embedded helper libraries as editable map functions.

## How recovery works

Read the three columns from left to right to follow map recovery from `MapScript.galaxy` to editable triggers and a recovered `.SC2Map`. Mod recovery uses the same converter for library header and body pairs. See [mod recovery](MOD_RECOVERY_STATUS.md).

```mermaid
---
config:
  themeVariables:
    fontSize: 17px
  flowchart:
    curve: linear
    nodeSpacing: 7
    rankSpacing: 17
    padding: 6
    wrappingWidth: 145
---
flowchart LR
    accTitle: Galaxy to SC2 map recovery
    accDescr: Three connected columns follow Galaxy source through its AST and library bindings, editable Triggers XML, and a packed map with verification evidence.

    subgraph sourceStage["1. Read Galaxy and build the AST"]
        direction TB
        prepare["Open a map<br/>App or recover CLI<br/>Isolate job, hash source<br/>Read Galaxy, Triggers,<br/>strings and Attributes"]
        resources["Installed SC2 CASC<br/>or Standalone snapshot<br/>Map libraries and local mods"] --> dependencies
        prepare --> dependencies["Resolve dependencies<br/>and nested includes"]
        dependencies --> coverage{"Dependencies<br/>resolved?"}
        coverage -->|Missing| partial["Partial recovery<br/>List missing packages<br/>and symbols<br/>Draft or XML if available"]
        coverage -->|Ready| ast["Build the Galaxy AST<br/>MapScript.galaxy and owned scripts<br/>Declarations, expressions, statements"]
        ast -->|Syntax errors| diagnostics["Report source locations<br/>SOURCE_DIAGNOSTICS.json"]
        ast --> model["Resolve symbols and types<br/>Scopes, owners, libraries<br/>Calls, control flow,<br/>events and startup"]
    end

    subgraph recoveryStage["2. Resolve bindings and recover triggers"]
        direction TB
        libraries["Library declarations<br/>and native GUI definitions"] --> binding["Bind calls and values<br/>Library and element IDs<br/>Parameters and presets"]
        binding --> lowering["Guarded transformations<br/>for supported GUI"]
        evidence["Attributes and localized strings<br/>Optional verified evidence"] --> attributes["Map attribute queries<br/>to matching data"]
        lowering --> policy["Preserve Source<br/>or Full GUI"]
        attributes --> policy
        authored["Index Triggers XML<br/>IDs, folders, libraries<br/>and Custom Script"] --> route
        policy --> route{"Authored GUI<br/>and source delta?"}
        route -->|Absent or empty| fresh["Build a new<br/>trigger tree"]
        route -->|Matches Galaxy| preserve["Retain markup<br/>and element IDs"]
        route -->|Supported changes| update["Update affected nodes<br/>Preserve the tree"]
        fresh --> recovered
        preserve --> recovered
        update --> recovered["Recovered Triggers XML,<br/>strings and applicable attributes"]
    end

    subgraph verifyStage["3. Pack, verify and download"]
        direction TB
        output["Recovered components"] --> pack["Pack a separate map<br/>Verify preserved payloads"] --> rebuild["Reopen the packed map<br/>Regenerate Galaxy from<br/>packed GUI and libraries"]
        output --> xml["Download editable<br/>Triggers XML when available"]
        rebuild --> compare["Compare original and regenerated Galaxy<br/>Types, calls, events, startup<br/>Strict benchmark if applicable"]
        rebuild --> contracts["Check GUI references,<br/>attributes and payloads"]
        compare --> verdict{"Offline verdict"}
        contracts --> verdict
        verdict -->|Static match| match["Static checks matched<br/>Editor check pending"]
        verdict -->|Review| review["Differences or missing proof<br/>Editor check pending"]
        verdict -->|Failure| failure["Report diagnostics<br/>Draft if available"]
        match --> map
        review --> map["Recovered .SC2Map<br/>RESULT.json and evidence"]
        map -.-> editor["SC2 Editor compile<br/>and Galaxy export<br/>Separate comparison"]
    end

    sourceStage ==> recoveryStage ==> verifyStage

    classDef stage fill:#dce9fd,stroke:#4d6b9b,stroke-width:2px,color:#172d50;
    classDef input fill:#e7eefb,stroke:#4d6b9b,color:#172d50;
    classDef process fill:#e0f4f1,stroke:#387e78,color:#103d3a;
    classDef output fill:#e6f3df,stroke:#58804b,color:#263f1f;
    classDef review fill:#fff0d2,stroke:#aa7435,color:#593b14;
    classDef error fill:#fce4e4,stroke:#ac5858,color:#622424;
    classDef editorStep fill:#eee7fc,stroke:#7760a8,color:#3b2c5a;
    class prepare,ast,binding,pack stage;
    class resources,libraries,evidence,authored,output input;
    class prepare,dependencies,coverage,model,lowering,attributes,policy,route,rebuild,compare,contracts,verdict process;
    class fresh,preserve,update,recovered,xml,match,map output;
    class partial,review review;
    class diagnostics,failure error;
    class editor editorStep;
    style sourceStage fill:transparent,stroke:#94a3b8
    style recoveryStage fill:transparent,stroke:#94a3b8
    style verifyStage fill:transparent,stroke:#94a3b8
```

Preserve Source retains authored Custom Script and separate libraries where possible. Full GUI also tries to reconstruct supported functions and variables from embedded Galaxy libraries. Names, comments and folder information missing from all available inputs may be unrecoverable.

The source archive stays read-only. The dashed arrow marks the separate Editor check. See [architecture](ARCHITECTURE.md#conversion-flow) for the verification boundaries.

## Documentation

- [Architecture](ARCHITECTURE.md) and [mod recovery](MOD_RECOVERY_STATUS.md)
- [CLI](CLI.md), [API](API.md) and [build instructions](BUILDING.md)
- [Verified map records](maps/verified.md), [historical acceptance records](maps/previously-accepted.md) and [source provenance](SOURCE_STATUS.md)
- [Release history](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases)
- [Contributors](CONTRIBUTORS.md) and [third-party notices](THIRD_PARTY_NOTICES.md)
