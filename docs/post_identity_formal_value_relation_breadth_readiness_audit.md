# Post-Identity Formal Value / Relation Breadth Readiness Audit

## 1. 結論

Baseline:

```text
main:
faa607ac21fc7f320b6b4aebc72d8eceb74378e6
```

現行 committed artifact を再集計した current coverage は次のとおり。

| Category | Formal Identity | Formal Value v2 | Formal Relation v2 unique source domains | Identity-only / Value-missing | Identity-only / Relation-missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Melee | 31 | 27 | 27 | 4 | 4 |
| Ranged | 27 | 23 | 23 | 4 | 4 |
| Armor | 71 | 0 | 1 | 71 | 70 |
| Artifact | 23 | 0 | 1 | 23 | 22 |
| **Total** | **152** | **50** | **52** | **102** | **100** |

Relation v2 は 52 unique source domains に対して 121 semantic relation records / relation projections を持ち、Melee / Ranged の 50 collection domains と Battle Robe / Death Cap Mushroom の representative scope relation 2件から成る。

次の最小で安全な implementation wave は **Melee / Ranged catch-up 8 domains**。

```text
Melee:
  broken-sawblade
  mechanized-sawblade
  chill-gale-knife
  resolute-tempest-knife

Ranged:
  bonebow
  twin-bow
  burst-gale-bow
  echo-of-the-valley
```

8件はすべて、

```text
matched Formal Identity
-> exact selected Horizontal candidate package
-> existing Horizontal Value source contract
-> existing Horizontal Relation source contract
```

を満たす。新しい source adapter、schema、category foundation、Raw再抽出は不要。

必要なのは current first-wave allow-list / audit expectation を 27 Melee + 23 Ranged から 31 Melee + 27 Ranged へ拡張することだけで、Value / Relation source adapter 本体は再利用できる。

Armor / Artifact はこの catch-up と混ぜない。両categoryとも Identity package と Horizontal Raw candidate root の対応自体は成立しているが、Value は現行 v2 semantic contract に category が存在せず、Relation も representative 1件の relation kind を category 全体へ無条件に一般化できない。

---

## 2. Current coverage reconciliation

Authority:

```text
research/domain/formal/identity-evidence-v1.json
research/domain/formal/value-availability-v2.json
research/domain/formal/serialized-relation-v2.json
```

実集計:

```text
Formal Identity assertions:
  152

Formal Value v2 domains:
  semantic.melee:  27
  semantic.ranged: 23
  total:           50

Formal Relation v2:
  semantic relation records: 121
  unique sourceDomainId:       52
  relation collections:        50
```

Relation unique source-domain breakdown:

```text
Melee:    27
Ranged:   23
Armor:     1  (battle-robe)
Artifact:  1  (death-cap-mushroom)
```

Value v2 serialized semantic keys are currently exactly:

```text
semantic.melee
semantic.ranged
```

Armor / Artifact Value container is not present.

Current audit / integration code also intentionally locks the old first-wave population:

- `scripts/audit-formal-value-availability.ts`
  - Melee definition set = Fighter's Bindings + ready Melee + documented reviewed bridges
  - Ranged definition set = Scatter Crossbow + ready Ranged + documented reviewed bridges
  - expected counts = 27 / 23
  - Sawblade 2件が Value に入っていないことを explicit assertion している
- `scripts/formal-relation-horizontal-wave-sources.ts`
  - 同じ old first-wave definition set のみを読む
- `scripts/audit-formal-serialized-relation.ts`
  - expected unique domains = 27 / 23
  - current relation records = 121
- `src/domain/formal/integrationAudit.ts`
  - Value / Relation join category map が old 27 / 23 definition set のみ
  - expected matched counts = 27 / 23

したがって、8件が未populationなのは source adapter が拒否しているからではなく、**wave membership と audit expectation が Identity expansion 前の集合に固定されているため**。

---

## 3. Melee / Ranged catch-up 8

### 3.1 Identity / Horizontal candidate reconciliation

8件すべてで Formal Identity assertion の `applicationScope.packagePath` が current Structural Inventory manifest の同一 catalog row に存在する candidate package と exact match する。

Raw candidate status は Formal Identity status ではない。特に ambiguous row でも、Formal Identity が reviewed evidence により選択した exact package を source gate として使用できる。

