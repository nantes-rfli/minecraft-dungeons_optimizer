# Armor Formal Value / Relation Foundation Design Audit

## 結論

Baseline は `e0cf0ad8ef042a9e8ea3665fff3880cd5daaadbf`。

Formal Identity 済み Armor 71件は、すべて exact `applicationScope.packagePath` から current committed Horizontal Raw / Structural Inventory の selected package へ 1:1 で reconciliation できた。

監査結果は次のとおり。

- **Armor Value:** current committed Raw / Structural closure から、Armor gameplay modifier として安全に typed Formal semantic へ昇格できる serialized configured value は **0 / 71 domain**。71件すべてで value foundation は **defer**。
- **Armor Relation:** exact source root の `GearActor` edge は **71 / 71 domain、各1 occurrence、全件 resolved-local-package**。既存 `RelationKind = gear-actor` と scope occurrence で表現可能。
- **次に実装すべきwave:** **Armor GearActor Relation breadth**。Battle Robe 1件を保持し、残り70件を source-backed population する。そのために **Armor scope source adapter / builder lane** を追加する。serialized Relation schema version / RelationKind の追加は不要。
- GameplayEffect / built-in enchantment / ownership-target-scope の Armor edge は current 142-package traversal closure では観測されなかった。推測 population はしない。
- `src/data/armors.ts` / runtime の damage reduction、attack speed、cooldown、life steal、soul 等は今回の source authority ではないため Formal へ逆輸入しない。

したがって Value の選択肢は **C. source semantics不足のためschema実装を延期**。Relation は **既存schema + Armor scope adapter** が最小安全foundation。

---

## 1. Authority / method

確認した主要 authority:

- `research/domain/formal/identity-evidence-v1.json`
- `research/domain/formal/value-availability-v2.json`
- `research/domain/formal/serialized-relation-v2.json`
- `research/raw/game-data-horizontal-fact-inventory-v1.json.gz`
- `research/raw/game-data-raw-structural-inventory/manifest.json`
- `research/raw/game-data-raw-structural-inventory/shards/**`
- `src/domain/formal/valueAvailability.ts`
- `src/domain/formal/serializedRelation.ts`
- `src/domain/formal/integrationAudit.ts`
- `scripts/game-data-horizontal-fact-inventory.ts`
- `scripts/formal-value-horizontal-source.ts`
- `scripts/formal-relation-horizontal-source.ts`
- `scripts/audit-formal-value-availability.ts`
- `scripts/audit-formal-serialized-relation.ts`
- `src/data/armors.ts`
- `src/core/armor.ts`
- current Data Browser / Formal tests / fixtures / generated docs
- `docs/post_identity_formal_value_relation_breadth_readiness_audit.md`

再現用に `scripts/audit-armor-formal-foundation-design.ts` を追加した。script は current committed Horizontal inventory を読み、Identity exact root から Structural graph を traversal し、さらに traversal された全packageの **full CDO property inventory** と structural edges を直接走査する。Horizontal collector が保持しなかったpropertyを理由に false-negative としないためである。

成功runでは:

```text
Armor Identity roots:                  71
exact selected Raw package:            71 / 71
Structural packages visited:           142
Structural packages materialized:      142
Structural shards touched:             15
full CDO property observations:        965
full CDO property groups:              25
Horizontal fact observations:          223 known
Horizontal parser-boundary facts:      0
```

同一inputでscriptを2回実行して出力byte identityを確認した。

---

## 2. Armor Identity root reconciliation

`identity-evidence-v1.json` の assertion を `applicationScope.packagePath` が Armor package であることから抽出した。結果は **71件**。

各domainについて:

1. Formal semantic identity が `resolution.state = matched`
2. assertion の exact `applicationScope.packagePath`
3. Horizontal inventory の `category = armor / catalogId = domainId`
4. candidate package の `packagePath`
5. Structural graph 上の package path

を exact join した。

結果:

```text
Formal Armor Identity:        71
unique domainId:              71
exact package reconciliation: 71 / 71
duplicate:                    0
missing:                      0
```

候補名やcatalog similarityによる代替joinは使用していない。

---

## 3. Armor Value source census

### 3.1 Horizontal inventory が保持しているfact family

| source property/path | type | domain coverage | occurrence | source boundary | decode | Formal Value判断 |
|---|---|---:|---:|---|---|---|
| `GearActor` | ObjectProperty | 71 | 105 | root 71 + traversed 34 | decoded/known | ValueではなくRelation |
| `InventoryDropSound` | SoftObjectProperty | 71 | 105 | root 71 + traversed 34 | decoded/known | presentation/audio。除外 |
| `PrimaryActorTick` | StructProperty | 5 | 5 | root/inheritance/GearActor traversal | decoded/known | engine plumbing。semantic unknown |
| `PrimaryActorTick.bStartWithTickEnabled` | BoolProperty | 5 | 5 | 同上 | decoded/known | engine plumbing。Armor modifierではない |
| `PrimaryActorTick.TickInterval` | FloatProperty | 3 | 3 | GearActor traversal | decoded/known | numberは読めるがArmor gameplay semantic/単位をsourceだけで確定しない |

