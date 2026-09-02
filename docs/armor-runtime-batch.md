# Armor Core Runtime Batch — Phase 2-3B

Phase 2-3B connects owned Armor to the production `Inventory -> Build -> evaluate/evaluateCandidate -> optimize` pipeline. Runtime coverage is Armor **3 / 73** and Armor Enchantment **3 / 41**, all Limited. No research-only effect is entered as zero.

## Schema and enumeration

`Inventory.armors` and `Build.armor` are optional, so old JSON and Armor-less builds retain their exact outputs. An owned Armor stores its card `observedHealthBonus`, actual slot rolls with fixed Tier, optional lock, and fixed gilded roll. Normal slot, gilded, and built-in sources stay distinct.

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

## Armor Enchantments

- Cool Down: runtime uses 18/29/37% from the version-targeted game-file-derived audit. The current Wiki individual page displays 38% at Tier III, while its broader Enchantment table and the audit show 37%; no rounding lineage resolves the conflict. Runtime therefore keeps 37%, one copy, and rejects Battle Robe/external/multi-copy composition.
- Potion Barrier: 90% DR for 5/7/9 seconds. Coverage is `min(1, duration / PotionState.effectiveCooldownSeconds)`, so Refreshment changes capacity. Other runtime DR sources are rejected.
- Chilling: 20/40/60% slow for one second every two seconds. The Limited steady-state model uses 50% raw temporal coverage times eligible and affected target shares. It contributes only to Control and never changes Defense.

Machine-readable decisions and source conflicts are in [`research/armor-core-runtime-audit.json`](../research/armor-core-runtime-audit.json).
