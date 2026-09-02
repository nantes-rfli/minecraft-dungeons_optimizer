# Armor Runtime — Phase 2-3C

Phase 2-3B connected owned Armor to the production `Inventory -> Build -> evaluate/evaluateCandidate -> optimize` pipeline. Phase 2-3C expands runtime coverage to Armor **7 / 73** and Armor Enchantment **7 / 41**, all Limited. No research-only effect is entered as zero.

## Schema and enumeration

`Inventory.armors` and `Build.armor` are optional, so old JSON and Armor-less builds retain their exact outputs. An owned Armor stores its card `observedHealthBonus`, actual slot rolls with fixed Tier, optional lock, and fixed gilded roll. Normal slot, gilded, and built-in sources stay distinct. All 41 audited Armor Enchantment IDs can be saved as actual rolls; the UI labels each as Limited runtime or unsupported.

The optimizer enumerates owned Armor and the candidates actually present in each slot. A free slot is eligible only when every alternative in that slot is runtime-supported. A supported locked roll bypasses an unsupported alternative. Unsupported Armor, missing card Health, unsupported gilded/built-in effects, and unsupported combinations are rejected before numerical evaluation. If registered Armor yields no supported candidate, optimization fails instead of falling back to Armor-less builds.

## Health

Armor-less builds use legacy `scenario.maxHealth`. Armor builds use:

```text
baseHeroHealth = 100
finalMaxHealth = 100 + observedHealthBonus
```

`scenario.maxHealth` is not added. The resolved value feeds Potion healing, Anima Conduit, Pain Cycle self-damage, and EHP. Radiance remains the independent scenario card-heal input. No Power midpoint or endgame extrapolation is available.

## Armor

- Battle Robe: +30% applies to the modeled direct melee channel before conditional direct multipliers; proc, DoT, explosion, and standalone charge additions do not inherit it. Its -40% Artifact cooldown is supported only as the sole CDR source.
- Renegade Armor: +25% attack speed enters cadence, affecting hits, Void timing, finishers, procs, and Artifact Synergy opportunities. +20% aura applies to the hero's direct melee channel. 35% DR works alone. Death Cap/Rampaging speed and all other runtime DR-source combinations are rejected.
- Wither Armor: 35% DR works alone. +50% Souls multiplies existing flat Gathering units and cannot create collection from zero; pickup count is unchanged and Soul Siphon is rejected. Life Steal credits 6% of modeled direct melee AoE damage only.
- Mercenary Armor: +20% self weapon-damage aura applies to direct melee only, while 35% DR works alone.
- Grim Armor: +50% Souls and 6% Life Steal reuse Wither behavior without Armor DR; Soul Siphon remains rejected.
- Scale Mail: +30% direct melee damage and 35% DR reuse the existing components.
- Spider Armor: +25% attack speed reuses the cadence component and 6% Life Steal reuses the direct-melee-only channel. Other runtime attack-speed sources are rejected.

## Armor Enchantments

- Cool Down: runtime uses 18/29/37% from the version-targeted game-file-derived audit. The current Wiki individual page displays 38% at Tier III, while its broader Enchantment table and the audit show 37%; no rounding lineage resolves the conflict. Runtime therefore keeps 37%, one copy, and rejects Battle Robe/external/multi-copy composition.
- Potion Barrier: 90% DR for 5/7/9 seconds. Coverage is `min(1, duration / PotionState.effectiveCooldownSeconds)`, so Refreshment changes capacity. Other runtime DR sources are rejected.
- Chilling: 20/40/60% slow for one second every two seconds. The Limited steady-state model uses 50% raw temporal coverage times eligible and affected target shares. It contributes only to Control and never changes Defense.
- Health Synergy: 3/4/5% of resolved maximum Health per realized Artifact activation. This is nominal healing capacity and does not simulate overheal.
- Snowball: one target is stunned for two seconds every 5/3/1 seconds. Its temporal coverage is scaled by one-target share and eligibility, then unioned with other hard-disable sources. It affects Control only; the boss default is zero.
- Cowardice: +20/30/40% direct melee damage is weighted by the required `cowardiceFullHealthShare`. It does not amplify proc, DoT, or explosion channels.
- Protection: 6/11/15% DR only when it is the sole DR source. Armor DR, Potion Barrier, Iron Hide, Guarding Strike, and Weakening combinations are rejected.

## Contribution policy

Armor identity, observed Health, and intrinsic effects are reported in Reasons. A whole-Armor leave-one-out result is not shown because it would conflate all of those responsibilities and Armor Enchantment ownership. Individual Armor Enchantment contributions remain available.

Machine-readable decisions and source conflicts are in [`research/armor-core-runtime-audit.json`](../research/armor-core-runtime-audit.json).
