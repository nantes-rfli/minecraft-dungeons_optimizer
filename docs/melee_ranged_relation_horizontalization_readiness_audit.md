# Melee / Ranged Relation Horizontalization Readiness Audit

## 1. Executive conclusion

Baseline:

```text
main:
b0c46ad7c91098078351afb7ae2a68d1c049a132
```

current main と一致する。matched Formal Identity / Formal Value の first-wave 対象は Melee 27 / Ranged 23 / total 50。

committed Raw Structural Inventory shard を直接再読し、50 domain の candidate root から primary relation occurrence を再計算した。

```text
Melee AttackSequence:
  domains observed: 27 / 27
  occurrences: 96
  source package = candidate root: all
  target kind = import: all
  target Structural package available: all

Ranged Projectile:
  domains observed: 23 / 23
  occurrences: 23
  source package = candidate root: all
  target kind = import: all
  target Structural package available: all
```

first Relation population wave に source-resolution / inheritance / parser blocker はない。

```text
RELATION CONTRACT DECISION:
  B. Relation v2 migration
```

Melee 27 + Ranged 23 は同一 population PR で扱える。ただし v2 migration / source adapter foundation と population は分離する。

## 2. Current Relation contract audit

### KEEP

- source Formal Identity の matched gate
- same-source Raw observation requirement
- RelationRef / projectionRef / EvidenceRef の分離
- serialized target `objectName` + `gamePackagePath`
- ObjectProperty -> import -> outer Package を source evidence として証明する原則
- relation projection と target Raw verification の独立性
- unavailable relation を semantic relationとして出さない原則
- Rawに記録された sourceIndex を occurrence identity とし、生成順/配列位置で推測しない原則
- Scatter Crossbow の既存 RelationRef / projectionRef

### GENERALIZE

- `RelationRef` literal union -> domain-parameterized relation definition
- `RelationOccurrence` -> explicit domainId + scopeRef / collectionRef + sourceIndex
- `FormalRelationInputs` -> representative RawPackageSnapshot と Horizontal/Structural source adapter を受けられる source-neutral input
- 3 fixed relation definitions -> relation kind registry
- representative RawPackageSnapshot-only reader -> verified Structural edge reader
- integration audit の `occurrence.slice` dependency -> `occurrence.domainId`

### REPLACE

- `slice` を generic domain identity として流用すること
- current `TargetResolution` だけで serialized target resolution と full target Raw snapshot verification を同一視すること
- `scatterParent` という slice-specific serialized fieldを horizontal parent/child rule として使い続けること

### DEFER

- FormalProjectile
- AttackSequence timing / montage / notify
- effective attack cadence
- projectile damage / hit behavior
- GameplayEffect semantic
- Armor / Artifact relation horizontalization
- Application / Optimizer migration
- generic UE graph mirror

## 3. Relation v1 vs v2 decision

### A. v1 compatibility-preserving foundation

既存3 projectionの文字列identityを守るだけなら可能。ただし current v1 は 3 fixed slice を serialized contract としており、`slice` の意味を silently `domainId` へ拡張し、TargetResolution の意味も拡張することになる。

### B. v2 migration

v2で occurrence identity と target boundary を明示する。

```ts
type ScopeRelationOccurrence = {
  domainId: string
  scopeRef: string
}

type CollectionRelationOccurrence = {
  domainId: string
  collectionRef: string
  sourceIndex: number
}

type RelationOccurrence =
  | ScopeRelationOccurrence
  | CollectionRelationOccurrence
```

Value v2とのjoinが自然で、Armor / Artifactへ後で広げても Raw graph mirror にならない。

既存3件は migration しても RelationRef / projectionRef / evidence ID / serialized target / target verification outcome を維持する。occurrence JSON shape は v2へ移るが、logical occurrence identity は維持する。

## 4. Proposed RelationOccurrence

```text
Melee AttackSequence:
  domainId
  collectionRef = configured-attacks
  sourceIndex = ConfiguredAttackVariants element.index

Ranged Projectile:
  domainId
  collectionRef = projectile-definitions
  sourceIndex = AttackDefintion.ProjectileDefinition element.index

Battle Robe GearActor:
  domainId = battle-robe
  scopeRef = source

Death Cap Mushroom Effect:
  domainId = death-cap-mushroom
  scopeRef = source
```

`sourceIndex` は今回再読した Structural edge の `sourceOccurrence.arrayIndex` をそのまま使用する。

## 5. Proposed RelationRef strategy

新規:

```text
relation:<domainId>:attack-sequence@1
relation:<domainId>:projectile@1
```

既存:

```text
relation:scatter-crossbow:projectile@1
relation:battle-robe:gear-actor@1
relation:death-cap-mushroom:effect@1
```

既存3 RelationRefは変更しない。projectionRefも既存3件は byte-identical を regression lock とする。新規 collection relation は relationRef + sourceIndex で stable projection identity を作る。

## 6. Source adapter / provenance design

Horizontal artifactをFormal semanticへコピーしない。

```text
candidate relation ref
-> edgeId
-> sourceRelations[edgeId]
-> verified Structural shard
-> exact Structural edge
-> exact source property occurrence
-> serialized target object/package
-> Formal Relation evidence
```

adapterで必ず検証するもの:

1. candidate relation ref の `edgeId` が sourceRelations に一意。
2. candidate `sourcePackage` / `sourceRelationPathId` が source relation と一致。
3. Structural manifest dataset / shard compressed+uncompressed identity を検証。
4. Structural edge の id / sourcePackage / propertyPath / arrayIndex / targetKind / targetObject / targetPackage を照合。
5. exact source provenance を `matchedIdentityDomainIdFromSource` へ渡す。
6. RelationEvidenceRecord は exact Structural occurrence / import chain を evidence として持つ。

Value側の verified Structural shard reader / provenance verifier は共通primitiveとして再利用できる。relation occurrence selectionとedge verificationは Relation専用adapterにする。

## 7. Identity same-source gate

gate:

```text
reviewed Formal Identity assertion
+ resolution.state = matched
+ assertion/domainId correspondence
+ sameRawSource(identity evidence, relation source occurrence)
```

Raw candidate statusは gateに使わない。

今回50件は relation source package = candidate root = Formal assertion applicationScope.packagePath。したがって PR #121 で導入した provenance-based Identity gate をそのまま再利用できる。

## 8. Target resolution boundary

今回Formal Relationへ上げてよいのは:

```text
serialized target object
serialized /Game package path
Structural target package path / local availability
```

