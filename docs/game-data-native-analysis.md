# Native game-data analysis restart

調査日: 2026-09-24。`main` の `37d7d29ac2ffa799f476703eb5cf1d41285b1756` を基準に D-2 Static Native Deepening を続行した。アプリ、Formal Domain、Optimizer、Gap、runtime support は変更していない。ゲーム executable、DLL、生メモリイメージ、raw asset はGitに含めない。

## Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| D-1: first packed layer | Complete and rechecked | Local Shipping executable SHA-256 matches Stage 1 record; 8,937,075 packed bytes recover 15,360,000 bytes at `.dungeon`, SHA-256 `d68e1bdf…e99d925b`. The independent decoder agreement is reused from the earlier Stage 1 evidence. |
| D-2: startup/protection to original stable code | In progress | Bounded Capstone recovery maps the SMBIOS return blocks, dispatcher candidate, indirect dispatch slot, and an exact `and ebx, 1; je` block. Paired synthetic traces take different branch successors, but the API-return-to-EBX dataflow and original-image handoff remain unresolved. |
| D-3: gameplay function identification | Not started | No native implementation address, class registration, vtable, `UFunction::Func`, gameplay caller/callee chain, or formula was identified. |

The exact baseline and all machine-readable fields live in [the Native Analysis lane](../research/native/README.md). Existing Stage 1 and Stage 2 artifacts remain at their original paths; nothing was bulk moved.

## Inputs and architecture

The inspected local file is `Dungeons-Win64-Shipping.exe`, SHA-256 `eab80a0b…bf0eb8`, 37,613,072 bytes. The archive's distribution authenticity is unverified; hash equality proves identity with the earlier local record only. A nearby `winmm.dll` was hashed but not loaded and its provenance is also unverified.

The PE entry point is RVA `0x5a5e058` in `.boot` (section 14, RVA `0x5a5e000`). Stage 1 packed data begins at RVA `0x5a5e22c` and decompresses into `.dungeon` (section 13, RVA `0x4bb8000`, virtual size `0xea6000`, zero raw bytes, RWX). The saved Stage 1 entry is VA `0x144e7c95f`, relative offset `0x2c495f`. The first eight PE section names are eight spaces. Their raw bytes and flags are structural evidence, not proof that any is a stable gameplay region.

The saved startup path ran inside the decompressed `.dungeon` region with synthetic API exports. It observed TEB/PEB access, RDTSC, library/procedure lookup, vectored exception registration, `VirtualProtect`, debugger/context queries, `ThreadHideFromDebugger`, and `GetSystemFirmwareTable`. Stage 2's stop guard covered `[0x140000000, 0x144bb7fff]`; no entry into that original-image range was observed. Section 13 `.dungeon` was the only PE section whose bytes changed in the saved conditional Stage 2 comparison. These observations do not establish a write-to-execute handoff into game code.

The PE resource identifies engine version 4.22.3.0. CodeView metadata refers to `Dungeons-Win64-Shipping.pdb` (GUID `1860eb8f-2c41-49f0-af0f-2bfebd15447b`, age 2), but no matching PDB, MAP, or SYM file was found in the extracted tree. The delay-import directory points into virtual section bytes without a raw-file mapping. The bounded literal scan did not find common UE reflection, FName, Dungeons, or RTTI markers; encoded or runtime-generated identifiers remain possible.

Raw `.text` samples are high entropy, and a Capstone sample at one recorded exception-range start decoded one instruction before stopping. This is not a whole-binary decompilation result. Available local tools were the read-only PE parser, Apple LLVM objdump, Capstone 5.0.6, and Unicorn 2.1.4; Ghidra, IDA, Binary Ninja, and radare2/rizin were not found on the current path.

## SMBIOS and environment boundary

The previous Stage 2 checkpoint was `GetSystemFirmwareTable(0x52534d42, 0, NULL, 0)`, return RVA `0x50d0fe9`. Counterfactual size models show:

| Synthetic result | Observed next boundary | What it establishes |
| --- | --- | --- |
| 0 bytes | `RegOpenKeyA` at return RVA `0x50f434d` | A zero size follows a different API path. |
| 1024 bytes | Second `GetSystemFirmwareTable` at return RVA `0x50d1349`, buffer size `0x400` | A positive size drives a buffer allocation/request using that size. |
| 4096 bytes | Second call at the same return RVA with buffer size `0x1000` | Same positive-size path at another size. Trace stops before returning firmware bytes. |

A separate fake 4096-byte buffer had an eight-byte RawSMBIOSData-like header and hand-authored records. The emulator accessed the first 240 byte offsets at a single code VA, then freed the buffer and reached the first registry request. This does **not** identify a real SMBIOS field or prove which machine data affects a branch.

