# Power Levelと実ダメージ

## Phase 1-2.2の結論

runtimeは **Model G: dungeons.toolsの内部Power rating比** を採用します。対象バージョンはMinecraft Dungeons 1.17.0.0です。

```text
logDamage(p) =
  logDamage(lower)
  + position × (logDamage(upper) − logDamage(lower))

weaponDamage =
  interpolatedAnchorDamage
  × weaponInternalPowerRating
  ÷ anchorInternalPowerRating
```

内部ratingはFighter's Bindings `2.045`、Double Axe `8.686`、Anchor `14`です。Wikiのbase damage `25 / 100 / 238`はruntime係数に使わず、Model Wを比較するresearch Evidenceとしてのみ保持します。

## データの意味

### dungeons.toolsのPower

[tier list](https://www.dungeons.tools/tier-list)はPowerを「ゲームファイルで各武器に保存されたper-hit damage rating」、データセットを1.17.0.0のgame files由来と説明しています。[damage calculator](https://www.dungeons.tools/damage-calculator)は次を明示しています。

- 各weaponはPower / Speed / Areaのfloat値をitem stat tableに持つ。
- inventoryの1〜14表示はその丸め値であり、計算には元のfloatを使う。
- 絶対damageはweaponに保存されず、全item共通のGear Power curveをratingへ乗算する。
- Power比はGear Powerによらず一定で、Speedはper-hit damageとは別にDPSへ使う。

公開ページのclient実装もper-hitを`weapon.power`、sustained damageを`weapon.power × weapon.speed`として比較しています。一方、raw game-fileのfield名、抽出コード、検証可能なrepositoryは公開されていません。このため個々のrating値は1.17.0.0 game-file dataとしてhigh confidence、武器間の線形関係は独立監査不足を反映してmedium confidenceとします。

### Wikiのbase damage

WikiのFighter's Bindingsは4 hitすべて`25`、Double Axeは2 hitとも`100`、Anchorは`238`を掲載しています。しかし、Fighter's BindingsのPower damage表は[revision 1887242](https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings?oldid=1887242)で2021-03-21に無出典で追加され、per-hit base damage `25`は[revision 2209570](https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings?oldid=2209570)で2023-01-01に無出典で追加されています。現在のStats表にもgame-file fieldや計測条件のreferenceはありません。

したがって、これらの値はcombo内のhit比を表す正規化値としては利用できますが、1.17.0.0の武器間damage係数とは確認できません。`WIKI_BASE_HIT_DAMAGE`はlow-confidence research Evidenceとしてruntimeから分離します。

## Evidence hierarchy

判断順は次のとおりです。

1. 1.17.0.0 game-file data
2. version明記の1.17.0.0実測
3. version不明の公開実測・item card
4. 出典のないWiki正規化値
5. model inference

dungeons.toolsの内部ratingは1、既存の29 fixtureは3または4です。fixtureへのfitだけで意味の異なる低優先度データを採用しません。

| source | game version certainty | data origin | confidence / use |
| --- | --- | --- | --- |
| dungeons.tools internal rating | 1.17.0.0明記 | game-file item stat tableからの抽出と公開client計算 | rating high / 線形ratio medium |
| Anchor Power curve | row version不明 | Minecraft Wiki公開card damage表 | medium / 絶対curve |
| Fighter's Bindings / Double Axe Power表 | row version不明 | Minecraft Wiki公開card damage range | medium / validationのみ |
| Wiki base damage | version・一次出典とも不明 | Wiki編集者が追加したnormalized Stats値 | low / Model W比較のみ |
| Fighter's Bindings P251 report | version不明 | community item-card報告 | low / validationのみ |

## 独立fixtureと誤差

[`src/data/powerScalingValidation.ts`](../src/data/powerScalingValidation.ts)の29 sampleは変更していません。Anchorの12点はruntime curveの入力でもあるため回帰確認に使い、独立した武器間比較はFighter's Bindings 3点とDouble Axe 14点の計17点です。

- [Fighter's Bindings Wiki revision 2959833](https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings?oldid=2959833): P114、P135 range
- [Fighter's Bindings P251 community report](https://www.reddit.com/r/MinecraftDungeons/comments/o8no8d/): 約188,000〜191,710
- [Double Axe Wiki revision 3004051](https://minecraft.wiki/w/Dungeons%3ADouble_Axe?oldid=3004051): P50〜108の13 rangeとP251 range
- [Anchor Wiki](https://minecraft.wiki/w/Dungeons%3AAnchor): P50〜263の12 exact値

exactは相対絶対誤差、rangeは範囲内を0、範囲外を最寄り境界からの相対距離として扱います。許容値はexact 5%、range 8%、P90はnearest-rankです。各rowのgame version、item sub-power、rarity rollは不明です。

## Model W / G比較

Model Wは`Anchor curve × Wiki base damage / 238`、Model Gは`Anchor curve × internal Power / 14`です。第三の公開式を確認できなかったためModel Cは比較対象なしです。

| model / weapon | samples | median | P90 | max | tolerance内 |
| --- | ---: | ---: | ---: | ---: | ---: |
| W / Fighter's Bindings | 3 | 0.00% | 21.35% | 21.35% | 2 / 3 |
| W / Double Axe | 14 | 6.02% | 6.18% | 6.22% | 14 / 14 |
| W / 独立17点overall | 17 | 5.97% | 6.22% | 21.35% | 16 / 17 |
| G / Fighter's Bindings | 3 | 0.21% | 36.61% | 36.61% | 2 / 3 |
| G / Double Axe | 14 | 33.30% | 35.78% | 45.06% | 0 / 14 |
| G / 独立17点overall | 17 | 33.28% | 36.61% | 45.06% | 2 / 17 |

代表Powerの予測値は次のとおりです。

| weapon | Model | P50 | P100 | P251 |
| --- | --- | ---: | ---: | ---: |
| Fighter's Bindings | W | 50 | 389 | 188,334 |
| Fighter's Bindings | G | 70 | 540 | 261,897 |
| Double Axe | W | 200 | 1,554 | 753,337 |
| Double Axe | G | 296 | 2,295 | 1,112,392 |
| Anchor | W / G | 477 | 3,699 | 1,792,941 |

Model Wはversion不明fixtureへのfitが良好ですが、cross-weapon係数だという根拠がありません。Model Gの不一致は無視せずGolden TestとUI caveatへ残し、「既存fixtureを1.17.0.0のcalibration値として扱えない」ことを示すEvidenceとします。

## Decision Bを選ぶ理由

1.17.0.0を対象にするため、データ意味とversion hierarchyを誤差fitより優先します。Model Gは内部rating、per-hit比較、共通Gear Power curveという公開説明とclientの計算が一致します。Model Wを採用すると、出典のないWiki正規化値をgame-file係数と推定することになります。

武器別calibrationは導入しません。versionとrollが不明な少数点への過学習になり、P50〜263全域で根拠のない補正を生むためです。

## 分離したEvidenceと残る不確実性

- Gear Power curve: Minecraft WikiのAnchor 12点、medium confidence。Power 50〜263だけをlog補間し外挿しない。
- 内部Power rating: dungeons.toolsの1.17.0.0 exact float、high confidence。
- cross-weapon scaling: dungeons.toolsの共通curve・線形rating比、medium confidence。raw抽出pipelineは非公開。
- Wiki base damage: versionと出典不明、cross-weapon用途ではlow confidence。research比較専用。
- published validation fixture: version / sub-power / roll不明。Model Gと最大45.06%競合。

`observedDamagePerHit`があればcurveと武器間比率を完全に迂回します。一部だけobservedの比較は`MIXED_DAMAGE_SCALE`で拒否し、敵HP・被ダメージ・最大HP・Radiance回復量も同じgame unitへ揃えます。

## Phase 1-3 readiness

Power ratingの意味はModel Bへ決定し、Gear Power curveと武器間係数のEvidenceを分離したため、Phase 1-3（Void Strike時間曲線）へ進めます。Power側の継続課題は、同一1.17.0.0・同一roll条件の実測とraw game-file fieldの独立確認です。これはmedium-confidence caveatとobserved overrideで管理し、Phase 1-3のblockerにはしません。

Golden TestはW/G両モデルの武器別・overall統計、P50 / P100 / P251予測、Anchor全結節点、範囲外拒否、observed override、混在拒否を固定します。
