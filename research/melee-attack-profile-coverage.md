# Minecraft Dungeons Melee Attack Profile Audit

Generated from `research/melee-attack-profile-audit.json` by `npm run audit:melee`.

## Scope and population

- Game version: 1.17.0.0
- Audit date: 2026-08-28
- Obtainable melee weapons: 82
- Known melee weapons: 88
- Excluded known/non-obtainable records: golden-axe, ladle, mountaineer-pick, the-monkey-motivator, golden-sword, stone-sword
- Population sources: [Minecraft Wiki gear list](https://minecraft.wiki/w/Dungeons%3AGear), [dungeons.tools 1.17.0.0 game-file-derived tier list](https://www.dungeons.tools/tier-list)

The Wiki count (88 known / 82 obtainable) was reconciled with the independent 82-row list derived from the 1.17.0.0 game files. Per-hit durations come from each weapon's current Minecraft Wiki Stats table; the game-file-derived source establishes population and family context but does not publish those durations.

## Coverage

| Classification | Weapons | Coverage |
| --- | ---: | ---: |
| Exact | 76 | 92.7% |
| Verified shared | 0 | 0.0% |
| Partial | 6 | 7.3% |
| Inferred | 0 | 0.0% |
| Missing | 0 | 0.0% |
| **Strict runtime-ready** | **76 / 82** | **92.7%** |
| Relaxed runtime-ready (includes inferred) | 76 / 82 | 92.7% |

Strict runtime-ready requires a complete per-hit timing profile, a source, and status `exact` or `verified-shared`. Relaxed coverage additionally accepts `inferred`; this audit deliberately contains no inferred or family-only shared profiles.

## Public information richness

| Public evidence | Weapons |
| --- | ---: |
| Any directly published attack-duration rows | 82 |
| Complete, internally consistent per-hit duration profiles | 76 |
| Combo count only (no duration rows) | 0 |
| Completed by verified profile sharing | 0 |
| No public profile data | 0 |
| Attack-speed modifier scaling still unknown | 82 |

All 82 pages expose at least one attack-duration row. Six cannot be converted into a fixed profile without resolving contradictory or non-fixed combo structures. Damage ratios are derived only for internally consistent profiles from the raw base-damage rows; raw values remain stored. No attack-speed modifier scaling rule was guessed.

## Partial weapons

- Broken Sawblade (broken-sawblade) — The infobox states 10 hits/upon release, while the Stats table groups Hit 1 and Hit 2-21. Overheat, early release, and combo-trigger behavior require a dedicated cycle model.
- Mechanized Sawblade (mechanized-sawblade) — The infobox states 15 hits/upon release, while the Stats table groups Hit 1 and Hit 2-31. Overheat, early release, and combo-trigger behavior require a dedicated cycle model.
- Daggers (daggers) — Minecraft Wiki infobox states 6 hits, but its Stats table contains 7 hit rows. The fixed combo remains unresolved.
- Fangs of Frost (fangs-of-frost) — Minecraft Wiki infobox states 6 hits, but its Stats table contains 7 hit rows. The fixed combo remains unresolved.
- Moon Daggers (moon-daggers) — Minecraft Wiki infobox states 6 hits, but its Stats table contains 7 hit rows. The fixed combo remains unresolved.
- Sheer Daggers (sheer-daggers) — Minecraft Wiki infobox states 6 hits, but its Stats table contains 7 hit rows. The fixed combo remains unresolved.

## Missing weapons

- None.

## Special handling required

- Broken Sawblade (broken-sawblade) — Continuous sawblade attacks can stop on release and enter an overheat cooldown; a fixed-combo HPS model is insufficient.
- Mechanized Sawblade (mechanized-sawblade) — Continuous sawblade attacks can stop on release and enter an overheat cooldown; a fixed-combo HPS model is insufficient.

## Low-confidence entries

- None.

Individual timing sources are rated medium confidence: each value is directly visible in a concrete Wiki Stats table, but those tables do not expose a primary game-file citation for every duration. The population cross-check from dungeons.tools is high confidence because it explicitly identifies the 1.17.0.0 game files as its source.

## Legacy runtime proxy comparison

Before the first Phase 1 runtime migration, the three supported weapons used the proxies below. Runtime now stores these audit per-hit timings and calculates HPS as `comboHits / sum(hitDurationsSeconds)`; the legacy comparison remains here to make the model change explicit.

| Weapon | Legacy runtime proxy HPS | Audit-derived HPS | Proxy difference |
| --- | ---: | ---: | ---: |
| fighters-bindings | 7 | 6.95652173913 | +0.6% |
| double-axe | 1.05 | 1.66666666667 | -37.0% |
| anchor | 0.5 | 0.4 | +25.0% |

The Double Axe and Anchor differences motivated the deliberate Phase 1 migration. Fighter's Bindings was close to the rounded proxy, but runtime now preserves its raw four-hit structure as well.

## Recommendation

**B. Some additional research is required.** Public information produces strict fixed profiles for 76/82 weapons (92.7%), so broad Phase 1 work can proceed. The four dagger-family contradictions and two sawblade cycle models must be resolved separately, and attack-speed modifier behavior remains unverified for every weapon.