The new [startup block map](../research/native/startup-block-map.json) records the static and focused trace evidence. The two RSMB API return continuations end in direct tail jumps to the bounded dispatcher candidate at RVA `0x4ebd3c1`; no adjacent call instruction ends at either API return RVA. The dispatcher contains a `lock cmpxchg` backedge and a computed `jmp qword ptr [rax]` at RVA `0x4ebdde7`. In one saved synthetic trace, the dispatch slot at RVA `0x4ed272d` changes from qword `0x4be79a4` to absolute VA `0x144be79a4`; sampled instruction bytes remain unchanged. This supports runtime-written dispatch **data**, without establishing rewritten instructions, a protector product, or a conventional function boundary.

The downstream EBX bit-test block at RVA `0x4e9934f` is identified exactly as `and ebx, 1; je 0x4e9938c`. The paired zero and positive-size synthetic profiles correlate with different EBX low bits and take fallthrough `0x4e9935b` versus the JE target `0x4e9938c`. At this point RAX is zero in both captures. The static register/state transfer from the RSMB API return through the dispatcher into EBX is unresolved, so the profiles do not establish that the modeled size directly controls this branch.

For the saved `firmware-data-generic` profile, 74 API-return observations have 58 distinct RVAs; none falls in the 236,168 listed exception ranges. All exception rows have nonzero fields and `begin < end`, but only one referenced unwind-info RVA is backed by initialized input bytes. An API return RVA is not treated as a function entry, and neither the range misses nor unreadable unwind-info locations imply that no function exists. The call/wrapper identity remains unresolved.

The bounded search checked common UE4/Dungeons registration/reflection and RTTI strings, common x64 prologue signatures at listed exception-range starts, and aligned runs of executable pointers. It found no registration marker or stable UE4/Dungeons candidate in initialized PE raw sections and Stage 1. This negative result is limited to those inputs and signatures; it does not show that such code is absent.

One registry failure model returns `ERROR_FILE_NOT_FOUND` once and stops at the next request for `Hardware\description\System`. A separate success model writes a synthetic handle and stops at `RegQueryValueExA` before modeling any registry value. A clearly labeled all-keys-missing profile checks three paths and reaches `CreateFileW`. These are branch probes in a synthetic process, not measurements from Windows and not evidence of DRM behavior.

The remaining D-2 blocker is concrete: this host has no real Windows game process or real Windows DLL/API execution, and the only firmware buffer examined was fabricated. Without valid OS results, no trustworthy SMBIOS field semantics or path into a stable original image region can be stated. A discriminating next run needs the same hash-pinned executable under a legitimate Windows environment, actual API results kept local, and a stop at each unknown registry/file response until its caller and resulting code region can be checked. Do not infer a successful path from a guessed response.

## Raw-to-native bridge and D-3 target

The best current class candidate is `/Script/Dungeons.ArmorGearItemInstance`, because the Raw Battle Robe package exports `BP_BattleRobeInstance_C` and its serialized `superReference` resolves to the `ArmorGearItemInstance` import whose outer package is `/Script/Dungeons`. This makes the asset-to-class-name edge concrete and reusable across armor assets.

The edge ends at the serialized class name. No executable registration, `UClass::SuperStruct`, vtable, constructor, native pointer, or implementation RVA was found. The candidate therefore remains `candidate`; function, address, callers, inputs, and outputs are unknown. The next useful evidence is a build-matched reflection snapshot or a verified registration structure that resolves this exact class and one native function pointer back into this binary. Generic UE offsets and external addresses are not accepted.

No native damage, Power scaling, effect stacking, cooldown, attack-timing application, or effective hit sequence has been verified. These remain `unknown`/`unsupported`; none is converted to zero or promoted into project semantics.

## Prior art

[dungeons.tools](https://www.dungeons.tools/damage-calculator) says its item ratings come from game data and that absolute damage requires a gear-power curve compiled into the executable. This is an external-only claim; no public implementation/address was identified and this analysis did not recover that curve. [MCDSaveEdit](https://github.com/CutFlame/MCDSaveEdit), [DungeonTools](https://github.com/ZingBallyhoo/DungeonTools), and [DungeonsEditor](https://github.com/hoonkun/DungeonsEditor) are save/pak workflows, not native implementation dumps. [Dungeons Mod Kit](https://github.com/Dokucraft/Dungeons-Mod-Kit) documents a UE4.22 asset/mod workflow, consistent with the local 4.22.3.0 resource version but not evidence of native layouts.

[UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) documents live reflection and approximate-vtable dumps as a generic technique. Its Minecraft Dungeons [issue #1211](https://github.com/UE4SS-RE/RE-UE4SS/issues/1211) is a UE4.22.3 launch-failure report, not a successful class dump. No independently verifiable MCD SDK/reflection dump or native class/function address list was found in the bounded public-source pass. No external code was copied.

## Verification and data boundaries

The inventory generator checks both input hashes and writes only structural metadata. The SMBIOS tracer checks the same hashes and writes its raw trace and `.dungeon` memory image below ignored `local-game-data/`. The Native artifact validator checks JSON shapes, cross-references, source URLs, hashes, and that no binary/memory-dump files are present under `research/native/`. The README has exact reproduction commands.

Only `docs/` and `research/native/` are in this lane. No site deployment is required because there are no user-facing site changes.
