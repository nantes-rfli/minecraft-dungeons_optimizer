# Game Data Semantic Mapping — Phase 6.5D

## Overview

Phase 6.5D keeps the Phase 6.5C extracted records immutable and adds a separate semantic layer. It maps representative raw structural facts to normalized **research** properties only when the meaning is supportable. No runtime catalog, Optimizer value, support manifest, evidence Gap, or score is changed.

## Method

`Extracted structural fact → context review → public/project evidence cross-check → semantic status → normalized research property`

The parser remains `ue4-package-property-parser` schema 1. Source and extraction confidence remain medium/high, while the dataset version remains low-confidence and is claimed only from the dataset root label. Reference following is bounded to depth 2; inherited effective values and native behavior are not resolved automatically.

## Representative categories

### ranged-weapon

Scatter Crossbow instance and projectile — direct projectile count, tentative cadence field, and raw damage boundary.

### enchantment

Rapid Fire — zero declared CDO properties; inherited/native/default storage remains unresolved.

### artifact

Death Cap Mushroom instance — artifact-to-GameplayEffect structural reference only.

### armor-property

Item Cooldown Decrease — effect-class reference plus rejected UI-priority-as-magnitude control.

### melee-weapon

Double Axe instance — first attack animation duration plus unresolved raw damage scalar.

## Representative source samples

| Parsed asset | Raw properties read | Selected records | Diagnostics |
| --- | ---: | ---: | ---: |
| `Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance` | 85 | 2 | 0 |
| `Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance` | 8 | 1 | 0 |
| `Dungeons/Content/Components/ArmorProperties/ItemCooldownDecrease/BP_ItemCooldownDecrease` | 4 | 2 | 0 |
| `Dungeons/Content/Components/Enchantments/RapidFire/BP_RapidFire` | 0 | 1 | 0 |

The additional semantic sample set parses 4 logical assets and commits 6 extracted source records. The three Scatter Crossbow source records remain in the unchanged Phase 6.5C artifact, for 9 linked records across 6 representative logical assets.

## Accepted mappings

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
| Item Cooldown Decrease | `Effect` | `{"rawPackageIndex":-4,"kind":"import","index":3,"objectName":"ItemCooldownDecreaseGameplayEffect","className":"Class"}` | `armor.gameplayEffectClass` = `"ItemCooldownDecreaseGameplayEffect"` | accepted | high | semantics-not-comparable |
| Death Cap Mushroom | `Effect` | `{"rawPackageIndex":-3,"kind":"import","index":2,"objectName":"BP_DeathCapMushroomGameplayEffect_C","className":"BlueprintGeneratedClass"}` | `artifact.gameplayEffectClass` = `"BP_DeathCapMushroomGameplayEffect_C"` | accepted | high | semantics-not-comparable |
| Double Axe | `ConfiguredAttackVariants[0].AttackAnimationTimeDurationSeconds` | `0.6000000238418579` | `melee.attackAnimationDurationSeconds` = `0.6000000238418579` | accepted | high | matches |
| Scatter Crossbow | `AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles` | `3` | `ranged.projectileCount` = `3` | accepted | high | matches |

## Tentative mappings

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
| Scatter Crossbow | `AttackDefintion.AttackRateSeconds` | `0.6000000238418579` | `ranged.attackRateSeconds` = `0.6000000238418579` | tentative | medium | public-source-missing |

The Scatter Crossbow `AttackRateSeconds` unit is supported by the property name, but effective cadence ownership is not established.

## Unresolved / rejected

| Entity | Raw property | Raw value | Normalized research property | Status | Semantic confidence | Cross-check |
| --- | --- | --- | --- | --- | --- | --- |
| Double Axe | `ConfiguredAttackVariants[0].Damage` | `100` | — | unresolved | unknown | semantics-not-comparable |
| Rapid Fire | `$cdo.declaredPropertyCount` | `0` | — | unresolved | unknown | partially-matches |
| Scatter Crossbow projectile | `damage` | `50` | — | unresolved | unknown | semantics-not-comparable |
| Item Cooldown Decrease | `PropertyColorPrio.Prio` | `13` | — | rejected | high | semantics-not-comparable |

Rapid Fire's public +10%/+15%/+20% tiers are not copied into the game-data mapping because the representative CDO exposes no serialized property that links those values. The Item Cooldown Decrease `PropertyColorPrio.Prio=13` candidate is rejected because its surrounding structure is presentation metadata, not a gameplay percentage.

## Negative controls

- Scatter Crossbow projectile `damage = 50` remains unresolved; it is not mapped to final displayed or Power-scaled damage.
- Double Axe `Damage = 100` remains unresolved for the same scaling/native-context reason.
- Item Cooldown Decrease `PropertyColorPrio.Prio = 13` is explicitly rejected as a cooldown-reduction magnitude.

These controls enforce `raw value present != semantic fact accepted`.

## Cross-check sources

- Existing Source Harvest: dungeons.tools Scatter Crossbow (three projectiles), Rapid Fire (public tier values), and Death Cap Mushroom (artifact role).
- Existing Source Harvest: Minecraft Wiki Double Axe timing table (0.6 seconds per configured hit).
- Project evidence and runtime models were read only; no evidence hierarchy automatically overrides a conflict.

No cross-check conflict was found. Missing or non-comparable evidence remains explicit instead of being treated as agreement.

## Normalized property dictionary

| ID | Category | Unit | Boundary |
| --- | --- | --- | --- |
| `armor.gameplayEffectClass` | armor-property | asset-reference | The gameplay-effect class structurally referenced by an armor property; it does not establish the effect magnitude. |
| `artifact.gameplayEffectClass` | artifact | asset-reference | The gameplay-effect class structurally referenced by an artifact instance; it does not establish modifier magnitude or duration. |
| `melee.attackAnimationDurationSeconds` | melee-weapon | seconds | Serialized duration for one configured melee attack animation variant; not a complete effective attack-cycle measurement. |
| `ranged.attackRateSeconds` | ranged-weapon | seconds | Serialized AttackRateSeconds value retained as a research property while exact runtime cadence semantics remain tentative. |
| `ranged.projectileCount` | ranged-weapon | count | Number of projectile spawn entries emitted by the configured ranged attack definition. |

## Limits

- No runtime promotion, runtime catalog change, Optimizer value change, or score/objective change.
- No bulk harvest, Gap reconciliation, or `resolved-by-game-data` assignment.
- Dataset version remains claimed `1.17.0.0` with low confidence.
- Inheritance, native behavior, complete GameplayEffect modifier traversal, and effective values may remain unresolved.
- This sample is representative, not exhaustive.
- Raw game assets and binary excerpts are not committed.

## Next step

Phase 6.5E — Bulk Harvest & Gap Reconciliation.
