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

Melee は `ConfiguredAttackVariants[sourceIndex] -> AttackSequence`、Ranged は `ProjectileDefinition[sourceIndex] -> Projectile` として parent collection / sourceIndex / exact child edge を bind します。property 名や target path の類似だけで sibling occurrence を借りません。

## Same-source Formal Identity gate

Horizontal Relation source は reviewed Formal Identity assertion、committed `resolution.state = matched`、assertion/domain binding、および relation source provenance と Identity evidence provenance の same-source 一致を必要とします。Raw candidate status は Formal Relation gate に使用しません。

## Current population and next wave

このPRで committed Formal Relation population は次のままです。

```text
schemaVersion: 2
semantic relations: 3
relation projections: 3
new Melee/Ranged horizontal population: 0
```

Melee 27 domain の AttackSequence 96 occurrences と Ranged 23 domain の Projectile 23 occurrences、合計119 occurrences は source adapter foundation の次PRで population します。このv2 foundation自体は119件をcommitted artifactへ追加しません。
