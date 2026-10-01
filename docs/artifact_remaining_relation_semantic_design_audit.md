# Artifact remaining Formal Relation semantic design audit

## Decision and baseline

**次の implementation wave は `spinblade` の configured SpinWheel actor class 1件だけとする。** 新しい `RelationKind = spin-wheel-actor` を追加し、exact target が `/Script/Dungeons.SpinWheelActor` を直接継承する generated class であることを、対応する CDO/template とともに必須 guard にする。occurrence は `{ domainId: "spinblade", scopeRef: "source" }`。`projectile`、`gear-actor`、`effect`、`item-actor` の流用はしない。

本監査は **調査・Formal Domain 設計のみ**。Relation/Value population、schema/adapter/Application 実装、Raw 再抽出、PR、配信は行っていない。以下の post-wave counts は設計上の予測であり、現在の population ではない。

基準は GitHub `main` **`4957c9b5912b853f581ec16b0f4f6f73360ec1e2`**。2026-10-01 に GitHub connector で `main` の SHA を確認した。ローカル HEAD は `29050725e569dfd964fd8c88516ed6c1dede70af` だが、[GitHub compare](https://github.com/nantes-rfli/minecraft-dungeons_optimizer/compare/29050725e569dfd964fd8c88516ed6c1dede70af...4957c9b5912b853f581ec16b0f4f6f73360ec1e2) は merge commit 1件、`files = []` を返した。同一 content tree は `5fa2fe8649b90e866791a45b61daae7f593ef0f9`。census は working tree を監査入力に使わず、指定 baseline の Git blob、またはこの検証済み同一 tree の commit blob を読む。baseline がローカルにない場合の代替を SHA と tree hash で限定し、他の HEAD へ自動追従しない。

既存の [foundation audit](artifact_formal_value_relation_foundation_design_audit.md) と [ItemActor audit](artifact_item_actor_relation_semantic_design_audit.md) を起点にしたが、candidate discovery はその固定 field list ではなく **23 matched Formal Identity の selected source package の全 CDO reference edge** を再走査した。

## Reproducible census and completeness boundary

[script](../scripts/audit-artifact-remaining-relation-design.py) / [deterministic census](artifact_remaining_relation_semantic_design_census.json):

```sh
python3 scripts/audit-artifact-remaining-relation-design.py --output docs/artifact_remaining_relation_semantic_design_census.json
python3 scripts/audit-artifact-remaining-relation-design.py --output /tmp/artifact-remaining-census-repeat.json
cmp docs/artifact_remaining_relation_semantic_design_census.json /tmp/artifact-remaining-census-repeat.json
```

入力は committed Identity v1、Horizontal inventory、Structural manifest/shards、Relation v2、Value v2。dataset は `mcd-quickbms-local-1.17.0.0-823acded`。全 **96 shard** の compressed/uncompressed SHA-256、package/edge counts と dataset binding を検証した。全23 Identity が matched で、Assertion の exact package = selected Horizontal candidate = Structural seed candidate を要求する。Identity evidence と source package の dataset/hash/parse provenance を照合し、Death Cap の full Raw evidence は同一 logical package hash を照合する。

root の decoded ObjectProperty/ClassProperty/SoftObjectProperty を nested struct/array element まで走査し、Structural CDO edge と多重度まで一致させた。各 edge の source range、property pointer、arrayIndex、rawPackageIndex、target object/package、Horizontal reference の有無を census に保存した。未分類 edge、duplicate、target role drift は script failure とする。全 root package の非 CDO edges も保存し、import/class/outer/super/template と gameplay property を分離して確認した。

**今回の completeness は current committed inventory に観測された root CDO edges に対するもの。** 非 CDO payload は `not-extracted`、native implementation は unavailable のまま。未シリアライズの inherited default や実行時 edge が存在しないとは主張しない。unknown/unsupported/not-observed/parser-boundary を 0 や「無効果」に変換しない。

| root CDO edge 分類 | 件数 | 根拠 |
| --- | ---: | --- |
| 実装済み `Effect` / `ItemActorClass` | 21 | 10 + 11 exact root edges |
| remaining gameplay class candidates | 10 | 8 domains / 9 semantic families / 9 distinct target classes |
| `TypeHierarchy[*].classType` | 2 | fishing-rod の native class reference |
| presentation / component wiring | 69 | ActivationAnimation 18、Montage 1、FishHook animation 2、LandingEffect 1、LandingSound 1、InventoryDropSound 23、RootComponent 23 |
| **合計** | **102** | object-property 79 + soft-object-property 23 |

提示された10 candidate は全て再発見した。追加の **gameplay class candidate は0**。一覧外の TypeHierarchy 2件と InventoryDropSound 23件も落とさずに分類した。非 CDO edges は import 596、class/outer/super/template 各119件で、いずれも配置/型/所有の serialized wiring である。

## Exact candidate reconciliation

以下の package path は共通の `Dungeons/Content/` prefix だけを省略している。実際の full path、full target object、package hash、source range、CDO/export/edge JSON pointer は census の `remainingCandidates` にある。locator の `061#/edges/1058` は `research/raw/game-data-raw-structural-inventory/shards/part-061.json.gz#/edges/1058` を意味する。path の case/spelling は committed source のまま。

全10件は root `object-property / cdo-property`、targetKind=`import`、Structural target=`resolved-local-package`、traversal=`already-visited`。これは訪問済み package の再利用であり解決失敗ではない。10件すべての generated class chain は direct native superclass 1 hop で停止する。**local target resolution とその先の native boundary は別の状態**である。

| domainId / property path | exact source package | Structural edge ID / locator | exact target package / generated class |
| --- | --- | --- | --- |
| `blast-fungus` / `ProjectileItemSpec.ClassesToSpawn[0]` | `Content_DLC4/Actors/Items/NetherWartSporeGrenade/BP_NetherWartSporeGrenadeInstance` | `cbca1ff1473ec0b3b53a43ea` / `061#/edges/1058` | `Content_DLC4/Actors/Items/NetherWartSporeGrenade/BP_SporeGrenade` / `BP_SporeGrenade_C` |
| `buzzy-nest` / `BeesNestClass` | `Patch2/Actors/Items/Beenest/BP_BeenestInstance` | `f02ac79f98d642001867c8ec` / `078#/edges/2305` | `Patch2/Actors/Items/Beenest/BP_Beenest` / `BP_Beenest_C` |
| `fishing-rod` / `FishingHookActorClass` | `Actors/Items/FishingRod/BP_FishingRodInstance` | `61c85456ce1c89009060695d` / `030#/edges/4451` | `Actors/Items/FishingRod/BP_FishHookItem` / `BP_FishHookItem_C` |
| `fishing-rod` / `FishingRodActorClass` | `Actors/Items/FishingRod/BP_FishingRodInstance` | `a5980691c198c7fd05bd2a0c` / `030#/edges/4470` | `Actors/Items/FishingRod/BP_FishingRod` / `BP_FishingRod_C` |
| `light-feather` / `CustomMover` | `Actors/Items/LightFeather/BP_LightFeatherInstance` | `e46cec8f231640716e16cc33` / `031#/edges/1029` | `Actors/Items/LightFeather/BP_LightfeatherCustomMover` / `BP_LightfeatherCustomMover_C` |
| `powershaker` / `MobMashShockWavePrimaryClass` | `Content_DLC4/Actors/Items/MobMasher/BP_MobMasherInstance` | `184f285d23b605e92ac20377` / `061#/edges/98` | `Content_DLC4/Actors/Items/MobMasher/BP_MobMasherShockWave` / `BP_MobMasherShockWave_C` |
| `powershaker` / `MobMashShockWaveSecondaryClass` | `Content_DLC4/Actors/Items/MobMasher/BP_MobMasherInstance` | `736256eb6b887c81c1aa80e1` / `061#/edges/115` | `Content_DLC4/Actors/Items/MobMasher/BP_MobMasherShockWave` / `BP_MobMasherShockWave_C` |
| `scatter-mines` / `ChargedRedstoneMineBP` | `Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMinesInstance` | `698f18b4f6d00a168d8f0e1f` / `058#/edges/1983` | `Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMine` / `BP_ChargedRedstoneMine_C` |
| `spinblade` / `SpinWheelActorClass` | `Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance` | `2cd31aaf1c49b33bd4dca244` / `061#/edges/2281` | `Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor` / `BP_SpinWheelActor_C` |
| `totem-of-casting` / `TotemClass` | `Actors/Items/SoulTotemOfCasting/BP_SoulTotemOfCastingInstance` | `abba8ad43cb2a63d66abc89c` / `031#/edges/4340` | `Actors/Items/SoulTotemOfCasting/BP_SoulTotemOfCasting` / `BP_SoulTotemOfCasting_C` |

| domain / role | direct superclass / native boundary | exact CDO / native template | target package locator / super edge ID | Horizontal root binding |
| --- | --- | --- | --- | --- |
| `blast-fungus` / `ProjectileItemSpec.ClassesToSpawn[0]` | `/Script/Dungeons.SporeGrenade` / `native-boundary` | `Default__BP_SporeGrenade_C` / `Default__SporeGrenade` | `061#/packages/13` / `8e938256059e41e53e6cec4b` | exact `rp-root` |
| `buzzy-nest` / `BeesNestClass` | `/Script/Dungeons.BeeNest` / `native-boundary` | `Default__BP_Beenest_C` / `Default__BeeNest` | `078#/packages/53` / `0df13a3c1c7ffe0c6fe9c5be` | **absent** |
| `fishing-rod` / `FishingHookActorClass` | `/Script/Dungeons.FishHookItem` / `native-boundary` | `Default__BP_FishHookItem_C` / `Default__FishHookItem` | `030#/packages/40` / `f152271931f19a7765d010b1` | exact `rp-root` |
| `fishing-rod` / `FishingRodActorClass` | `/Script/Engine.Actor` / `native-boundary` | `Default__BP_FishingRod_C` / `Default__Actor` | `030#/packages/41` / `1922f57b3dccb80478bd915f` | exact `rp-root` |
| `light-feather` / `CustomMover` | `/Script/Dungeons.PushbackCustomMover` / `native-boundary` | `Default__BP_LightfeatherCustomMover_C` / `Default__PushbackCustomMover` | `031#/packages/13` / `80bd35a266192e90cfbbd274` | **absent** |
| `powershaker` / `MobMashShockWavePrimaryClass` | `/Script/Dungeons.MobMashShockWave` / `native-boundary` | `Default__BP_MobMasherShockWave_C` / `Default__MobMashShockWave` | `061#/packages/4` / `6a74272df023a430ba208123` | **absent** |
| `powershaker` / `MobMashShockWaveSecondaryClass` | `/Script/Dungeons.MobMashShockWave` / `native-boundary` | `Default__BP_MobMasherShockWave_C` / `Default__MobMashShockWave` | `061#/packages/4` / `6a74272df023a430ba208123` | **absent** |
| `scatter-mines` / `ChargedRedstoneMineBP` | `/Script/Dungeons.ChargedRedstoneMineActor` / `native-boundary` | `Default__BP_ChargedRedstoneMine_C` / `Default__ChargedRedstoneMineActor` | `058#/packages/30` / `456915b6fea8c7bd814fddb1` | **absent** |
| `spinblade` / `SpinWheelActorClass` | `/Script/Dungeons.SpinWheelActor` / `native-boundary` | `Default__BP_SpinWheelActor_C` / `Default__SpinWheelActor` | `061#/packages/22` / `20c0a35bef8c6056ba6a50b2` | exact `rp-root` |
| `totem-of-casting` / `TotemClass` | `/Script/Dungeons.SoulTotemOfCastingActor` / `native-boundary` | `Default__BP_SoulTotemOfCasting_C` / `Default__SoulTotemOfCastingActor` | `031#/packages/48` / `aa539d7dfd4a93d9dd3fdb66` | **absent** |

CDO は名前 suffix の照合だけでなく、`references.class.kind = export` と rawPackageIndex が exact target generated class export を指すことを確認した。class 自身の `super` edge、inheritance chain の edgeId と native object path を照合した。target の class role は export + super + CDO/template の三者に基づき、source field 名の類似には基づかない。

## Family identity and readiness

`ready-with-new-kind` は、現在の source/target evidence で bounded configured-class relation を定義できるという判定。kind policy、target guard、validators の将来実装を免除する意味ではない。`requires-additional-source-evidence` は、**Structural の証拠は既に存在するが、現行 Formal producer に bind する source-evidence contract が欠ける**状態を指す。missing target や追加 Raw extraction が必要という意味ではない。

| family / domain / exact edge | source-backed semantic identity | existing kind / new kind | occurrence 設計 | readiness / required work |
| --- | --- | --- | --- | --- |
| SporeGrenade class-to-spawn / blast-fungus / `ClassesToSpawn[0]` | decoded `ProjectileItemSpec` 内の ObjectProperty array member が direct native SporeGrenade subclass を設定する。target CDO は `Default__SporeGrenade`。 | existing不可。`spore-grenade-spawn-class`。general spawn-class taxonomy まで広げない。 | `{domainId:"blast-fungus", collectionRef:"spore-grenade-spawn-classes", sourceIndex:0}` | **ready-with-new-kind**。indexed reader と container/element/target-role guard が必要。 |
| BeeNest class / buzzy-nest / `BeesNestClass` | BeeNestItemInstance source → direct native BeeNest subclass。target CDO の `SummonHelper` は local component reference。 | existing不可。限定 `bee-nest`。item-owned actor という所有/runtime意味は加えない。 | `{domainId:"buzzy-nest", scopeRef:"source"}` | **requires-additional-source-evidence**。Horizontal root ref なし。verified Structural source binding + BeeNest target guard を追加する設計が必要。 |
| FishHookItem class / fishing-rod / `FishingHookActorClass` | direct FishHookItem subclass と `Default__FishHookItem` CDO/template。CDO explicit edge は RootComponent。 | existing不可。`fish-hook`。`ItemActor` と名前で同一視しない。 | `{domainId:"fishing-rod", scopeRef:"source"}` | **ready-with-new-kind**。exact `rp-root` がある。FishHookItem guard が必要。rod 側との一括化は禁止。 |
| rod class / fishing-rod / `FishingRodActorClass` | exact configured generated class は分かるが、直接 parent は Engine.Actor、CDO property inventory は空。StaticMesh/SceneComponent の非 CDO exports は wiring evidence。 | existing不可。gameplay `rod-actor` kind は未確定。generic actor-class で逃がさない。 | singleton root scope の物理形は安定。semantic ref は保留。 | **semantic-ambiguous**。表示 actor / gameplay entity / ownership の判別には追加の source-backed role evidence が必要。native/runtime 使用条件を推測しない。 |
| PushbackCustomMover class / light-feather / `CustomMover` | direct PushbackCustomMover subclass と対応 template。target CDO の Pushback struct と bApplyResistance は設定の存在だけを裏付ける。 | existing不可。限定 `pushback-custom-mover`。generic mover / Actor の継承は native 先を推測しない。 | `{domainId:"light-feather", scopeRef:"source"}` | **requires-additional-source-evidence**。Horizontal root ref なし。Structural binding + PushbackCustomMover guard が必要。実際の移動を assert しない。 |
| MobMashShockWave class / powershaker / primary + secondary | **exact same target object、same package hash、same class export、same super edge、same CDO/template**。共通 target role を証明できる唯一の multi-property family。ただし二つの設定 role は独立。 | existing不可。限定 `mob-mash-shockwave`。effect/ItemActorとは別。 | 同一 `relation:powershaker:mob-mash-shockwave@1` に `{domainId:"powershaker", scopeRef:"primary"}` / `scopeRef:"secondary"` の2 role。 | **requires-additional-source-evidence**（両 edge）。Horizontal refs なし。加えて role-aware occurrence/projection support と独立 edge guard が必要。 |
| ChargedRedstoneMineActor class / scatter-mines / `ChargedRedstoneMineBP` | source ChargedRedstoneMinesInstance → direct ChargedRedstoneMineActor subclass。target CDO は対応 native template、MineCollision/Root は component wiring。 | existing不可。限定 `charged-redstone-mine`。隣接する ItemActorClass は別 superclass/別 CDO。 | `{domainId:"scatter-mines", scopeRef:"source"}` | **requires-additional-source-evidence**。Horizontal ref なし。Structural binding + exact mine role guard が必要。爆発/攻撃/damage は未確認。 |
| SpinWheelActor class / spinblade / `SpinWheelActorClass` | source direct SpinWheelInstance subclass → target direct SpinWheelActor subclass。対応 native CDO/template。target CDO に LaunchSideInfluence / ArcSideInfluence / ReturnInfluence の設定がある。 | existing不可。`spin-wheel-actor`。configured class identity だけを意味する。 | `{domainId:"spinblade", scopeRef:"source"}` | **ready-with-new-kind — 次 wave に選定**。exact Horizontal binding + single scope。SpinWheelActor target guard を実装する。 |
| SoulTotemOfCastingActor class / totem-of-casting / `TotemClass` | direct SoulTotemOfCastingActor subclass と exact CDO/template。CooldownReductionPercentage / PulseDelaySeconds 等の decoded field の存在は role補助証拠に留める。 | existing不可。限定 `soul-totem-of-casting`。他 totem 類への共通 ancestor は未確認。 | `{domainId:"totem-of-casting", scopeRef:"source"}` | **requires-additional-source-evidence**。Horizontal ref なし。Structural binding + SoulTotemOfCastingActor guard が必要。target `Beat Amount` は parse-failed のまま。 |

**10 candidate の判定内訳:** ready-with-new-kind 3、requires-additional-source-evidence 6、semantic-ambiguous 1。remaining に ready-with-existing-kind は0。target role を確認できず追加 target inspection を待つ `requires-additional-target-role-guard` は0だが、確定した role を producer で強制する guard は全ての new kind に必要。rod は generic Actor guard の追加だけでは解決しない。source と target role は異なる gate として扱う。

単一 native boundary ごとに family を限定する。SporeGrenade、BeeNest、FishHookItem、PushbackCustomMover、MobMashShockWave、ChargedRedstoneMineActor、SpinWheelActor、SoulTotemOfCastingActor は共通の native ancestor を current source で確認できていない。`spawn-class`、`item-owned actor`、`mine`、`shockwave`、`hook / rod`、`custom mover`、`totem` を一つの「Artifact actor」に統合しない。target CDO の似た Pushback/RootComponent/animation fields は共有 semantic identity の証明にならない。

### Source-evidence gap is real, but Raw already exists

`game-data-horizontal-fact-inventory.ts` の `RELATION_PROPERTY_PATTERN` / traversal patterns は、BeesNestClass、CustomMover、MobMashShockWavePrimaryClass、MobMashShockWaveSecondaryClass、ChargedRedstoneMineBP、TotemClass を relation reference に取り込まない。census はこの6 edge の `horizontalSource = null` / `horizontalReference = null` を explicit に保存する。反対に blast-fungus、hook、rod、spinblade の4 edge は、unique sourceRelations + selected candidate exact `rp-root` を確認した。

したがって、既存 `resolveHorizontalScopeRelationSource` に field policy だけを足して6件を通す設計は成立しない。将来は (a) current Structural shards への新しい verified direct reader を追加する、または (b) Horizontal derivative の selector/coverage を設計して再生成する、のどちらかで source binding を供給する。これは game binary の Raw 再抽出を要求しない。未存在 Horizontal ref を捏造したり、nearby ItemActor/Effect の evidence を借りたりしない。本 wave はこの追加経路を含めない。

### Shockwave role identity and projection collision

primary edge=`184f285d23b605e92ac20377`、secondary edge=`736256eb6b887c81c1aa80e1` は source range が別で、同じ target でも別 evidence を持つ必要がある。primary/secondary は source の設定 slot を示す名前であり、first/second hit、damage差、chain発生などを意味しない。

v2 occurrence type の `scopeRef: string` は role scope を記録できる。しかし現行 `relationProjectionRef()` は全 scope を `:source` にし、horizontal generator は `scopeRef !== "source"` を reject する。よって role scope を書くだけでは実装できない。将来のこの family は explicit policy `primary → PrimaryClass edge` / `secondary → SecondaryClass edge`、scope-aware projection suffix `:primary` / `:secondary`、duplicate/ref validation を同時に設計・実装し、既存 `:source` refs を byte-preserve する必要がある。架空の arrayIndex/sourceIndex=0/1 は使わず、target equality による coalescing も行わない。JSON shape だけなら v2 内で可能でも、現在の producer contract の変更を要するため次 wave から除外する。

## Exclusions rechecked against committed source

| family | current source result | classification / boundary |
| --- | --- | --- |
| ActivationAnimation / Montage | 18 + 1 root edges。targets は AnimSequence/AnimComposite/AnimMontage。eye-of-the-guardian の ActivationAnimation target 自体も AnimMontage。 | **presentation-or-structural**。attack/activation runtime execution や notify/timeline は未確認。 |
| FishHook animation sequences | fishing-rod の2 edge は実際には AnimComposite export。名前の Sequence suffix から Asset type を推定しない。 | **presentation-or-structural**。hook entity relation と分ける。 |
| LandingEffect / LandingSound | light-feather の target は ParticleSystem / SoundCue。 | **presentation-or-structural**。GameplayEffectやdamageと扱わない。 |
| InventoryDropSound | 全23 root の SoftObjectProperty。local SoundCue targets。 | **presentation-or-structural**。old object-property-only enumeration に落ちた追加23 edge。 |
| RootComponent | 全23 root が local export reference。targetObject/targetPackage が null でも targetKind=`export`、rawPackageIndex は非zero。 | **presentation-or-structural**。known-null gameplay relation に変換しない。 |
| Paperdoll | root は0。11 ItemActor target CDO に observed Paperdoll export links。RootComponent と同一 component を指す wiring。 | **presentation-or-structural**。item ownership/spawn を証明しない。 |
| UIData / iconClass | root は0。current Effect target 内 UIData 6 edge と traversed UIData package の iconClass 6 edge を supplemental census に再記録。 | **presentation-or-structural**。UI target role。root relation を増やさない。 |
| import / class / outer / super / template | 23 root package の全非 CDO edge を census に保存。class/super/template は役割 guard の証拠として読む。 | **presentation-or-structural**。それ自体は configured gameplay relation occurrence ではない。 |
| TypeHierarchy[0].classType | fishing-rod、edge `72be2f092605984b1016bae3` → `/Script/Dungeons.MobCharacter`。 | **native/runtime-boundary**。native target CDO/ancestry/HierarchyPlacement runtime semantics は未確認。 |
| TypeHierarchy[1].classType | fishing-rod、edge `860dda9d7c48abaea57e2a81` → `/Script/Dungeons.StorableItem`。 | **native/runtime-boundary**。target filter/ownership/selection behavior を補完しない。 |

`MobsToChooseFrom[*].MobType`（enchanted-grass）は EntityType enum であり serialized object/package edge ではない。PetAmountCap、damage/launch/health 等の scalar fields から関係 target を発明しない。Value population と effective behavior は今回の対象外。

## All 23 root coverage

`E` = existing Effect、`I` = existing ItemActor、`A` = presentation animation family、`S` = InventoryDropSound、`R` = RootComponent。exact package/CDO/property paths と edges は census `rows` に全件保存。

| domainId | existing gameplay kinds | remaining root candidates / native edges | presentation / structural root paths | 判定 |
| --- | --- | --- | --- | --- |
| `blast-fungus` | — | `ProjectileItemSpec.ClassesToSpawn[0]` | A, S, R | 上記 family matrix |
| `boots-of-swiftness` | E | — | S, R | remaining candidate なし（existing は維持） |
| `buzzy-nest` | — | `BeesNestClass` | A, S, R | 上記 family matrix |
| `corrupted-pumpkin` | E | — | Montage, S, R | remaining candidate なし（existing は維持） |
| `corrupted-seeds` | I | — | A, S, R | remaining candidate なし（existing は維持） |
| `death-cap-mushroom` | E, I | — | A, S, R | remaining candidate なし（existing は維持） |
| `enchanted-grass` | I | — | A, S, R | remaining candidate なし（existing は維持） |
| `eye-of-the-guardian` | — | — | A, S, R | **no-formal-relation-candidate**（current root inventory 内） |
| `fishing-rod` | E | `FishingHookActorClass` / `FishingRodActorClass` / `TypeHierarchy[0].classType` / `TypeHierarchy[1].classType` | FishHookPullAnimationSequence, FishHookThrowAnimationSequence, S, R | 上記 family matrix |
| `ghost-cloak` | E | — | S, R | remaining candidate なし（existing は維持） |
| `harpoon-quiver` | — | — | S, R | **no-formal-relation-candidate**（current root inventory 内） |
| `iron-hide-amulet` | E, I | — | A, S, R | remaining candidate なし（existing は維持） |
| `light-feather` | E | `CustomMover` | A, LandingEffect, LandingSound, S, R | 上記 family matrix |
| `powershaker` | E, I | `MobMashShockWavePrimaryClass` / `MobMashShockWaveSecondaryClass` | A, S, R | 上記 family matrix |
| `satchel-of-elements` | I | — | A, S, R | remaining candidate なし（existing は維持） |
| `satchel-of-elixirs` | I | — | A, S, R | remaining candidate なし（existing は維持） |
| `satchel-of-snacks` | I | — | A, S, R | remaining candidate なし（existing は維持） |
| `scatter-mines` | I | `ChargedRedstoneMineBP` | A, S, R | 上記 family matrix |
| `shadow-shifter` | E, I | — | A, S, R | remaining candidate なし（existing は維持） |
| `shock-powder` | E, I | — | A, S, R | remaining candidate なし（existing は維持） |
| `spinblade` | — | `SpinWheelActorClass` | A, S, R | 上記 family matrix |
| `totem-of-casting` | — | `TotemClass` | A, S, R | 上記 family matrix |
| `vexing-chant` | — | — | A, S, R | **no-formal-relation-candidate**（current root inventory 内） |

`eye-of-the-guardian`、`harpoon-quiver`、`vexing-chant` は presentation/component 以外の root gameplay relation edge が観測されない。これは game effect が0、または runtime relation が存在しないという結論ではない。Formal Identity 未昇格の他 Artifact root をこの23 domain の counts に混ぜない。

## Guard contract for every future new kind

共通 source guard は exact catalog/domain/assertion + matched same-source Formal Identity、selected candidate package、unique root CDO、unique source property occurrence、exact Structural edge ID、property path/source range/rawPackageIndex/arrayIndex、dataset/manifest/shard compressed/uncompressed hashes、package hash/parse run、import target object/package の一致。Horizontal source を使う場合は unique sourceRelations + candidate reference + `rp-root` と Structural summary の equality を必須とする。

共通 target guard は verified target shard/package、full target object が exact package の generated class export に一致すること、class kind、unique class export、class自身の unique super edge と raw index、one-hop exact native parent + native-boundary chain、unique corresponding CDO の class reference、expected native template。actor/mover/effect の役割を class suffix、directory、component名だけで判断しない。source class の parent も family別に固定し、別 domain/root/role の同名 field を含めない。

| proposed kind | required native parent / template | extra occurrence guard |
| --- | --- | --- |
| spore-grenade-spawn-class | Dungeons.SporeGrenade / Default__SporeGrenade | decoded ProjectileItemSpec struct → ClassesToSpawn array（inner ObjectProperty）→ raw element index=0 と exact reference。parent/element range を保持。成功順に再採番しない。 |
| bee-nest | Dungeons.BeeNest / Default__BeeNest | unique BeesNestClass scalar root。source BeeNestItemInstance role。 |
| fish-hook | Dungeons.FishHookItem / Default__FishHookItem | unique hook scalar root。rod field と完全に分ける。 |
| pushback-custom-mover | Dungeons.PushbackCustomMover / Default__PushbackCustomMover | unique CustomMover scalar root。native ancestors が未確認なので generic CustomMover/Actor を許可しない。 |
| mob-mash-shockwave | Dungeons.MobMashShockWave / Default__MobMashShockWave | primary/secondary slot を明示し、source occurrence と projection identity を2件保持。片方の drift をもう片方の成功で補完しない。 |
| charged-redstone-mine | Dungeons.ChargedRedstoneMineActor / Default__ChargedRedstoneMineActor | unique mine root。existing ItemActor edge/hash/evidence を借用しない。 |
| spin-wheel-actor | Dungeons.SpinWheelActor / Default__SpinWheelActor | unique scalar SpinWheelActorClass root、source SpinWheelInstance role。scope=source。 |
| soul-totem-of-casting | Dungeons.SoulTotemOfCastingActor / Default__SoulTotemOfCastingActor | unique TotemClass scalar root。他 Totem の native family を推定しない。parser failure は target class role guard と区別する。 |

root/target の欠落、重複、hash drift、wrong class/template、inherited/local hopへの変化、別 role への変更は fail closed。想定外 source/target を近い型や default 値で穴埋めしない。target full Raw snapshot を供給しない wave では `targetRawVerification = not-supplied / not-resolved / target-snapshot-not-supplied` を維持する。Structural class/CDO 証明は full target Raw verification を意味しない。

## Selected next implementation wave: one configured SpinWheel class

新 kind の意味は **source Artifact に設定された、exact target generated class が native SpinWheelActor を直接継承する class relation**。飛ぶ、戻る、移動する、攻撃する、damage を与える、activation 時に必ず使われる、item に所有される等は含めない。

```text
included domains: spinblade only
source package:
  Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance
source native parent: /Script/Dungeons.SpinWheelInstance
property: SpinWheelActorClass
Structural edge: 2cd31aaf1c49b33bd4dca244
source locator: part-061.json.gz#/edges/2281
sourceOccurrence: cdo-property / arrayIndex=null
Horizontal source: unique sourceRelations + selected candidate reference / rp-root

target package:
  Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor
target object:
  /Game/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor.BP_SpinWheelActor_C
target class export: part-061.json.gz#/packages/22/exports/1
super edge: 20c0a35bef8c6056ba6a50b2
native parent: /Script/Dungeons.SpinWheelActor
target CDO: Default__BP_SpinWheelActor_C
CDO export: part-061.json.gz#/packages/22/exports/2
template: Default__SpinWheelActor

RelationKind: spin-wheel-actor
RelationRef: relation:spinblade:spin-wheel-actor@1
occurrence: { domainId: "spinblade", scopeRef: "source" }
projectionRef: projection:relation:spinblade:spin-wheel-actor@1:source
new collections: 0
```

選定理由は **1 kind / 1 domain / 1 scope occurrence / 既存 exact Horizontal source binding** に収まるため。6件の欠けた Horizontal source contract、blast-fungus の indexed collection reader、shockwave の2 role projection identity を巻き込まない。hook も単独なら evidence-ready だが、同一 source に隣接する generic rod class との family混同を別に管理する必要があるため、独立した SpinWheel family を最初に選ぶ。これは semantic proof の強さだけで複数 family を同じ wave に束ねる理由にはしない。

serialized fields/occurrence JSON shape は既存 v2 で足り、schemaVersion bump は不要。ただし controlled consumers の `RelationKind` union、typed scope policy、target-role verifier、generator lane、validation/integration/count locks、fixtures/docs を揃えて変更する implementation が必要。existing ItemActor verifier の superclass 条件を緩めず、SpinWheelActor の独立 policy とする。全既存 RelationRef/projectionRef/evidence/Value/Identity を preserve する。Application semantics と Value は追加しない。

関連する将来検証は exact new population、same-source guard と wrong superclass/CDO/template/hash の rejection、singleton occurrence の uniqueness、既存225 relation/evidence の保持、byte deterministic generation に限定する。本監査では全体 CI の再実行は行わない。

## Final Formal state, post-wave counts and deferrals

| state | current committed main | expected after selected wave |
| --- | ---: | ---: |
| Formal Identity（all categories） | 152 | 152 |
| Artifact Formal Identity domains | 23 | 23 |
| Relation schemaVersion | 2 | 2 |
| Relation kinds | 5 | 6 |
| Melee AttackSequence occurrences / domains | 106 / 31 | 106 / 31 |
| Ranged Projectile occurrences / domains | 27 / 27 | 27 / 27 |
| Armor GearActor occurrences / domains | 71 / 71 | 71 / 71 |
| Artifact Effect occurrences / domains | 10 / 10 | 10 / 10 |
| Artifact ItemActor occurrences / domains | 11 / 11 | 11 / 11 |
| Artifact SpinWheelActor occurrences / domains | 0 / 0 | **1 / 1** |
| semantic relation records | 225 | **226** |
| relation projections | 225 | **226** |
| relation collections | 58 | 58 |
| unique Relation source domains（all categories） | 145 | **146** |
| unique Artifact Relation source domains | 16 | **17** |
| Artifact Narrow Formal Value domains | 3 | 3 |
| remaining audited candidate occurrences / families | 10 / 9 | **9 / 8** |

現在の Artifact Relation source domain の union は16（Effect/ItemActor が5 domainで重複）。spinblade は現在の union 外なので +1 domain。post-wave counts は script で既存ref/projectionとの非衝突も確認した。

**Deferred families と理由:**

- SporeGrenade spawn-class: new kind に加え、explicit array element / collection sourceIndex adapter が必要。既存 ranged projectile の ProjectileDefinition role と等価ではない。
- FishHookItem: ready-with-new-kind。今回の1 family最小waveに含めない。rod と同時に formalize しない。
- rod actor: semantic-ambiguous。Engine.Actor / 空CDO / mesh wiring から gameplay role や runtime所有を決められない。
- BeeNest、PushbackCustomMover、ChargedRedstoneMineActor、SoulTotemOfCastingActor: target configured-role proof は揃うが現行 Horizontal source evidence contract がない。追加 reader または derivative inventory の設計が先。totem の一部 parse-failed state と native runtime semantics を保持する。
- MobMashShockWave primary/secondary: target familyは一致するが source bindings が欠ける。現行 scope projection implementation は2 roleを表現できず、role-aware identity support を必要とする。
- TypeHierarchy: native/runtime-boundary。presentation/structural edges 69件および supplemental UI/component links は対象外。root gameplay candidate が観測されない3 domainは no-formal-relation-candidate とする。

監査検証は census の2回生成の byte一致、全23 root reference coverage、96 shard hashes、exact class/super/CDO binding、ref collision check、`git diff --check`、既存 committed files の不変確認。追加したのは本 report、design census、read-only census script のみ。ここで停止し、population/schema/Application/PR 作業へ進めない。
