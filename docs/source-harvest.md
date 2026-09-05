# Phase 4 Coverage Source Harvest

Generated from the existing category audits. This is a read-only evidence index: it does not feed candidate generation, numeric evaluation, runtime support or confidence promotion.

## Methodology

- Target game version: **1.17.0.0**. Mojang identifies 1.17 as the final content update; this establishes the version boundary only.
- Source hierarchy: 1.17.0.0 game-file-derived database → official release boundary / patch notes → concrete Wiki mechanics and history → reproducible quantitative testing → community claims.
- Current-version applicability and source confidence are separate. Missing values remain unknown; zero is never used as a placeholder.
- Existing audits remain the source of truth. This generated index stores normalized facts and provenance references for cross-category browsing and drift checks.

## Sources

- game-file-derived: 73
- official: 5
- Wiki: 145
- quantitative public tests / observations: 23
- other community: 0

Source version applicability: exact current 21; claimed current 16; historical 10; unknown/unresolved 199.

## Property-level Harvest coverage

Runtime coverage is intentionally not included in these ratios. A property is counted only when an accepted value exists; stale and conflicting values remain separate.

| Category | Property | Known | Conflicts |
| --- | --- | ---: | ---: |
| melee-weapon | identity | 82 / 82 | 0 |
| melee-weapon | family | 82 / 82 | 0 |
| melee-weapon | baseUniqueRelation | 0 / 82 | 0 |
| melee-weapon | combo | 82 / 82 | 0 |
| melee-weapon | timing | 76 / 82 | 0 |
| melee-weapon | hitDamageRatios | 82 / 82 | 0 |
| melee-weapon | attackSpeedScaling | 0 / 82 | 0 |
| melee-weapon | intrinsicMechanicOwnership | 0 / 82 | 0 |
| melee-weapon | powerScaling | 0 / 82 | 0 |
| melee-enchantment | identity | 33 / 33 | 0 |
| melee-enchantment | availability | 33 / 33 | 0 |
| melee-enchantment | tiers | 33 / 33 | 0 |
| melee-enchantment | trigger | 33 / 33 | 0 |
| melee-enchantment | procChance | 12 / 33 | 0 |
| melee-enchantment | duration | 7 / 33 | 0 |
| melee-enchantment | cooldown | 2 / 33 | 0 |
| melee-enchantment | stacking | 33 / 33 | 0 |
| melee-enchantment | maxCopies | 33 / 33 | 0 |
| melee-enchantment | damageChannel | 33 / 33 | 0 |
| melee-enchantment | powerDependence | 0 / 33 | 0 |
| melee-enchantment | versionHistory | 0 / 33 | 0 |
| melee-enchantment | currentVersionGameplayVerification | 0 / 33 | 0 |
| armor | identity | 73 / 73 | 0 |
| armor | family | 73 / 73 | 0 |
| armor | availability | 73 / 73 | 0 |
| armor | baseUniqueRelation | 73 / 73 | 0 |
| armor | intrinsicProperties | 73 / 73 | 0 |
| armor | builtInEnchantments | 73 / 73 | 0 |
| armor | soulProperty | 73 / 73 | 0 |
| armor | healthPowerCurve | 0 / 73 | 0 |
| armor-enchantment | identity | 41 / 41 | 0 |
| armor-enchantment | tiers | 41 / 41 | 0 |
| armor-enchantment | trigger | 0 / 41 | 0 |
| armor-enchantment | duration | 0 / 41 | 0 |
| armor-enchantment | cooldown | 0 / 41 | 0 |
| armor-enchantment | procChance | 0 / 41 | 0 |
| armor-enchantment | stacking | 41 / 41 | 0 |
| armor-enchantment | availability | 41 / 41 | 0 |
| armor-enchantment | effectChannel | 41 / 41 | 0 |
| armor-enchantment | stateRequirement | 0 / 41 | 0 |
| armor-enchantment | powerDependence | 0 / 41 | 0 |
| armor-enchantment | versionHistory | 0 / 41 | 0 |
| armor-enchantment | runtimeMechanic | 0 / 41 | 0 |
| ranged-weapon | identity | 71 / 71 | 0 |
| ranged-weapon | family | 71 / 71 | 0 |
| ranged-weapon | baseUniqueRelation | 71 / 71 | 0 |
| ranged-weapon | availability | 71 / 71 | 0 |
| ranged-weapon | firingMode | 71 / 71 | 0 |
| ranged-weapon | projectileFamily | 71 / 71 | 0 |
| ranged-weapon | projectileCount | 2 / 71 | 0 |
| ranged-weapon | chargeBehavior | 71 / 71 | 0 |
| ranged-weapon | intrinsic | 71 / 71 | 0 |
| ranged-weapon | ammo | 71 / 71 | 0 |
| ranged-weapon | soul | 71 / 71 | 0 |
| ranged-weapon | neutralProjectileDamageDistribution | 0 / 71 | 0 |
| ranged-weapon | procOwnership | 0 / 71 | 0 |
| ranged-enchantment | identity | 41 / 41 | 0 |
| ranged-enchantment | rarity | 41 / 41 | 0 |
| ranged-enchantment | tiers | 3 / 41 | 0 |
| ranged-enchantment | trigger | 41 / 41 | 0 |
| ranged-enchantment | damageChannel | 41 / 41 | 0 |
| ranged-enchantment | stacking | 3 / 41 | 0 |
| ranged-enchantment | maxCopies | 3 / 41 | 0 |
| ranged-enchantment | triggerOwnership | 0 / 41 | 0 |
| ranged-enchantment | ammoChargeInteractions | 0 / 41 | 0 |
| artifact | identity | 45 / 45 | 0 |
| artifact | family | 45 / 45 | 0 |
| artifact | availability | 45 / 45 | 0 |
| artifact | cooldown | 45 / 45 | 0 |
| artifact | duration | 20 / 45 | 0 |
| artifact | powerScalingClass | 44 / 45 | 0 |
| artifact | powerScalingEvidence | 1 / 45 | 0 |
| artifact | soul | 44 / 45 | 0 |
| artifact | targeting | 5 / 45 | 0 |
| artifact | stacking | 2 / 45 | 0 |
| artifact | interactions | 0 / 45 | 0 |

## Unknown and conflict policy

Generated gap candidates: **2449**. Explicit source conflicts: **6**.

- source-missing: 1112
- version-unknown: 164
- conflicting-public-sources: 6
- requires-game-observation: 428
- likely-requires-experiment: 439
- implementation-related: 271
- objective-related: 29

Each gap carries the entity/property, attempted sources, version/conflict flags, likely acquisition type and runtime relevance. Phase 5 can refine measurement conditions without re-harvesting or inventing results.

## Safety boundary

No runtime support level, optimizer candidate, score formula, Inventory JSON format, Worker behavior or Evidence confidence is changed by this harvest. Research Quest, Evidence submission, Runtime Promotion, Public Availability and New Drop Comparison remain out of scope.
