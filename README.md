# SC2 Galaxy Trigger Recovery

**Galaxy to GUI trigger recovery for StarCraft II.** Convert `MapScript.galaxy` into editable `Triggers` XML for the SC2 Editor. The tool works with `.SC2Map` maps and `.SC2Mod` mods and preserves existing trigger folders and Custom Script where possible.

## Version 3.1.6

[Download 3.1.6 for Windows x64](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases/tag/v3.1.6)

- **Installed-SC2** uses data from your StarCraft II installation and can recover missing map lobby attributes.
- **Standalone** downloads a pinned metadata snapshot during setup and runs without StarCraft II. Its recovered output is marked for Editor review.

Open **`Open Recovery.cmd`** from the installed or extracted folder. Select a map or mod and click **Generate Triggers**. For a map, **Insert Triggers Into Map** downloads a recovered copy. The interface also offers a separate Triggers XML download. [Installation and launch guide](INSTALL.md)

Version 3.1.6 displays stored attribute defaults and can optionally fill missing defaults in recovered game attributes with their first known value. It also restores supported embedded helper libraries as editable map functions.

## How recovery works

The diagrams follow a packed map through the Windows app or the `recover` CLI. Mod recovery uses the same converter for individual library header and body pairs. See [mod recovery](MOD_RECOVERY_STATUS.md).

### Prepare the source and libraries

```mermaid
---
config:
  flowchart:
    curve: linear
    nodeSpacing: 28
    rankSpacing: 30
    wrappingWidth: 220
---
flowchart TB
    accTitle: Prepare the source and libraries
    accDescr: Read a map without modifying it, resolve the required libraries, and record the inputs for conversion. Missing dependencies can lead to a downloadable draft.

    entry["Windows app or recover CLI"] --> job["Create an isolated job<br/>Record the source map hash"]
    job --> components["Read selected components<br/>Galaxy, Triggers XML, strings and Attributes"]
    components --> deps["Identify declared dependencies<br/>and includes in map-owned scripts"]

    game["Installed SC2 CASC<br/>or Standalone snapshot"] --> resolve["Resolve required libraries<br/>and follow nested includes"]
    deps --> resolve
    local["Map-owned libraries<br/>and matching local mods"] --> resolve
    resolve --> coverage{"Required dependencies<br/>resolved?"}
    coverage -->|Yes| metadata["Collect Galaxy declarations<br/>and library GUI definitions"]
    coverage -->|Missing| partial["Try partial recovery<br/>Report missing packages and symbols"]
    partial --> draft["Offer a draft or XML<br/>when available"]
    metadata --> ready["Prepared conversion inputs<br/>Map sources and resolved libraries"]

    classDef input fill:#e7eefb,stroke:#4d6b9b,color:#172d50;
    classDef process fill:#e0f4f1,stroke:#387e78,color:#103d3a;
    classDef output fill:#e6f3df,stroke:#58804b,color:#263f1f;
    classDef review fill:#fff0d2,stroke:#aa7435,color:#593b14;
    class entry,game,local input;
    class job,components,deps,resolve,coverage,metadata process;
    class ready output;
    class partial,draft review;
```

### Analyze Galaxy and reconstruct the trigger tree

```mermaid
---
config:
  flowchart:
    curve: linear
    nodeSpacing: 28
    rankSpacing: 30
    wrappingWidth: 220
---
flowchart TB
    accTitle: Analyze Galaxy and reconstruct the trigger tree
    accDescr: Parse Galaxy into an AST, resolve symbol and library ownership, then preserve, complete, or rebuild editable trigger markup.

    source["Original Galaxy and owned scripts"] --> parse["Build a shared AST<br/>Declarations, expressions and statements"]
    parse -->|Syntax errors| diagnostics["Report source locations<br/>in SOURCE_DIAGNOSTICS.json"]
    parse --> symbols["Resolve symbols and types<br/>Scopes, ownership and library references"]
    symbols --> program["Build the program model<br/>Calls, events and initialization order"]

    metadata["Dependency declarations<br/>and GUI definitions"] --> binding["Resolve GUI bindings<br/>Library and element IDs, parameters and presets"]
    program --> binding
    program --> attributes["Trace attribute queries to<br/>verified or observed map data"]
    evidence["Attributes, localized strings<br/>and optional verified evidence"] --> attributes
    binding --> lowering["Apply guarded transformations<br/>to supported control flow and expressions"]
    attributes --> plan["Apply the selected recovery policy<br/>Preserve Source or Full GUI"]
    lowering --> plan

    authored["Existing Triggers XML"] --> inventory["Index authored IDs and folders<br/>Custom Script and libraries"]
    plan --> mode{"State of authored GUI<br/>and source changes?"}
    inventory --> mode
    mode -->|Absent or empty| fresh["Build editable GUI<br/>for supported code"]
    mode -->|Existing GUI matches| preserve["Retain authored markup<br/>and element identities"]
    mode -->|Supported changes| complete["Update affected elements<br/>Keep the surrounding tree"]
    fresh --> assembled["Assemble Triggers XML,<br/>strings and applicable attributes"]
    preserve --> assembled
    complete --> assembled

    classDef input fill:#e7eefb,stroke:#4d6b9b,color:#172d50;
    classDef process fill:#e0f4f1,stroke:#387e78,color:#103d3a;
    classDef output fill:#e6f3df,stroke:#58804b,color:#263f1f;
    classDef error fill:#fce4e4,stroke:#ac5858,color:#622424;
    class source,metadata,evidence,authored input;
    class parse,symbols,program,binding,attributes,lowering,plan,inventory,mode process;
    class fresh,preserve,complete,assembled output;
    class diagnostics error;
```

