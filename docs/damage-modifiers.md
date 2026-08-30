# Direct melee weapon modifiers — Phase 2-1B

## 型と単一の数値境界

`EnchantmentTierValues.effect`（Phase 2-1Cで名称を統合）の直接modifier部分 は次のdiscriminated unionです。bonusは各tier内だけに保存し、別のeffect tableへ複製しません。既存5種のtier fieldはそのまま維持します。

```ts
type DirectWeaponEffect =
  | { kind: 'passive-weapon-damage'; bonus: number }
  | { kind: 'conditional-weapon-damage'; condition: 'enchanted-enemy'; bonus: number }

interface EnemyComposition {
  enchantedShare: number
}
// Scenario.enemyComposition: EnemyComposition
```

今回のruntime登録はSharpness / Unchantingだけです。Enemy Compositionは今後の条件付き効果の入力をまとめる境界であり、Smiting / Ambush / Committedを実装したものではありません。DamageEvent framework、敵simulator、built-in unique、遠距離、防具は追加していません。

## 計算pipeline

```text
baseDps = (表示ダメージ入力 または Power curve推定per-hit damage) × hitsPerSecond
S = Π(1 + Sharpness tier bonus)
C = 1 + Critical chance × (Critical damage multiplier − 1)
V = 既存per-hit interval・戦闘時間に基づくVoid Strike期待倍率
U = 1 + enchantedShare × Unchanting tier bonus
nonEnchantedTargetDps = baseDps × S × C × V
enchantedTargetDps = nonEnchantedTargetDps × (1 + Unchanting tier bonus)
singleTargetDps = nonEnchantedTargetDps × U
               = (1 − e) × nonEnchantedTargetDps + e × enchantedTargetDps
aoeDps = singleTargetDps × expectedTargetsHit
```

未選択効果は倍率1です。`damagePerHit`と`baseDps`はEnchant適用前を維持します。観測入力は効果適用前の武器表示値を想定し、既にEnchant込みの対敵hit測定を入力して二重増幅しないでください。

このpipelineは**direct melee weapon hit damage**だけを扱います。Criticalによるhit増幅は含みますが、Shockwave / Swirling / Thundering等の独立proc、DoT、Artifact damageは含めません。将来それらを実装するときは別channelとし、現在のscalar pipelineへ流し込まないでください。Sharpnessがゲーム内であらゆる間接damageに無効である、という主張ではありません。

数式上はS / C / V / Uのスカラー乗算順序を交換できます。ただし「独立した期待値を掛ける」こと自体はモデル仮定です。現在はCritical判定、攻撃間隔、対象のenchanted状態を独立とみなし、敵構成がVoidの間隔・付与hit比率を変えないものとします。1.17.0.0の全interactionを独立実機検証したという扱いにはせず、`DIRECT_WEAPON_COMPOSITION`をlow-confidence Evidenceへ分離します。Strength Potion、armor damage aura、その他の加算bonusを追加する際にこの乗算則を一般化してはいけません。

## Sharpness

Phase 2-1A auditの+10% / +21% / +33%をそのままruntimeへ移しました。33%を33.1%へ再解釈しません。`combineEnchantmentValues()`のmultiplicative modeを再利用し、最大4コピー（通常3枠＋金色1枠）を認めます。例えばTier III×2は`1.33²`、Tier III＋金色Tier Iは`1.33 × 1.1`。sortはspecial stackingでの高Tier優先に必要な既存処理であり、Sharpnessの乗算は順序非依存です。

