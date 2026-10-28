# Native Analysis

Independent executable-analysis lane. These records do not become serialized Raw facts, Formal values, runtime support, optimizer inputs, or Gap classifications.

## Current state

2026-10-28 update: [Native Power findings and reproduction handoff](power-117-handoff.md), with a [hash-pinned evidence inventory](power-117-evidence-manifest.json). A continuous conditional loader run recovered native code and data. Power damage/HP scalar arithmetic, named class bindings, item input transport, display conversions and three additional Power modifier functions now have build-matched native evidence. The `powf` candidate's import record, cached lookup and committed IAT store are independently checked under explicit export fixtures. Actual Windows CRT output, complete effect application and final combat values remain unverified; runtime promotion is false.

The following milestone assessment is historical, through 2026-10-22. Its pinned artifacts are preserved. The [self-file continuation report](../../docs/game-data-native-self-file.md) records the earlier partial captures and external formula candidates; the new handoff supersedes its current-state limits where explicitly verified.

- **D-1 complete:** the local executable hash matches the Stage 1 record, and the 15,360,000-byte `.dungeon` output hash matches. The two-decoder agreement is reused from Stage 1.
- **D-2 static boundary survey complete:** paired synthetic traces close the modeled RSMB return-to-EBX-bit dataflow inside `.dungeon`. A new range-seeded sweep found two unexecuted `.dungeon` to `.boot` JMP candidates; neither reaches stable section-0 code. The 87 aligned absolute references are sparse typed records, and several target exception-range starts, but none identifies a Dungeons class/function. Current-environment static native evidence is exhausted; further progress needs a new source such as a Windows capture, a full post-unpack image, or matching symbols.
- **D-3 not started:** no gameplay native function has an executable address or evidence chain. One serialized `/Script/Dungeons` parent-class link is retained as a candidate only.

## Artifacts

- [Native Power handoff](power-117-handoff.md) — function RVAs, per-operation binary32 formulas, constants, native caller/name bindings, validation scope and concrete remaining inputs.
- [Power evidence inventory](power-117-evidence-manifest.json) — hashes for private proof files and public recovery scripts; an inventory, not Formal acceptance.
- [Continuous self-file runner](scripts/run_continuous_self_file.py) and [verified copy-loop summary](scripts/verified_copy_loop.py) — one loader emulation call with terminal timeout handling and optional hash-bound copy acceleration.
- [Native copy differential check](scripts/check_native_copy_loop.py) — optional private-input verification of native versus summarized registers, flags and memory.
- [Native input inventory](native-source-inventory.json) — PE sections/directories, imports/exports, TLS, unwind, resources, CodeView, symbol-file search, and bounded identifier scan.
- [Native architecture map](native-architecture.json) — bootstrap, `.dungeon`, original-image boundary, observed control-flow transitions, and explicit unknowns.
- [Firmware boundary observations](firmware-boundary-observations.json) — conditional SMBIOS and registry paths, API return RVAs, local output hashes, and semantic limits.
- [Startup block map](startup-block-map.json) — hash-pinned basic blocks, bounded API-return/control-flow edges, the exact `and ebx, 1; je` branch, synthetic register captures, and scoped negative scans for stable UE4/Dungeons code.
- [Runtime function-table assessment](runtime-function-table-analysis.json) — bounded PE import, ASCII/UTF-16 literal, and saved synthetic-resolution checks for x64 runtime function-table and unwind APIs.
- [Stable-code boundary survey](stable-code-boundary-survey.json) — cross-region edge candidates, 87-pointer deepening, exception-range sweeps, UE4/Dungeons registration search, TLS/init path, resolver cluster, and the D-3 entry/exhaustion decision.
- [External prior-art census](external-prior-art.json) — technique prior art, identifier hints, external-only claims, licenses, and bounded negative search result.
- [Function candidates](function-candidates.json) — confidence-gated Raw class to native implementation candidates. Null locations remain unknown.
- [PE inventory script](scripts/native_input_inventory.py) — hash-pinned read-only parser.
- [SMBIOS boundary tracer](scripts/trace_smbios_boundary.py) — conditional emulation profiles that read the local executable and Stage 1 payload but write traces and memory images only under ignored `local-game-data/`.
- [Static startup analyzer](scripts/static_startup_analysis.py) — reads pinned local executable, Stage 1 bytes, and existing conditional traces; writes only the compact `startup-block-map.json` metadata artifact.
- [Static boundary survey](scripts/static_boundary_survey.py) — reads the pinned executable, Stage 1, seven saved partial captures, and current metadata; writes only the compact final survey. It does not run the game or add synthetic API responses.
- [Artifact validator](scripts/validate_native_artifacts.py) — schema, hash, cross-reference, URL, and repository-hygiene checks.

## Reproduction

### Continuous runner deadline (macOS/POSIX)

```sh
MCD_LOCAL_GAME_DATA_ROOT=/path/to/local-game-data \
  python3 -B research/native/scripts/run_continuous_self_file.py consistent \
  --run-id fresh-capture-id --seconds 1800 --verified-copy
```

The CLI now supervises a dedicated child session. `--seconds` (1..3600) is a
wall-clock limit for the entire child, including setup, emulation and saving.
At the deadline the parent sends SIGTERM to that session's process group, waits
up to one second, then sends SIGKILL if needed and waits at most one more second.
SIGINT, SIGTERM and SIGHUP to the parent use the same cleanup, including repeated
interruptions and descendants left after the worker exits. The runner does not
detach descendants from this group. SIGKILL to the parent and OS failures cannot
be handled; an unfinished monitoring record remains incomplete.