Preserve Source retains authored Custom Script and separate libraries where possible. Full GUI also tries to reconstruct supported functions and variables from embedded Galaxy libraries. Names, comments and folder information missing from all available inputs may be unrecoverable.

### Pack the result and check it

```mermaid
---
config:
  flowchart:
    curve: linear
    nodeSpacing: 28
    rankSpacing: 30
    wrappingWidth: 220
---
flowchart TB
    accTitle: Pack the result and check it
    accDescr: Save separate trigger XML or build a candidate archive, regenerate Galaxy from the packed triggers and record the offline verdict. Editor verification is a separate step.

    assembled["Recovered components"] --> xml["Download standalone<br/>Triggers XML when available"]
    assembled --> pack["Pack a separate candidate<br/>Verify preserved payloads"]
    pack --> reopen["Read back the packed components"]
    reopen --> generate["Regenerate Galaxy from packed GUI<br/>using matching library metadata"]
    original["Original Galaxy<br/>and prepared source model"] --> compare
    generate --> compare["Compare Galaxy programs<br/>Types, calls, events and startup"]
    reopen --> verify["Check GUI references, attribute<br/>bindings and archive contents"]
    compare --> benchmark["Run the strict benchmark<br/>where applicable"]
    benchmark --> verdict{"Offline verdict"}
    verify --> verdict
    verdict -->|Static match| match["Static checks matched<br/>Editor verification pending"]
    verdict -->|Review| review["Differences or missing proof<br/>Editor verification pending"]
    verdict -->|Failure| failure["Report diagnostics<br/>Offer a draft if available"]
    match --> result["Download candidate<br/>Inspect RESULT.json and evidence"]
    review --> result
    result -.-> editor["Open and compile in<br/>StarCraft II Editor"]
    editor -.-> exported["Export Editor-generated Galaxy<br/>for separate comparison"]

    classDef input fill:#e7eefb,stroke:#4d6b9b,color:#172d50;
    classDef process fill:#e0f4f1,stroke:#387e78,color:#103d3a;
    classDef output fill:#e6f3df,stroke:#58804b,color:#263f1f;
    classDef review fill:#fff0d2,stroke:#aa7435,color:#593b14;
    classDef error fill:#fce4e4,stroke:#ac5858,color:#622424;
    classDef editorStep fill:#eee7fc,stroke:#7760a8,color:#3b2c5a;
    class assembled,original input;
    class pack,reopen,generate,compare,verify,benchmark,verdict process;
    class xml,match,result output;
    class review review;
    class failure error;
    class editor,exported editorStep;
```

The source archive stays read-only. Dashed arrows show the separate Editor check. See [architecture](ARCHITECTURE.md#conversion-flow) for the verification boundaries.

## Documentation

- [Architecture](ARCHITECTURE.md) and [mod recovery](MOD_RECOVERY_STATUS.md)
- [CLI](CLI.md), [API](API.md) and [build instructions](BUILDING.md)
- [Verified map records](maps/verified.md), [historical acceptance records](maps/previously-accepted.md) and [source provenance](SOURCE_STATUS.md)
- [Release history](https://github.com/VoVanRusLvSC2/SC2-Galaxy-Trigger-Recovery/releases)
- [Contributors](CONTRIBUTORS.md) and [third-party notices](THIRD_PARTY_NOTICES.md)
