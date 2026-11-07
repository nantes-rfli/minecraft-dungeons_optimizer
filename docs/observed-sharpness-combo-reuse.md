# Diamond Sword with observed Sharpness I

Diamond Sword is Limited for sustained complete combos against one target at base cadence. The [target source](../research/sources/observed-sharpness-combo-source.json) verifies the exact calculator row, Sharpness I ownership, the English `ItemType/Sword_Unique1` key and both serialized identifiers. The own attack list agrees with the published 0.40 / 0.40 / 0.242 s sequence. The corresponding Raw configured damage vector is 50 / 50 / 80. The runtime obtains damage from the equipped item's observed combo total.

## Inclusive observation

Enter one ordinary complete combo against a single unenchanted, non-undead target without damage reduction, external buffs or activated slot effects. Record the hit total as displayed with the equipped weapon's own Sharpness I included. The current Power must match the observation. The [reuse grant](../research/runtime/observed-sharpness-combo-reuse.json) binds the already-included fixed +10% modifier and the established single-target scope.

The model divides the inclusive total by the hit count and the existing Tier I factor before applying that factor once through the existing direct-damage model. With only the fixed effect active, modeled DPS equals the entered total divided by 1.042 s. Other supported effects can use the same model. The Sharpness contribution is the model's difference with the fixed factor removed, derived from the rounded observed total. It is not a separate measurement.

The fixed tuple is required once. A matching slot or Gilded copy, stale observation, unsupported scope or extra intrinsic effect is excluded. Existing Catalog migration, ownership display, equipment score and per-condition comparison use the same observed combo foundation. This takes Melee gear from 26/82 to 27/82 and leaves P3B eligibility at 0.