Armor用Horizontal selectorの結果:

| selector | not-observed | parser-boundary | ready |
|---|---:|---:|---:|
| `intrinsic-attack-speed-fields` | 71 / 71 | 0 | 0 |
| `intrinsic-cooldown-fields` | 71 / 71 | 0 | 0 |
| `intrinsic-damage-modifier-fields` | 71 / 71 | 0 | 0 |
| `ownership-target-scope-fields` | 71 / 71 | 0 | 0 |
| `built-in-enchantment-or-effect-relations` | 71 / 71 | 0 | 0 |

ここで `not-observed` は **0値ではない**。current committed Structural closureに該当serialized occurrenceが見つからない、という境界だけを表す。

### 3.2 Full Structural CDO census

Horizontal collectorのselector外も確認するため、142 visited package / 15 shard の full `cdoPropertyInventory` を走査した。

965 property observation / 25 grouped occurrence のうち、Armor gameplay value候補名として広く検索した:

```text
armor, health, damage, attack, speed, cooldown, soul, steal,
artifact, melee, ranged, aura, modifier, multiplier, reduction,
resist, bonus, percent, rate, duration, movement, roll, potion,
arrow, pet, bee, enchant, effect, heal, life
```

presentation名を除いた **candidate gameplay property group = 0**。

全71件に共通して確認できる主なCDO情報は、Identity、GearActor wiring、slot/paperdoll、RootComponent、drop sound等であり、runtime Armor modifierのsource-backed valueではなかった。

### 3.3 semantic boundary

今回の分類:

| category | current source状態 | Formal扱い |
|---|---|---|
| serialized configured Armor gameplay value | not-observed | Formal Valueに入れない |
| effective gameplay modifier | current serialized sourceから確定不可 | 推定しない |
| derived runtime multiplier | `src/core/armor.ts` に存在 | Formal Raw sourceではない |
| presentation/catalog value | `src/data/armors.ts` 等に存在 | 逆輸入しない |
| empirical/community value | repository内の別researchに存在し得る | 今回のFormal authorityにしない |

特に以下のruntime/catalog fieldは今回Formal化しない:

```text
meleeDamageBonus
weaponDamageAuraBonus
meleeAttackSpeedBonus
armorDamageReduction
soulGatheringMultiplier
lifeStealFraction
artifactCooldownReduction
observedHealthBonus
```

---

## 4. Armor Value semantic / schema decision

### Decision: C — schema実装を延期

**採用する `FormalArmorConfiguredValues` fieldは現時点で0件。**

Aの「schemaVersion 2 compatible additive extension」は、JSON objectに `semantic.armor` を足せるという理由だけでは成立しない。current contractでは:

- `FormalValueAvailabilityArtifact.semantic` は `melee / ranged` のみ
- generatorは `{ melee: {}, ranged: {} }` を生成
- horizontal source categoryは `melee | ranged` のみ
- semantic occurrence collector / mapping auditはMelee/Rangedを明示loop
- integration auditはMelee 31 / Ranged 27のIdentity↔Value exact-setを検証し、ArmorをMelee/Ranged waveから明示的に除外
- current docsはArmorをValue v2 boundary外と記載
- fixtures / projection coverage testもMelee/Ranged semanticを前提
- Battle Robe Data BrowserはIdentity + Relationを読み、Armor Formal Valueはconsumeしていない

ため、silent additive keyはcontract-compatibleではない。

一方、Bのv3 migrationを今決める根拠もない。**source-backed Armor value semantic自体が未成立**だからである。source semanticsが将来得られた時点で、v2の明示的contract extensionで十分か、v3が必要かを改めて判断する。

### Proposed field review

| candidate semantic | source status | type/unit | occurrence / mapping | relation dependency | decision |
|---|---|---|---|---|---|
| configured melee attack speed modifier | 71/71 not-observed | source確定不可 | n/a | unknown | reject/defer |
| configured artifact cooldown modifier | 71/71 not-observed | source確定不可 | n/a | unknown | reject/defer |
| configured damage modifier / reduction | 71/71 not-observed | source確定不可 | n/a | unknown | reject/defer |
| built-in enchantment configured refs/values | 71/71 not-observed | source確定不可 | n/a | edge absent | reject/defer |
| ownership / target / scope configured value | 71/71 not-observed | source確定不可 | n/a | edge absent | reject/defer |
| GearActor | observed 71/71 | Object reference | scope relation | relationそのもの | Value fieldにしない |
| SlotType | GearActor側でobserved | Enum | target-side actor metadata | GearActor traversal | Armor gameplay Value fieldにしない |
| PrimaryActorTick.* | 5 domainsのみobserved | bool/number等 | target/inheritance traversal | wiring依存 | semantic-unknown。採用しない |

