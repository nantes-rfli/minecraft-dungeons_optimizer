# Elite Power Bow and Phantom Bow with observed fixed Power I

This Work Unit extends the existing Limited normal-arrow model from 7/71 to 9/71 weapons and from 11 to 15 weapon/mode pairs. The only eligible Power I variants are Elite Power Bow and Phantom Bow. Master's Bow also directs pets and remains Research-only. Sabrewing owns Radiance Shot, a separate healing mechanic.

## Identity and projectile scope

The [target source review](../research/sources/observed-fixed-power-bows.json) records the separate English `ItemType` entries and the exact Raw instance, gear actor and projectile packages. Elite's two serialized NameProperty fields contain `Powerbow_Unique1`. Its package key and exact Locres entry spell `PowerBow_Unique1`, matching the target's published internal identifier. This bridge records both spellings explicitly and checks the exact package, exact keys, unique Locres row and catalog category. Phantom's exact key and both serialized IDs are `PowerBow_Spooky2`. The Formal resolver's exact Raw equality remains unchanged.

Each instance declares one normal projectile with no configured extra delay, spread or separate charged projectile definition. The instance and projectile superclass chains lead to the existing Limited Power Bow path. The only own projectile functions are Elite's complete `ToggleCharged` forwarding to `BP_PlayerPowerBowArrow_C`; Phantom adds no functions. Movement and impact components retain inherited templates with empty own properties. The reviewed inheritable overrides are particle/audio only. This scope covers the known serialized component properties and complete own function exports. It leaves opaque metadata and effective Native damage, timing and resource cost outside runtime authority.

The target sources list the built-in Power I and the inherited charged property. The existing ranged Power definition provides +10%. Each mode uses its own recorded hit, including the existing Strong Charged Attacks effect in the full-charge hit. It also requires its own complete cycle and observed one-arrow cost, even at zero ammo stock. Source and donor grants must both match the requested mode. No configurable cadence, coefficient or Power curve supplies an effective gameplay number.

## Inventory and scoring

Record one normal hit at the current equipped Power in 1.17.0.0. Keep fixed Power I and the intrinsic charge effect for the chosen mode, with other Enchants, armor effects, buffs and target damage reduction excluded. A Power edit clears the stored observation. Changing modes clears the mode-owned draft fields and retains available stock until explicit Apply. Historical Catalog ownership and notes migrate, with observations left missing.

The actual candidate includes fixed Power I once. Duplicate slot and Gilded copies are excluded. DPS applies the existing ranged modifier model divided by the included `1.1` to the observed projectile damage. With fixed Power alone the multiplier relative to the observation is exactly one. The reported leave-one-out Power contribution models `observedDamage / 1.1` from the rounded input, with all other legal effects held constant. Independent selectable Critical Hit and Unchanting stay within the existing ranged model assumptions. The two variants participate in Inventory readiness, Optimize, equipment scores and condition comparisons using the same ranged coexistence constraints.

The target [Limited reuse grant](../research/runtime/observed-fixed-power-bow-reuse.json) adds no new promotion or independent gameplay verification. Formal Value/Relation remain on their existing populations. Wind Bow's distinct impact path, non-ordinary arrows, additional target/projectile interactions and unavailable target observations stay outside this scope.
