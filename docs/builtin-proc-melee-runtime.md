# Fixed built-in melee procs — finite two-weapon reuse

Baseline: main `ab4450f110346ff8125bc2312c48742bca036be0` after PR #228. This foundation connects Whirlwind and Stormlander to existing direct-melee and proc calculations. Gear runtime increases from 9/82 to 11/82 (Full4 / Limited7). New numeric formulas, Native parameters, independent DPS samples and R3/P3B promotions: 0.

| Target | Exact Raw identity | Own Power / Speed / Area | Published hit seconds | Mandatory effect | Proc Power range |
| --- | --- | --- | --- | --- | --- |
| Whirlwind | DoubleAxe_Unique1 | 8.686 / 2.057 / 12.927 | 0.6, 0.6 | Shockwave I | 210–252 |
| Stormlander | Hammer_Unique1 | 8.686 / 1 / 7.762 | 0.7 | Thundering I | 248–263 |

## Source reconciliation and Identity

The [source snapshot](../research/sources/builtin-proc-melee-source-snapshot.json) binds exact target-owned calculator rows from HTML SHA-256 `47a271870eb588957d71b011b7bcac03164f14f110a16461ebed223f40e4bce1`. Their explicit `builtIn` arrays name Shockwave and Thundering. Tier I comes separately from existing target-specific Wiki-backed records in the DamageEvent audit.

An older enchantment-page `BUILT INTO 0` observation was an aggregate display, not a typed assertion that either target lacks the effect. The current target-specific positive arrays resolve ownership for these two tuples. The old counter is not reinterpreted as a missing-link bug or a gameplay zero, and no general rule assigns Tier I to every Unique item.

The [localization sidecar](../research/sources/builtin-proc-melee-localization-identity.json) binds the exact `ItemType` keys to Whirlwind and Stormlander through the already reviewed English resource and strict full-structure reader. Both Raw identity fields and the scoped package must match Unique1. Unique2 icon/presentation candidates are not Identity evidence. The old Great Hammer declaration and all prior153 Formal assertions, semantic records and provenance remain unchanged; new2 append only. Private bytes, payload hex and the localization corpus are not committed.

The [runtime ledger](../research/runtime/builtin-proc-melee-reuse.json) is finite. Source/identity/row/profile/intrinsic/Tier/range drift rejects the weapon. Required fixed tuples do not disappear when eligibility is withdrawn; the item becomes unsupported instead of becoming a plain weapon.

## Calculation and legality

Both published profiles have equal hit ratios. Direct damage uses each target's own exact rating with existing Model G or its neutral direct-hit observation. Speed and Area ratings remain metadata. Exactly one target and base cadence are required; no splash geometry, extra targets or effective speed scaling are inferred. Whirlwind retains Spin attack/Casts shockwaves; Stormlander retains Great splash/Fires lighting bolts as published facts.

The existing Shockwave curve and combo-finisher trigger apply once per 1.2-second combo. Existing Thundering uses its 30% direct-hit roll, giving base expected proc rate `0.3 / 0.7`. These are expected continuous-contact models with existing attribution, target and accuracy limitations, not a new discrete simulator. Proc damage remains indirect and retains existing direct-kill/healing treatment.

The proc's absolute Power curve must be supported even when direct observed damage is supplied. Direct observation cannot estimate missing proc damage or extend either range. Source confidence/Estimated policy and independent-error pending states are unchanged.

Optimizer candidates include exactly one fixed Tier I tuple after actual slot/Gilded choices. Public evaluation rejects missing, false-source, wrong-Tier, extra or duplicate fixed effects; other weapons cannot acquire a forged built-in source. Same-ID slot or Gilded copies violate the existing maxCopies1. Other unsupported Enchant/Power/composition rules still apply.

These two source paths additionally reject Void Strike, attack-speed effects, Pain Cycle/Dynamo and multiple targets. Historical selectable Shockwave/Thundering plus Void keeps its existing declared Limited assumptions; that uncertain interaction is not extended into the new fixed path. Ranged interactions remain excluded by existing rules.

## Contribution and Inventory

Actual candidates cannot remove their fixed effect. After validating the real baseline, the private contribution calculation may remove a known effect hypothetically to compute its numerical contribution. It does not reinsert the effect, report a false zero or register the hypothetical build as legal. Built-in ownership is visible in the recommended build and contribution row. Legacy output objects retain their shape.

Finite Catalog migration supports versions1–6 and preserves IDs, Power, rarity, favorite, notes, slots, Tier, Gilded and Research. It does not invent observed damage. Recorded built-in provenance must match the fixed tuple and is not injected twice; incompatible slot/fixed/intrinsic records remain unsupported. All previous nine weapons and five plain source/grant records remain preserved.

Other uniform-hit built-ins lack target-bound Tier/ownership or additional supported semantics; Rampaging also needs speed behavior, Prospector utility is not modeled, Gravity's built-in path remains excluded, and Jungle Poison is not Poison Cloud. Sheer Daggers has conflicting hit-count/timing evidence. Those populations are not widened by this grant.

Validation covers source withdrawal, Unique1/Unique2 substitution, fixed ownership/copy/Tier, range endpoints and out-of-range observed input, unsupported composition, nonzero fixed contribution, historical records, old153 preservation and unchanged old routes. Browser fixtures follow both migrated items through one-target optimization, fixed-effect display, per-item comparison and reload. Fixtures are software data, not gameplay measurements. Exact-head Full Validate and independent merge review are recorded in the PR.
