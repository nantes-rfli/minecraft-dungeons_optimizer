# Native game-data analysis restart

2026-10-22追記: [自己exe読み取りの継続解析と旧版計算式候補](./game-data-native-self-file.md)を追加した。以下は2026-09の静的調査の履歴。新しい条件付き実行でもゲーム本体への移行・現行戦闘式の確定には至っていない。

調査日: 2026-09-24。`main` の `647fcaefed2a8b90372fcc1e5f1297371ae0ee9d` を基準に D-2 終盤の Native Static Boundary Survey を実施した。アプリ、Formal Domain、Optimizer、Gap、runtime support は変更していない。ゲーム executable、DLL、生メモリイメージ、raw asset はGitに含めない。

## Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| D-1: first packed layer | Complete and rechecked | Local Shipping executable SHA-256 matches Stage 1 record; 8,937,075 packed bytes recover 15,360,000 bytes at `.dungeon`, SHA-256 `d68e1bdf…e99d925b`. The independent decoder agreement is reused from the earlier Stage 1 evidence. |
| D-2: startup/protection to original stable code | Static boundary survey complete; current-environment static evidence exhausted | Paired synthetic traces connect the modeled RSMB return to an EBX bit-test within `.dungeon`. Two range-seeded JMP candidates point to `.boot`, but neither was executed or decoded as stable game code. No UE4/Dungeons registration mechanism was identified. |
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

The [startup block map](../research/native/startup-block-map.json) records the static and focused trace evidence. A write hook pins the qword writer to `add qword ptr [r14], rcx` at RVA `0x4eaf54d`, in a loop entered at `0x4eaf539`. The loop starts from `.dungeon` VA `0x144ed01dd`, advances by eight bytes, and adds the image base in `RCX`; the observed dispatch slot is entry `0x4aa` of the loop. Its old qword `0x4be79a4` becomes VA `0x144be79a4`. This supports runtime-written dispatch **data**, without establishing rewritten instructions or a conventional function boundary.

The focused target chain continues through `jmp rbx` at `0x4cceab9` to `.dungeon` RVA `0x4bb927b`, which directly jumps to `0x4e5f7d5`. That long state block ends with `jmp r11` at `0x4e5fc75`; the captured target is RVA `0x4c1968b`, followed by a direct jump to `0x4dd6892`. These blocks remain in Stage 1 `.dungeon` and show state-based branches and indirect jumps without a normal call/return boundary or a transition to stable code.

The paired traces recover the conditional-emulation dataflow to the EBX branch. The modeled API result in `RAX` reaches dispatcher entry, is saved at `[RSP+0x78]`, is later popped into `R11` at `0x4dd6b04`, and is written to `.dungeon` address `0x144be849b` at `0x4dd6b06`. At `0x4c77f97`, the same dword is read and compared with `R10D = 0xff`: the paired values are zero and `0x1000`. `pushfq` at `0x4c77f9a` saves the compare flags. Later, `pop r10` at `0x4c780e4` restores them and `mov qword ptr [r12], r10` at `0x4c780e6` writes them to state cell `0x144be8443`. At `0x4e99160`, `mov ebx, dword ptr [rbx]` reloads that dword. A focused code hook records the executed path and shows EBX remains `0x293` or `0x212` up to `and ebx, 1` at `0x4e9934f`. Bit 0 is the compare's carry flag: the zero-size profile falls through to `0x4e9935b`, while the `0x1000` profile takes the JE to `0x4e9938c`. This closes the dataflow only in the paired synthetic profiles. It does not establish real Windows firmware behavior, branch meaning, or a subsequent stable-code handoff.

For the saved `firmware-data-generic` profile, 74 API-return observations have 58 distinct RVAs; none falls in the 236,168 listed exception ranges. All exception rows have nonzero fields and `begin < end`, but only one referenced unwind-info RVA is backed by initialized input bytes. An API return RVA is not treated as a function entry, and neither the range misses nor unreadable unwind-info locations imply that no function exists. The call/wrapper identity remains unresolved.

The bounded search checked common UE4/Dungeons registration/reflection and RTTI strings, common x64 prologue signatures at listed exception-range starts, aligned runs of executable pointers, and aligned absolute pointers from Stage 1 into original executable sections. It found isolated pointer-like constants but no code-pointer run, registration marker, or stable UE4/Dungeons candidate. The one initialized target sample decodes as high-entropy bytes; other target locations lack initialized bytes. These constants do not identify an executed code target or registration structure. The negative result is limited to those inputs and signatures.

