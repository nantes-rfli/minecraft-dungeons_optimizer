# Armor common mechanisms — native coverage research

Baseline `6bf212dc5ea8f686f981c9882657874264e41791` (after PR #241). Research only. No runtime, Formal, R3/P3B, PR, merge or Site changes. Native image SHA-256 `04a990ccbc67454505724a28043eccc595f613a0a877ae55386a4fa8656434d3`, image base `0x140000000`. Raw/exe same-build identity and official distribution authenticity remain unverified.

## Current ranked impact

- Damage reduction: 15 currently unsupported catalog Armor entries are affected, plus existing Limited Armor composition boundaries. Generic Gameplay Effect channel arithmetic is already known; complete writers/ordering and the independent P3B raw holdouts remain unresolved. Do not rebrand this shared arithmetic as solved DR composition.
- Hit negation (`MissChance`): 11 unsupported Armor entries. A reusable native discrete cancellation branch and deterministic RNG slice are now identified. Remaining per-item class binding and event eligibility prevent immediate runtime promotion.
- Arrow bundle bonus: 3 catalog entries, all 3 marked obtainable by `research/armor-audit.json`: `hunter-s-armor`, `archer-s-armor`, `guard-s-armor`. Hunter still requires ranged-damage ownership, Archer additionally movement aura, and Guard artifact-cooldown composition boundaries. This mechanism cannot justify “6+ newly calculable Armor.”

New runtime-eligible items from this research: **0**. Affected population is not the number of fully supported items.

## Arrow bundle mechanism

Native class registration `0xf0f130` names `IncreasedArrowBundleSize`; constructor thunk `0xf10e20` jumps to `0x91e510`. Constructor stores integer **5** at `+0x128`, and property descriptor `0x4226678` identifies that offset as `ArrowIncreaseAmount` (IntProperty). The cooked `BP_IncreasedArrowBundleSize` CDO explicitly overrides this value to **10**: `.uexp` `[101,105)` = `0a000000`. This resolves the native-default/catalog-number difference at the class-default level; it does not prove every candidate item instantiates this Blueprint class.

Vtable `0x321c2d0 + 0x2f8` points to lifecycle handler `0x935ee0`. It gets the owner EquipmentComponent (`0xef6530`), selects equipment slot enums **2, 1, 5** through `0x99f0f0`, and registers handler `0x940560` on each selected slot's delegate at `+0x188`. The handler is independently named `OnArrowsPickedUp` by native registration pair `0x3438c40` → exec bridge `0xf13cf0` → `0x940560`.

The handler requires the owner actor's role byte `+0x118 == 3`, builds an item record from the affected slot's equipped item identity (using its virtual `+0x640` and `0xb7f050`), and calls `0xaf13e0` with `R8D=ArrowIncreaseAmount`, `R9B=1`. The native `0xb50870` ammo-add branch adds the requested integer to slot `+0x1fc`, calls refresh `0xb5c8b0`, and emits `+0x188` only if the flag is false. The bonus uses true, suppressing recursive bonus pickup emission on this branch.

The lifecycle handler itself performs registration, not an immediate ammo grant. This is **not** proof that all startup ammo paths exclude the bonus. Startup/pickup emitter provenance, exact meaning of slots 2/1/5, item-to-component binding, and alternate `0xb50870` branches remain open. No per-second bonus or unconditional initial +10 is justified.

The intermediate `0xaf13e0` also updates a stored ammo record when its identity differs and prior record exists. It uses float32 ratio `slot[+0x27c]/slot[+0x280]`, multiplies by requested amount, then `*2 -0.5`, `CVTSS2SI`, `SAR 1`. This state conversion must not be silently replaced by an unconditional integer +10 across differing ammo capacities.

## Hit-negation foundation

Native `MissChance` registration `0xf3c7c0` → thunk `0xf3ca60` → constructor `0x91fad0`; native default chance at `+0x128` is `0.2f`. Cooked `BP_MissChance` CDO overrides `Chance` to bits `0x3e99999a` (`0.30000001192092896`) at `.uexp` `[101,105)`. Vtable `0x321f108 + 0x3c0` selects `0x940860`.

Handler first calls eligibility helper `0x93ecc0`, which checks a union of supplied tags and parent tags against four named tags: `Damage.Aoe`, `Damage.Ranged`, `Damage.Melee`, `Damage.Explosion`. On eligible input it advances a supplied 32-bit RNG state and tests one discrete draw:

```
next = (state * 0x0bb38435 + 0x3619636b) mod 2^32
u = (next & 0x7fffff) / 2^23
if u < Chance: cancellationByte = 1
```

For finite Chance, the inequality is strict (`COMISS; JAE` takes the non-cancel branch). No incoming magnitude multiplication occurs in this slice. Ineligible input returns before advancing RNG. This supports a discrete damage-event model, not a blanket scalar expected DR approximation.

A generic component dispatch `0xc149d3` calls virtual `+0x3c0`; `0x7b0fcc` invokes it with a shared cancellation byte and `0x7b0fd1` checks that byte before proceeding. However the RNG argument origin and the full dispatch's dynamically selected receiver are **not closed** by this static chain. In particular, the inspected caller passes a null fifth argument whereas the MissChance handler dereferences its fifth argument after eligibility; this requires resolving argument/class applicability before asserting a continuously valid end-to-end call. Do not conceal this inconsistency or stub it into successful execution.

## Evidence levels

Static mapped code/metadata and byte-verified cooked defaults are evidence about these pinned files. Bounded emulation, where present in `armor-evidence.json`, verifies only explicit instruction slices with synthetic state. No gameplay observation was obtained. Parent's independent verifier is distinct from implementer checks; neither replaces P3B independent raw holdouts. Unsupported conditions remain unknown.

## Reproduction and bounded replay

`check_armor_raw.mjs REPO_ROOT LOCAL_ROOT` parses only the two existing cooked packages with the repository UE parser, verifies native parent imports and raw numeric bytes, and emits compact bindings in `armor-raw-bindings.json`. Both Blueprint class parents explicitly resolve to `/Script/Dungeons` and the matching native class. This establishes class inheritance and the overriding CDO values.

```
python3 -B check_armor_coverage.py --local-root /path/to/local-game-data --replay --output /tmp/armor-replay.json
node check_armor_raw.mjs /path/to/repository /path/to/local-game-data
python3 -B -m unittest discover -s . -p test_armor_coverage.py
```

Native replay completed **1,068 RNG/strict-threshold cases**, **216 ammo-history conversion cases**, and **4 recursion-flag branches**, with **zero mismatches**. The RNG controls include chosen next-state lower bits directly below and above the cooked 0.3f threshold. These are isolated instruction slices with explicit synthetic state and MXCSR=0x1f80. No import or engine function is stubbed into success; each slice stops before the next external call. Every run is one synchronous `emu_start`, with instruction count 100 and no timeout-resume.

Priority recommendation: complete item-to-component configuration binding and pickup/startup emitter ownership for Arrow first because its mechanics are narrow. MissChance provides the larger affected population (11), but the unresolved dispatch/RNG applicability makes it a second native work unit, not immediate runtime adoption. Defense composition remains the broadest affected class, but its writer inventory and independent raw holdouts are a separate, larger evidence task.

## Foundation readiness and minimum next work

**READY as conditional native foundations:** cooked native-class overrides (Arrow 10, MissChance 0.3f); bonus-recursion flag behavior; stored-ammo capacity conversion; seeded RNG update and strict cancellation threshold. “READY” means reusable bounded research evidence, **not R3 approval, complete item behavior, or Runtime Promotion**.

**PARTIAL:** complete Arrow resource semantics (item binding, startup/pickup event origin, slot enum identities, alternate ammo routing); complete MissChance event semantics (per-item binding, valid RNG argument and dynamic receiver). **HELD:** damage-reduction composition and its existing independent raw evidence gates.

The smallest next questions are recorded individually in `armor-evidence.json/minimalQuestions`. The immediate priority is static item/property registry binding followed by pickup/startup emitter tracing. Neither requires repeating the whole loader or requesting a new Windows/gameplay session. A future item count must still account for all other intrinsic effects and explicit promotion approval; this report claims zero newly eligible runtime items.