Availability behaviorは、未観測fieldを `0` / `false` / emptyとして生成せず、**semantic自体を定義しない**。

---

## 5. Armor Relation edge census

### 5.1 First-class candidate: root GearActor

exact Identity rootから:

```text
GearActor direct root domain coverage:    71 / 71
GearActor direct root occurrences:       71
duplicate/missing:                        0
Structural resolution:                    71 / 71 resolved-local-package
target kind:                              import
existing RelationKind compatibility:      71 / 71 gear-actor
existing scope occurrence compatibility:  71 / 71 { domainId, scopeRef: "source" }
```

Battle Robeの既存projection:

```text
relationRef:
  relation:battle-robe:gear-actor@1

occurrence:
  { domainId: "battle-robe", scopeRef: "source" }

serializedTargetResolution:
  resolved-local-package

targetRawVerification:
  not-supplied / not-resolved / target-snapshot-not-supplied
```

これは残り70件の**semantic shapeの代表**として再利用できる。ただしtarget pathをBattle Robeから推測するのではなく、各domainのexact Structural edgeを使用する。

### 5.2 Other observed edge families

| family | domain coverage | state | Formal decision |
|---|---:|---|---|
| root `GearActor` | 71 / 71 | all resolved-local-package | **first wave ready** |
| root super/template structural edges | 71 / 71 | resolved-local + native-boundary + known-null mixed | Raw structural plumbing。RelationKind追加しない |
| GearActor-side `RootComponent` / component wiring | 71 / 71 | package-local/export等 | actor plumbing。Armor gameplay relationとして採用しない |
| root `RootComponent` | 71 / 71 | known-null | useful semantic relationではない |
| `InventoryDropSound` | 71 / 71 | resolved local soft-object | presentation/audio。除外 |
| GameplayEffect / Effect | 0 / 71 | source-edge-absent | 推測しない |
| built-in enchantment | 0 / 71 | source-edge-absent | 推測しない |
| ownership / target / scope | 0 / 71 | source-edge-absent | 推測しない |

inheritance/templateは71件すべてに存在するが、Raw `superIndex/templateIndex` をそのままRelationKindへ昇格させない。Armor gameplay property inheritanceという安定semanticをsourceだけで確定できず、native/null boundaryも含むためである。

---

## 6. Relation foundation decision

### GearActor

分類:

```text
ready-with-existing-relation-schema
+
requires-armor-scope-adapter
```

serialized Relation v2は既に:

- `RelationKind = gear-actor`
- `ScopeRelationOccurrence = { domainId, scopeRef }`
- domain-parameterized RelationRef
- scope projection identity

を持つ。**schemaVersion bump / new RelationKindは不要。**

必要なのはsource adapter / builder laneの一般化。

current horizontal Relation adapterはMelee/Ranged collection child向けで:

- categoryが `melee | ranged`
- `sourceIndex` 必須
- `CollectionRelationOccurrence` 固定
- builderのhorizontal inputがrelation collectionへ入る

というcontract。

Armorでは次のscope laneが必要:

```text
Identity exact applicationScope.packagePath
→ Armor Horizontal candidate exact package
→ sourceRelationPathId = rp-root
→ exact edgeId
→ propertyPath = GearActor
→ Structural shard/hash/package/edge verification
→ resolved-local-package target import
→ occurrence { domainId, scopeRef: "source" }
→ relation:<domainId>:gear-actor@1
```

builder側ではscope relationを `relationCollections` に入れず、semantic relation + projectionだけを生成する。

Battle Robeの既存RelationRef / projectionRef / EvidenceRef / occurrence / serialized target / targetRawVerificationは保持する。残り70件のStructural source laneを追加する。

### Additional RelationKind

**今回は提案しない。**

`effect` kind自体は既存だが、Armor current sourceにEffect/GameplayEffect edgeが0件なので流用populationしない。enchantment / inheritance / actor-componentの新kindも、安定したArmor semanticがsourceから成立していないため追加しない。

---

## 7. Implementation wave decision

| wave | target domains | semantic / family | serialized schema work | adapter / implementation work | population | blocked |
|---|---:|---|---|---|---:|---:|
| **A — next** | 71 census / 70 new | Armor `gear-actor` scope relation | **none** | Armor scope source adapter + horizontal builder scope lane + audits/tests | **70 new**（Battle Robe含め71/71） | 0 |
| B — later | 71 | Armor configured Value | **defer decision** | source semantics確立後に設計 | 0 now | 71 |
| C — later | 71 | GameplayEffect / built-in enchantment relations | kind/adapterとも未決 | explicit source edge発見後 | 0 now | 71 |

