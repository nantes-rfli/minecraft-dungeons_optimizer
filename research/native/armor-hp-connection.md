# Native Power → Armor maximum health connection

Status: **held, research only; new calculable equipment: none**. Baseline is
`0990f9731dba5ab668cbaf97a1b5da0fcb366bda` (main after PR #217, fetched
2026-10-28). This bounded study does not change Game Domain, AdoptionDecision,
Runtime Promotion, support classification, Optimizer results, or Site output.

## Target selection

| Criterion | A: Melee neutral one-hit damage | B: Armor maximum health |
| --- | --- | --- |
| Existing evidence | Native damage scalar; Formal configured attack values for 31 Melee domains. Sword Raw damage is 50 / 50 / 80. | Native health scalar and named MaxHealth effect; Mercenary Armor has matched Formal Identity and a direct native superclass. |
| Missing connection | Select attack/target vs splash branch, effective damage coefficient, Power factor use, outgoing/incoming modifiers and final hit generation. Speed/DPS would not be required. | Resolve native PowerEffects defaults, effective player base MaxHealth, modifier dispatch and attribute aggregation. |
| Independent checks possible now | Native bytes + Raw attacks; no independent final-hit oracle with exact internal Power. | Native bytes + Raw inheritance; no independent final-HP oracle with exact internal Power. |
| Potential reach | Shared Melee Power path, subject to per-attack proof. No equipment is automatically covered. | Shared ArmorGearItemInstance defaults; no per-hit variant or target channel. No equipment is automatically covered. |
| Remaining work | More attack-specific stages beyond the shared multiplier. | Narrower attribute target and a short constructor path to inspect first. |

Choose **B**, represented by Mercenary Armor. This chooses a smaller calculation
boundary, not a claim that HP is already calculable. Do not treat the 31 Melee
Formal values, or the Armor catalog population, as effective-behavior coverage.

## New build-pinned observations

The [metadata](armor-hp-connection.json) and
[checker](scripts/check_armor_hp_connection.py) pin 19 recovered code spans,
39 decoded instruction assertions, 8 RIP-relative registration/vtable bindings,
class names and metadata pointers. These are **static checks**, not a continuous
native execution trace. The original image, exe and Raw source bytes were checked
locally; none is committed.

1. `ArmorGearItemInstance` registration `0xea3cd0` binds constructor thunk
   `0xea3e50`, which branches to `0xad8000`. After calling `AItemInstance`'s
   constructor, the armor constructor requests `MaxHealthIncrease` (`0xf1c730`)
   and `ArmorDamageIncrease` (`0xf1c7e0`) in that order. It sets count at `+0x478`
   to 2, sizes the array through `0x38cb80`, then copies both returned class
   pointers into the allocation at `+0x470`. PR #217 independently identified
   `PowerEffects +0x470` and `ItemPower +0x480` via reflection metadata.
2. The armor constructor installs vtable `0x32c2a00`; slot `+0x678` targets
   `0xaea3a0`. That override calls shared `0xaea5a0` **before** its separate
   armor-property work. The shared loop reads PowerEffects data/count,
   resolves class default objects, checks the effect class, loads the effect
   object's `+0x28` gameplay-effect class and ItemPower `+0x480`, and calls
   `0x363a40`. It advances by 8 bytes per effect.
3. Application is conditional: item byte `+0x118` must equal 3; owner ability
   lookup must succeed; the gameplay-effect class must pass native class checks.
   `0x363a40` has an additional authority/prediction gate. Byte value 3 is
   recorded as a native comparison, not independently adopted as an enum name.
   Actual role, owner, engine object state and array contents on a live equipped
   Blueprint were not observed.
4. Existing #217 bindings connect MaxHealthIncrease to the health gameplay
   effect, `MaxHealth`, calculation class and `0xb94940`. The health effect
   constructor `0x7a1430` adds a modifier with operation byte 1 and magnitude
   kind byte 2, using `ItemPowerHealthModCalculation`. Their gameplay semantics
   are not adopted from names or enum guesses.
5. The common magnitude constructor `0x400bf0` initializes the custom calculation
   storage with coefficient 1, pre-add 0, post-add 0 and a null final-curve
   pointer. The health constructor selects the custom class and copies its
   temporary storage through `0x7aa750`, `0x796c70` and `0x7968c0`. These are
   constructor defaults, **not proven effective values after object loading**.
6. Generic custom-magnitude branch `0x3a9f06` calls `0x4083f0`, then evaluates
   scalable values at ItemPower via `0x3b55f0`. Its arithmetic is
   `F(post + F(coefficient * F(pre + calculationReturn)))`, followed by an
   optional final lookup curve. `F` denotes each scalar SSE binary32 operation
   under the FP environment actually in force. A missing scalable curve returns
   its stored scalar. No host pow, reassociation, or bit-exact output is inferred.
