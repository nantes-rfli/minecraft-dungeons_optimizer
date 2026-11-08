# Phase 2-5 — Ranged audit and observed runtime (partial)

## Result and close gates

Population reconciliation and the observation-driven MVP are implemented. This Phase remains **partial**, not a claim of verified current-version game accuracy. Weapon taxonomy still has explicitly unknown fields and unverified Japanese names; independent cadence/shot/interaction samples are absent. Closure requires the three ranged measurement protocols, resolving population/channel conflicts, and filling the missing per-family mechanics/localization evidence. The existing Phase 1 independent-DPS 0/5 gate is unchanged.

- 2-5A: population 71/71 reconciled; taxonomy and Japanese names partial.
- 2-5B: typed projectile/attack boundary and finite observation-driven rate; built-in measured profiles pending.
- 2-5C: primary 38 / secondary 41 / union 41; initial tier/trigger audit, unresolved stack/Tier/channel fields explicit.
- 2-5D: Bow / Shortbow / Longbow / Power Bow / Elite Power Bow / Phantom Bow (uncharged/charged), Crossbow / Heavy Crossbow / Rapid Crossbow (single). Full 0, Limited 9, Research-only 62; 15 weapon/mode pairs.
- 2-5E: inventory → evaluate → optimize → explanations, actual Tier rolls, locks, Gilded I–III, historical JSON v2 (current writes v6).
- 2-5F: common read-model adapter, structured backlog, three protocols, generated reports and CI checks.

## Sources and reconciliation

