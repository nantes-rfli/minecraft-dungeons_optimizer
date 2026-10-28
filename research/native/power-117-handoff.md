# 1.17.0.0 Native Power — difficult analysis handoff

This is a research handoff, not a runtime promotion. It records the difficult analysis for subsequent integration. Keep Evidence, Formal and Promotion gates unchanged. Do not treat missing evidence as zero or supported behavior.

## Checkout and private evidence

- Worktree: `/Users/nanto/.codex/worktrees/native-combat-117/minecraft-dungeons_optimizer`
- Branch: `codex/native-combat-117-boundary`
- Baseline: `5ce5790ff0217c338b6a7fcb37b2dc9dffefedea` (main through PR #216; GitHub main rechecked on 2026-10-28 and still matches).
- Private data root: `/Users/nanto/Development/minecraft-dungeons_optimizer/local-game-data`
- Capture: `phase6.8/native-stage2/self-file-experiments/verified-copy-20261024-a`
- Target exe SHA-256: `eab80a0ba0c3c4c1bbae6e0e40ed8ada5dc26bf3008b7385579168b793bf0eb8`.
- Recovered mapped-image SHA-256: `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`.

The archive/pak label is 1.17.0.0. Hash equality establishes identity with the inspected local executable; official distribution authenticity remains unverified. No Windows environment is available. No game process or Windows CRT implementation was executed.

Do not touch unrelated staged changes in the original checkout. Do not commit game binaries, memory images, source-copy buffers, or external source mirrors. Private evidence and reproducible analysis scripts are saved in the capture directory above.

The compact `power-117-evidence-manifest.json` alongside this handoff pins the private proof files and scripts. It is a handoff inventory, not an accepted Evidence/Formal artifact. The repository's existing validator does not yet validate these new findings.

## Recovered native arithmetic

All RVAs refer to the pinned exe; image base is `0x140000000`.

| Role | RVA | Binding |
| --- | --- | --- |
| Damage multiplier | `0xb88f20` | Melee/Ranged/Armor calculation classes; independent Increase-class callback bindings |
| Health multiplier | `0xb94940` | Health calculation class; independent MaxHealthIncrease callback |
| Internal Power normalization | `0xb8f610` | Called by both multipliers |
| Integer constant 19 | `0xa3fa50` | Actual `mov eax,19; ret`, not inferred from old source |
| Spec level reader | `0x3b4ac0` | Reads float32 at spec + `0x298` |
| Damage calculation override | `0x7b02e0` | Calls level reader, tail-jumps to damage multiplier |
| Health calculation override | `0x7b0300` | Calls level reader, tail-jumps to health multiplier |
| `powf` candidate import thunk | `0x2f46ee5` | Indirect jump through IAT `0x3095e38`; conditional native parser proof below |
| Display integer conversion | `0xb8f500` | Native registration binds `GetItemPowerDisplayInt` |
| Display float conversion | `0xb8f5d0` | Arithmetic helper; descriptive name |
| Display-to-internal helper | `0xb8f5f0` | Arithmetic helper; descriptive name |
| DamageReduction Power scalar | `0xb88fa0` | `UDamageReduction` constructor callback |
| DurationIncrease Power scalar | `0xb8a5f0` | `UDurationIncrease` constructor callback |
| CooldownReduction Power scalar | `0xb86b70` | `UCooldownReduction` constructor callback |

For finite inputs, let `F` mean rounding each operation to binary32. The isolated checks explicitly use MXCSR `0x1f80` (nearest, ties to even; FTZ/DAZ off); live-game MXCSR has not been observed.

```text
x = internal float32 ItemPower (not displayed integer Power)
N = 19
c = float32 bits 0x3f151515 = 0.5823529362678528
upper = F(F(float32(N - 1) * c) + 1)
denom = F(upper - 1) = 10.482353210449219 (bits 0x4127b7b8)
q = F(F(x - 1) / denom)
e = F(clamp(q, 0, 3) * 19)
y = math_import(1.25f, e)  # powf matches module/hash/native parser; actual Windows CRT unverified
t = max(F(F(y * 0.75f) - 0.75f), +0)
damage_multiplier = F(F(t + t) + 1)
health_multiplier = F(t + 1)
```

The actual clamp branches map unordered/negative q to +0; final MAXSS also selects +0 for NaN. The normalization function has a zero-range guard, though this build's constant range is nonzero. Preserve the native operation order: `0.75*y - 0.75` must not be rewritten as `(0.75*y + 0.25) - 1` when matching binary32 results.

## `powf` binding: native record, cached lookup, and committed IAT store

The remaining record-to-IAT link was completed on 2026-10-28 under explicit PE export-data fixtures. Damage calls at `0xb88f66` and health at `0xb94986` both target thunk `0x2f46ee5`, whose RIP-relative jump reads IAT `0x3095e38`.

The original 10-byte record at `0x4bc6010` is `2400fdf5b8c6385e0903`: module index 36, name checksum `0xc6b8f5fd`, IAT RVA `0x3095e38`. The original loader decodes `api-ms-win-crt-math-l1-1-0.dll`; its module-table slot is `0x4c19b08 + 36*8 = 0x4c19c28`. The index is verified by an actual slot read after the record, not inferred from DLL call order.

The loader's custom reflected checksum uses initial/final XOR `0xffffffff`, polynomial `0x54495041`, and the ASCII name **including NUL**. `powf\0` gives `0xc6b8f5fd`. The later cached resolver uses a different code path from the earlier isolated direct resolver:

1. Native reads the fixture's `powf\0` bytes and writes `0xc6b8f5fd` into its allocated cache at offset `0x1a8`.
2. Native reads the original target record's three fields (with that exact record copied to the first slot of cloned guest memory).
3. Native selects math module slot 36 and reads the cached checksum. At `0x4ec02b7`, `cmp dword ptr [r9],r10d` compares `0xc6b8f5fd` with itself; the next instruction observes ZF set. Both observed comparisons agree.
4. Native reads ordinal 0 and EAT function RVA `0x5000` from the selected math fixture.
5. Native `mov qword ptr [r8],rdx` at `0x4ed8910` writes the resolved pointer to `0x3095e38`. Execution stops at the following instruction `0x4ed8913`, and a memory read confirms the full 8-byte store committed.

The enriched positive run takes 14,139,817 code-hook visits, exactly matching the earlier positive run, in one synchronous segment without a timeout resume. The observer additions do not alter the native instructions, registers, or memory. Independent control changes the fixture's `powf` EAT RVA from `0x5000` to `0x6000`; the committed IAT pointer changes by exactly `0x1000`, using the same native writer. A separate `powf` → `POWF` name control changes the cached hash to `0xcf55a6a3` and produces no IAT write before a missing-environment read stops the trial; it does not establish complete failure/fallback handling.

All module-handle results in these trials are explicit synthetic PE export tables: only the math fixture has `powf`, and other DLL fixtures have `POWF`. The target record is moved to the first slot to isolate its semantics. The only allocation model accepts the observed `VirtualAlloc(NULL,0x298,0x1000,0x4)` and returns zero-filled guest memory. Neither Windows APIs nor exported functions execute. This is conditional proof of the native record/parser/name/address relationship, not an unmodified full import-table run, a Windows runtime dump, or CRT numerical validation. Actual DLL export-set collisions are not checked without that DLL.

Private evidence lives under `import-checkpoint-20261026-a`:

- `native-import-binding-complete.json` and `mcd_complete_import_binding.py` join the primary observations and native Power callsites; proof SHA-256 `6070a96d8ed5401b05fff2f4e59d06d3e293cf708e3ea0ed41c2d7546f136585`.
- `parser-cached-targetfirst-20261028-a/import-parser-trial.json` and its saved `import-parser-harness.py` contain the complete positive observation.
- `parser-review-rva6000-20261028-a` contains the independent EAT-RVA control.
- `parser-review-nonmatching-20261028-a` contains the negative name control.
- `import-parser-binding-independent-review.json` and `review-import-parser-binding.py` independently check the 36 checkpoint regions, fixture files, 5,948 observed instruction spans (including the final stop boundary), record fields, module selection, hash comparisons and committed write. Review SHA-256: `5bf787cddf8ac13551674bcd564184ee26d328683d83befb1679bdbfdb10183b`; no findings. All supporting hashes are listed in `power-117-evidence-manifest.json`.

Do not require the old `knownNativeResolverMatchingHashAndMathModuleObserved` flag to become true: it watches unused direct-resolver instruction `0x4f9e74a`. The positive cached path is separately observed at `0x4ec02b7`. Preserve the older partial evidence and its original limits rather than rewriting its status.

Constants read from recovered data:

| RVA | Bits | Value |
| --- | --- | --- |
| `0x331c414` | `0x3f151515` | 0.5823529362678528 |
| `0x30ca850` | `0x40400000` | 3 |
| `0x320a5d0` | `0x3fa00000` | 1.25 |
| `0x30ca84c` | `0x3f400000` | 0.75 |
| `0x3cc0548` | `0x3f800000` | 1 |

Old-source formulas are search hints only. Strict source-order binary32 evaluation of the old display conversion produces denominator bits `0x4127b7b7`, whereas this recovered native function produces `0x4127b7b8`. This is a source-order comparison, not an observed difference from an old game binary: compiler reassociation could produce the native result. See `power-source-order-comparison.json` and its separate C++ check. Preserve the measured native order.

## Three additional named Power scalars

These functions reuse the normalization above but **do not clamp q to 3**. With the same per-operation binary32 convention:

```text
a = F(18 * float32bits(0x3e1c9c9c))  # bits 0x40303030
t = MAXSS(F(q * a), +0)
DamageReductionScalar = F(F(0.75f / F(t + 1)) + 0.25f)
DurationIncreaseScalar = F(F(t * 0.25f) + 1)
CooldownReductionScalar = F(F(0.5f / F(F(t * float32bits(0x3ea8f5c3)) + 1)) + 0.5f)
```

Extra constants are `0x331c410` → bits `0x3e1c9c9c` (0.15294116735458374), `0x30ca848` → 0.25, `0x30c7634` → 0.5, and `0x3142b24` → bits `0x3ea8f5c3` (0.33000001311302185).

| Registered class | Class getter → constructor thunk → constructor | Bound scalar |
| --- | --- | --- |
| `UDamageReduction` | `0xf1c5f0` → `0xf1d850` → `0xb78730` | `0xb88fa0` |
| `UDurationIncrease` | `0xf1c9e0` → `0xf1d870` → `0xb78a70` | `0xb8a5f0` |
| `UCooldownReduction` | `0xf1d140` → `0xf1d820` → `0xb781c0` | `0xb86b70` |

Constructors bind the scalar address into a function object transferred through `0x4ac810` to object +0x30; this helper is a swap-like transfer. The shared functor's vtable entry `0x3290ff0` points to `0xa7a3a0`, which loads the input float from RDX and tail-jumps to the callback at object +8. Names and constructor callback references establish the family; shared object vtables alone do not.

Specific equipment use, argument origin, base duration/cooldown, stacking and final damage application are not yet established for these three functions. Do not label the first formula as the complete armor/defense formula or the other two as absolute seconds. Attack speed has not been identified in this work unit.

## Meaning and caller evidence

Named `CalculateBaseMagnitude` reflection dispatch calls vtable slot 72 (`+0x240`). Class constructors install the exact vtables that lead to the damage/health overrides. Independent Increase-class constructors also bind these scalar functions as float callbacks.

The shared damage multiplier affects named attributes `MeleeAttackItemPowerFactor`, `RangedAttackItemPowerFactor` and **`ArmorAttackItemPowerFactor`**. The Armor name does not identify damage reduction. Health targets `MaxHealth`. These are Power multipliers, not complete absolute damage or HP calculations.

The equipped-item input path is:

```text
ItemPower field +0x480
  -> load at 0xaea77f, call at 0xaea790
  -> 0x363a40 -> 0x3a0ba0 -> 0x3b8c60 -> 0x3c99e0
  -> store at 0x3c99f1 into spec +0x298
  -> reader 0x3b4ac0
```

Reflection property metadata independently identifies `ItemPower +0x480` and `PowerEffects +0x470` in the same item class. Transport verification executes native slices across an explicitly selected allowed authority/prediction branch; it does not fake successful engine calls. Continuous dispatch from application virtual slot `0x590` at `0x363aff` to a specific modifier override, and the actual equipped Blueprint's `PowerEffects` array contents, remain separate checks.

## Display Power is not enough to recover exact input

The float display helper computes `F(F(max(F(x-1),0)*10)+1)`. The integer helper then uses ADDSS, SUBSS 0.5, CVTSS2SI, SAR 1; it agrees with floor over the tested domain under the chosen MXCSR, not under every possible rounding mode or overflow input.

The inverse helper computes `F(F(F(display-1)*float32(0.1))+1)`, using bits `0x3dcccccd` for 0.1. It is not an exact inverse. For example, internal `10.899999618530273` displays as 100, while inverse(100) is `10.90000057220459`. Several different internal values display as the same integer. Do not silently use integer Power as an exact native input.

## Reproduction and validation already completed

Private scripts in the capture directory:

- `mcd_power_registration_check.py` → `power-registration-bindings.json`.
- `mcd_power_secondary_check.py` → `power-secondary-bindings.json`.
- `power-native-replay.py` → `power-native-isolated-replay.json`.
- `mcd_power_math_independent_review.py` → `power-native-independent-review.json`.
- `verify_display_conversion.py` → `display-conversion-evidence.json`.
- `verify_item_power_input.py` → `item-power-input-evidence.json`.
- `verify_linear_power_scalars.py` → `linear-power-scalars-evidence.json`.
- `mcd_linear_review.py` with `mcd_linear_review.cpp` → `linear-power-independent-review.json`.
- `native-import-checksum-replay.py` → `native-import-checksum.json`.
- `native-import-binding-review.py` → `native-import-binding-independent-review.json` (earlier partial binding; preserve its stated limit).

Use the pinned local Capstone 5.0.6 / Unicorn 2.1.4 packages under `phase6.8/native-stage2/tools`. Inspect each script's CLI before re-running. Preserve earlier evidence rather than overwriting it without recording new hashes.

- Power: 956 normalization inputs, 3,824 direct/wrapper argument checks, 214 **synthetic external-return** suffix checks, all matching a separate exact-rational binary32 model.
- Wrapper: 1,912 cases start XMM0 with different bits and observe the reader's actual return, confirming spec input is loaded.
- Independent math review: separately rounds by nearest binary32 neighbors and exact rational distances; no unresolved findings.
- Display conversions: 3,059 inputs, 9,177 comparisons, no mismatches.
- ItemPower transport: 1,037 raw bit patterns, 3,111 identity comparisons, no mismatches.
- Three additional Power scalars: 1,003 finite inputs / 3,009 complete native function comparisons against exact-rational rounding, no mismatches.
- Independent scalar review: a separate strict-float C++ backend / 278 inputs / 834 comparisons, including NaN, infinities, subnormals, maximum finite float and random bit patterns, no mismatches. This is an independent implementation/backend, not an independent game oracle.

Synthetic suffix checks do not execute the imported math implementation and are not full multiplier-output verification. No host `pow` result has been substituted as native evidence.

## Unpacking breakthrough and reproducibility boundary

The earlier CPU path stalled partly because asynchronous Unicorn timeout/resume can replay a memory-writing instruction. A minimal reproducer observed excess increments; the new runner uses one `emu_start` call and never resumes a timeout snapshot. The exact cause of the historical failed capture remains a hypothesis because its preceding checkpoint was not saved.

`run_continuous_self_file.py --verified-copy` preserves the previous API model and summarizes only a hash-pinned 19-block byte-copy loop. The final native iteration is retained. Twenty-five differential cases compare all general registers, flags, and source/destination/stack memory. Seven saved copy buffers equal their full final mapped destinations byte-for-byte. There is no checksum skip or guessed decompression result.

The successful capture stopped at unmodeled `ws2_32.dll` resolution after recovering code and data. Static analysis and bounded isolated functions now replace further whole-loader emulation. The capture is not a Windows runtime dump or proof that game startup completed.

The first capture lacked the live stack at this boundary. Two diagnostic restorations stopped at an unknown stack read (`0x4e0481c`, stack address `0x703fefe0`); they are not successful continuation evidence. One new uninterrupted run captured all 36 mapped regions, GPR/flags, segment bases and FP/SIMD state at the same synchronous API hook. Its recovered image SHA-256 is identical to the first capture. This checkpoint is in `phase6.8/native-stage2/self-file-experiments/import-checkpoint-20261026-a`, metadata `import-checkpoint.json` SHA-256 `6032850ed65e18ce0ef03fc354f9417e580424a4e0878860cb9cebe93684ec07`. It is a complete emulated-state checkpoint, not Windows memory. Its synthetic initial FP state is not evidence of live-game MXCSR.

## Remaining integration and acceptance work

Remaining integration work: turn these findings and private proof hashes into the repository's accepted evidence metadata format and add focused validation. The current-state README points to this handoff; historical evidence and validators retain their original scope. No Site update is needed for research-only changes.

This change packages the handoff, inventory and recovery tools for review. New recovery-script unit checks pass (19 tests, including existing self-file tests), and the handoff inventory's native spans, constant bits and private file hashes have been checked. Those checks do not constitute Formal acceptance of combat formulas.

Hard acceptance boundaries that must stay visible:

1. The exact external CRT implementation and live-game FP environment are not captured. The native record/hash/module/parser proof supports the `powf` import identity under explicit fixtures; it does not establish bit-for-bit output or export-set collision absence for a specific Windows CRT build.
2. Complete application dispatch, effect coefficient/pre/post/curve processing, base damage/base HP, and specific equipment effect arrays still need build-matched evidence before claiming final combat values.
3. Displayed integer Power cannot determine a unique internal float. Optimizer input/model design must preserve this ambiguity.
4. The local executable's official 1.17.0.0 provenance remains unverified. Do not widen the evidence claim beyond the pinned input hash.

Concrete ways to close those boundaries:

- Exact CRT outputs: obtain the actual loaded math-provider DLL (including any API-set forwarding target), its hash/version and the game's MXCSR, plus input/output bit captures for the identified scalar calls; or execute a hash-pinned equivalent CRT in a separately verified harness. A generic host `pow` is insufficient. No matching CRT file was found in the local game-data file inventory.
- Equipment application: trace the recovered native path from `0x363aff` through the actual effect object/override, and inspect build-matched cooked `PowerEffects` arrays and coefficient/curve fields. A Windows runtime object snapshot would help, but is not a prerequisite for trying static metadata and asset inspection.
- Absolute HP/damage: trace callers and named attribute aggregation beyond the verified scalar, preserving base values, coefficients, pre/post modifiers and operation order. Do not infer these from class names.
- Exact input: use the item's internal float32 bits (or an explicitly bounded set of possible values). Displayed integer Power alone cannot supply them.
- Version provenance: match the executable/pak hash against a trusted 1.17.0.0 installation or authenticated distribution manifest.

Do not repeat the failed sliced-loader approach or transplant old-source addresses/formulas. Do not equate these native findings with Formal acceptance or runtime support.
