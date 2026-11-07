# Observed melee combos with a fixed Tier I damage effect

Five weapons can reuse the complete-combo observation model and the existing Critical Hit or Smiting calculation. All require continuous contact with one target at base cadence. Their owned effects appear in the equipment detail, optimized build and contribution view. Melee gear coverage increases from 21/82 to 26/82, with 4 Full and 22 Limited.

| Target | Raw identity | Own published hit times (s) | Fixed effect |
| --- | --- | --- | --- |
| Cackling Broom | Glaive_Spooky2 | 0.50 / 0.60 / 1.00 | Smiting I |
| Dark Katana | Katana_Unique2 | 0.48 / 0.48 / 0.60 | Smiting I |
| Grave Bane | Glaive_Unique1 | 0.50 / 0.60 / 1.00 | Smiting I |
| Hawkbrand | Sword_Unique2 | 0.40 / 0.40 / 0.242 | Critical Hit I |
| Sinister Sword | Sword_Spooky1 | 0.40 / 0.40 / 0.242 | Critical Hit I |

The [target sources](../research/sources/fixed-observed-melee-combo-source.json) contain the exact calculator row for each weapon, its complete published intrinsic list, and the source identifying the Tier. Smiting Tier I supplies the existing +25% modifier against undead. Critical Hit Tier I uses the existing 10% chance of triple damage. The held weapons' effects are separate.

Four exact English `ItemType` localization entries resolve the Raw identity of Cackling Broom, Dark Katana, Grave Bane and Hawkbrand. The committed accepted Identity already resolves Sinister Sword. Each target's own CDO contains both serialized identifiers and the complete ordered set of three direct attacks. The audit replays the linked Raw shards, matching each configured hit value and time to the target's published table with float32 precision, and verifies one loop and no separately configured variant effect for each hit. Configured damage stays in that comparison. The [Limited reuse grant](../research/runtime/fixed-observed-melee-combo-reuse.json) binds each target to one fixed effect.

## Inventory and optimizer

Record one full combo of ordinary non-critical hits against a single non-undead, unenchanted target without damage reduction or external bonuses. Record the total at the equipped item's current Power. The Optimizer applies the target's fixed effect to this neutral observation, using the scenario's undead share for Smiting and the expected critical multiplier for Critical Hit. A matching rolled or gilded copy is excluded. Existing compatible slot effects, non-speed Armor and non-speed Artifacts retain their original restrictions.

Existing Catalog copies migrate with their metadata, actual rolls and Research. A known fixed tuple from Research reconciles with the mandatory effect. The observation stays missing until entered, and mismatched Power or extra intrinsic effects exclude the item. Positive and negative tests cover exact ownership, both conditional outcomes, comparison, migrations and source drift. The browser test verifies one visible fixed effect and per-condition scoring.

Master's Katana is held because its second published hit is 0.48 s while its Raw configured value is 0.60 s. Diamond Sword requires a separate boundary for the always-on Sharpness already present in an observed hit. Sun's Grace requires a separate healing observation decision. Broadsword and Frost Slayer also have a distinct pushback property. The observed damage model and R3/P3B adoption gates are unchanged.
