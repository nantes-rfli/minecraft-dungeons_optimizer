# Observed complete melee combos

The single-target, base-speed comparison accepts the ten normal weapons below from main baseline `60deec90e1f1ffb5eff6d67673b958e9e2565256`. This takes Melee gear from 11/82 to 21/82 (Full 4, Limited 17). The [source snapshot](../research/sources/observed-melee-combo-source.json) and [reuse ledger](../research/runtime/observed-melee-combo-reuse.json) record each target and the shared scope.

| Weapon | Raw identity | Hits per complete combo | Published base-speed cycle (s) |
| --- | --- | ---: | ---: |
| Battlestaff | Battlestaff | 10 | 4.65 |
| Coral Blade | CoralBlade | 3 | 0.9 |
| Gauntlets | Gauntlets | 7 | 1.6 |
| Glaive | Glaive | 3 | 2.1 |
| Katana | Katana | 3 | 1.56 |
| Mace | Mace | 3 | 1.65 |
| Obsidian Claymore | ObsidianClaymore | 2 | 1.9 |
| Rapier | Rapier | 14 | 2.51 |
| Sickles | Sickles | 6 | 1.7 |
| Spear | Spear | 3 | 1.25 |

The matched Formal identities bind both serialized identifiers and their own CDO packages. Each target's published hit count, timing, and ordered base-damage vector agree with its Formal configured attacks, including serialized float32 rounding and one loop per attack. Configured damage stays in the source check. The exact calculator rows identify the normal variant and its empty built-in list. The published intrinsic facts describe the complete direct combo or reach within this scope. Katana and Mace use their own detail pages to cover a gap in the historical harvest. Reach has no numerical benefit in the continuous-contact single-target condition.

## Inventory and comparison

Enter the sum of damage from all hits in one uninterrupted combo against a single neutral target with no buffs or enchants, using the exact individual and Power on 1.17.0.0. The app divides by the hit count to provide an average to the existing direct-hit model. At base cadence the resulting unmodified DPS is the observed total divided by the published complete cycle. The result is a sustained rate. The model does not simulate partial combos, stagger, movement, overkill, or individual hit timestamps. No card-range midpoint, rating conversion, or Power curve supplies missing damage.

Critical Hit, Sharpness, Unchanting and Smiting reuse the existing per-hit expectation or direct multiplier. Radiance reuses the existing hit-rate trigger. Direct melee Armor modifiers and compatible non-speed Artifacts remain usable within their existing boundaries. Cowardice, ranged time sharing, multi-target evaluation, speed modifiers, and effects requiring hit order, finisher damage or precise kill triggers are excluded. Observed and Power-estimated melee damage keep their existing comparison-scale constraint.

Historical Catalog items migrate with their original individual ID, Power, recorded Enchantments, notes and Research. Missing observations stay pending. A Power edit in the Inventory editor clears the old combo total. Existing fixed ownership and unsupported Research checks still apply. Per-item and per-condition scores come from evaluated builds containing the individual item.

## Exclusions and validation

Axe is held because the first two configured damages are 65 while the published table gives 60. Sword lacks matched serialized identity. Boneclub and Claymore have distinct pushback properties outside this contact-only grant. Other variants with fixed or extra effects, partial combos, or conflicting source records remain outside this foundation.

This is a bounded extension of existing Limited direct melee arithmetic. Product tests use synthetic totals. Independent gameplay DPS evidence and R3/P3B status are unchanged. CI and independent review are recorded on the PR.