### 次に実装すべきwave

**Wave A — Armor GearActor Relation breadth** に1つだけ絞る。

期待するpost-wave state:

```text
Armor GearActor Relation:
  census: 71 / 71
  existing: battle-robe 1
  new: 70
  total Armor GearActor: 71

Formal Relation records:
  current 135
  +70
  expected 205

unique source domains:
  current 60
  +70
  expected 130
```

新規70件の `targetRawVerification` はfull target snapshotを供給しない限り、Structural local resolutionとは分離して:

```text
input: not-supplied
result: not-resolved
reason: target-snapshot-not-supplied
```

とする。Structural target knownをtarget gameplay semantic knownへ昇格させない。

---

## 8. 71-domain readiness matrix / exact GearActor census

Value列の「5 selector」は attack-speed / cooldown / damage-modifier / ownership-target-scope / built-in-enchantment-or-effect を指す。

| domainId | exact Identity / source package | Value ready fields | Value blocked/source boundary | Value readiness | GearActor target package | target object | Structural state | existing schema | adapter | Relation readiness |
|---|---|---|---|---|---|---|---|---|---|---|
| `archer-s-armor` | `Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings_Unique1/BP_ArchersStrappings_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings_Unique1/BP_ArchersStrappings_Unique1` | `/Game/Actors/Equipment/Armor/ArchersStrappings_Unique1/BP_ArchersStrappings_Unique1.BP_ArchersStrappings_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `arctic-fox-armor` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/WolfArmor_Winter1/BP_WolfArmor_Winter1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/WolfArmor_Winter1/BP_WolfArmor_Winter1` | `/Game/Content_DLC3/Actors/Equipment/Armor/WolfArmor_Winter1/BP_WolfArmor_Winter1.BP_WolfArmor_Winter1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `battle-robe` | `Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe` | `/Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe.BP_BattleRobe_C` | resolved-local-package | gear-actor: compatible | preserve existing | 既存populationを保持（census ready） |
| `beehive-armor` | `Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor_Unique1/BP_BeenestArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor_Unique1/BP_BeenestArmor_Unique1` | `/Game/Patch2/Actors/Equipment/Armor/BeenestArmor_Unique1/BP_BeenestArmor_Unique1.BP_BeenestArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `beenest-armor` | `Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor/BP_BeenestArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Patch2/Actors/Equipment/Armor/BeenestArmor/BP_BeenestArmor` | `/Game/Patch2/Actors/Equipment/Armor/BeenestArmor/BP_BeenestArmor.BP_BeenestArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `black-spot-armor` | `Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor_Unique1/BP_NatureArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor_Unique1/BP_NatureArmor_unique1` | `/Game/Content_Season2/Actors/Equipment/Armor/NatureArmor_Unique1/BP_NatureArmor_unique1.BP_NatureArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `black-wolf-armor` | `Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique2/BP_WolfArmor_Unique2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique2/BP_WolfArmor_Unique2` | `/Game/Actors/Equipment/Armor/WolfArmor_Unique2/BP_WolfArmor_Unique2.BP_WolfArmor_Unique2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `cauldron-armor` | `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Spooky2/BP_FullPlateArmor_Spooky2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Spooky2/BP_FullPlateArmor_Spooky2` | `/Game/Actors/Equipment/Armor/FullPlateArmor_Spooky2/BP_FullPlateArmor_Spooky2.BP_FullPlateArmor_Spooky2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `cave-crawler` | `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Unique1/BP_SpelunkersArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Unique1/BP_SpelunkersArmor_Unique1` | `/Game/Actors/Equipment/Armor/SpelunkersArmor_Unique1/BP_SpelunkersArmor_Unique1.BP_SpelunkersArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `champion-s-armor` | `Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor/BP_ChampionsArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor/BP_ChampionsArmor` | `/Game/Actors/Equipment/Armor/ChampionsArmor/BP_ChampionsArmor.BP_ChampionsArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `climbing-gear` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear/BP_ClimbingGearInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear/BP_ClimbingGear` | `/Game/Content_DLC3/Actors/Equipment/Armor/ClimbingGear/BP_ClimbingGear.BP_ClimbingGear_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `cloaked-skull` | `Dungeons/Content/Actors/Equipment/Armor/GhostArmor_Spooky2/BP_GhostArmor_Spooky2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/GhostArmor_Spooky2/BP_GhostArmor_Spooky2` | `/Game/Actors/Equipment/Armor/GhostArmor_Spooky2/BP_GhostArmor_Spooky2.BP_GhostArmor_Spooky2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `dark-armor` | `Dungeons/Content/Actors/Equipment/Armor/DarkArmor/BP_DarkArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/DarkArmor/BP_DarkArmor` | `/Game/Actors/Equipment/Armor/DarkArmor/BP_DarkArmor.BP_DarkArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `ember-robe` | `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique1/BP_EvocationRobe_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique1/BP_EvocationRobe_Unique1` | `/Game/Actors/Equipment/Armor/EvocationRobe_Unique1/BP_EvocationRobe_Unique1.BP_EvocationRobe_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `emerald-gear` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor/BP_EmeraldArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor/BP_EmeraldArmor` | `/Game/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor/BP_EmeraldArmor.BP_EmeraldArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `entertainer-s-garb` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb/BP_BardsGarbInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb/BP_BardsGarb` | `/Game/Content_DLC6/Actors/Equipment/Armor/BardsGarb/BP_BardsGarb.BP_BardsGarb_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `evocation-robe` | `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe/BP_EvocationRobeInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe/BP_EvocationRobe` | `/Game/Actors/Equipment/Armor/EvocationRobe/BP_EvocationRobe.BP_EvocationRobe_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `fox-armor` | `Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique1/BP_WolfArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/WolfArmor_Unique1/BP_WolfArmor_Unique1` | `/Game/Actors/Equipment/Armor/WolfArmor_Unique1/BP_WolfArmor_Unique1.BP_WolfArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `frost-armor` | `Dungeons/Content/Actors/Equipment/Armor/SnowArmor_Unique1/BP_SnowArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SnowArmor_Unique1/BP_SnowArmor_Unique1` | `/Game/Actors/Equipment/Armor/SnowArmor_Unique1/BP_SnowArmor_Unique1.BP_SnowArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `frost-bite` | `Dungeons/Content/Actors/Equipment/Armor/PhantomArmor_Unique1/BP_PhantomArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/PhantomArmor_Unique1/BP_PhantomArmor_Unique1` | `/Game/Actors/Equipment/Armor/PhantomArmor_Unique1/BP_PhantomArmor_Unique1.BP_PhantomArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `full-metal-armor` | `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Unique1/BP_FullPlateArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor_Unique1/BP_FullPlateArmor_Unique1` | `/Game/Actors/Equipment/Armor/FullPlateArmor_Unique1/BP_FullPlateArmor_Unique1.BP_FullPlateArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `ghost-kindler` | `Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor_Unique1/BP_GhostArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor_Unique1/BP_GhostArmor_Unique1` | `/Game/Patch2/Actors/Equipment/Armor/GhostArmor_Unique1/BP_GhostArmor_Unique1.BP_GhostArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `ghostly-armor` | `Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor/BP_GhostArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Patch2/Actors/Equipment/Armor/GhostArmor/BP_GhostArmor` | `/Game/Patch2/Actors/Equipment/Armor/GhostArmor/BP_GhostArmor.BP_GhostArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `gilded-glory` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique2/BP_EmeraldArmor_Unique2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique2/BP_EmeraldArmor_Unique2` | `/Game/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique2/BP_EmeraldArmor_Unique2.BP_EmeraldArmor_Unique2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `glow-squid-armor` | `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor_Unique1/BP_SquidArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor_Unique1/BP_SquidArmor_Unique1` | `/Game/Content_DLC5/Actors/Equipment/Armor/SquidArmor_Unique1/BP_SquidArmor_Unique1.BP_SquidArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `goat-gear` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique2/BP_ClimbingGear_Unique2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique2/BP_ClimbingGear_Unique2` | `/Game/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique2/BP_ClimbingGear_Unique2.BP_ClimbingGear_Unique2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `golden-piglin-armor` | `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor_Unique1/BP_PiglinArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor_Unique1/BP_PiglinArmor_Unique1` | `/Game/Content_DLC4/Actors/Equipment/Armor/PiglinArmor_Unique1/BP_PiglinArmor_Unique1.BP_PiglinArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `grim-armor` | `Dungeons/Content/Actors/Equipment/Armor/GrimArmor/BP_GrimArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/GrimArmor/BP_GrimArmor` | `/Game/Actors/Equipment/Armor/GrimArmor/BP_GrimArmor.BP_GrimArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `guard-s-armor` | `Dungeons/Content/Actors/Equipment/Armor/CowardsArmor/BP_CowardsArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/CowardsArmor/BP_CowardsArmor` | `/Game/Actors/Equipment/Armor/CowardsArmor/BP_CowardsArmor.BP_CowardsArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `hero-s-armor` | `Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor_Unique1/BP_ChampionsArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ChampionsArmor_Unique1/BP_ChampionsArmor_Unique1` | `/Game/Actors/Equipment/Armor/ChampionsArmor_Unique1/BP_ChampionsArmor_Unique1.BP_ChampionsArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `highland-armor` | `Dungeons/Content/Actors/Equipment/Armor/ScaleMail_Unique1/BP_ScaleMail_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ScaleMail_Unique1/BP_ScaleMail_Unique1` | `/Game/Actors/Equipment/Armor/ScaleMail_Unique1/BP_ScaleMail_Unique1.BP_ScaleMail_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `hungriest-horror` | `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Spooky2/BP_MercenaryArmor_Spooky2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Spooky2/BP_MercenaryArmor_Spooky2` | `/Game/Actors/Equipment/Armor/MercenaryArmor_Spooky2/BP_MercenaryArmor_Spooky2.BP_MercenaryArmor_Spooky2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `hungry-horror` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/MercenaryArmor_Spooky1/BP_MercenaryArmor_Spooky1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/MercenaryArmor_Spooky1/BP_MercenaryArmor_Spooky1` | `/Game/Content_DLC3/Actors/Equipment/Armor/MercenaryArmor_Spooky1/BP_MercenaryArmor_Spooky1.BP_MercenaryArmor_Spooky1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `hunter-s-armor` | `Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings/BP_ArchersStrappingsInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ArchersStrappings/BP_ArchersStrappings` | `/Game/Actors/Equipment/Armor/ArchersStrappings/BP_ArchersStrappings.BP_ArchersStrappings_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `living-vines-armor` | `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor_Unique1/BP_SproutArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor_Unique1/BP_SproutArmor_Unique1` | `/Game/Content_DLC4/Actors/Equipment/Armor/SproutArmor_Unique1/BP_SproutArmor_Unique1.BP_SproutArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `mercenary-armor` | `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor/BP_MercenaryArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor/BP_MercenaryArmor` | `/Game/Actors/Equipment/Armor/MercenaryArmor/BP_MercenaryArmor.BP_MercenaryArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `mystery-armor` | `Dungeons/Content/Actors/Equipment/Armor/MysteryArmor/BP_MysteryArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/MysteryArmor/BP_MysteryArmor` | `/Game/Actors/Equipment/Armor/MysteryArmor/BP_MysteryArmor.BP_MysteryArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `nimble-turtle-armor` | `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor_Unique1/BP_TurtleArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor_Unique1/BP_TurtleArmor_Unique1` | `/Game/Content_DLC5/Actors/Equipment/Armor/TurtleArmor_Unique1/BP_TurtleArmor_Unique1.BP_TurtleArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `ocelot-armor` | `Dungeons/Content/Actors/Equipment/Armor/OcelotArmor/BP_OcelotArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/OcelotArmor/BP_OcelotArmor` | `/Game/Actors/Equipment/Armor/OcelotArmor/BP_OcelotArmor.BP_OcelotArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `opulent-armor` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique1/BP_EmeraldArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique1/BP_EmeraldArmor_Unique1` | `/Game/Content_DLC3/Actors/Equipment/Armor/EmeraldArmor_Unique1/BP_EmeraldArmor_Unique1.BP_EmeraldArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `phantom-armor` | `Dungeons/Content/Actors/Equipment/Armor/PhantomArmor/BP_PhantomArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/PhantomArmor/BP_PhantomArmor` | `/Game/Actors/Equipment/Armor/PhantomArmor/BP_PhantomArmor.BP_PhantomArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `piglin-armor` | `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor/BP_PiglinArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/PiglinArmor/BP_PiglinArmor` | `/Game/Content_DLC4/Actors/Equipment/Armor/PiglinArmor/BP_PiglinArmor.BP_PiglinArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `plate-armor` | `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor/BP_FullPlateArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/FullPlateArmor/BP_FullPlateArmor` | `/Game/Actors/Equipment/Armor/FullPlateArmor/BP_FullPlateArmor.BP_FullPlateArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `reinforced-mail` | `Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail/BP_ReinforcedMailInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail/BP_ReinforcedMail` | `/Game/Actors/Equipment/Armor/ReinforcedMail/BP_ReinforcedMail.BP_ReinforcedMail_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `renegade-armor` | `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Unique1/BP_MercenaryArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/MercenaryArmor_Unique1/BP_MercenaryArmor_Unique1` | `/Game/Actors/Equipment/Armor/MercenaryArmor_Unique1/BP_MercenaryArmor_Unique1.BP_MercenaryArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `root-rot-armor` | `Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor/BP_NatureArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_Season2/Actors/Equipment/Armor/NatureArmor/BP_NatureArmor` | `/Game/Content_Season2/Actors/Equipment/Armor/NatureArmor/BP_NatureArmor.BP_NatureArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `rugged-climbing-gear` | `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique1/BP_ClimbingGear_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique1/BP_ClimbingGear_Unique1` | `/Game/Content_DLC3/Actors/Equipment/Armor/ClimbingGear_Unique1/BP_ClimbingGear_Unique1.BP_ClimbingGear_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `scale-mail` | `Dungeons/Content/Actors/Equipment/Armor/ScaleMail/BP_ScaleMailInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ScaleMail/BP_ScaleMail` | `/Game/Actors/Equipment/Armor/ScaleMail/BP_ScaleMail.BP_ScaleMail_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `shadow-walker` | `Dungeons/Content/Actors/Equipment/Armor/OcelotArmor_Unique1/BP_OcelotArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/OcelotArmor_Unique1/BP_OcelotArmor_Unique1` | `/Game/Actors/Equipment/Armor/OcelotArmor_Unique1/BP_OcelotArmor_Unique1.BP_OcelotArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `shulker-armor` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor/BP_ShulkerArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor/BP_ShulkerArmor` | `/Game/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor/BP_ShulkerArmor.BP_ShulkerArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `snow-armor` | `Dungeons/Content/Actors/Equipment/Armor/SnowArmor/BP_SnowArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SnowArmor/BP_SnowArmor` | `/Game/Actors/Equipment/Armor/SnowArmor/BP_SnowArmor.BP_SnowArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `soul-robe` | `Dungeons/Content/Actors/Equipment/Armor/SoulRobe/BP_SoulRobeInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SoulRobe/BP_SoulRobe` | `/Game/Actors/Equipment/Armor/SoulRobe/BP_SoulRobe.BP_SoulRobe_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `souldancer-robe` | `Dungeons/Content/Actors/Equipment/Armor/SoulRobe_Unique1/BP_SoulRobe_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SoulRobe_Unique1/BP_SoulRobe_Unique1` | `/Game/Actors/Equipment/Armor/SoulRobe_Unique1/BP_SoulRobe_Unique1.BP_SoulRobe_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `spelunker-armor` | `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor/BP_SpelunkersArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor/BP_SpelunkersArmor` | `/Game/Actors/Equipment/Armor/SpelunkersArmor/BP_SpelunkersArmor.BP_SpelunkersArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `spider-armor` | `Dungeons/Content/Actors/Equipment/Armor/AssassinArmor_Unique1/BP_AssassinArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/AssassinArmor_Unique1/BP_AssassinArmor_Unique1` | `/Game/Actors/Equipment/Armor/AssassinArmor_Unique1/BP_AssassinArmor_Unique1.BP_AssassinArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `splendid-robe` | `Dungeons/Content/Actors/Equipment/Armor/BattleRobe_Unique1/BP_BattleRobe_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/BattleRobe_Unique1/BP_BattleRobe_Unique1` | `/Game/Actors/Equipment/Armor/BattleRobe_Unique1/BP_BattleRobe_Unique1.BP_BattleRobe_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `sprout-armor` | `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor/BP_SproutArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC4/Actors/Equipment/Armor/SproutArmor/BP_SproutArmor` | `/Game/Content_DLC4/Actors/Equipment/Armor/SproutArmor/BP_SproutArmor.BP_SproutArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `squid-armor` | `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor/BP_SquidArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/SquidArmor/BP_SquidArmor` | `/Game/Content_DLC5/Actors/Equipment/Armor/SquidArmor/BP_SquidArmor.BP_SquidArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `stalwart-armor` | `Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail_Unique1/BP_ReinforcedMail_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/ReinforcedMail_Unique1/BP_ReinforcedMail_Unique1` | `/Game/Actors/Equipment/Armor/ReinforcedMail_Unique1/BP_ReinforcedMail_Unique1.BP_ReinforcedMail_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `sturdy-shulker-armor` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor_Unique1/BP_ShulkerArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor_Unique1/BP_ShulkerArmor_Unique1` | `/Game/Content_DLC6/Actors/Equipment/Armor/ShulkerArmor_Unique1/BP_ShulkerArmor_Unique1.BP_ShulkerArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `sweet-tooth` | `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Year1/BP_SpelunkersArmor_Year1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/SpelunkersArmor_Year1/BP_SpelunkersArmor_Year1` | `/Game/Actors/Equipment/Armor/SpelunkersArmor_Year1/BP_SpelunkersArmor_Year1.BP_SpelunkersArmor_Year1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `teleportation-robes` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes/BP_EndRobesInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes/BP_EndRobes` | `/Game/Content_DLC6/Actors/Equipment/Armor/EndRobes/BP_EndRobes.BP_EndRobes_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `the-spooky-gourdian` | `Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Spooky2/BP_GrimArmor_Spooky2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Spooky2/BP_GrimArmor_Spooky2` | `/Game/Actors/Equipment/Armor/GrimArmor_Spooky2/BP_GrimArmor_Spooky2.BP_GrimArmor_Spooky2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `the-troubadour` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb_Unique1/BP_BardsGarb_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/BardsGarb_Unique1/BP_BardsGarb_Unique1` | `/Game/Content_DLC6/Actors/Equipment/Armor/BardsGarb_Unique1/BP_BardsGarb_Unique1.BP_BardsGarb_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `thief-armor` | `Dungeons/Content/Actors/Equipment/Armor/AssassinArmor/BP_AssassinArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/AssassinArmor/BP_AssassinArmor` | `/Game/Actors/Equipment/Armor/AssassinArmor/BP_AssassinArmor.BP_AssassinArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `titan-s-shroud` | `Dungeons/Content/Actors/Equipment/Armor/DarkArmor_Unique1/BP_DarkArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/DarkArmor_Unique1/BP_DarkArmor_Unique1` | `/Game/Actors/Equipment/Armor/DarkArmor_Unique1/BP_DarkArmor_Unique1.BP_DarkArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `turtle-armor` | `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor/BP_TurtleArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC5/Actors/Equipment/Armor/TurtleArmor/BP_TurtleArmor` | `/Game/Content_DLC5/Actors/Equipment/Armor/TurtleArmor/BP_TurtleArmor.BP_TurtleArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `unstable-robes` | `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes_Unique1/BP_EndRobes_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Content_DLC6/Actors/Equipment/Armor/EndRobes_Unique1/BP_EndRobes_Unique1` | `/Game/Content_DLC6/Actors/Equipment/Armor/EndRobes_Unique1/BP_EndRobes_Unique1.BP_EndRobes_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `verdant-robe` | `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique2/BP_EvocationRobe_Unique2Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/EvocationRobe_Unique2/BP_EvocationRobe_Unique2` | `/Game/Actors/Equipment/Armor/EvocationRobe_Unique2/BP_EvocationRobe_Unique2.BP_EvocationRobe_Unique2_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `wither-armor` | `Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Unique1/BP_GrimArmor_Unique1Instance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/GrimArmor_Unique1/BP_GrimArmor_Unique1` | `/Game/Actors/Equipment/Armor/GrimArmor_Unique1/BP_GrimArmor_Unique1.BP_GrimArmor_Unique1_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |
| `wolf-armor` | `Dungeons/Content/Actors/Equipment/Armor/WolfArmor/BP_WolfArmorInstance` | none | 5 selectorすべて not-observed / semantic-unknown | defer-source-semantics | `GearActor` → `Dungeons/Content/Actors/Equipment/Armor/WolfArmor/BP_WolfArmor` | `/Game/Actors/Equipment/Armor/WolfArmor/BP_WolfArmor.BP_WolfArmor_C` | resolved-local-package | gear-actor: compatible | Armor scope adapter | ready-with-existing-relation-schema + requires-armor-scope-adapter |

---

## 9. Validation

成功runで以下を確認した。

```text
baseline main:
  e0cf0ad8ef042a9e8ea3665fff3880cd5daaadbf