[dungeons.tools Sharpness](https://www.dungeons.tools/enchantments/sharpness)の1.17.0.0由来Tier・copy乗算・4copy説明を2026-08-30に再確認しました。[Minecraft Wiki Sharpness](https://minecraft.wiki/w/Dungeons:Sharpness)の履歴にも1.17.0.0のEnchantsmithによる4copyと、金色に存在する効果を通常枠へ再抽選できることが記載されています。混在Tierは通常Tier IIIと金色Tier I / IIを既存の選択経路で表現します。built-inを含む違法な重複を認める変更ではありません。

## Unchantingと敵構成

Tier I / II / IIIは+50% / +75% / +100%、enchanted敵のみ、maxCopies=1です。[dungeons.tools Unchanting](https://www.dungeons.tools/enchantments/unchanting)の値、melee/ranged適用、STACKS No、対象条件を2026-08-30に再確認しました。runtimeの適用範囲は近接のみです。

`enchantedShare`は「そのScenarioでdirect weapon damageを与える対象のうち、enchanted mobが占める期待割合」です。両群を同じbaseline damageで重み付けするため`(1-e) + e(1+b) = 1 + e×b`となります。敵ごとのHP、enchanted mobのHP偏り、target priority、encounter sequencing、target switchingを無視します。spawn確率・kill割合・実戦の時間割合を計測した値ではありません。

全6profileのdefaultは共通の**0.25**。profile別の実測差がないため、boss / apocalypse-plusも同じgeneric composition assumptionです。bossだから0や1へ固定する処理はありません。UIは0〜100%で編集でき、内部値は0〜1です。`validateScenario()`は範囲外、NaN、±Infinity、欠落を明確な入力エラーとして拒否します。旧APIのScenario objectにもこのfieldが必要です。既存inventory JSONのschemaVersionは変えません（Scenarioは元からinventory保存対象外）。

## Evidenceと結果の追跡

| 根拠 | confidence | factorへの追加条件 |
| --- | --- | --- |
| Sharpness tier / applicability | high | tierは選択時 |
| Sharpness copy乗算・maxCopies | high | 複数copy時 |
| Unchanting tier / applicability / non-stackable | high | tierは選択時、重複はvalidationで拒否 |
| Unchanting enchanted対象条件 | high | Unchanting選択時 |
| Direct modifier composition | low（MVP仮定） | 新規2種のいずれか＋別のdirect modifier |
| Unchanting equal-baseline mixture | low（MVP仮定） | Unchanting選択時 |
| Enemy composition default・入力割合 | low（MVP仮定） | Unchanting選択時のみ |

Unchanting未選択のBuildに敵割合factor/caveatを混ぜません。選択されて割合0の場合は計算仮定を表示し、全寄与deltaは0になります。選択効果を1copyずつ除外する既存のcontribution計算を再利用し、reasonとUIの倍率内訳に割合を表示します。DamageMetricsには`sharpnessMultiplier`、`unchantingMultiplier`、`enchantedShare`、両対象のDPSを残します。

## 残る不確実性

- 全4modifierを組み合わせた同一1.17.0.0の独立実機測定は未取得。Tier/stackingのhigh Evidenceをinteractionへ流用しません。
- Void Strikeの厳密なcurve、target switching、Power換算の誤差は既存の制約を維持。
- Enemy Compositionのprofile別実測は未取得。入力を変更しても観測証拠を添付する機能はないためconfidenceはlowのまま。
- 監査のUnchanting built-in availabilityと公開ページに差があります。dungeons.toolsは現在0 built-ins、Wikiは遠距離のSpellbound Crossbowsを記載。既存audit値はresearch-onlyとして保持し、近接built-in実装時の再監査事項として記録します。

## 検証境界

Tier別増幅、観測/Power入力、合法copyとmixed tiers、Critical/Voidとのcomposition、敵割合0/0.25/1、入力拒否、全profile、UI callback、Evidenceの条件付き集計、寄与0、候補/lock/gildedの保存・JSON・全探索、Phase 2-1B時点の未対応26種の拒否（現在の境界は21種、さらに3種のprocはPower範囲限定）をテストします。7候補×3枠はstacking制約後267buildとなり、既存同期全探索で実測時間を記録します。テストは数学モデルと経路を検証するもので、ゲーム内interactionの実測Evidenceではありません。

参考計測（2026-08-30、ローカルNode 24.8.0、Double Axe 1本・7候補×3枠・Artifactなし）: 267buildの全探索は46.4msでした。端末依存の単発値であり、性能保証や実戦DPS実測ではありません。

Phase 2-1Dは別channelの[DamageEvent](./damage-events.md)を追加しました。上記の直接modifierはprocへ適用しません。