上げてはいけないもの:

```text
Projectile damage semantic
effective projectile behavior
AttackSequence timing
animation timing
GameplayEffect semantics
effective mechanics
```

current `TargetResolution` は full RawPackageSnapshot verification の状態であり、Structural edge の target package resolution と同一ではない。v2では分離する。

```ts
serializedTargetResolution:
  | { state: 'resolved-local-package'; structuralPackagePath: string }
  | { state: 'known-null' | 'native-boundary' | 'outside-game-boundary'
      | 'missing-target' | 'parser-boundary' }

targetRawVerification:
  | { input: 'not-supplied'; result: 'not-resolved'; reason: 'target-snapshot-not-supplied' }
  | { input: 'supplied'; result: 'resolved'; targetEvidenceRef: string }
  | { input: 'supplied'; result: 'not-resolved'; reason: 'target-snapshot-mismatch'; targetEvidenceRef: string }
```

first wave 119 occurrences はすべて `serializedTargetResolution = resolved-local-package`。これは target gameplay semantic が known という意味ではない。

## 9. Melee 27 individual readiness

```csv
domainId,category,formalAssertionApplicationScopePackagePath,horizontalCatalogRow,candidatePackage,candidateRole,relationPathId,configuredAttackSourceIndexSet,relationOccurrenceCount,finalReadiness
anchor,melee,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/BP_AnchorInstance,melee:anchor; rawCandidateStatus=exact,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/BP_AnchorInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
axe,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance,melee:axe; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
backstabber,melee,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance,melee:backstabber; rawCandidateStatus=exact,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
battlestaff,melee,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,melee:battlestaff; rawCandidateStatus=exact,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,instance,rp-root,0|1|2|3|4|5|6|7|8|9,10,ready-with-relation-source-adapter
boneclub,melee,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/BP_BoneclubInstance,melee:boneclub; rawCandidateStatus=exact,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/BP_BoneclubInstance,instance,rp-root,0|1,2,ready-with-relation-source-adapter
bonehead-hammer,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance,melee:bonehead-hammer; rawCandidateStatus=provisional,Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
claymore,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance,melee:claymore; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
coral-blade,melee,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance,melee:coral-blade; rawCandidateStatus=exact,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
cutlass,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/BP_CutlassInstance,melee:cutlass; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/BP_CutlassInstance,instance,rp-root,0|1,2,ready-with-relation-source-adapter
daggers,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,melee:daggers; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,instance,rp-root,0|1|2|3|4|5,6,ready-with-relation-source-adapter
double-axe,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance,melee:double-axe; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance,instance,rp-root,0|1,2,ready-with-relation-source-adapter
fighters-bindings,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,melee:fighters-bindings; rawCandidateStatus=ambiguous,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,instance,rp-root,0|1|2|3,4,ready-direct
gauntlets,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,melee:gauntlets; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,instance,rp-root,0|1|2|3|4|5|6,7,ready-with-relation-source-adapter
glaive,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance,melee:glaive; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
katana,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance,melee:katana; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
mace,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance,melee:mace; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
obsidian-claymore,melee,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/BP_ObsidianClaymoreInstance,melee:obsidian-claymore; rawCandidateStatus=exact,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/BP_ObsidianClaymoreInstance,instance,rp-root,0|1,2,ready-with-relation-source-adapter
pickaxe,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/BP_Pickaxe_SteelInstance,melee:pickaxe; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/BP_Pickaxe_SteelInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
rapier,melee,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,melee:rapier; rawCandidateStatus=exact,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,instance,rp-root,0|1|2|3|4|5|6|7|8|9|10|11|12|13,14,ready-with-relation-source-adapter
sickles,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,melee:sickles; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,instance,rp-root,0|1|2|3|4|5,6,ready-with-relation-source-adapter
sinister-sword,melee,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance,melee:sinister-sword; rawCandidateStatus=provisional,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
soul-knife,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulKnife/BP_SoulKnifeInstance,melee:soul-knife; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulKnife/BP_SoulKnifeInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
soul-scythe,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/BP_SoulScytheInstance,melee:soul-scythe; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/BP_SoulScytheInstance,instance,rp-root,0|1,2,ready-with-relation-source-adapter
spear,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance,melee:spear; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
tempest-knife,melee,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance,melee:tempest-knife; rawCandidateStatus=exact,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance,instance,rp-root,0|1|2,3,ready-with-relation-source-adapter
void-touched-blades,melee,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,melee:void-touched-blades; rawCandidateStatus=exact,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,instance,rp-root,0|1|2|3,4,ready-with-relation-source-adapter
whip,melee,Dungeons/Content/Actors/Equipment/MeleeWeapons/Whip/BP_WhipInstance,melee:whip; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/MeleeWeapons/Whip/BP_WhipInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
```

## 10. Ranged 23 individual readiness

```csv
domainId,category,formalAssertionApplicationScopePackagePath,horizontalCatalogRow,candidatePackage,candidateRole,relationPathId,projectileDefinitionSourceIndexSet,relationOccurrenceCount,finalReadiness
bow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/Bow/BP_BowInstance,ranged:bow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/Bow/BP_BowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
bubble-bow,ranged,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_BubbleBowInstance,ranged:bubble-bow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_BubbleBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
burst-crossbow,ranged,Dungeons/Content/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossbowInstance,ranged:burst-crossbow; rawCandidateStatus=exact,Dungeons/Content/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
cog-crossbow,ranged,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowInstance,ranged:cog-crossbow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_CrossbowInstance,ranged:crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_CrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
dual-crossbows,ranged,Dungeons/Content/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossbowsInstance,ranged:dual-crossbows; rawCandidateStatus=exact,Dungeons/Content/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossbowsInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
exploding-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowInstance,ranged:exploding-crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
harpoon-crossbow,ranged,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowInstance,ranged:harpoon-crossbow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
heavy-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbowInstance,ranged:heavy-crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
hunting-bow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowInstance,ranged:hunting-bow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
longbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/LongBow/BP_LongbowInstance,ranged:longbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/LongBow/BP_LongbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
power-bow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/PowerBow/BP_PowerBowInstance,ranged:power-bow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/PowerBow/BP_PowerBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
rapid-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossbowInstance,ranged:rapid-crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
scatter-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance,ranged:scatter-crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance,instance,rp-root,0,1,ready-direct
shadow-crossbow,ranged,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowInstance,ranged:shadow-crossbow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
shortbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortbowInstance,ranged:shortbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
shrieking-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance,ranged:shrieking-crossbow; rawCandidateStatus=provisional,Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
soul-bow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowInstance,ranged:soul-bow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
soul-crossbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossbowInstance,ranged:soul-crossbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossbowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
trickbow,ranged,Dungeons/Content/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowInstance,ranged:trickbow; rawCandidateStatus=exact,Dungeons/Content/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
twisting-vine-bow,ranged,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowInstance,ranged:twisting-vine-bow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
void-bow,ranged,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowInstance,ranged:void-bow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
wind-bow,ranged,Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowInstance,ranged:wind-bow; rawCandidateStatus=exact,Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowInstance,instance,rp-root,0,1,ready-with-relation-source-adapter
```