7. HealthAttributeSet registration `0xf05130` binds `0xf06a50`. Its property
   table identifies `MaxHealth +0x38`; the constructor writes float bits
   `0x43fa0000` (500) there. **500 is a constructor default, not the established
   player base HP**. Player initialization, equipment and attribute effects may
   replace it. No `500 * health_multiplier` calculation is admitted.

## Raw → Identity → native boundary

Reuse Raw shard `part-010`, package 28 and its existing package/file hashes.
`Default__BP_MercenaryArmorInstance_C` serializes `ItemIdName=MercenaryArmor`,
`ItemId.SerializedId=MercenaryArmor`, GearActor, InventoryDropSound and
RootComponent. The existing Formal record `identity:mercenary-armor@1` is matched.
The class's serialized super is `/Script/Dungeons.ArmorGearItemInstance`.

Neither ItemPower nor PowerEffects is serialized in that CDO. This means **no
serialized override was observed**, not PowerEffects=[], ItemPower=0, or proof of
an instantiated effect array. No armor-specific HP coefficient/curve was decoded.
The native constructor supplies a concrete default candidate that replaces the
previously unspecified native boundary. Raw and exe share a version label; their
same-build identity and official distribution provenance remain unverified.

## Exact stopping point and next minimal Work Unit

Static inspection has reached the following explicit join, not closed it:

```text
Mercenary Raw super → native Armor constructor → default PowerEffects classes
 → conditional shared effect loop → spec ItemPower transport (#217)
 → apply virtual +0x590 (base AbilitySystemComponent vtable → 0x362ce0)
 ... engine objects / active-effect handling / custom reflection dispatch ...
 → MaxHealth modifier aggregation → effective player maximum HP (unknown)
```

`0x362ce0` rechecks authority/prediction, validates modifiers and may construct or
reuse an active effect. The inspected base vtable does not establish the actual
owner component's override. The custom path reaches a ProcessEvent-style virtual
call in `0x4083f0`; #217's separately proven CalculateBaseMagnitude reflection
bridge/slot `+0x240` is not a continuous trace from this equipped item. Native
coefficient/default identification alone does not close these engine joins.

**Next minimal Work Unit:** resolve the actual owner component class/vtable and
one health effect's dispatch from `0x363aff` through active-effect handling to
MaxHealth aggregation, including effective base initialization, operation-byte
meaning, pre/post/curve values and rounding order. Start from existing recovered
image, reflection registrations and the Mercenary CDO; use one bounded static
call graph plus isolated checks. If engine state is indispensable, acquire only
the necessary component/CDO/spec/attribute snapshot, with exact ItemPower bits.
Do not repeat loader recovery, widen the search to unrelated mechanics, or build
an engine/toolchain. Stop at the first required unresolved engine dependency and
record its exact field/call, rather than fabricate successful engine calls.

Independent remaining acceptance blockers:

- Actual math-provider DLL/API-set target/hash and output-bit checks; live-game
  MXCSR is unknown. A generic host pow or synthetic return is not a CRT oracle.
- Exact internal float32 ItemPower from item/save/object state. Display integer
  Power has multiple internal preimages; the inverse helper is not exact.
  A future bounded-range result must preserve that range and its FP assumptions;
  it still cannot fix unknown base/aggregation/CRT behavior here.
- Trusted installation or authenticated manifest matching exe and pak hashes.
- Semantic/version/conflict/independence checks and R3 accepted decision, then
  independent Product regression and the five-artifact New Mechanic Promotion
  bundle. Existing Limited reuse does not authorize this new HP formula.

No independent game measurement or final-value calculation was obtained. No
AdoptionDecision was submitted; no runtime candidate or support was added.
The search stopped after the armor constructor, shared effect loop, health
modifier/default constructors, generic magnitude branch and application prefix;
we did not run loader emulation or make unbounded engine-call searches.

## Reproduction

```sh
python3 -B research/native/scripts/check_armor_hp_connection.py
python3 -B -m unittest discover -s research/native/scripts -p 'test_armor_hp_connection.py'
python3 -B research/native/scripts/check_armor_hp_connection.py \
  --local-root /path/to/local-game-data
```

The first two commands require only repository data. They validate source
references, public hashes, claim boundaries and rejection behavior; they do not
re-verify native bytes without private inputs. The last command requires the
original hash-matched capture, exe, two saved copy-source buffers, Raw files and
pinned Capstone 5.0.6. It performs static checks only, so no Unicorn worker is
started. #217's external watchdog and timeout/no-resume policy are unchanged.
Independent implementation agreement remains distinct from live-game evidence.
