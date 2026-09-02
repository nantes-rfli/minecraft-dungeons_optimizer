# Armor model — Phase 2-3B

The runtime catalog contains Battle Robe, Renegade Armor, and Wither Armor. Each is Limited, requires direct card `observedHealthBonus`, and models every major intrinsic property inside explicit combination boundaries.

## Owned state

An `OwnedArmor` contains identity, Power, observed Health, actual normal-slot candidate rolls with their Tier, an optional locked roll, a fixed gilded roll, and future variable intrinsic rolls. `SelectedArmorEnchantment` records `slot`, `gilded`, or `built-in`; the optimizer never changes a roll's Tier.

`Inventory.armors?`, `Build.armor?`, and `Build.armorEnchantments?` preserve old JSON and Armor-less builds. Storage treats omitted Armor as an empty legacy route. Research-only IDs remain representable at the input boundary so they can be rejected with an explicit reason rather than silently discarded.

## Runtime state

`ArmorState` owns resolved card Health, direct-melee multiplier, cadence bonus, Armor DR, Soul multiplier, Life Steal eligibility, selected Enchants, and source-separated Artifact cooldown state. Downstream mechanics receive `resolvedMaxHealth`; they do not read Armor Health independently.

Artifact cooldown sources are external Scenario, Armor intrinsic, and Armor Enchant. Phase 2-3B supports one active source at a time. Defense similarly permits 35% Armor DR or Potion Barrier alone; interaction with Iron Hide, Guarding Strike, Weakening, and Protection remains unsupported.

Damage bonuses affect direct melee only. Renegade speed enters attack cadence rather than multiplying final DPS. Wither Soul Gathering multiplies existing resource units without changing pickup events, and its Life Steal matrix credits direct melee while excluding indirect channels.

## Optimizer policy

The search is `weapon × owned Armor × actual Armor slot choices × artifacts`. It never creates the theoretical 41-Enchantment cross-product. Every free slot alternative must be supported; a locked supported choice is evaluable even if another visible alternative is research-only. Gilded and built-in effects are fixed and cannot be ignored.

See [runtime batch](armor-runtime-batch.md), [Health](armor-health-model.md), and [support manifest](armor-runtime-support.md).