Scatter Crossbow は current representative Formal Relation と一致:

```text
sourceIndex: 0
edgeId: 2370fd1907b463edc01c4924
target object: /Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow.BP_ScatterCrossBow_Arrow_C
target package: Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow
```

## 11. Per-occurrence source-backed census

全 occurrence。source relation は全件 candidate root なので `sourceRelationPathId = rp-root`。

```csv
domainId,category,sourceIndex,relationPropertyPath,edgeId,sourcePackage,sourceRelationPathId,targetKind,targetObject,targetGamePackage,targetStructuralPackage,targetStructuralPackageAvailability,structuralTraversalStopReason
anchor,melee,0,ConfiguredAttackVariants[0].AttackSequence,a22c1027329bafbd2f2cbd5d,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/BP_AnchorInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/Animations/Player_Master_AnchorAxe.Player_Master_AnchorAxe,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/Animations/Player_Master_AnchorAxe,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/Anchor/Animations/Player_Master_AnchorAxe,available,already-visited
axe,melee,0,ConfiguredAttackVariants[0].AttackSequence,bc54849a74ba64b753046d13,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_1LeftToRight.Player_Master_AxeCombo_1LeftToRight,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_1LeftToRight,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_1LeftToRight,available,already-visited
axe,melee,1,ConfiguredAttackVariants[1].AttackSequence,13929206972792b5489a1c34,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_2LeftToRight_Alternative.Player_Master_AxeCombo_2LeftToRight_Alternative,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_2LeftToRight_Alternative,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_2LeftToRight_Alternative,available,followed
axe,melee,2,ConfiguredAttackVariants[2].AttackSequence,544394ed4ad98e6e12ed11de,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/BP_AxeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_3SpinAttack.Player_Master_AxeCombo_3SpinAttack,/Game/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_3SpinAttack,Dungeons/Content/Actors/Equipment/MeleeWeapons/Axe/Animations/Player_Master_AxeCombo_3SpinAttack,available,already-visited
backstabber,melee,0,ConfiguredAttackVariants[0].AttackSequence,1ab50469d56f6cc8f7768e22,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_1.Player_Master_BackstabberCombo_1,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_1,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_1,available,followed
backstabber,melee,1,ConfiguredAttackVariants[1].AttackSequence,4dbab743ef5ce581e422c74c,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_2.Player_Master_BackstabberCombo_2,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_2,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_2,available,already-visited
backstabber,melee,2,ConfiguredAttackVariants[2].AttackSequence,1ac48e1eaabb7229bb9a9ffa,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/BP_BackstabberInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_3.Player_Master_BackstabberCombo_3,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_3,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/Backstabber/Animations/Player_Master_BackstabberCombo_3,available,followed
battlestaff,melee,0,ConfiguredAttackVariants[0].AttackSequence,d6b4cd1f3053f84cebf7451e,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo1_Left.Player_Master_BoStaffCombo1_Left,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo1_Left,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo1_Left,available,already-visited
battlestaff,melee,1,ConfiguredAttackVariants[1].AttackSequence,c18d68df4ceaacbaaab14902,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo2_Right.Player_Master_BoStaffCombo2_Right,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo2_Right,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo2_Right,available,already-visited
battlestaff,melee,2,ConfiguredAttackVariants[2].AttackSequence,935eb29a919e9465e3a38f7d,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo3_Swipe.Player_Master_BoStaffCombo3_Swipe,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo3_Swipe,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo3_Swipe,available,already-visited
battlestaff,melee,3,ConfiguredAttackVariants[3].AttackSequence,ca25159e812ba3a068ba274a,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo4_Smash.Player_Master_BoStaffCombo4_Smash,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo4_Smash,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo4_Smash,available,already-visited
battlestaff,melee,4,ConfiguredAttackVariants[4].AttackSequence,9b2f6a48f3a1dee0bbd6094a,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo5_Thrust1.Player_Master_BoStaffCombo5_Thrust1,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo5_Thrust1,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo5_Thrust1,available,already-visited
battlestaff,melee,5,ConfiguredAttackVariants[5].AttackSequence,ccda958fe863b27ef1f1b2b3,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo6_Thrust2.Player_Master_BoStaffCombo6_Thrust2,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo6_Thrust2,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo6_Thrust2,available,already-visited
battlestaff,melee,6,ConfiguredAttackVariants[6].AttackSequence,5485b2f83311f9282d59c34b,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo7_SpinAttack1.Player_Master_BoStaffCombo7_SpinAttack1,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo7_SpinAttack1,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo7_SpinAttack1,available,followed
battlestaff,melee,7,ConfiguredAttackVariants[7].AttackSequence,d129b45ff34e7cfdb45e1dd9,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo8_SpinAttack2.Player_Master_BoStaffCombo8_SpinAttack2,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo8_SpinAttack2,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo8_SpinAttack2,available,already-visited
battlestaff,melee,8,ConfiguredAttackVariants[8].AttackSequence,cafce8a6f6f5eee122c47a11,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo9_SpinAttack3.Player_Master_BoStaffCombo9_SpinAttack3,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo9_SpinAttack3,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo9_SpinAttack3,available,already-visited
battlestaff,melee,9,ConfiguredAttackVariants[9].AttackSequence,c4ef193ec1b1a0c22d7409ec,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/BP_BattlestaffInstance,rp-root,import,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo10_FinalImpact.Player_Master_BoStaffCombo10_FinalImpact,/Game/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo10_FinalImpact,Dungeons/Content/Patch1/Actors/Equipment/MeleeWeapons/Battlestaff/Animations/Player_Master_BoStaffCombo10_FinalImpact,available,already-visited
boneclub,melee,0,ConfiguredAttackVariants[0].AttackSequence,523d849638003332435f6adf,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/BP_BoneclubInstance,rp-root,import,/Game/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo1.Player_Master_BoneclubCombo1,/Game/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo1,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo1,available,already-visited
boneclub,melee,1,ConfiguredAttackVariants[1].AttackSequence,10759a7b2e88781b2b1113ab,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/BP_BoneclubInstance,rp-root,import,/Game/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo2.Player_Master_BoneclubCombo2,/Game/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo2,Dungeons/Content/Content_DLC4/Actors/Equipment/MeleeWeapons/Boneclub/Animations/Player_Master_BoneclubCombo2,available,followed
bonehead-hammer,melee,0,ConfiguredAttackVariants[0].AttackSequence,187c8a8dc98515b69df6d565,Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Hammer/Animations/Player_Master_SkeletonHammerCombo_1Strike_Separated_Composite.Player_Master_SkeletonHammerCombo_1Strike_Separated_Composite,/Game/Actors/Equipment/MeleeWeapons/Hammer/Animations/Player_Master_SkeletonHammerCombo_1Strike_Separated_Composite,Dungeons/Content/Actors/Equipment/MeleeWeapons/Hammer/Animations/Player_Master_SkeletonHammerCombo_1Strike_Separated_Composite,available,followed
claymore,melee,0,ConfiguredAttackVariants[0].AttackSequence,c175c574f6ea9ca64e18d5dd,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo1.Player_Master_ClaymoreCombo1,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo1,available,already-visited
claymore,melee,1,ConfiguredAttackVariants[1].AttackSequence,5ee52d6aadd7432b0139c275,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo2.Player_Master_ClaymoreCombo2,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo2,available,already-visited
claymore,melee,2,ConfiguredAttackVariants[2].AttackSequence,8cd058e7f0936b905d502b6d,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/BP_ClaymoreInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo3.Player_Master_ClaymoreCombo3,/Game/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Claymore/Animations/Player_Master_ClaymoreCombo3,available,already-visited
coral-blade,melee,0,ConfiguredAttackVariants[0].AttackSequence,482015e62fc0c90b96cda699,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_1.Player_Master_CoralBladeCombo_1,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_1,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_1,available,followed
coral-blade,melee,1,ConfiguredAttackVariants[1].AttackSequence,25f6acfda287a766f2e4c925,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_2.Player_Master_CoralBladeCombo_2,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_2,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_2,available,followed
coral-blade,melee,2,ConfiguredAttackVariants[2].AttackSequence,e0ae5495d0ac84b19a843ee3,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/BP_CoralBladeInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_3.Player_Master_CoralBladeCombo_3,/Game/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_3,Dungeons/Content/Content_DLC5/Actors/Equipment/MeleeWeapons/CoralBlade/Animations/Player_Master_CoralBladeCombo_3,available,already-visited
cutlass,melee,0,ConfiguredAttackVariants[0].AttackSequence,8692b32eb36da71f769def00,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/BP_CutlassInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_1LeftToRight.Player_Master_CutlassCombo_1LeftToRight,/Game/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_1LeftToRight,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_1LeftToRight,available,already-visited
cutlass,melee,1,ConfiguredAttackVariants[1].AttackSequence,1e75d0b67f58869bf5d54671,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/BP_CutlassInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_2LeftToRight_Alternative.Player_Master_CutlassCombo_2LeftToRight_Alternative,/Game/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_2LeftToRight_Alternative,Dungeons/Content/Actors/Equipment/MeleeWeapons/Cutlass/Animations/Player_Master_CutlassCombo_2LeftToRight_Alternative,available,followed
daggers,melee,0,ConfiguredAttackVariants[0].AttackSequence,44408b47d8a9a59996b7abe9,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_1.Player_Master_DaggersComboDeluxe_1,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_1,available,followed
daggers,melee,1,ConfiguredAttackVariants[1].AttackSequence,cc453e7c89b01dc33049fcd6,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_2.Player_Master_DaggersComboDeluxe_2,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_2,available,already-visited
daggers,melee,2,ConfiguredAttackVariants[2].AttackSequence,42f25fada44c4967fa552784,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_3.Player_Master_DaggersComboDeluxe_3,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_3,available,already-visited
daggers,melee,3,ConfiguredAttackVariants[3].AttackSequence,eb91dd7ef8c9cc5dce0b6f1f,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_4.Player_Master_DaggersComboDeluxe_4,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_4,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_4,available,already-visited
daggers,melee,4,ConfiguredAttackVariants[4].AttackSequence,88c7a6684ea2256db05ff167,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_5.Player_Master_DaggersComboDeluxe_5,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_5,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_5,available,already-visited
daggers,melee,5,ConfiguredAttackVariants[5].AttackSequence,8f7d4cc06e25adbe0e0bc629,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/BP_DaggersInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_6.Player_Master_DaggersComboDeluxe_6,/Game/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_6,Dungeons/Content/Actors/Equipment/MeleeWeapons/Daggers/Animations/Player_Master_DaggersComboDeluxe_6,available,already-visited
double-axe,melee,0,ConfiguredAttackVariants[0].AttackSequence,c0d942e75cefd9cd3e3b30cc,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack1.Player_Master_DoubleAxeCombo_SpinAttack1,/Game/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack1,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack1,available,already-visited
double-axe,melee,1,ConfiguredAttackVariants[1].AttackSequence,95e6788a177599f1f6859bf6,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/BP_DoubleAxeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack2.Player_Master_DoubleAxeCombo_SpinAttack2,/Game/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack2,Dungeons/Content/Actors/Equipment/MeleeWeapons/DoubleAxe/Animations/Player_Master_DoubleAxeCombo_SpinAttack2,available,already-visited
fighters-bindings,melee,0,ConfiguredAttackVariants[0].AttackSequence,c95c2199a7eeafd638bcf396,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1.Player_Master_GauntletsCombo1,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1,available,already-visited
fighters-bindings,melee,1,ConfiguredAttackVariants[1].AttackSequence,cfa184ee79cf8a98d29d3d1d,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2.Player_Master_GauntletsCombo2,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2,available,already-visited
fighters-bindings,melee,2,ConfiguredAttackVariants[2].AttackSequence,d6e8fa4c236b0e5f529c522d,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3.Player_Master_GauntletsCombo3,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3,available,already-visited
fighters-bindings,melee,3,ConfiguredAttackVariants[3].AttackSequence,ceb3f8cde99935bfd5e8b598,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4.Player_Master_GauntletsCombo4,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4,available,already-visited
gauntlets,melee,0,ConfiguredAttackVariants[0].AttackSequence,27a1a8e8fe97ff56951b5958,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1.Player_Master_GauntletsCombo1,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo1,available,already-visited
gauntlets,melee,1,ConfiguredAttackVariants[1].AttackSequence,c9d4807e6887c61de34f7111,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2.Player_Master_GauntletsCombo2,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo2,available,already-visited
gauntlets,melee,2,ConfiguredAttackVariants[2].AttackSequence,2688085dd812129942fad50c,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3.Player_Master_GauntletsCombo3,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo3,available,already-visited
gauntlets,melee,3,ConfiguredAttackVariants[3].AttackSequence,a3bb9b59a655f5fddb62a5c4,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4.Player_Master_GauntletsCombo4,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo4,available,already-visited
gauntlets,melee,4,ConfiguredAttackVariants[4].AttackSequence,f5610f17808c5ba2ab46383b,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo5.Player_Master_GauntletsCombo5,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo5,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo5,available,already-visited
gauntlets,melee,5,ConfiguredAttackVariants[5].AttackSequence,9fac59b942c77920b61b3b16,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo6.Player_Master_GauntletsCombo6,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo6,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo6,available,already-visited
gauntlets,melee,6,ConfiguredAttackVariants[6].AttackSequence,3d7ae79285dd00a4d7693c94,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/BP_GauntletsInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo7Punch2.Player_Master_GauntletsCombo7Punch2,/Game/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo7Punch2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets/Animations/Player_Master_GauntletsCombo7Punch2,available,already-visited
glaive,melee,0,ConfiguredAttackVariants[0].AttackSequence,358b7db521d5bde065dc6220,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack1.Player_Master_GlaiveCombo_Attack1,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack1,available,already-visited
glaive,melee,1,ConfiguredAttackVariants[1].AttackSequence,9f45877546d24a59a5660db8,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack2.Player_Master_GlaiveCombo_Attack2,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack2,available,already-visited
glaive,melee,2,ConfiguredAttackVariants[2].AttackSequence,977d9cfe536abafdd04c6896,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/BP_GlaiveInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack3.Player_Master_GlaiveCombo_Attack3,/Game/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Glaive/Animations/Player_Master_GlaiveCombo_Attack3,available,already-visited
katana,melee,0,ConfiguredAttackVariants[0].AttackSequence,a9718db73fdfbac063647575,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_1.Player_Master_KatanaCombo_1,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_1,available,already-visited
katana,melee,1,ConfiguredAttackVariants[1].AttackSequence,606853bdcb9a1bb07d45578e,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_2.Player_Master_KatanaCombo_2,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_2,available,already-visited
katana,melee,2,ConfiguredAttackVariants[2].AttackSequence,14022f6296a19ec9e4b885d9,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/BP_KatanaInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_3.Player_Master_KatanaCombo_3,/Game/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Katana/Animations/Player_Master_KatanaCombo_3,available,followed
mace,melee,0,ConfiguredAttackVariants[0].AttackSequence,935b2609a29b19f620547722,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_1.Player_Master_MaceSwing_1,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_1,available,already-visited
mace,melee,1,ConfiguredAttackVariants[1].AttackSequence,54cd0f726d0ecab937beb829,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_2.Player_Master_MaceSwing_2,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_2,available,followed
mace,melee,2,ConfiguredAttackVariants[2].AttackSequence,5522389b0843247856f6e890,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/BP_MaceInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_3.Player_Master_MaceSwing_3,/Game/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Mace/Animations/Player_Master_MaceSwing_3,available,followed
obsidian-claymore,melee,0,ConfiguredAttackVariants[0].AttackSequence,c6c8602a79de56f9efe9c324,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/BP_ObsidianClaymoreInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo1.Player_Master_ObsidianClaymoreCombo1,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo1,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo1,available,already-visited
obsidian-claymore,melee,1,ConfiguredAttackVariants[1].AttackSequence,43ed0da125eab84db6f18385,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/BP_ObsidianClaymoreInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo3.Player_Master_ObsidianClaymoreCombo3,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo3,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/ObsidianClaymore/Animations/Player_Master_ObsidianClaymoreCombo3,available,already-visited
pickaxe,melee,0,ConfiguredAttackVariants[0].AttackSequence,be72191ad9aa88ef1905f366,Dungeons/Content/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/BP_Pickaxe_SteelInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/Animations/Player_Master_PickAxe_Hit2.Player_Master_PickAxe_Hit2,/Game/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/Animations/Player_Master_PickAxe_Hit2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Pickaxe_Steel/Animations/Player_Master_PickAxe_Hit2,available,followed
rapier,melee,0,ConfiguredAttackVariants[0].AttackSequence,af621bad96e8a846f6489b91,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo1Start.Player_Master_RapierCombo1Start,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo1Start,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo1Start,available,already-visited
rapier,melee,1,ConfiguredAttackVariants[1].AttackSequence,78085fc2697131a0dbe2be3b,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right.Player_Master_RapierCombo2_Right,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,available,already-visited
rapier,melee,2,ConfiguredAttackVariants[2].AttackSequence,bc37df63e0d8f52296b0c981,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left.Player_Master_RapierCombo2_Left,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left,available,already-visited
rapier,melee,3,ConfiguredAttackVariants[3].AttackSequence,174dead31aff4cc62a754a00,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2.Player_Master_RapierCombo2,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,available,already-visited
rapier,melee,4,ConfiguredAttackVariants[4].AttackSequence,a96272a2f4b4c2e55558754c,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble.Player_Master_RapierCombo2_MiddleDouble,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,available,already-visited
rapier,melee,5,ConfiguredAttackVariants[5].AttackSequence,1b88579cc959056410a5bacd,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right.Player_Master_RapierCombo2_Right,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,available,followed
rapier,melee,6,ConfiguredAttackVariants[6].AttackSequence,1662c3d9573ff6c68a66a2c9,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left.Player_Master_RapierCombo2_Left,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Left,available,followed
rapier,melee,7,ConfiguredAttackVariants[7].AttackSequence,1b597efb2a822499babd92f8,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2.Player_Master_RapierCombo2,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,available,already-visited
rapier,melee,8,ConfiguredAttackVariants[8].AttackSequence,3d27218030f2d2edb5104a4a,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble.Player_Master_RapierCombo2_MiddleDouble,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,available,already-visited
rapier,melee,9,ConfiguredAttackVariants[9].AttackSequence,8675dffaf92bc5563afae77c,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2.Player_Master_RapierCombo2,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2,available,already-visited
rapier,melee,10,ConfiguredAttackVariants[10].AttackSequence,10b8891107188241408c103c,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble.Player_Master_RapierCombo2_MiddleDouble,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,available,followed
rapier,melee,11,ConfiguredAttackVariants[11].AttackSequence,1d2606aacd1f778bf3496db8,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right.Player_Master_RapierCombo2_Right,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_Right,available,already-visited
rapier,melee,12,ConfiguredAttackVariants[12].AttackSequence,a89dcfac95daed99c8279d84,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble.Player_Master_RapierCombo2_MiddleDouble,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo2_MiddleDouble,available,already-visited
rapier,melee,13,ConfiguredAttackVariants[13].AttackSequence,d9d1829eb1cd52f82249f52f,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/BP_RapierInstance,rp-root,import,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo5Final.Player_Master_RapierCombo5Final,/Game/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo5Final,Dungeons/Content/Patch2/Actors/Equipment/MeleeWeapons/Rapier/Animations/Player_Master_RapierCombo5Final,available,already-visited
sickles,melee,0,ConfiguredAttackVariants[0].AttackSequence,eeff0482f5c8a2bb33d1dab3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo1.Player_Master_SicklesCombo1,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo1,available,already-visited
sickles,melee,1,ConfiguredAttackVariants[1].AttackSequence,09eb972fa842ebce92a2c165,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo2.Player_Master_SicklesCombo2,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo2,available,followed
sickles,melee,2,ConfiguredAttackVariants[2].AttackSequence,1d2d4b478fa561c3200b9525,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo3.Player_Master_SicklesCombo3,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo3,available,already-visited
sickles,melee,3,ConfiguredAttackVariants[3].AttackSequence,7971762556b90ba70b6ed57e,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo4.Player_Master_SicklesCombo4,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo4,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo4,available,followed
sickles,melee,4,ConfiguredAttackVariants[4].AttackSequence,a0bd0551d79750f474007839,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo5.Player_Master_SicklesCombo5,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo5,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo5,available,followed
sickles,melee,5,ConfiguredAttackVariants[5].AttackSequence,8e4193dbbc20ea2a0da531b3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/BP_SicklesInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo6.Player_Master_SicklesCombo6,/Game/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo6,Dungeons/Content/Actors/Equipment/MeleeWeapons/Sickles/Animations/Player_Master_SicklesCombo6,available,already-visited
sinister-sword,melee,0,ConfiguredAttackVariants[0].AttackSequence,15c64a499d1679e65b38cb54,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_1.Player_Master_Sword_Spooky1Swing_1,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_1,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_1,available,already-visited
sinister-sword,melee,1,ConfiguredAttackVariants[1].AttackSequence,5b3c972db67b4d16886f55d4,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_2.Player_Master_Sword_Spooky1Swing_2,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_2,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_2,available,followed
sinister-sword,melee,2,ConfiguredAttackVariants[2].AttackSequence,132938f745c9ad7c8c788e47,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_3.Player_Master_Sword_Spooky1Swing_3,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_3,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/Animations/Player_Master_Sword_Spooky1Swing_3,available,followed
soul-knife,melee,0,ConfiguredAttackVariants[0].AttackSequence,e4525abe95bc63e22622aea1,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulKnife/BP_SoulKnifeInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/SoulKnife/Animations/Player_Master_SpiritSwordStab1.Player_Master_SpiritSwordStab1,/Game/Actors/Equipment/MeleeWeapons/SoulKnife/Animations/Player_Master_SpiritSwordStab1,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulKnife/Animations/Player_Master_SpiritSwordStab1,available,already-visited
soul-scythe,melee,0,ConfiguredAttackVariants[0].AttackSequence,477a03c0f1adccd0b105732e,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/BP_SoulScytheInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_1Scythe.Player_Master_ScytheCombo_1Scythe,/Game/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_1Scythe,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_1Scythe,available,already-visited
soul-scythe,melee,1,ConfiguredAttackVariants[1].AttackSequence,0b4b01b183ed079fc82c4a1d,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/BP_SoulScytheInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_2Scythe.Player_Master_ScytheCombo_2Scythe,/Game/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_2Scythe,Dungeons/Content/Actors/Equipment/MeleeWeapons/SoulScythe/Animations/Player_Master_ScytheCombo_2Scythe,available,followed
spear,melee,0,ConfiguredAttackVariants[0].AttackSequence,3d2167b5feec6eaf7e9df802,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo1.Player_Master_SpearCombo1,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo1,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo1,available,followed
spear,melee,1,ConfiguredAttackVariants[1].AttackSequence,007e1d925a137690c8ee9983,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo2.Player_Master_SpearCombo2,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo2,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo2,available,followed
spear,melee,2,ConfiguredAttackVariants[2].AttackSequence,616e05c1c2bc87f662f06554,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/BP_SpearInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo3.Player_Master_SpearCombo3,/Game/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo3,Dungeons/Content/Actors/Equipment/MeleeWeapons/Spear/Animations/Player_Master_SpearCombo3,available,followed
tempest-knife,melee,0,ConfiguredAttackVariants[0].AttackSequence,3b960d00412963c31c6bf92e,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_1.TempestKnife_Combo_Hit_1,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_1,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_1,available,already-visited
tempest-knife,melee,1,ConfiguredAttackVariants[1].AttackSequence,750bdb06c768290bb75e3a56,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_2.TempestKnife_Combo_Hit_2,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_2,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_2,available,followed
tempest-knife,melee,2,ConfiguredAttackVariants[2].AttackSequence,cabb1aa534c015eef4738cc9,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/BP_TempestKnifeInstance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_3.TempestKnife_Combo_Hit_3,/Game/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_3,Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/TempestKnife/Animations/TempestKnife_Combo_Hit_3,available,already-visited
void-touched-blades,melee,0,ConfiguredAttackVariants[0].AttackSequence,8ab522b7b9639ddf8ea8cd9f,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_1.Player_Master_VoidBladesCombo_1,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_1,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_1,available,already-visited
void-touched-blades,melee,1,ConfiguredAttackVariants[1].AttackSequence,c622aae7690aedc567f12384,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_2.Player_Master_VoidBladesCombo_2,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_2,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_2,available,already-visited
void-touched-blades,melee,2,ConfiguredAttackVariants[2].AttackSequence,4b7a46edd6cd68605c58539e,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_3.Player_Master_VoidBladesCombo_3,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_3,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_3,available,already-visited
void-touched-blades,melee,3,ConfiguredAttackVariants[3].AttackSequence,cf1f04256919d515081dfc11,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/BP_VoidTouchedBladesInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_5.Player_Master_VoidBladesCombo_5,/Game/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_5,Dungeons/Content/Content_DLC6/Actors/Equipment/MeleeWeapons/VoidTouchedBlades/Animations/Player_Master_VoidBladesCombo_5,available,already-visited
whip,melee,0,ConfiguredAttackVariants[0].AttackSequence,faf60f544da536ed259f9eff,Dungeons/Content/Actors/Equipment/MeleeWeapons/Whip/BP_WhipInstance,rp-root,import,/Game/Actors/Equipment/MeleeWeapons/Whip/Animation/Player_Master_WhipCombo_Composite.Player_Master_WhipCombo_Composite,/Game/Actors/Equipment/MeleeWeapons/Whip/Animation/Player_Master_WhipCombo_Composite,Dungeons/Content/Actors/Equipment/MeleeWeapons/Whip/Animation/Player_Master_WhipCombo_Composite,available,already-visited
bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,ace463722b4fd6a6cf988b4e,Dungeons/Content/Actors/Equipment/RangedWeapons/Bow/BP_BowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/Bow/BP_BowArrow.BP_BowArrow_C,/Game/Actors/Equipment/RangedWeapons/Bow/BP_BowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/Bow/BP_BowArrow,available,already-visited
bubble-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,35ab539c86e9a1473c08e286,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_BubbleBowInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_Bubble_Arrow.BP_Bubble_Arrow_C,/Game/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_Bubble_Arrow,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/BubbleBow/BP_Bubble_Arrow,available,already-visited
burst-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,85840517fe00803f8c1e5913,Dungeons/Content/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossbowInstance,rp-root,import,/Game/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossBow_Arrow.BP_BurstCrossBow_Arrow_C,/Game/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossBow_Arrow,Dungeons/Content/Patch2/Actors/Equipment/RangedWeapons/BurstCrossbow/BP_BurstCrossBow_Arrow,available,already-visited
cog-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,741f856583f8d1e997744d3d,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowInstance,rp-root,import,/Game/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowArrow.BP_CogCrossbowArrow_C,/Game/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowArrow,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/CogCrossbow/BP_CogCrossbowArrow,available,already-visited
crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,233fd372804da04a0ff0d009,Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_CrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/Crossbow/BP_PlayerCrossbowArrow.BP_PlayerCrossbowArrow_C,/Game/Actors/Equipment/RangedWeapons/Crossbow/BP_PlayerCrossbowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/Crossbow/BP_PlayerCrossbowArrow,available,already-visited
dual-crossbows,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,aed267eb2764bc05d6a6138a,Dungeons/Content/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossbowsInstance,rp-root,import,/Game/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossBows_Arrow.BP_DualCrossBows_Arrow_C,/Game/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossBows_Arrow,Dungeons/Content/Patch1/Actors/Equipment/RangedWeapons/DualCrossbows/BP_DualCrossBows_Arrow,available,already-visited
exploding-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,63b1bac97e88fa9dcd9c6fc7,Dungeons/Content/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowArrow.BP_ExplodingCrossbowArrow_C,/Game/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/ExplodingCrossbow/BP_ExplodingCrossbowArrow,available,already-visited
harpoon-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,1915a48a7006ff41f1543170,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowInstance,rp-root,import,/Game/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowArrow.BP_HarpoonCrossbowArrow_C,/Game/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowArrow,Dungeons/Content/Content_DLC5/Actors/Equipment/RangedWeapons/HarpoonCrossbow/BP_HarpoonCrossbowArrow,available,already-visited
heavy-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,6778d5c406e5955079acdaa5,Dungeons/Content/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbow_Arrow.BP_HeavyCrossbow_Arrow_C,/Game/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbow_Arrow,Dungeons/Content/Actors/Equipment/RangedWeapons/HeavyCrossbow/BP_HeavyCrossbow_Arrow,available,already-visited
hunting-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,6f349af9def10f57995394be,Dungeons/Content/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowArrow.BP_HuntingBowArrow_C,/Game/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/HuntingBow/BP_HuntingBowArrow,available,already-visited
longbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,ef1700c4c3650879cddc5c80,Dungeons/Content/Actors/Equipment/RangedWeapons/LongBow/BP_LongbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/LongBow/BP_LongBowArrow.BP_LongBowArrow_C,/Game/Actors/Equipment/RangedWeapons/LongBow/BP_LongBowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/LongBow/BP_LongBowArrow,available,already-visited
power-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,64abc9f0a02d157cfa0789a0,Dungeons/Content/Actors/Equipment/RangedWeapons/PowerBow/BP_PowerBowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/PowerBow/BP_PlayerPowerBowArrow.BP_PlayerPowerBowArrow_C,/Game/Actors/Equipment/RangedWeapons/PowerBow/BP_PlayerPowerBowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/PowerBow/BP_PlayerPowerBowArrow,available,already-visited
rapid-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,b31b42d142befbbe081d1720,Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossBow_Arrow.BP_RapidCrossBow_Arrow_C,/Game/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossBow_Arrow,Dungeons/Content/Actors/Equipment/RangedWeapons/RapidCrossbow/BP_RapidCrossBow_Arrow,available,already-visited
scatter-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,2370fd1907b463edc01c4924,Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow.BP_ScatterCrossBow_Arrow_C,/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow,Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow,available,followed
shadow-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,0e25880ce22032cdcc2a8aca,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowArrow.BP_ShadowCrossbowArrow_C,/Game/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowArrow,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/ShadowCrossbow/BP_ShadowCrossbowArrow,available,already-visited
shortbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,4a03902714d2062e0025bffd,Dungeons/Content/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortBow_Arrow.BP_ShortBow_Arrow_C,/Game/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortBow_Arrow,Dungeons/Content/Actors/Equipment/RangedWeapons/Shortbow/BP_ShortBow_Arrow,available,already-visited
shrieking-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,cbec62edbfb1e2bc666428a1,Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbow_Arrow_02.BP_BatCrossbow_Arrow_02_C,/Game/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbow_Arrow_02,Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbow_Arrow_02,available,already-visited
soul-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,df9bd9efb7a618222b19c4cc,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowArrow.BP_SoulBowArrow_C,/Game/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulBow/BP_SoulBowArrow,available,already-visited
soul-crossbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,ed564d631422bd557ea8b97e,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossbowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossBow_Arrow.BP_SoulCrossBow_Arrow_C,/Game/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossBow_Arrow,Dungeons/Content/Actors/Equipment/RangedWeapons/SoulCrossbow/BP_SoulCrossBow_Arrow,available,already-visited
trickbow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,b58eccd8053337ced956c791,Dungeons/Content/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowInstance,rp-root,import,/Game/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowArrow.BP_TrickBowArrow_C,/Game/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowArrow,Dungeons/Content/Actors/Equipment/RangedWeapons/TrickBow/BP_TrickBowArrow,available,already-visited
twisting-vine-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,a561d6ed380abcd076d4fb57,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowInstance,rp-root,import,/Game/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowArrow.BP_TwistingVineBowArrow_C,/Game/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowArrow,Dungeons/Content/Content_DLC4/Actors/Equipment/RangedWeapons/TwistingVineBow/BP_TwistingVineBowArrow,available,already-visited
void-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,9f566d76c839cc1dec69d89c,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowInstance,rp-root,import,/Game/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowArrow.BP_VoidBowArrow_C,/Game/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowArrow,Dungeons/Content/Content_DLC6/Actors/Equipment/RangedWeapons/VoidBow/BP_VoidBowArrow,available,already-visited
wind-bow,ranged,0,AttackDefintion.ProjectileDefinition[0].Projectile,5362d567e861e1c2a4fab06c,Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowInstance,rp-root,import,/Game/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowArrow.BP_WindBowArrow_C,/Game/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowArrow,Dungeons/Content/Content_DLC3/Actors/Equipment/RangedWeapons/WindBow/BP_WindBowArrow,available,already-visited
```

