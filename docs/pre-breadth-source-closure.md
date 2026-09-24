# Pre-Breadth Source-Closure Audit

判定: **SAFE TO START HORIZONTAL BREADTH**

この監査は271装備の横展開前に、linked attack timingとArtifact base cooldownのRaw collection contractを固定する。formula推定、Formal schema、Raw extraction、Application、Optimizer、Native実装は対象外。machine-readableなitem別結果は[research/pre-breadth-source-closure.json](../research/mechanics/pre-breadth-source-closure.json)に記録した。

## Baselineとauthority

- main baseline: `3b102f6e798836d2e8762b44ec262730b87a587d`
- authority: [PR #118のformula-inference research](../research/mechanics/formula-inference-pre-breadth.json)と[summary](./mechanics-formula-inference-pre-breadth.md)。PR #118の2つの残gateをこの監査の対象とする。
- source: committed [Raw Structural Inventory manifest](../research/raw/game-data-raw-structural-inventory/manifest.json)と96 shards、現在のrelation evidence、6個のrepresentative Raw package snapshots。
- inventory coverage: 271 catalog seeds、6,086 parsed package records、992,099 serialized-reference edges、186 parser boundaries、missing target 0、unresolved target 0。
- Artifact population: 45 catalog seeds。candidate mappingはexact 29、provisional 15、ambiguous 1。全候補instance path 47個をinventory上で確認した。

candidate mappingのprovisional / ambiguous / not-found状態はRaw inventoryのidentity状態として保持し、見た目や公開データから確定しない。edgeのnull、未解決、parser boundary、not-observedも値の0に変換しない。

## Gate 1 — Linked timing

Collectorは決め打ちfield一覧だけではなく、catalog seedの全candidateから始め、実際のserialized relationとそのfield pathを辿る。Raw inventoryの全CDO property tree、package relation、decode stateを保持する。

~~~yaml
Melee:
  source paths:
    - catalog seed candidate instance
    - CDO ConfiguredAttackVariants[*]
    - AttackSequence relation -> AnimComposite / AnimMontage
    - VariantActiveEffect / VariantChangeEffect relation -> GameplayEffect (including null)
    - GearActor, imports, super/template, inheritance chain
  linked source types:
    - melee instance and GearActor Blueprint
    - animation sequence/composite/montage and notify export/class
    - active/change GameplayEffect
    - inherited local packages
  retain fields:
    - occurrence order, array index, source package, full property path, type, value, decode state
    - AttackAnimationTimeDurationSeconds, DamageDelaySeconds, CooldownSeconds
    - AttackVariantResetMultiplier and AttackVariantResetSeconds when present
    - VariantLoopAmount, ContinuousDamageInterval
    - AttackSequence, VariantActiveEffect, VariantChangeEffect
    - release/variant-change enchantment trigger fields when present
    - all timing-like nested properties discovered in linked packages
  unavailable states:
    - animation non-CDO payload is not extracted; notify placement and timeline are parser-boundary
    - null effect refs are retained as null
    - actual input cancel, hitstop, recovery, and overheat cycle are empirical-required

Ranged:
  source paths:
    - catalog seed candidate instance
    - AttackDefintion struct and Animation relation
    - AnimNotifyStateData[*]
    - ProjectileDefinition[*].Projectile and charged projectile relations
    - GearActor, actor/projectile/effect dependencies, super/template
  linked source types:
    - ranged instance and GearActor Blueprint
    - AnimMontage and notify exports/classes
    - projectile/actor and linked GameplayEffect
    - inherited local packages
  retain fields:
    - AttackRateSeconds, ChargeTimeSecond, ChargeDamageMultiplier
    - Animation relation and all attack/charge variants
    - projectile count, DelaySeconds, DelaySecondsPerProjectile, angle fields, target relation
    - exact NotifyStateName strings, order/index, TriggerSound and sibling properties
    - every timing-like field on linked projectile/actor/effect packages
  unavailable states:
    - actual notify enter/exit times and montage sections are parser-boundary
    - a notify name string is not promoted to a package relation
    - missing AttackRate/charge/notify/projectile facts remain not-observed, not zero
    - Shivering Bow has a provisional storable-role Raw candidate, but no instance-role candidate; preserve that distinction

Armor:
  source paths:
    - catalog seed candidate instance
    - GearActor/object-property relations
    - built-in enchantment/effect and actor CDOs
    - import, super/template, and inheritance chains
  linked source types:
    - armor instance and GearActor Blueprint
    - explicitly linked attribute, enchantment, passive-effect, and inherited packages
  retain fields:
    - serialized attack-speed, cooldown, and recovery modifiers when present
    - property ownership, target/scope relations, source occurrence, and decode state
    - all timing-like decoded fields on explicit built-in effect targets
  unavailable states:
    - Ender Armor and Vanguard Armor have no Raw candidate instance; retain not-found
    - no consistently named AttackSpeed property was observed in committed CDO trees
    - absence is not a zero modifier and does not establish the global attack-speed transform

Artifact:
  source paths:
    - catalog seed candidate instance
    - Effect -> GameplayEffect
    - ItemActorClass / TomeActorClass / spawned actor or projectile
    - ActivationAnimation, super/template, and every other serialized local relation
  linked source types:
    - Artifact instance, actor, GameplayEffect, projectile/spawn target, animation, inherited package
  retain fields:
    - linked Duration, TickInterval, interval, delay, rate, loop, recovery, charge, release, and cooldown-like properties
    - all relation edges with original names, source package/path, occurrence/index, target and traversal result
    - SharedPassiveCooldown, cooldown refund/reduction flags separately from base cooldown
  unavailable states:
    - no base cooldown value was observed in decoded linked CDO fields
    - five relevant linked Actor/GameplayEffect CDOs have partial property streams
    - Blueprint non-CDO execution payload is not decoded; cooldown start semantics remain parser-boundary
    - all provisional/ambiguous candidate paths remain explicit
~~~

### Observed timing facts and collection classes

The inventory contains 293 occurrences each for AttackAnimationTimeDurationSeconds, DamageDelaySeconds, CooldownSeconds, AttackVariantResetMultiplier, VariantLoopAmount, ContinuousDamageInterval, and AttackSequence. These are configured melee occurrence facts, not effective HPS and not 293 catalog items.

Ranged package occurrence counts include AttackRateSeconds 29, ChargeTimeSecond 18, ChargeDamageMultiplier 21, projectile NumberOfProjectiles / DelaySeconds / DelaySecondsPerProjectile 78 each, and NotifyStateName 427. Counts span the full linked inventory; they are not per-item coverage promises. They show why the collector must preserve field absence and relation/decode state per candidate.

| Class | Preserve as |
| --- | --- |
| `static-known` | decoded configured CDO values with complete owner, property path, occurrence index, type, and provenance |
| `static-relation-traversal` | object/soft-object/import/export/inheritance relation and target package/class; continue through every local `/Game` target |
| `parser-boundary` | partial/unsupported CDO stream, DataTable/Curve row payload, or non-CDO animation/Blueprint payload marked not-extracted |
| `not-observed` | a field or target absent after traversal; explicit unavailable state, never numeric zero |
| `empirical-required` | effective HPS, runtime cancel/recovery, overheat/release cycle, and trigger timing not represented by decoded static data |

Collector traversal contract:

1. Start from all catalog seed candidates, including provisional and ambiguous candidates. Preserve not-found separately.
2. Follow the actual serialized local `/Game` graph without a fixed depth limit: import/package refs, object-property and soft-object-property refs, export class/super/template/outer refs, and recorded inheritance hops.
3. Keep the source occurrence, full property path, array/struct order, source/target object and package, target class, raw package index, and stop reason. Do not collapse repeated refs or null values.
4. Retain decoded CDO child trees, package export metadata, imports, inheritance, `payloadCoverage`, diagnostics, and unavailable ranges for each reached package.
5. Discover timing names by field contents and relation structure rather than a closed taxonomy. Keep newly observed timing-like fields and explicit unknown states.
6. Never infer a runtime effect from a display name, a null/absent property, an unsupported parser state, or a public numeric value.

## Gate 2 — Artifact base cooldown

「classification」はbase-cooldown値がRaw Structural Inventoryから得られるかを表す。cooldown開始semanticsは別factとして全45 item rowに記録した。Artifactごとのcandidate path、candidate status、classificationはmachine artifactの`itemResults`、bucket一覧は下表を参照。

| Base cooldown result | Count | Items |
| --- | ---: | --- |
| static-known | 0 | none |
| static-relation-traversal | 0 | none |
| parser-boundary | 5 | Corrupted Pumpkin, Fishing Rod, Light Feather, Shock Powder, Totem of Casting |
| not-observed | 40 | all remaining 40 IDs listed below |

`parser-boundary` rows:

| Artifact | Candidate status | linked package and boundary |
| --- | --- | --- |
| Corrupted Pumpkin | provisional | `CorruptedBeacon_Spooky1/BP_CorruptedBeacon_Spooky1GameplayEffect` — property stream partial, reached from `Effect` |
| Fishing Rod | exact | `FishingRod/FishingRodGameplayEffect` — property stream partial, reached from `Effect` |
| Light Feather | exact | `LightFeather/LightFeatherGameplayEffect` — property stream partial, reached from `Effect` |
| Shock Powder | exact | `ShockPowder/ShockpowderGameplayEffect` — property stream partial, reached from `Effect` |
| Totem of Casting | provisional | `SoulTotemOfCasting/BP_SoulTotemOfCasting` — property stream partial in the linked actor package/import closure |

`not-observed` rows (candidate paths remain in the JSON artifact):

`blast-fungus`, `boots-of-swiftness`, `buzzy-nest`, `corrupted-beacon`, `corrupted-seeds`, `death-cap-mushroom`, `enchanted-grass`, `enchanters-tome`, `eye-of-the-guardian`, `fireworks-arrow`, `flaming-quiver`, `ghost-cloak`, `golem-kit`, `gong-of-weakening`, `harpoon-quiver`, `harvester`, `ice-wand`, `iron-hide-amulet`, `lightning-rod`, `love-medallion`, `powershaker`, `satchel-of-elements`, `satchel-of-elixirs`, `satchel-of-snacks`, `scatter-mines`, `shadow-shifter`, `soul-healer`, `soul-lantern`, `spinblade`, `tasty-bone`, `thundering-quiver`, `tome-of-duplication`, `torment-quiver`, `totem-of-regeneration`, `totem-of-shielding`, `updraft-tome`, `vexing-chant`, `void-quiver`, `wind-horn`, `wonderful-wheat`.

`staticRelationTraversal` is empty because no base-cooldown value was found on an explicitly linked package. `Death Cap Mushroom` may have a cooldown value in a public game-derived database, but that value is not Raw provenance and is excluded here.

Other cooldown-named facts are retained independently: Shadow Shifter `SharedPassiveCooldown` and cooldown-refund fraction; Soul Lantern and Spinblade `SharedPassiveCooldown`; Vexing Chant `CoolDownForEachPetDeath`; Totem of Casting linked actor `CooldownReductionPercentage`. These are not base Artifact cooldown values. A configured zero for Spinblade’s passive cooldown remains a known value and does not change the base-cooldown result.

Cooldown start semantics are `parser-boundary` across the 45 static-inventory rows: instance/effect/actor CDO values and activation/effect relations do not expose when the cooldown timer starts, and Blueprint non-CDO execution payloads are marked not-extracted. Do not infer a start point from `ActivationAnimation`, `Effect`, or `ActorClass` alone.

## Gate decision

- linked timing: traversal/retention rule fixed; known values, relation traversal, parser boundaries, empirical-only behavior, and not-observed states are distinguished.
- Artifact base cooldown: all 45 rows have a source outcome; 5 are parser-boundary and 40 not-observed. No value was taken from public sources as Raw.
- new Raw extraction required: **no**. Current inventory is sufficient to close these collection-contract gates by retaining the explicit states; it does not make absent values known.

**SAFE TO START HORIZONTAL BREADTH**

Validation of this research change: `git diff --check` and the committed Raw Structural Inventory audit. See PR description for command results.