The sibling `<run-id>.watchdog.json` is reserved before spawning and is the
authoritative capture status. A final copy is saved as `watchdog-run.json` inside
the output directory when it exists. `captureComplete: false` (including
`running`, timeout, crash, interrupted or unconfirmed cleanup) excludes the whole
directory from successful capture evidence, even if image/trace files exist.
`forcedKill` records escalation separately. A complete conditional capture is an
`analysis-stopped` result, never proof of game startup or accepted Evidence;
`evidenceAccepted`, `runtimePromotion` and `resumable` remain false.

Exit codes: 2 = recorded analysis stop with complete conditional output;
124 = external or Unicorn timeout; 137 = external timeout requiring SIGKILL;
128 + signal = parent interrupted; 1 = failure or unconfirmed cleanup.
The process supervisor separately distinguishes an ordinary child exit (0) from
an analysis stop. Timeout states are never resumed or reconstructed. Use a fresh
run ID; existing outputs and monitoring records are never overwritten.

The Power evidence manifest pins the **historical** runner at PR head
`a5b6105ab94a3352efd89217a0555a6e4090854a`. Its hashes and captures are preserved;
this watchdog fix-up does not regenerate them. New captures record their own
runner hash and require separate validation.

With the matching private `local-game-data` directory available (it contains the executable, Stage 1 output, Stage 2 import map, Wine export lists, and local Python tools):

```sh
LOCAL_GAME_DATA_ROOT=/path/to/local-game-data
python3 research/native/scripts/native_input_inventory.py \
  --exe "$LOCAL_GAME_DATA_ROOT/archive-1.17.0.0/extracted/Dungeons/Binaries/Win64/Dungeons-Win64-Shipping.exe" \
  --stage1 "$LOCAL_GAME_DATA_ROOT/phase6.8/mechanics/stage1.bin"
MCD_CAPTURE_DISPATCH_SLOT_WRITES=1 MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-success-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-zero-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-alt-size
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-data-generic
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-first-failure
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-success
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/trace_smbios_boundary.py firmware-registry-failure
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" python3 research/native/scripts/static_startup_analysis.py
MCD_LOCAL_GAME_DATA_ROOT="$LOCAL_GAME_DATA_ROOT" PYTHONPATH="$LOCAL_GAME_DATA_ROOT/phase6.8/native-stage2/tools" python3 research/native/scripts/static_boundary_survey.py
python3 research/native/scripts/validate_native_artifacts.py
```

Replace `/path/to/local-game-data` with the local directory path. The inventory command accepts explicit executable and Stage 1 paths and writes only metadata. The tracer locates the ignored Stage 2 `imports.json`, six local Wine export `.spec` lists, and local Capstone/Unicorn Python packages below `MCD_LOCAL_GAME_DATA_ROOT`; it does not load Windows DLLs or use host Windows APIs. Trace JSON and `api-dungeon.bin` are local-only; do not add them to Git.

`firmware-data-generic` uses a hand-authored synthetic buffer. `firmware-registry-*` profiles are explicit counterfactuals. None is a measured Windows result or real device data.

## Acceptance boundary

A serialized `/Script/Dungeons` superclass is not a native function address. A future `supported` or `accepted` candidate needs the exact executable hash and RVA, independent class-registration or reflection evidence, control-flow and data-flow observations, and a Raw identity correlation. A nearby string, generic UE4 layout, or external game's offset is insufficient.

## Self-file continuation (2026-10-22)

The adapter verifies the historical tracer SHA-256 and applies exact, checked source anchors in memory. The original script and its earlier evidence hashes remain unchanged. It adds guest-only self-file APIs, disables expensive historical focused hooks, and retains the original-image execution stop guard. All raw output remains under the private local data root. Use a fresh run ID; existing output is never overwritten.

```sh
MCD_LOCAL_GAME_DATA_ROOT=/path/to/local-game-data python3 -B research/native/scripts/continue_self_file.py legacy --run-id legacy-20261022 --slices 1
MCD_LOCAL_GAME_DATA_ROOT=/path/to/local-game-data python3 -B research/native/scripts/continue_self_file.py consistent --run-id consistent-20261022 --slices 1
python3 -B research/native/scripts/summarize_self_file.py \
  --local-root /path/to/local-game-data \
  --runs legacy-20261022 consistent-20261022 \
  --external research/native/external-native-candidates-20261022.json \
  --output research/native/self-file-continuation.json
python3 -B research/native/scripts/validate_native_artifacts.py
```

The committed capture uses run IDs `verified-legacy-b` and `verified-consistent-b`. Slice boundaries can depend on the 60-second timeout; a replay need not stop at the same instruction or produce the same memory hash. The four file-API boundaries and bounded read observations, not byte-identical budget-stop snapshots, are the reproducibility target. The summary generator uses the existing local Capstone package. Validation requires neither private game files nor Unicorn/Capstone and includes eleven boundary/lifecycle tests for the file model and API adapter.

- [Continuation metadata](self-file-continuation.json): profile conditions, file API arguments, read instruction, section hashes, bounded read samples and literal search.
- [External candidates](external-native-candidates-20261022.json): commit-pinned SDK identifiers, old-source formula hypotheses, source/build discrepancies and discriminating checks.
- [Self-file model](scripts/self_file_model.py): in-memory input only; unsupported operations and arguments stop.
- [Adapter](scripts/continue_self_file.py), [summary generator](scripts/summarize_self_file.py), [new evidence validator](scripts/validate_self_file_artifacts.py).
