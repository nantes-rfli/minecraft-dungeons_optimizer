# Minecraft Dungeons Melee Enchantment Audit

Generated from `research/melee-enchantment-audit.json` by `npm run audit:enchants`.

## Scope and population

- Target game version: 1.17.0.0
- Audit date: 2026-08-30
- Melee-applicable, hero-accessible enchantments: **33**
- Runtime implemented: **12**
- Population rule: Hero-accessible enchantments which the 1.17.0.0 game-file-derived data marks as applicable to melee; normal-slot and gilded availability are retained, while mob-only, innate-only, ranged-only, armor-only, unused, and fail-safe records are excluded.
- Source of truth: [dungeons.tools 1.17.0.0 game-file-derived enchantments](https://www.dungeons.tools/enchantments)

The 33 entries are: Ambush, Anima Conduit, Artifact Synergy, Busy Bee, Chains, Committed, Critical Hit, Dynamo, Echo, Enigma Resonator, Exploding, Fire Aspect, Freezing, Gravity, Guarding Strike, Leeching, Looting, Pain Cycle, Poison Cloud, Prospector, Radiance, Rampaging, Refreshment, Sharpness, Shockwave, Smiting, Soul Siphon, Stunning, Swirling, Thundering, Unchanting, Void Strike, Weakening.

The source index explicitly separates player enchantments from mob/innate records. The population therefore includes shared melee/ranged entries and the three entries omitted from the initial candidate list (Busy Bee, Dynamo, Soul Siphon), while excluding name-based guesses and internal-only effects.

## Coverage summary

| Runtime status | Count |
| --- | ---: |
| implemented | 12 |
| straightforward | 0 |
| needs-state-model | 13 |
| needs-damage-event-model | 3 |
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
| Refreshment | implemented | potion-cooldown | — |
| Sharpness | implemented | passive-damage | — |
| Shockwave | implemented | indirect-damage-event | Power 210–252 only; Phase 2-1D partial |
| Smiting | needs-enemy-state | category-damage | Needs scenario.undeadEnemyShare (or encounter composition) before ranking. |
| Soul Siphon | needs-state-model | soul-generation | Needs a soul resource and downstream soul-spend utility/damage model. |
| Stunning | needs-state-model | crowd-control | Stun duration/resistance and CC valuation need evidence; no invented defense conversion. |
| Swirling | implemented | indirect-damage-event | Power 210–263 only; Phase 2-1D partial |
| Thundering | implemented | indirect-damage-event | Power 248–263 only; Phase 2-1D partial |
| Unchanting | implemented | conditional-damage | — |
| Void Strike | implemented | time-ramping-damage | — |
| Weakening | implemented | enemy-debuff | — |

Three entries are range-limited: Shockwave 210–252, Swirling 210–263, Thundering 248–263. Outside those Power ranges the optimizer explicitly excludes free choices, rejects locked/gilded choices and never assigns zero damage. Phase 2-1D remains **partial**; 12 is catalog coverage, not full Power coverage.

Only the 12 `implemented` entries exist in `EnchantmentId` and `ENCHANTMENTS`. Every other entry remains research-only, so storage, UI candidate controls, evaluation, and optimization reject it instead of assigning a zero effect.

## Focus findings

### Refreshment and kill attribution

Refreshment uses a direct kill by the weapon carrying it. Direct melee hits and direct ranged projectiles qualify; indirect enchantment damage, DoT/proc damage (including Shockwave, Swirling, Fire Aspect, and Thundering), and artifact damage do not. This matches the existing `CombatState.directWeaponKillsPerSecond` boundary used by Leeching and Guarding Strike. Phase 2-1C derives PotionState using C / (1 + k × r), then adds only incremental healing capacity to utility. Base cooldown 45 seconds and approximately 75% healing have independent Evidence. This is a low-confidence steady-state availability model, not actual healing or an event simulator. Artifact cooldownReduction is not applied. See [PotionState](../docs/potion-state.md).

Kill attribution is high confidence for the direct-weapon wording and low confidence for the exhaustive interaction boundary because the latter is community-observed rather than published game-file metadata.

### Unchanting

Phase 2-1B implements +50% / +75% / +100% only against enchanted targets, using `scenario.enemyComposition.enchantedShare` and expected multiplier `1 + share × bonus`. Every profile has the same editable 25% low-confidence assumption, including boss. Tier, condition and stacking are high confidence; equal-baseline mixture and cross-enchantment composition are separate low-confidence model assumptions. See [direct weapon modifiers](../docs/damage-modifiers.md).

### Committed

The published tiers are ranges (0–50% / 0–75% / 0–100%), not constants. The Minecraft Wiki documents linear scaling with health already lost: at 50% health lost, Tier III grants 50% bonus, while full health grants zero. A correct average still needs an enemy-health trajectory/distribution or analytic integration because the enchantment changes that trajectory. No boss-specific exception was found, so boss behavior remains a verification target rather than an assumed special case.

### Combo finishers and damage events

Shockwave and Swirling trigger from the last combo attack. Existing `AttackProfile.comboFinisherHit` can supply proc cadence, but HPS alone cannot. Their power-scaled damage, AoE, Void Strike interaction, and non-direct kill attribution belong in separate damage events. Proc kills must not increment `directWeaponKillsPerSecond` for Leeching, Guarding Strike, or Refreshment.

### DoT, lightning, CC, and utility

Fire Aspect and Poison Cloud still require separate power-scaled damage events with trigger/tick/overlap/AoE and interaction evidence. Chains, Stunning, Gravity and Freezing still need crowd-control state. Phase 2-1C implements Weakening through an explicit time-weighted affected incoming damage share, not unconditional defense. Looting and Prospector are utility-only and require future consumable/emerald objectives rather than a score of zero.

## Existing model assessment

- `EnchantmentTierValues`: Phase 2-1C keeps the original five unchanged and expands the typed `effect` union to direct weapon bonuses, potion cooldown on direct kill, and enemy damage debuffs. Numeric bonuses live only in tier data. Extend effect channels incrementally before any proc/DoT work; do not add 33 optional scalar fields.
- `combineEnchantmentValues()`: sufficient for Sharpness's multiplicative copies and scalar additive/non-stackable effects. It is insufficient for independent proc rolls, duration extension/refresh, tier-mixed event streams, and cross-copy caps. Add effect-specific combination policies instead of forcing those behaviors into one scalar.
- `CombatState`: reuse `estimatedKillsPerSecond` and `directWeaponKillsPerSecond`; Phase 2-1D now adds direct/indirect damage shares and an explicitly low-confidence final-blow proxy. Refreshment now consumes this signal in independent PotionState; soul, roll, artifact-use, summon, and Pain Cycle mechanics still need explicit resources.
- `DamageMetrics`: Phase 2-1D adds typed source/event contributions for Shockwave, Swirling and Thundering; Poison Cloud, Fire Aspect and Exploding remain unsupported. Keep direct weapon damage separate from proc/DoT/AoE damage so kill attribution remains correct.
- `HealingMetrics`: Refreshment contributes only incremental potion healing capacity, explicitly a low-confidence proxy; Anima Conduit still needs soul-heal state.
- `DefenseMetrics`: Weakening preserves affected incoming damage share, reduction, duration and enemy multiplier separately from Artifact/Guarding hero DR. Hard CC utility remains unsupported.

## Phase 2-1B completed scope

- **Sharpness** — audit tier values, multiplicative copies (maximum four), mixed tiers and direct-hit modifier.
- **Unchanting** — non-stackable conditional modifier with reusable enemy composition, editable UI and traceable target DPS.
- The seven enchantments available at Phase 2-1B completion used the existing storage, slot lock, gilded and exhaustive optimizer paths.
- That phase did not include Refreshment or Weakening; both are added in Phase 2-1C below.

## Phase 2-1C completed scope

- **Refreshment** — Tier reductions 1/2/3 seconds, direct-weapon kills only, PotionState and incremental healing capacity (base potion healing excluded).
- **Weakening** — enemy damage reductions 20/30/40%, five-second nearby-enemy application, and editable 50% affected incoming damage share for every profile. This share includes duration/positioning/attack uptime; duration is not multiplied again.
- Weakening enemy multiplier is `1 - share × reduction`; Artifact and Guarding Strike remain separate hero-defense stages. See [enemy debuffs](../docs/enemy-debuffs.md).
- **Source conflict**: dungeons.tools says Weakening STACKS Yes; the prior audit interpreted maxCopies=4/special. The requested maxCopies=1/non-stackable rule follows the Wiki's explicit normal/gilded/unique-slot semantics. Raw conflicting metadata and the correction are retained in audit sources; runtime stacking confidence is medium, not asserted game-file agreement.
- Both additions use normal candidates, locks, gilded tiers, JSON/storage, contribution and exhaustive optimizer paths. Runtime coverage is **12 / 33**, unsupported **21 / 33**.
- Phase 2-1C did not implement DamageEvent; Phase 2-1D below adds it. Potion Barrier, armor, CC utility and target-switching simulation remain unsupported.

## Phase 2-1D partial

DamageEvent separates direct weapon damage and three independent power-scaled proc contributions. Shockwave/Swirling use combo-finisher cadence; Thundering uses direct HPS × 30%. Generic targeting defaults to 1 for all three, with separate editable low-confidence assumptions. Direct modifiers never apply to procs. Direct weapon kills use total kills × scenario.directKillShare × directWeaponAoeDps / totalAoeDps. Proc removal recalculates all dependent healing/defense effects.

38 Power knots / 114 tier samples support per-enchantment Tier I log-linear interpolation and published tier multipliers. The common-curve hypothesis was not sufficiently established; no extrapolation is performed. Void amplification and consumption remain independently uncertain (runtime applies neither). See [DamageEvent architecture, evidence and limitations](../docs/damage-events.md) and [research audit](damage-event-audit.json).

Next: close the Power-curve evidence gap before extending proc/DoT damage. Committed/simple-state work is a more independent Phase 2-1E candidate, but still needs enemy-health integration. The parent goal of 25–30 melee enchantments remains incomplete.

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
- [Community interaction report](https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/) — low-confidence proc/DoT kill-attribution boundary kept separate from high-confidence direct-weapon wording.

## Phase decision

**Phase 2-1D partial — full Power 50–263 proc evidence remains missing.** Runtime coverage is 12 / 33; unsupported coverage is 21 / 33. The parent Phase 2 goal remains incomplete until supported runtime coverage reaches the target.
