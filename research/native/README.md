# Native Analysis

Independent executable-analysis lane. These records do not become serialized Raw facts, Formal values, runtime support, optimizer inputs, or Gap classifications.

## Current state

- **D-1 complete:** the local executable hash matches the Stage 1 record, and the 15,360,000-byte `.dungeon` output hash matches. The two-decoder agreement is reused from Stage 1.
- **D-2 in progress:** conditional startup emulation now distinguishes zero from positive synthetic SMBIOS size results and reaches the next API boundaries. No original/stable game-code region was reached.
- **D-3 not started:** no gameplay native function has an executable address or evidence chain. One serialized `/Script/Dungeons` parent-class link is retained as a candidate only.

## Artifacts

- [Native input inventory](native-source-inventory.json) — PE sections/directories, imports/exports, TLS, unwind, resources, CodeView, symbol-file search, and bounded identifier scan.
- [Native architecture map](native-architecture.json) — bootstrap, `.dungeon`, original-image boundary, observed control-flow transitions, and explicit unknowns.
- [Firmware boundary observations](firmware-boundary-observations.json) — conditional SMBIOS and registry paths, API return RVAs, local output hashes, and semantic limits.
- [External prior-art census](external-prior-art.json) — technique prior art, identifier hints, external-only claims, licenses, and bounded negative search result.
- [Function candidates](function-candidates.json) — confidence-gated Raw class to native implementation candidates. Null locations remain unknown.
- [PE inventory script](scripts/native_input_inventory.py) — hash-pinned read-only parser.
- [SMBIOS boundary tracer](scripts/trace_smbios_boundary.py) — conditional emulation profiles that read the local executable and Stage 1 payload but write traces and memory images only under ignored `local-game-data/`.
- [Artifact validator](scripts/validate_native_artifacts.py) — schema, hash, cross-reference, URL, and repository-hygiene checks.

## Reproduction

With the matching private `local-game-data` directory available (it contains the executable, Stage 1 output, Stage 2 import map, Wine export lists, and local Python tools):

```sh
LOCAL_GAME_DATA_ROOT=/path/to/local-game-data
python3 research/native/scripts/native_input_inventory.py \
  --exe "$LOCAL_GAME_DATA_ROOT/archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe" \
  --stage1 "$LOCAL_GAME_DATA_ROOT/phase6.8/mechanics/stage1.bin"
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-success-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-zero-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-alt-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-data-generic
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-first-failure
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-success
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-failure
python3 research/native/scripts/validate_native_artifacts.py
```

Replace `/path/to/local-game-data` with the local directory path. The inventory command accepts explicit executable and Stage 1 paths and writes only metadata. The tracer locates the ignored Stage 2 `imports.json`, six local Wine export `.spec` lists, and local Capstone/Unicorn Python packages below `MCD_LOCAL_GAME_DATA_ROOT`; it does not load Windows DLLs or use host Windows APIs. Trace JSON and `api-dungeon.bin` are local-only; do not add them to Git.

`firmware-data-generic` uses a hand-authored synthetic buffer. `firmware-registry-*` profiles are explicit counterfactuals. None is a measured Windows result or real device data.

## Acceptance boundary

A serialized `/Script/Dungeons` superclass is not a native function address. A future `supported` or `accepted` candidate needs the exact executable hash and RVA, independent class-registration or reflection evidence, control-flow and data-flow observations, and a Raw identity correlation. A nearby string, generic UE4 layout, or external game's offset is insufficient.