Primary: [dungeons.tools weapons](https://www.dungeons.tools/weapons) and [enchantments](https://www.dungeons.tools/enchantments), which claim extraction from 1.17.0.0. The historical population audit did not independently inspect game binaries. The later [Native integration](./ranged-native-integration.md) separately verifies local hash-bound Raw/Native inputs; official authenticity and same-build applicability remain unverified. Factual index snapshots retain source URL, acquisition date and HTML SHA256; `extract-ranged-sources.ts` regenerates them from explicitly downloaded HTML. Normal audits run offline and do not replace source evidence. Secondary: [Wiki Gear](https://minecraft.wiki/w/Dungeons:Gear) and the [ranged Enchantment table](https://minecraft.wiki/w/Dungeons:Enchantment). Where direct access failed, search-index text was inspected, not invented. Audit capture: 2026-09-04.

Weapons reconcile after explicit Burst Gale Bow / Burst Gust Bow and apostrophe normalization. The seven seasonal variants are classified Common in the primary index but Unique in the secondary definition; both values remain. “Obtainable” describes published hero gear, including legacy seasonal ownership, not a guarantee of drops today. No raw game-ID completeness claim.

Enchant secondary-only entries are Exploding, Looting and Weakening. Primary shared pages contain melee/ranged conflicts: Anima 2/4/6% vs ranged 4/6/8%; Void 200/400/600% vs ranged 100/200/300%. Those are **not runtime values**. Tier text stays verbatim numeric metadata, never an automatic mechanic. Exclusive intrinsic-only and unused effects do not enter roll candidates.

Only [Power](https://www.dungeons.tools/enchantments/power), [Critical Hit](https://minecraft.wiki/w/Dungeons:Critical_Hit) and [Unchanting](https://minecraft.wiki/w/Dungeons:Unchanting) are Limited. Each is capped at one copy across slots/Gilded. They have separate ranged definitions; no melee implementation is reused by name. Normal direct single projectile only: Power +10/21/33%, Critical 10/15/20% chance of triple damage, Unchanting +50/75/100% against enchanted targets. Independent expected modifier multiplication is a declared model assumption, not independently verified pair evidence.

## Input and attack model

`Inventory.rangedWeapons` and `Build.rangedWeapon/rangedEnchantments` are optional; the public APIs remain `evaluate(build, scenario)` and `optimize(inventory, scenario)`. No registered ranged weapon means the old calculation and output shape remain unchanged, even when a ranged scenario setting is present.

Every evaluated ranged instance requires `observation`:

| Field | Meaning |
| --- | --- |
| gameVersion | Exactly 1.17.0.0, user-declared |
| mode | Bow / Shortbow / Longbow / Power Bow / Elite Power Bow / Phantom Bow uncharged or charged; Crossbow / Heavy Crossbow / Rapid Crossbow single |
| projectileDamage | Neutral damage of one normal projectile, before selectable Enchants, Armor, Strength and target DR; may be read from the matching card/neutral hit |
| shotCycleSeconds | Complete measured cycle including charge, release, reload and recovery to the next ready state |
| availableAmmo | Explicit finite number of normal arrows available in the encounter, no replenishment |
| sourceNote | User observation provenance; not a verification certificate |
| arrowsConsumedPerShot | Required for Rapid Crossbow, Elite Power Bow and Phantom Bow: target mode-owned observed consumption must be 1. Missing is input-required; any explicit value other than 1 is unsupported on every registered Ranged weapon |

Power is stored as individual equipment metadata. There is no ranged Power curve, extrapolation, multiplier from melee, card-range midpoint or inferred cadence. Charged and uncharged observations must not be mixed. Mode changes clear draft damage/cycle/note while retaining known ammo; saved observations remain unchanged until valid Apply. The UI does not prefill observed numbers. Rapid additionally requires explicit observed consumption of one normal arrow per complete shot. Ammo stock 0 does not waive that requirement; Native ResourceCost remains unknown. Mode changes also clear this mode-owned consumption draft. See the [bounded reuse contract](rapid-crossbow-runtime-reuse.md).

`scenario.rangedTimeShare` must be explicitly between 0 and 1 (exclusive). The complementary share scales modeled melee action cadence. Switching/movement overhead must be included in the user's reserved time budget. This is a time-average scenario model, not a switching simulator. Pure ranged builds and automatic time allocation are not implemented.

```text
completeShots = floor(encounterSeconds × rangedTimeShare / observedCompleteCycle)
shots = min(completeShots, availableAmmo)
directRangedDps = neutralProjectileDamage × expectedModifiers × shots / encounterSeconds
```

One shot is credited after a full cycle, not at t=0. One shot uses one arrow and hits one target once. Idle budget after ammo depletion is not reassigned to melee. Crossbow's faster projectile property is retained but not turned into a cadence multiplier: the model conditions on completed hits and excludes flight time. No projectile-count × card-damage inference. Arithmetic tests use **synthetic fixtures**, not gameplay measurements.

## Channels and combinations

The historical `damage.directWeapon*` and `CombatState.directWeaponKillsPerSecond` retain their **direct melee** meanings. `damage.ranged` contains separate direct/indirect ranged metrics, mode, ammo and evidence limits. Aggregate single-target/AoE DPS includes ranged; ranged damage share and kills are separate. Ranged kills never trigger melee Leeching, Guarding Strike or Refreshment. Damage share remains an approximate final-blow attribution, not an exact kill sequence.

Allowed melee selections are Critical Hit, Sharpness, Unchanting, Smiting, Radiance, Leeching, Guarding Strike and Refreshment. Other melee/Ranged pairs (Void reset, DoT, Committed target trajectory, charge, temporal/state interactions) are rejected pending evidence. Current runtime artifacts retain their original effects; Mushroom changes **melee** rate only. Ammo/charge artifacts are not registered.

Unsupported free-slot alternatives exclude the whole ranged item; locking a supported candidate makes that roll eligible. Unsupported fixed Gilded, mode mismatches, missing observations and illegal copies are not assigned zero. If no supported ranged combinations remain, optimize reports `NO_SUPPORTED_RANGED_CANDIDATES`; evaluate rejects directly. Unknown input IDs are rejected while audited Research-only rolls persist unchanged.

## Armor and intrinsic reassessment

No Armor or Armor Enchant is promoted just because Ranged exists. Existing weapon-damage aura, Life Steal, Soul Gathering and Cowardice combinations are rejected with Ranged until channel/stacking evidence is available. Pure existing armor health/defense/cooldown properties keep their current constraints. Hunter/Archer ranged bonuses, arrow/ammo properties and projectile enchants remain Research-only. The existing Armor support manifest is unchanged.

[Elite Power Bow and Phantom Bow](observed-fixed-power-bow-reuse.md) model their own fixed Power I and observed mode effects. Other unique weapons remain Research-only, with published effects and base inheritance retained separately. Some index properties are incomplete (e.g. an index may expose only one intrinsic). `completeMechanicVerification: false` explicitly prevents interpreting the taxonomy as a complete unique simulator.

## Persistence and coverage

JSON writes version 6 and reads versions 1–6. The existing localStorage key is retained so valid old inventories are read losslessly; the next ordinary save writes v6. Missing ranged fields remain absent (not replaced by dummy gear). Tier, slot lock, Gilded and unsupported audited candidates survive a round trip. Observations are device-local; no submission or Research Quest service was added. Historical Rapid Catalog records use a finite lossless migration; Research metadata never supplies missing damage, cycle or consumption observations. Recorded effects must reconcile with the selected rolls/fixed ownership/intrinsic scope, or remain excluded.

Unreadable saved JSON is retained and shown for recovery; automatic saving is blocked until a valid document is explicitly imported. Form edits are validated before saving, so an invalid intermediate value never overwrites the last valid inventory. Save failures are surfaced in the UI.

Two common read-model categories were added: `ranged-weapon` (includes its attack profile; no duplicate denominator) and `ranged-enchantment`. Their category audit is the source of truth; common Coverage provides aggregation/provenance, not numeric inputs. P0 cadence, P1 projectile and interaction blockers plus P2 pure-ranged implementation are structured; raw diagnostics remain unclassified, with no text-based deduplication. No cross-category overall coverage percentage.

## Verification and regeneration

`npm run generate:ranged` regenerates the JSON/doc audits. `audit:ranged` and `audit:ranged-enchants` reject stale artifacts and population/support/tier drift. `audit:ranged-runtime` exercises evaluate/optimize, finite ammo, channels, exclusions and input validity. Run category audits before `generate:evidence-coverage` / `audit:evidence-coverage`, then the full tests, tsc, lint and build. Existing golden fixtures are not regenerated to accommodate ranged changes.

Validation on 2026-09-04: all 23 audit commands passed, including the existing historical partial gates; 39 test files / 1,322 tests passed, as did TypeScript, lint and production build. New runtime arithmetic fixtures are synthetic, not independent DPS samples. The build still warns about a client chunk above 500 kB (App roughly 581 kB / 134 kB gzip); code splitting and large-inventory performance remain Phase 3 work. The warning is not suppressed and no performance gate is claimed complete.

## Native connection and bounded reuse (2026-10-31)

[Integration contract](./ranged-native-integration.md) and [per-target support/Evidence ledger](../research/runtime/ranged-observed-reuse.json) connect four additional identities to the same observed arithmetic. This is Existing Limited Mechanic Reuse, not New Mechanic Promotion or an R3 accepted/Measured/Verified claim. Each target keeps its own neutral damage and complete cycle input; Strong Charged Attacks/Powerful Shots are included in that observation and never applied again as an inferred multiplier. Existing selectable enchant expectations and all rejected shared interactions are unchanged.

Five [conditional Native CDO models](../research/domain/ranged-native-model.json) retain base damage, charge completion and timing parameters with Raw ranges, inheritance and Native default provenance. These are derived domain information, outside serialized Formal Value/Relation v2. They cannot replace either observed numeric input. Unknown final damage and effective cadence remain explicit. The reference model adds **zero** calculable equipment; the actual observed-input expansion adds **four**.