Formal Armor Identity:
  71

Identity package ↔ selected Raw package:
  71 / 71

71-domain Value census:
  unique domainId: 71
  missing: 0
  duplicate: 0
  accepted gameplay Value fields: 0
  Horizontal parser-boundary facts: 0
  full Structural gameplay candidate property groups: 0

71-domain Relation census:
  direct root GearActor: 71 / 71
  exactly one per domain: yes
  resolved-local-package: 71 / 71
  duplicate/missing: 0

source locator:
  committed Horizontal Raw inventory verified
  committed Structural manifest/shards verified
  142 visited packages materialized from 15 shards

deterministic rerun:
  pass (two runs byte-identical)

protected artifacts/source:
  research/domain/formal/identity-evidence-v1.json unchanged
  research/domain/formal/value-availability-v2.json unchanged
  research/domain/formal/serialized-relation-v2.json unchanged
  research/raw/** unchanged
  src/** unchanged

git diff --check:
  pass
```

監査中にproduction behavior、Formal generated artifact、Raw artifactは変更していない。

---

## 10. Fail-closed notes

- `not-observed` は値0を意味しない。
- current RawにArmor modifierが見えない理由をnative behavior / parser limitation /別asset systemのいずれかと断定しない。
- super/template edgeが存在することからcatalog inheritance semanticsを推測しない。
- `GearActor` targetがlocalに解決できることからtarget Raw snapshot verified / gameplay property knownとは判断しない。
- presentation/catalog/empirical値をFormal sourceへ逆輸入しない。
- 追加relation familyは、explicit serialized edgeがcurrent authorityで観測されるまでready扱いしない。