| domainId | category | selected Formal package | Raw candidate status | exact selected candidate |
| --- | --- | --- | --- | --- |
| broken-sawblade | melee | `.../Chainsword/BP_ChainswordInstance` | provisional | yes |
| mechanized-sawblade | melee | `.../Chainsword_Unique1/BP_Chainsword_Unique1Instance` | provisional | yes |
| chill-gale-knife | melee | `.../TempestKnife_Unique2/BP_TempestKnife_Unique2Instance` | ambiguous | yes |
| resolute-tempest-knife | melee | `.../TempestKnife_Unique1/BP_TempestKnife_Unique1Instance` | ambiguous | yes |
| bonebow | ranged | `.../Bow_Unique1/BP_Bow_Unique1Instance` | ambiguous | yes |
| twin-bow | ranged | `.../Bow_Unique2/BP_Bow_Unique2Instance` | ambiguous | yes |
| burst-gale-bow | ranged | `.../WindBow_Unique2/BP_WindBow_Unique2Instance` | ambiguous | yes |
| echo-of-the-valley | ranged | `.../WindBow_Unique1/BP_WindBow_Unique1Instance` | ambiguous | yes |

### 3.2 Exact source occurrence check

Committed Structural Inventory shards を直接再読した。

#### Melee

現行 `horizontalMeleeValueMappings()` が要求する child fields:

```text
Damage
AttackAnimationTimeDurationSeconds
AttackRange
ConeAngleDegrees
ConeOffsetUnits
DamageSplashMultiplier
DamageDelaySeconds
AttackVariantType
VariantLoopAmount
```

Relation adapter が要求する primary relation:

```text
ConfiguredAttackVariants[*].AttackSequence
source package = selected candidate root
arrayIndex = sourceIndex
target kind = import
```

結果:

| domainId | selected Raw identity | ConfiguredAttackVariants | required Value fields | AttackSequence occurrences | disposition |
| --- | --- | ---: | --- | ---: | --- |
| broken-sawblade | Chainsword | 2 | all decoded for indices 0,1 | 2 | ready-with-existing-adapter |
| mechanized-sawblade | Chainsword_Unique1 | 2 | all decoded for indices 0,1 | 2 | ready-with-existing-adapter |
| resolute-tempest-knife | TempestKnife_Unique1 | 3 | all decoded for indices 0,1,2 | 3 | ready-with-existing-adapter |
| chill-gale-knife | TempestKnife_Unique2 | 3 | all decoded for indices 0,1,2 | 3 | ready-with-existing-adapter |

全 AttackSequence target は local `/Game` package への import relation で、Structural traversal は `followed` または `already-visited`。missing-target / parser blocker はない。

Sawblade の continuous/release/overheat **effective gameplay behavior** はこの結論に含めない。今回 ready とするのは configured serialized Value と AttackSequence relation の source-backed population だけ。

#### Ranged

現行 `horizontalRangedValueMappings()` が要求する child fields:

```text
NumberOfProjectiles
AngleSpan
DelaySecondsPerProjectile
DelaySeconds
```

Relation adapter が要求する primary relation:

```text
AttackDefintion.ProjectileDefinition[*].Projectile
source package = selected candidate root
arrayIndex = sourceIndex
target kind = import
```

結果:

| domainId | selected Raw identity | ProjectileDefinition | required Value fields | Projectile occurrences | disposition |
| --- | --- | ---: | --- | ---: | --- |
| bonebow | Bow_Unique1 | 1 | all decoded at index 0 | 1 | ready-with-existing-adapter |
| twin-bow | Bow_Unique2 | 1 | all decoded at index 0 | 1 | ready-with-existing-adapter |
| burst-gale-bow | WindBow_Unique2 | 1 | all decoded at index 0 | 1 | ready-with-existing-adapter |
| echo-of-the-valley | WindBow_Unique1 | 1 | all decoded at index 0 | 1 | ready-with-existing-adapter |

4件とも configured values は index 0 で source-backed。Projectile relation も exact candidate root 上の `ProjectileDefinition[0].Projectile` で local import target を持つ。

### 3.3 Catch-up disposition

```text
Value ready:
  8 / 8

Relation ready:
  8 / 8

source-fact blockers:
  0

relation-edge blockers:
  0

parser/native/Raw blockers for the configured breadth scope:
  0

new Value source adapter:
  not required

new Relation source adapter:
  not required

schema/foundation:
  not required
```

Implementation時は production semantic の redesign ではなく、wave set と deterministic audits を current Identity population に追随させる。

Expected post-wave coverage:

```text
Formal Value:
  Melee  31
  Ranged 27
  Total  58

Formal Relation unique source domains:
  Melee    31
  Ranged   27
  Armor     1
  Artifact  1
  Total    60
```