`followed` と `already-visited` は BFS bookkeeping の違いで、semantic relationの違いではない。どちらも target Structural package は local inventory 上で利用可能。

## 12. Aggregate readiness counts

```text
Melee AttackSequence readiness:
  ready-direct: 1
    fighters-bindings
  ready-with-relation-source-adapter: 26
  needs-source-resolution/inheritance: 0
  serialized-target-known-but-target-raw-unavailable: 0
  relation-not-observed: 0
  parser-boundary: 0
  ambiguous: 0

Ranged Projectile readiness:
  ready-direct: 1
    scatter-crossbow
  ready-with-relation-source-adapter: 22
  needs-source-resolution/inheritance: 0
  serialized-target-known-but-target-raw-unavailable: 0
  relation-not-observed: 0
  parser-boundary: 0
  ambiguous: 0
```

`ready-direct` は既存 committed full Raw snapshot lane から source occurrence を取得可能という意味。新しい relation kind / mapping 自体の実装は必要。

## 13. Existing 3-projection regression boundary

current committed artifact:

```text
schemaVersion: 1
semantic relations: 3
relation projections: 3

Scatter Crossbow:
  RelationRef: relation:scatter-crossbow:projectile@1
  projectionRef: projection:relation:scatter-crossbow:projectile@1:0
  target: BP_ScatterCrossBow_Arrow_C
  targetResolution: resolved

Battle Robe:
  RelationRef: relation:battle-robe:gear-actor@1
  projectionRef: projection:relation:battle-robe:gear-actor@1:source
  target: BP_BattleRobe_C
  targetResolution: target-snapshot-not-supplied

Death Cap Mushroom:
  RelationRef: relation:death-cap-mushroom:effect@1
  projectionRef: projection:relation:death-cap-mushroom:effect@1:source
  target: BP_DeathCapMushroomGameplayEffect_C
  targetResolution: resolved
```

