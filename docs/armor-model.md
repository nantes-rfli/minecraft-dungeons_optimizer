# Armor model — Phase 2-3C

The runtime catalog contains Battle Robe, Renegade Armor, Wither Armor, Mercenary Armor, Grim Armor, Scale Mail, and Spider Armor. Each is Limited, requires direct card `observedHealthBonus`, and models every major intrinsic property inside explicit combination boundaries.

## Owned state

An `OwnedArmor` contains identity, Power, observed Health, actual normal-slot candidate rolls with their Tier, an optional locked roll, a fixed gilded roll, and future variable intrinsic rolls. `SelectedArmorEnchantment` records `slot`, `gilded`, or `built-in`; the optimizer never changes a roll's Tier.

`Inventory.armors?`, `Build.armor?`, and `Build.armorEnchantments?` preserve old JSON and Armor-less builds. Storage treats omitted Armor as an empty legacy route. Research-only IDs remain representable at the input boundary so they can be rejected with an explicit reason rather than silently discarded.

## Runtime state

`ArmorState` owns resolved card Health, separate direct-melee and self weapon-aura multipliers, cadence bonus, Armor DR, Soul multiplier, Life Steal eligibility, selected Enchants, and source-separated Artifact cooldown state. Downstream mechanics receive `resolvedMaxHealth`; they do not read Armor Health independently.

Artifact cooldown sources are external Scenario, Armor intrinsic, and Armor Enchant. Phase 2-3C still supports one active source at a time because the audited CDR formulas do not reproduce both published anchors. Defense permits one modeled DR family: Armor DR, Potion Barrier, or Protection alone. Protection with Iron Hide, Guarding Strike, or Weakening is also rejected.

Damage bonuses affect direct melee only. Renegade and Spider speed enter attack cadence rather than multiplying final DPS. Wither and Grim Soul Gathering multiply existing resource units without changing pickup events. Wither, Grim, and Spider Life Steal credit direct melee while excluding indirect channels.

Health Synergy consumes realized Artifact activations and resolved maximum Health. Snowball is a one-target periodic hard-disable contribution to Control only. Cowardice requires an explicit full-Health time share and affects direct melee only. Protection is available only as the sole DR source.

## Optimizer policy

The search is `weapon × owned Armor × actual Armor slot choices × artifacts`. The editor and storage preserve all 41 audited Armor Enchantment IDs and their actual Tier, but optimization never creates their theoretical cross-product. Every free slot alternative must be runtime-supported; a locked supported choice is evaluable even if another visible alternative is research-only. Gilded and built-in effects are fixed and cannot be ignored.

Whole-Armor leave-one-out contribution is intentionally omitted because removing Armor also removes identity, Health, intrinsic properties, and legal Enchantment ownership at once. Those effects remain explicit in Reasons; selected Armor Enchantments retain individual leave-one-out contributions.

See [runtime batch](armor-runtime-batch.md), [Phase 2-3C](armor-expansion-state-enchants.md), [Health](armor-health-model.md), and [support manifest](armor-runtime-support.md).