現在の relation occurrence countへ今回の source occurrences 14件
(Melee 10 + Ranged 4) が加わるため、既存 representative を維持する場合の expected relation records は 135。

---

## 4. Armor readiness

### 4.1 Identity / Raw root

Formal Identity済み 71 Armor を current Structural Inventory manifest と照合した結果:

```text
Formal Armor Identity:
  71

Identity applicationScope package
== Horizontal / Structural candidate package:
  71 / 71

Raw candidate status:
  exact 71
```

したがって Armor breadth の primary blocker は identity / candidate root 不足ではない。

### 4.2 Value readiness

current Value v2 は typed semantic が Melee / Ranged のみであり、Armor domain value type / mapping / projector を持たない。

Horizontal Raw collector 自体は Armor について次を保持する設計:

```text
GearActor
intrinsic attack-speed-like fields
intrinsic cooldown-like fields
intrinsic damage-modifier-like fields
ownership / target / scope
built-in enchantment / GameplayEffect relations
linked actor/effect/inheritance facts
```

一方 current full Structural Inventory audit では、

```text
no consistently named AttackSpeed property observed
```

であり、field absence は zero modifier を意味しない。

また Battle Robe Application projection も GearActor relation 以外の Armor Property ownership semantics を Formal v2 では assert しない境界を明示している。

したがって Armor Value は単純 population ではない。

```text
classification:
  requires-category-foundation
  + requires-schema-decision

direct ready population candidates under current Value v2:
  0 / 71

blocked by current Value contract/foundation:
  71 / 71
```

必要な次段階は、Armorで Formal に上げる source-backed semantic fact set を定義し、`semantic.armor` を v2 compatible extension とするか schema migration とするかを決めること。

Optimizerが必要とする effective health / effective DR / attack-speed transform と、Raw serialized configured factsは分離する。Rawに見つからない transformを Formal Value として推測しない。

### 4.3 Relation readiness

Relation v2 の serialized schema 自体は、

```text
kind = gear-actor
occurrence = { domainId, scopeRef }
```

を既に表現でき、Battle Robe representative が存在する。

しかし current Horizontal Relation adapter は Melee / Ranged collection relation 専用:

```text
ConfiguredAttackVariants[*].AttackSequence
ProjectileDefinition[*].Projectile
```

であり、Armor scope relationを horizontalizeする adapter / per-domain rule はない。

さらに representative 1件だけから 70件へ `GearActor` の存在を推定してはいけない。current Raw collector は GearActor/object-property relation を保持しているため、Raw再抽出は不要だが、実装前に 71 domain の exact edge census を行い、relation absence / alternate edge family を明示する必要がある。

```text
current populated:
  1 / 71  (battle-robe)

additional ready-with-existing-adapter:
  0 / 70

classification:
  requires-category relation adapter
  + per-domain source-edge census

Relation schema redesign:
  not required for GearActor-only rows

possible source-edge-gap:
  must be determined per domain; do not infer from Battle Robe
```

---

## 5. Artifact readiness

### 5.1 Identity / Raw root

Formal Identity済み 23 Artifact を current Structural Inventory manifest と照合:

```text
Formal Artifact Identity:
  23

Identity applicationScope package
== Horizontal / Structural candidate package:
  23 / 23

Raw candidate status among these 23:
  exact:       8
  provisional: 15
```

Raw candidate status は Formal Identity promotion state ではない。23件はいずれも committed matched Formal Identity が exact applicationScope package を持つため、category foundation はその package を source gate にできる。

### 5.2 Value readiness

current Value v2 に Artifact semantic container / mappings / projector は存在しない。

さらに current Raw source closure で、Identity済み23 Artifact の **base cooldown** は:

```text
static-known:
  0

static-relation-traversal:
  0

parser-boundary:
  5

not-observed:
  18
```

parser-boundary 5件:

```text
fishing-rod
light-feather
shock-powder
corrupted-pumpkin
totem-of-casting
```

加えて cooldown start semantics は Artifact 全体で Blueprint non-CDO execution boundary にあり、Effect / Actor / ActivationAnimation relation から開始時点を推定してはいけない。

したがって public/game-derived database の cooldown numeric value を Raw source-backed Formal Value として代入することは不可。

```text
classification:
  requires-category-foundation
  + requires-schema-decision
  + source-fact-gap for base cooldown
  + parser boundary for selected linked sources/start semantics

direct ready population candidates under current Value v2:
  0 / 23

blocked by current Value contract/foundation:
  23 / 23
```

Artifact category foundationでは、Duration / TickInterval / Damage / Heal / actor/effect fields等の **serialized configured fact** と base cooldown / effective behavior を別contractで扱う必要がある。