v2 migration regression lock:

- RelationRef unchanged
- projectionRef unchanged
- evidence IDs unchanged
- target object/package unchanged
- target Raw verification outcome unchanged
- semantic source domain unchanged
- Scatter Crossbowを参照する Value v2 `relationProjectionRef` unchanged
- logical occurrence identity unchanged

## 14. Exact next implementation scope

### PR A — Relation v2 + horizontal relation source adapter foundation

populationを増やさない。

- RelationOccurrence v2
- domain-parameterized RelationRef
- serializedTargetResolution / targetRawVerification 分離
- existing 3 projection atomic migration
- sourceRelations -> verified Structural edge adapter
- Value provenance verifierのshared primitive抽出
- same-source Formal Identity gate
- integration audit generalization
- existing 3 IDs / Scatter Value join regression tests

### PR B — Melee 27 + Ranged 23 first Relation population

- Melee: `ConfiguredAttackVariants[*].AttackSequence`
- Ranged: `AttackDefintion.ProjectileDefinition[*].Projectile`
- Melee 27 + Ranged 23 を同一PR
- sourceIndexごと独立 projection
- target semanticは serialized target identity/packageまで
- Value artifactは原則変更不要。joinは domainId + collectionRef + sourceIndex と既存 Scatter relationProjectionRef regressionで監査
- Armor / Artifact / Applicationへ広げない