## NATIVE D-2 final static boundary survey

The [final survey artifact](../research/native/stable-code-boundary-survey.json) records the current `main` baseline, hashes, each search scope, candidate scoring, and the remaining source requirements.

- **Cross-region control flow:** a Capstone sweep seeded at the 1,157 Stage1 exception-range starts produced two unexecuted direct JMP candidates, `0x5338753 → 0x5e297ca` and `0x541b32d → 0x5b8b385`. Both target initialized `.boot` bytes. The first target begins `clc; ret 0xa679; out dx, eax`; the second stops decoding on its first byte. The candidates do not target section 0, and no saved profile reaches either address. An unseeded Stage1 byte-pattern sweep found 3,199 relative-branch signatures; these were excluded as control-flow evidence because the region contains high-entropy/encoded data and no instruction-boundary proof.
- **87 absolute references:** all 87 aligned references originate between Stage1 RVAs `0x4bb80f8` and `0x4c1a668`, with four repeated targets and no regular pointer-table stride. Their preceding dword pairs are mostly `(0x11,1)`, `(0x08,1)`, and `(0x0a,1)`. Sixty-two references target three exact exception-range starts, including `0x40b0c0` (37 references) and `0x276f6f0` (24). `0x276f6f0` and `0x2f46e1f` have no initialized target bytes; `0x40b0c0` decodes only two instructions before stopping, and `0x4d11a0` has no normal call/return shape. This supports a possible code-pointer field in opaque typed metadata, but not a vtable or class registrar.
- **UE4 and Dungeons bridge:** no named registration arrays, class/function pairs, constructor cluster, or native registration path was linked to an executable address. The `/Script/Dungeons.ArmorGearItemInstance` relation still comes from the Raw Battle Robe package; its native address remains unknown.
- **TLS, init, imports/exports, and resolution:** the executable has no TLS callback (`callbacksVa = 0`); its three DIR64 relocation entries target the TLS start/end/index fields. Static imports include `GetModuleHandleA` but no `GetProcAddress`/`LoadLibrary` or runtime function-table APIs. The delay-import directory lies in virtual bytes without raw-file backing. The 90 named exports group under AGS, Opus, libsamplerate, graphics preference flags, and `PrintScriptCallstack`; no Dungeons/UE registration name was identified. Seven saved synthetic profiles resolve `SetLastError`, `GetLastError`, and `IsUserAnAdmin` at three `.dungeon` resolver sites; traces do not connect returned pointers to a UE4 registrar. The executable statically imports `WINMM.dll`, but the adjacent local DLL remains authenticity-unverified and is not attributed to Dungeons.
- **Decision:** `CURRENT-ENVIRONMENT STATIC NATIVE EXHAUSTED`. The local executable, Stage1, exception metadata, PE startup directories, seven partial `.dungeon` captures, adjacent unverified DLL metadata, and the relevant Raw class relation were checked. Remaining work needs a real Windows trace, a complete post-unpack image, matching PDB/MAP symbols, protector-aware tooling, another authenticated build, or a same-build live reflection snapshot.

One registry failure model returns `ERROR_FILE_NOT_FOUND` once and stops at the next request for `Hardware\description\System`. A separate success model writes a synthetic handle and stops at `RegQueryValueExA` before modeling any registry value. A clearly labeled all-keys-missing profile checks three paths and reaches `CreateFileW`. These are branch probes in a synthetic process, not measurements from Windows and not evidence of DRM behavior.

No Windows process was needed for this static wave. The [runtime function-table assessment](../research/native/runtime-function-table-analysis.json) found no requested registration/unwind API in the PE import names or ASCII/UTF-16 literals, and none in the seven saved bounded synthetic profiles. A separate aligned absolute-pointer scan found 87 references from Stage 1 into original executable sections, grouped at four targets; none formed a code-pointer run or had execution/registration evidence, and the input-backed samples decode as high-entropy bytes. These bounded negative findings do not decide whether transformed code, generated metadata, or another runtime mechanism exists. Real Windows results would be needed for machine-specific firmware semantics, which remain outside the claims in this report.

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
