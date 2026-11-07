# Plain melee — bounded single-target runtime reuse

The original expansion from main `f1aff4684384c2235e75c6b76d6ed688b5243e6a` added Cutlass, Pickaxe, Soul Knife and Whip. The [Great Hammer follow-up](great-hammer-runtime-reuse.md) from main `e637d939edc760b6d1e3a12226ad165e77f8a25d` closes its exact localization-backed Identity bridge and reuses the same direct-melee calculation/comparison/recommendation model. At PR #229, gear runtime reached 11/82: historical four retain Full support within the optimizer scope; five plain additions and two separately reviewed [fixed-proc targets](builtin-proc-melee-runtime.md) are Limited. This plain foundation remains exactly five targets.

| Target | Matched Raw identity | Exact public Power / Speed / Area | Published hit seconds | Base Souls |
| --- | --- | --- | --- | --- |
| Cutlass | Cutlass | 6.473 / 3.944 / 4.576 | 0.4, 0.4 | 0 |
| Pickaxe | Pickaxe | 11.343 / 1.518 / 2.386 | 0.7 | 0 |
| Soul Knife | SoulKnife | 12.229 / 1 / 3.189 | 0.85 | 1 |
| Whip | Whip | 8.686 / 1.113 / 1 | 0.8 | 0 |
| Great Hammer | Hammer | 8.686 / 1 / 7.762 | 0.7 | 0 |

The [factual snapshot](../research/sources/plain-melee-source-snapshot.json) retains each target's exact calculator row, acquisition/source hash, detail scope and timing references. Rounded ratings are not substituted. Formal Identity provides the canonical-to-Raw bridge; configured Raw damage/animation fields are not effective damage/cadence inputs. Published profiles have uniform hit damage and complete hit sequences. Source-bound [grants](../research/runtime/plain-melee-reuse.json) require matching identity/version/value/profile/intrinsic/built-in/Soul/channel/scope and exclusions; drift fails closed.

Reliable Combo, thrust/single-target attack, longer reach and Great splash are bounded by an explicit one-target scenario. The normal variants have no built-in Enchantments in the reviewed scope; unique effects are not inherited. Pickaxe's old harvest taxonomy unknown is not evidence of an empty effect set: its own detail review and calculator list must ground the bounded plain-hit interpretation. Soul Knife uses its own +1 Gathering, not Eternal Knife's Soul Siphon or Truthseeker's Committed. Great Hammer uses its own exact public row, not Whip's coincidentally equal Power rating, and does not inherit Gravity/Thundering from unique variants.

## Calculation boundary

- `averageTargetsInReach` must equal 1; other values are rejected, never clamped. No cleave/splash geometry, reach-based safety, knockback utility or additional targets are inferred.
- Base cadence is published hit count / summed hit seconds. Speed rating is metadata. Mushroom, Rampaging and Armor attack-speed composition remain unsupported for the additions because their per-family scaling is unknown.
- Explicit neutral observed hit damage overrides Power calculation. Otherwise the existing [Model G](power-scaling.md) uses the target's exact rating and the existing Anchor curve. Power 50–263, no extrapolation, observed override and mixed-scale rejection remain; no new Power equation/calibration is added.
- Compatible existing Enchantment formulas consume each target's own hit/finisher sequence. Pain Cycle/Dynamo retain the historical four-weapon allowlist. All existing copy/Power/Evidence/partner/Armor/Ranged exclusions remain. Soul Knife with Ranged is rejected like Soul Scythe.
- Numeric Evidence is explicitly source-bound Derived, not Measured/Verified or R3 adoption. Independent DPS/error samples remain pending. Synthetic fixtures are not gameplay observations.

## Inventory and use

Register a normal variant with actual slot choices/Tiers/Gilded, choose a one-target scenario and compatible Artifacts/Armor. Compare with historical weapons under the same scenario and damage-scale policy, including assessments across saved conditions. Unsupported conditions remain exclusions, not losing scores.

Historical Catalog entries for all five additions migrate losslessly into the melee collection: instance ID, Power, rarity, favorites, notes, actual candidates/selections/Tiers/Gilded and Research survive export/reload. Missing damage/rolls are not inferred. Research effect records must reconcile with selected slot/Tier/copy and fixed-effect ownership before evaluation; unknown built-in/intrinsic effects block it. Research observations remain inert. Unrelated Catalog items and duplicate-ID rejection are preserved.

## Coverage and verification

Attack-profile readiness remains 76/82 fixed profiles and keeps its separate coverage meaning; it is not 76 calculable weapons. The two separately bound fixed-proc targets brought gear runtime to 11/82. The later [observed complete-combo grant](observed-melee-combo-reuse.md) brings it to 21/82. Melee Enchantment support, Armor 13/73, Ranged 7/71, Artifact 3/45 and R3/P3B candidate1/eligible0/promoted0 are unchanged.

Great Hammer's exact `ItemType / Hammer → Great Hammer` localization record supplies an independent bridge to the two serialized Raw `Hammer` identity fields; an icon alias is not evidence. Whirlwind/Stormlander now have a separate finite fixed built-in foundation; other built-in/unique variants still require their own ownership/Tier and interaction review. Jungle Poison is not Poison Cloud. Unequal-hit and special combo families are outside this foundation, not approximated by ignoring effects.

Regressions cover evaluation/optimization, source/value/intrinsic drift, single-target/speed/charge/Soul/Ranged boundaries, Power/mixed-scale rejection, pending error samples, historical results and Inventory migration. Full Validate and independent review must refer to the final PR head; their live records belong in the PR.
