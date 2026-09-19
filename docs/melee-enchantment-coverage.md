# Minecraft Dungeons Melee Enchantment Audit

Generated from mechanics audit by `npm run audit:enchants`. Runtime summary uses the separate support manifest.

## Current runtime support

Population 33 · Catalog runtime 28 / 33 · Full 19 · Limited 9 · Research-only 5 · Broad Power 22 · Power-limited 6

Fullは現Optimizer scope内の通常対応で、完全なゲーム再現ではありません。Limitedは具体的な機能境界、Research-onlyは未登録です。
[Runtime support matrix](./melee-runtime-support.md) / [limitations and close gates](./runtime-limitations.md)。
Phase partialは履歴上の未達gate、Evidence confidenceは根拠品質で、supportとは別軸です。

## Mechanics research scope

Game version: 1.17.0.0; audited: 2026-09-01.
Population: Hero-accessible enchantments which the 1.17.0.0 game-file-derived data marks as applicable to melee; normal-slot and gilded availability are retained, while mob-only, innate-only, ranged-only, armor-only, unused, and fail-safe records are excluded.
Source: [population source](https://www.dungeons.tools/enchantments).

This report asks what the game mechanic appears to do. The support manifest asks what the current optimizer can safely execute.
Research classifications below are not Full/Limited labels.

| Research status | Count |
| --- | ---: |
| implemented | 28 |
| straightforward | 0 |
| needs-state-model | 3 |
| needs-damage-event-model | 0 |
| needs-enemy-state | 0 |
| utility-only | 2 |
| insufficient-evidence | 0 |
| Total | 33 |

## Mechanics / research matrix

| Enchantment | Research status | Category | Main research boundary |
| --- | --- | --- | --- |
| Ambush | implemented | conditional-damage | — |
| Anima Conduit | implemented | soul-healing | — |
| Artifact Synergy | implemented | artifact-synergy | — |
| Busy Bee | needs-state-model | summon | Needs summon lifetime, cap, attacks, targeting, and damage events. |
| Chains | implemented | crowd-control | Single-copy runtime; game max 4 |
| Committed | implemented | health-dependent-damage | — |
| Critical Hit | implemented | proc-damage | — |
| Dynamo | implemented | roll-charge-consume-direct-damage | Power 210–263 only; Phase 2-1J partial: independent Tier curves, cap20, initial0 and roll0 defaults, periodic continuous roll income with finite consume and overflow |
| Echo | needs-state-model | attack-repeat | Phase 2-1F remains research-only: missing repeat selection/damage, animation/cadence cost, cooldown start, combo/finisher progression, Void reset, on-hit opportunities and direct-kill attribution |
| Enigma Resonator | needs-state-model | soul-dependent-proc | Phase 2-1G research-only: no verified 1.17 soul-to-chance curve or intermediate-fill measurements |
| Exploding | implemented | on-kill-explosion | — |
| Fire Aspect | implemented | attached-dot | Power 70–251 only; Phase 2-1H partial: Power70–251, one runtime copy only despite game stacking up to four; mixed-tier formula unresolved |
| Freezing | implemented | attack-speed-slow | Attack speed only, not movement |
| Gravity | implemented | mob-grouping | Grouping coverage only; 1/1.5/2s refresh |
| Guarding Strike | implemented | on-kill-defense | — |
| Leeching | implemented | on-kill-healing | — |
| Looting | utility-only | consumable-loot | Optimizer-excluded until a consumable/utility objective exists; never score as zero-effect. |
| Pain Cycle | implemented | finite-attack-charge-consume-self-damage | — |
| Poison Cloud | implemented | persistent-area-dot | Power 184–251 only; Phase 2-1H partial: Power184–251; 30% per profile hit; 3s cloud |
| Prospector | utility-only | emerald-loot | Optimizer-excluded until an emerald-farming objective exists; never score as zero-effect. |
| Radiance | implemented | proc-healing | — |
| Rampaging | implemented | on-kill-attack-speed | — |
| Refreshment | implemented | potion-cooldown | — |
| Sharpness | implemented | passive-damage | — |
| Shockwave | implemented | indirect-damage-event | Power 210–252 only; Phase 2-1D partial: conditional runtime only at Power 210–252; no extrapolation |
| Smiting | implemented | category-damage | — |
| Soul Siphon | implemented | soul-generation | — |
| Stunning | implemented | crowd-control | Limited runtime: 2s community-derived duration (low), high-confidence 5/10/15% chances |
| Swirling | implemented | indirect-damage-event | Power 210–263 only; Phase 2-1D partial: conditional runtime only at Power 210–263; no extrapolation |
| Thundering | implemented | indirect-damage-event | Power 248–263 only; Phase 2-1D partial: conditional runtime only at Power 248–263; no extrapolation |
| Unchanting | implemented | conditional-damage | — |
| Void Strike | implemented | time-ramping-damage | — |
| Weakening | implemented | enemy-debuff | — |

Tier raw values, sources, confidence, conflicting claims, stacking and applicability remain in [mechanics audit](../research/melee-enchantment-audit.json).
Low confidence is not an automatic Limited verdict. Unimplemented effects are never registered as zero-score candidates.

## Historical phase gates

Parent 25–30 meaningful runtime is complete in Phase 2-1K; it does not mean all 33 mechanics are fully reproduced.
Phase 1-4 / 2-1D / 2-1F / 2-1G / 2-1H / 2-1I / 2-1J remain partial under their original gates.

- [1-4: independent run-level regression](./model-regression.md)
- [2-1B: direct modifiers](./damage-modifiers.md)
- [2-1C: PotionState](./potion-state.md) / [Enemy debuffs](./enemy-debuffs.md)
- [2-1D: Power-range proc damage](./damage-events.md)
- [2-1E: enemy-state damage](./enemy-state-damage.md)
- [2-1F: Temporal State / Echo](./temporal-enchantments.md)
- [2-1G: Soul subsystem / Enigma](./soul-subsystem.md)
- [2-1H: DoT / Exploding](./dot-and-explosion-damage.md)
- [2-1I: independent Control](./cc-utility.md)
- [2-1J: finite charge / consume](./charge-consume-enchantments.md)
