# Minecraft Dungeons Melee Enchantment Audit

Generated from `research/melee-enchantment-audit.json` by `npm run audit:enchants`.

## Scope and population

- Target game version: 1.17.0.0
- Audit date: 2026-08-29
- Melee-applicable, hero-accessible enchantments: **33**
- Runtime implemented: **7**
- Population rule: Hero-accessible enchantments which the 1.17.0.0 game-file-derived data marks as applicable to melee; normal-slot and gilded availability are retained, while mob-only, innate-only, ranged-only, armor-only, unused, and fail-safe records are excluded.
- Source of truth: [dungeons.tools 1.17.0.0 game-file-derived enchantments](https://www.dungeons.tools/enchantments)

The 33 entries are: Ambush, Anima Conduit, Artifact Synergy, Busy Bee, Chains, Committed, Critical Hit, Dynamo, Echo, Enigma Resonator, Exploding, Fire Aspect, Freezing, Gravity, Guarding Strike, Leeching, Looting, Pain Cycle, Poison Cloud, Prospector, Radiance, Rampaging, Refreshment, Sharpness, Shockwave, Smiting, Soul Siphon, Stunning, Swirling, Thundering, Unchanting, Void Strike, Weakening.

The source index explicitly separates player enchantments from mob/innate records. The population therefore includes shared melee/ranged entries and the three entries omitted from the initial candidate list (Busy Bee, Dynamo, Soul Siphon), while excluding name-based guesses and internal-only effects.

## Coverage summary

| Runtime status | Count |
| --- | ---: |
| implemented | 7 |
| straightforward | 0 |
| needs-state-model | 15 |
| needs-damage-event-model | 6 |
| needs-enemy-state | 3 |
| utility-only | 2 |
| insufficient-evidence | 0 |
| **Total** | **33** |

## Runtime capability matrix

| Enchantment | Runtime | Category | Main blocker |
| --- | --- | --- | --- |
| Ambush | needs-enemy-state | conditional-damage | Requires an untargeting/backstab opportunity share; do not flatten to an unconditional multiplier. |
| Anima Conduit | needs-state-model | soul-healing | Needs soul generation, pickup timing, and max-health state. |
| Artifact Synergy | needs-state-model | artifact-synergy | Needs artifact-use event timing and a one-shot pending buff. |
| Busy Bee | needs-state-model | summon | Needs summon lifetime, cap, attacks, targeting, and damage events. |
| Chains | needs-state-model | crowd-control | Requires CC uptime and independent-proc stacking; no fabricated DPS or defense conversion. |
| Committed | needs-enemy-state | health-dependent-damage | Do not use a constant multiplier |
| Critical Hit | implemented | proc-damage | — |
| Dynamo | needs-state-model | roll-charged-damage | Needs roll count/stack state, cap, consumption, and power-scaling evidence. |
| Echo | needs-state-model | attack-repeat | Requires attack-event scheduling and evidence for which hit/combo properties are copied. |
| Enigma Resonator | needs-state-model | soul-dependent-proc | Needs current/max soul state and soul-spend timing. |
| Exploding | needs-damage-event-model | on-kill-area-damage | Needs enemy-specific max health, AoE targeting, delayed events, and explicit kill attribution. |
| Fire Aspect | needs-damage-event-model | damage-over-time | Needs DoT tick/refresh/stack behavior, focus interaction, Void Strike interaction, and non-direct kill attribution. |
| Freezing | needs-state-model | movement-slow | Needs CC utility/action-suppression metrics; it must not be assigned invented defense points. |
| Gravity | needs-state-model | mob-grouping | Needs grouping/target-density state and a CC utility metric. |
| Guarding Strike | implemented | on-kill-defense | — |
| Leeching | implemented | on-kill-healing | — |
| Looting | utility-only | consumable-loot | Optimizer-excluded until a consumable/utility objective exists; never score as zero-effect. |
| Pain Cycle | needs-state-model | stack-and-self-damage | Needs combo-independent stack state, self-damage, healing interaction, and per-hit damage events. |
| Poison Cloud | needs-damage-event-model | area-damage-over-time | Needs ticks, overlap, target residence, Poison Focus/Void Strike interactions, and non-direct kill attribution. |
| Prospector | utility-only | emerald-loot | Optimizer-excluded until an emerald-farming objective exists; never score as zero-effect. |
| Radiance | implemented | proc-healing | — |
| Rampaging | needs-state-model | on-kill-attack-speed | Needs stochastic/expected buff uptime, refresh rules, and attack-speed feedback into kill rate. |
| Refreshment | needs-state-model | potion-cooldown | Melee and ranged direct weapon/projectile kills qualify; indirect enchant, DoT, and artifact kills do not |
| Sharpness | implemented | passive-damage | — |
| Shockwave | needs-damage-event-model | combo-finisher-damage | AttackProfile.comboFinisherHit supplies cadence, but AoE, power curve, Void Strike interaction, and proc kill attribution require separate DamageEvent modeling. |
| Smiting | needs-enemy-state | category-damage | Needs scenario.undeadEnemyShare (or encounter composition) before ranking. |
| Soul Siphon | needs-state-model | soul-generation | Needs a soul resource and downstream soul-spend utility/damage model. |
| Stunning | needs-state-model | crowd-control | Stun duration/resistance and CC valuation need evidence; no invented defense conversion. |
| Swirling | needs-damage-event-model | combo-finisher-damage | AttackProfile.comboFinisherHit supplies cadence; power curve, AoE, Void Strike interaction, and proc kill attribution need DamageEvent modeling. |
| Thundering | needs-damage-event-model | proc-area-damage | Needs power curve, AoE targets, Lightning Focus, Void Strike consumption, and non-direct kill attribution. |
| Unchanting | implemented | conditional-damage | — |
| Void Strike | implemented | time-ramping-damage | — |
| Weakening | needs-state-model | enemy-debuff | Needs affected-attacker share, debuff uptime, multiple-copy composition, and enemy action model; no unconditional defense conversion. |

Only the seven `implemented` entries exist in `EnchantmentId` and `ENCHANTMENTS`. Every other entry remains research-only, so storage, UI candidate controls, evaluation, and optimization reject it instead of assigning a zero effect.

## Focus findings

### Refreshment and kill attribution

Refreshment uses a direct kill by the weapon carrying it. Direct melee hits and direct ranged projectiles qualify; indirect enchantment damage, DoT/proc damage (including Shockwave, Swirling, Fire Aspect, and Thundering), and artifact damage do not. This matches the existing `CombatState.directWeaponKillsPerSecond` boundary used by Leeching and Guarding Strike. Runtime still needs potion cooldown/use state and a principled healing/defense value, so a later phase should reuse the kill-rate signal but not reduce Refreshment to generic healing.

Kill attribution is high confidence for the direct-weapon wording and low confidence for the exhaustive interaction boundary because the latter is community-observed rather than published game-file metadata.

### Unchanting

Phase 2-1B implements +50% / +75% / +100% only against enchanted targets, using `scenario.enemyComposition.enchantedShare` and expected multiplier `1 + share × bonus`. Every profile has the same editable 25% low-confidence assumption, including boss. Tier, condition and stacking are high confidence; equal-baseline mixture and cross-enchantment composition are separate low-confidence model assumptions. See [direct weapon modifiers](../docs/damage-modifiers.md).

### Committed

The published tiers are ranges (0–50% / 0–75% / 0–100%), not constants. The Minecraft Wiki documents linear scaling with health already lost: at 50% health lost, Tier III grants 50% bonus, while full health grants zero. A correct average still needs an enemy-health trajectory/distribution or analytic integration because the enchantment changes that trajectory. No boss-specific exception was found, so boss behavior remains a verification target rather than an assumed special case.

### Combo finishers and damage events

Shockwave and Swirling trigger from the last combo attack. Existing `AttackProfile.comboFinisherHit` can supply proc cadence, but HPS alone cannot. Their power-scaled damage, AoE, Void Strike interaction, and non-direct kill attribution belong in separate damage events. Proc kills must not increment `directWeaponKillsPerSecond` for Leeching, Guarding Strike, or Refreshment.

### DoT, lightning, CC, and utility

Fire Aspect, Poison Cloud, and Thundering require separate power-scaled damage events with trigger/tick/overlap/AoE and interaction evidence. Chains, Stunning, Gravity, Freezing, and Weakening need crowd-control/debuff state; none receive a fabricated DPS or defense conversion. Looting and Prospector are utility-only and require future consumable/emerald objectives rather than a score of zero.

## Existing model assessment

- `EnchantmentTierValues`: Phase 2-1B keeps the existing five unchanged and adds one typed `directWeaponEffect` union for passive/conditional weapon bonuses. Numeric bonuses live only in tier data. Extend effect channels incrementally before any proc/DoT work; do not add 33 optional scalar fields.
- `combineEnchantmentValues()`: sufficient for Sharpness's multiplicative copies and scalar additive/non-stackable effects. It is insufficient for independent proc rolls, duration extension/refresh, tier-mixed event streams, and cross-copy caps. Add effect-specific combination policies instead of forcing those behaviors into one scalar.
- `CombatState`: reuse `estimatedKillsPerSecond` and `directWeaponKillsPerSecond`; add attributed kill channels only when DamageEvent work begins. Refreshment also needs potion cooldown/use state, while soul, roll, artifact-use, summon, and Pain Cycle mechanics need explicit resources.
- `DamageMetrics`: add typed source/event contributions before Shockwave, Swirling, Thundering, Poison Cloud, Fire Aspect, or Exploding. Keep direct weapon damage separate from proc/DoT/AoE damage so kill attribution remains correct.
- `HealingMetrics`: add potion-use and soul-heal contribution types before Refreshment or Anima Conduit; do not treat cooldown seconds as healing directly.
- `DefenseMetrics`: add affected-attacker share/debuff uptime and CC utility separately. Weakening and hard CC cannot be represented as unconditional damage reduction.

## Phase 2-1B completed scope

- **Sharpness** — audit tier values, multiplicative copies (maximum four), mixed tiers and direct-hit modifier.
- **Unchanting** — non-stackable conditional modifier with reusable enemy composition, editable UI and traceable target DPS.
- All seven implemented enchantments use the existing storage, slot lock, gilded and exhaustive optimizer paths.
- No Refreshment, Weakening, proc/DoT, DamageEvent, armor or ranged runtime expansion was included.

## Next: Phase 2-1C

Select the next bounded scope separately. Refreshment still needs potion state; Shockwave/Swirling need damage events; Weakening needs debuff state; Thundering needs proc/power evidence; Committed needs enemy-health integration. The new composition object alone does not implement Smiting, Ambush or Committed.

## Highest-risk mechanics

- Committed health-trajectory integration and unverified boss exceptions.
- Shockwave/Swirling power scaling, Void Strike interaction, AoE, and kill attribution.
- Thundering/Fire Aspect/Poison Cloud power curves, overlap/ticks, and focus interactions.
- CC/debuff valuation without inventing defense equivalence.
- Independent-proc and duration-based stacking beyond scalar combination.
- Utility-only objectives for loot and emerald farming.

## Evidence limits

Each entry preserves raw Tier I/II/III text separately from interpreted fields. `X / 2X / 3X` values are never converted to percentages. Source records declare which claims they support and their confidence, so high-confidence tier values do not promote low-confidence kill attribution or interactions. Built-in Tier I availability is recorded for future unique-weapon modeling but is not runtime-enabled.

## Primary sources

- [dungeons.tools enchantment index](https://www.dungeons.tools/enchantments) — 1.17.0.0 game-file-derived population, applicability, rarity, tiers, stacking flags, and built-ins.
- [Minecraft Wiki enchantment list](https://minecraft.wiki/w/Dungeons:Enchantment) — hero/mob/unused separation, stacking mechanics, history, and unique built-ins.
- [Minecraft Wiki: Committed](https://minecraft.wiki/w/Dungeons:Committed) — linear health-lost example and tiers.
- [Minecraft Wiki: Shockwave](https://minecraft.wiki/w/Dungeons:Shockwave) and [Swirling](https://minecraft.wiki/w/Dungeons:Swirling) — combo-finisher trigger, power scaling, stacking, and built-ins.
- [Community interaction report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/) — low-confidence proc/DoT kill-attribution boundary used only as a Phase 2 test target.

## Phase decision

**Phase 2-1B complete — ready for Phase 2-1C.** Runtime coverage is 7 / 33; unsupported coverage is 26 / 33. The parent Phase 2 goal remains incomplete until supported runtime coverage reaches the target.