### 5.3 Relation readiness

Relation v2 には Death Cap Mushroom representative:

```text
death-cap-mushroom -> effect
```

が存在し、`kind = effect` と scope occurrence は現行 schema で表現可能。

ただし Artifact Raw closure は category全体で複数の relation family を持つ:

```text
Effect
ItemActorClass
TomeActorClass
spawned actor / projectile
ActivationAnimation
super / template / inheritance
other explicit local relations
```

Death Cap Mushroom の `Effect` path を残り22件へ無条件に一般化することはできない。

current Horizontal Relation adapter は Artifact scope relationを扱わず、現行 `RelationKind` も `effect` 以外の Artifact-specific actor relationを一般に表現する registry にはなっていない。

```text
current populated:
  1 / 23  (death-cap-mushroom)

additional ready-with-existing-adapter:
  0 / 22

classification:
  requires-category relation foundation
  + per-domain edge-family census
  + possible RelationKind/schema extension depending on selected semantics
```

まず 23 domains の exact source edge family を列挙し、どの relation を Formal boundary に上げるか決める。その後に adapter / RelationKind extension の要否を確定する。GameplayEffect content の意味解釈は Relation breadth と分離する。

---

## 6. Readiness classification summary

| Area | Identity source | Horizontal candidate | Existing Value adapter | Existing Relation adapter | Current disposition |
| --- | --- | --- | --- | --- | --- |
| Melee/Ranged catch-up 8 | valid | exact selected package present 8/8 | accepts 8/8 | accepts 8/8 | **ready-with-existing-adapter** |
| Armor 71 Value | valid | exact package 71/71 | no Armor semantic | n/a | **requires-category-foundation + schema decision** |
| Armor remaining Relation 70 | valid | exact package roots available | n/a | no Armor scope adapter | **requires-category relation adapter + edge census** |
| Artifact 23 Value | valid | exact package 23/23 | no Artifact semantic | n/a | **requires-category-foundation + schema decision; cooldown fact gap/boundary** |
| Artifact remaining Relation 22 | valid | exact package roots available | n/a | no Artifact scope/edge-family adapter | **requires-category relation foundation; possible schema extension** |

---

## 7. Next implementation wave

### Wave A — implement next

```text
Melee / Ranged catch-up 8

Value:
  populate 4 Melee + 4 Ranged

Relation:
  populate the same 8
```

必要作業:

```text
existing Value adapter reuse:
  yes

existing Relation adapter reuse:
  yes

source adapter extension:
  no

schema change:
  no

category foundation:
  no

Raw re-extraction:
  no

required code/audit maintenance:
  extend first-wave definition membership to the 8 reviewed identities
  update Value expected counts 27/23 -> 31/27
  update Relation expected counts 27/23 -> 31/27
  update Formal integration category membership/counts
  preserve source-grounding / provenance guards
```

### Wave B — after Wave A

Armor category foundation:

```text
Value:
  decide v2 extension vs schema migration
  define typed Armor configured-value semantics

Relation:
  census 71 exact roots for GearActor / alternate relation families
  add Armor scope-relation adapter
  population only for source-proven rows
```

### Wave C — after Armor decision

Artifact category foundation:

```text
Value:
  define typed Artifact configured-value semantics
  keep base cooldown unknown/parser-boundary where Raw does not establish it

Relation:
  census 23 exact roots by relation family
  define Artifact relation registry
  decide whether RelationKind extension is needed
```

---

## 8. Validation

実施した reconciliation:

```text
baseline main SHA:
  faa607ac21fc7f320b6b4aebc72d8eceb74378e6

Identity count:
  152

Value domain count:
  50

Relation unique source-domain count:
  52

catch-up domains:
  8 unique / 8 requested
  no duplicate domainId
  no missing requested domain

catch-up Identity package -> Structural manifest candidate:
  8 / 8 exact selected package match

Armor Identity package -> Structural manifest candidate:
  71 / 71 exact package match

Artifact Identity package -> Structural manifest candidate:
  23 / 23 exact package match

catch-up exact source locator:
  all 8 parent configured collections decoded
  all required Value child occurrences decoded
  all primary Relation occurrences present
  all relation targets local import relations

production Formal artifact changes:
  none

Formal population:
  none

schema changes:
  none

Raw re-extraction:
  none

Application / Optimizer changes:
  none
```

この audit は current committed implementation / artifacts を authority とし、過去 audit は current state と一致する範囲だけ補助 evidence として用いた。