## 15. Deferred items / blockers

implementation前の追加 research blocker:

```text
no
```

defer:

- VariantActiveEffect / VariantChangeEffect
- deeper Animation / montage / notify
- TriggerSound
- other Effect / ActorClass relations
- AttackSequence timing / cadence
- Projectile damage / hit behavior
- FormalProjectile
- GameplayEffect semantic
- Armor / Artifact relation horizontalization
- Application / Optimizer migration
- Native analysis
- Raw re-extraction

## Validation

```text
main SHA:
  b0c46ad7c91098078351afb7ae2a68d1c049a132

Horizontal / Structural Raw changes since prior 50-domain readiness baseline:
  0 files

Structural source-edge census:
  Melee domains: 27 / 27
  AttackSequence occurrences: 96
  Ranged domains: 23 / 23
  Projectile occurrences: 23
  source package = candidate root: 119 / 119
  target kind = import: 119 / 119
  target Structural package available: 119 / 119

Formal Identity:
  matched Melee = 27
  matched Ranged = 23

Formal Value:
  populated Melee = 27
  populated Ranged = 23
  PR #122 validation:
    npx tsc -b: pass
    npm run lint: pass
    npm test: 88 files / 1,798 tests pass
    audit:formal-value-availability: pass
    audit:formal-integration: pass
    all 49 CI audit commands: pass

Formal Relation:
  schemaVersion = 1
  semantic relations = 3
  relation projections = 3

artifact / generated source changes:
  none
```
