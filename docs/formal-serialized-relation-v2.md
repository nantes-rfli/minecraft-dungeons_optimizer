# Formal Serialized Relation / Reference v2

Formal Serialized Relation v2 は、Rawで観測された serialized relation を source-backed Formal Relation として記録する境界です。canonical artifact は [serialized-relation-v2.json](../research/domain/formal/serialized-relation-v2.json) です。生成は `npm run generate:formal-serialized-relation`、検証は `npm run audit:formal-serialized-relation` を使用します。

## RelationOccurrence v2

v1 の slice 固有 occurrence を廃止し、すべての occurrence が `domainId` を持ちます。

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
```

collection child の `sourceIndex` は Raw / Structural Inventory に記録された element identity です。生成順、成功した要素の連番、array traversal position から再採番しません。

current representative relations は次の logical occurrence を持ちます。

- Scatter Crossbow Projectile: `scatter-crossbow / projectile-definitions / 0`
- Battle Robe GearActor: `battle-robe / source`
- Death Cap Mushroom Effect: `death-cap-mushroom / source`

v1 から migration した上記3件は RelationRef、projectionRef、EvidenceRef、serialized target、sourceDomainId、target Raw verification outcome を維持します。

## Target boundaries

v2 は次の境界を別々に記録します。

`serializedTargetResolution` は serialized relation の target が Structural inventory 上でローカル package へ解決できるか、または known-null / native-boundary / outside-game-boundary / missing-target / parser-boundary のどこに留まるかを表します。

`targetRawVerification` は full Raw target snapshot が入力されたか、その snapshot が expected target と一致したかを表します。

したがって次は同義ではありません。

```text
serialized target known
!= Structural target locally available
!= full Raw target snapshot verified
!= target gameplay semantic known
```

Relation は Projectile damage、AttackSequence timing、animation/notify timing、GameplayEffect の意味など effective gameplay semantics を assert しません。

## Domain-parameterized RelationRef

horizontal population 用の relation identity は domain から安定生成します。

```text
relation:<domainId>:attack-sequence@1
relation:<domainId>:projectile@1
relation:<domainId>:gear-actor@1
relation:<domainId>:effect@1
relation:<domainId>:item-actor@1
```

既存 representative relation は同じ規則の下で既存文字列を維持します。

## Horizontal Structural source adapter

`scripts/formal-relation-horizontal-source.ts` は Horizontal Raw Fact Inventory の relation reference を Formal Relation 入力へ変換する thin adapter です。

```text
candidate relation reference
-> edgeId
-> sourceRelations
-> verified Raw Structural Inventory shard
-> exact Structural edge
-> source occurrence
-> serialized target
```

adapter は fail closed です。candidate relation の edgeId と sourceRelations edge は一意でなければならず、first-wave source は `candidatePackage == sourcePackage` かつ `sourceRelationPathId == rp-root` を要求します。Structural manifest / shard の dataset identity、compressed/uncompressed hash、source package hash、edgeId、propertyPath、arrayIndex、target kind/object/package を exact に照合します。

Fighter's Bindings と Scatter Crossbow の Identity は既存の full Raw snapshot を参照します。これら2件は full Raw 上で matched Identity を再検証し、Structural shard と dataset ID・package path・package content hash が一致する場合に限って adapter を通します。両形式の extraction run ID は別であり、各 artifact の provenance はそれぞれ検証します。

Melee は `ConfiguredAttackVariants[sourceIndex] -> AttackSequence`、Ranged は `ProjectileDefinition[sourceIndex] -> Projectile` として parent collection / sourceIndex / exact child edge を bind します。Armor は exact Identity source package の root `GearActor` edge を `{ domainId, scopeRef: "source" }` として bind します。Artifact は承認済み typed policy に従い、root `Effect` または root `ItemActorClass` edge を同じ source scope に bind します。category だけで property や kind を決定しません。これらは collection/sourceIndex semantics へ変換しません。property 名や target path の類似だけで別 occurrence を借りません。

`item-actor` は source Artifact に設定された Blueprint class が、exact target class として `/Script/Dungeons.ItemActor` を直接継承する configured class relation です。verified Structural target package の class export、class 自身の super edge と native-boundary inheritance chain、class reference で結ばれた CDO を必須確認します。actor の実際の spawn、時点、数、持続時間、効果、damage、activation、cooldown は assert しません。target package の Structural 解決と full target Raw snapshot 検証は別の境界です。

## Same-source Formal Identity gate

Horizontal Relation source は reviewed Formal Identity assertion、committed `resolution.state = matched`、assertion/domain binding、および relation source provenance と Identity evidence provenance の same-source 一致を必要とします。Raw candidate status は Formal Relation gate に使用しません。

## Current population

committed Formal Relation population は次のとおりです。

```text
schemaVersion: 2
Melee: 31 domains / 106 AttackSequence occurrences
Ranged: 27 domains / 27 Projectile occurrences
Armor: 71 domains / 71 GearActor scope occurrences
Artifact Effect: 10 domains / 10 scope occurrences
Artifact ItemActor: 11 domains / 11 scope occurrences
Artifact SpinWheelActor: 1 domain / 1 scope occurrence
Artifact FishHook: 1 domain / 1 scope occurrence
relation collections: 58
semantic relations: 227
relation projections: 227
unique source domains: 146
```

Armor 71件のうち Battle Robe は既存 representative path をそのまま維持し、追加70件だけを Horizontal Armor scope lane から生成します。追加70件はすべて exact root `GearActor` Structural edge が `resolved-local-package` であることを要求し、`targetRawVerification` は `not-supplied / not-resolved / target-snapshot-not-supplied` のままです。Structural target の local package 解決は gameplay semantic や full Raw target snapshot の検証を意味しません。

Artifact Effect 10件のうち Death Cap Mushroom は既存 representative path を維持し、追加9件を Horizontal Artifact scope lane から生成します。追加9件は exact root `Effect` Structural edge の target が `resolved-local-package` であることを要求し、full Raw target snapshot は供給しないため `targetRawVerification` は `not-supplied / not-resolved / target-snapshot-not-supplied` のままです。

Artifact ItemActor 11件はすべて root `ItemActorClass` の scope relation です。各 target は `resolved-local-package` で、直接の `/Script/Dungeons.ItemActor` superclass と対応する CDO を Structural source で確認します。full Raw target snapshot は供給しないため `targetRawVerification` は全件 `not-supplied / not-resolved / target-snapshot-not-supplied` です。Effect と重なる5 domain は異なる RelationRef と独立した source edge evidence を持ちます。

## SpinWheelActor source population

`spin-wheel-actor` は `spinblade` の exact `SpinWheelActorClass`（Structural edge `2cd31aaf1c49b33bd4dca244`）に設定された class relation 1件です。`relation:spinblade:spin-wheel-actor@1`、occurrence `{ domainId: "spinblade", scopeRef: "source" }`、projection `projection:relation:spinblade:spin-wheel-actor@1:source` を使用します。schemaVersion は2、Relation kindsは6、collectionsは58です。

matched same-source Identity、exact selected Horizontal candidate と unique `rp-root`、source provenance/hash と unique scalar CDO occurrence を要求します。独立した SpinWheel verifier が source の direct `SpinWheelInstance`、target の exact `BP_SpinWheelActor_C` / direct `/Script/Dungeons.SpinWheelActor`、one-hop native-boundary inheritance、unique corresponding `Default__BP_SpinWheelActor_C` と class binding / `Default__SpinWheelActor` template を検証します。既存 ItemActor verifier の native parent条件は維持します。

target full-Raw verification は `not-supplied / not-resolved / target-snapshot-not-supplied` のままです。飛翔、帰還、移動、攻撃、damage、spawn、activation 等の runtime behavior は推論しません。既存225 Relation/projection、58 collections、全既存evidence、Identity/Value/Raw/Application は保持します。レビュー済み remaining census は過去baselineの監査authorityとして変更しません。

## FishHook source population

`fish-hook` は `fishing-rod` の exact `FishingHookActorClass`（Structural edge `61c85456ce1c89009060695d`）に設定された class relation 1件です。`relation:fishing-rod:fish-hook@1`、occurrence `{ domainId: "fishing-rod", scopeRef: "source" }`、projection `projection:relation:fishing-rod:fish-hook@1:source` を使用します。schemaVersion は2、Relation kindsは7、Relation/projectionは227、collectionsは58、unique source domainsは146です。既存 Effect とsource domainを共有します。

matched same-source Formal Identity と exact applicationScope、exact selected Horizontal candidate と unique `rp-root`、source provenance/hash、unique decoded scalar CDO rootと exact Structural edge を要求します。FishHook専用verifierが exact target package/object、unique generated `BP_FishHookItem_C`、direct `/Script/Dungeons.FishHookItem` superclass と one-hop native-boundary inheritance、unique corresponding `Default__BP_FishHookItem_C` と class binding / `Default__FishHookItem` template を検証します。

target full Raw verification は `not-supplied / not-resolved / target-snapshot-not-supplied` を維持します。`FishingRodActorClass` は semantic-ambiguous のままです。TypeHierarchy、animation sequences、他のArtifact familyは追加せず、投射・牽引・spawn・damage等のruntime semanticsを推論しません。baseline `50c94d6d9d9fb68c00e84a8dbf03dc806817323f` の既存226 Relation/projection/evidence、58 collectionsとIdentity/Value/Raw/Applicationを保持します。レビュー済みremaining監査authorityとcensusは変更しません。
