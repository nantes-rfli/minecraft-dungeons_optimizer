# Power Levelと実ダメージ

## Runtime式

[dungeons.toolsのゲームデータ調査](https://www.dungeons.tools/damage-calculator)によると、絶対damageはpakに直接保存されず、item共通のGear Power Curveがゲーム実行ファイル側で適用されます。runtimeはMinecraft WikiのAnchor Power 50〜263の12点を保持し、隣接点をlog-linear interpolationします。

```text
logDamage(p) =
  logDamage(lower)
  + position × (logDamage(upper) − logDamage(lower))

weaponDamage =
  interpolatedAnchorDamage
  × weaponBaseHitDamage
  ÷ 238
```

`25 / 238`や`100 / 238`を内部Power ratingと断定していません。Wikiの`base damage`は各hitの相対damageとして公開された値であり、武器間Power係数として独立に証明されたものではありません。この比率は以下のcross-validationに基づくmedium-confidenceの暫定モデルです。

## 独立fixtureとソース

公開値はruntime計算から生成せず、[`src/data/powerScalingValidation.ts`](../src/data/powerScalingValidation.ts)へ独立fixtureとして保存します。

- [Fighter's Bindings Wiki revision 2959833](https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings?oldid=2959833): P114、P135のrange。P25も掲載されますが、runtimeのP50〜263外なのでfixtureから除外。
- [Fighter's Bindings P251 community item-card report](https://www.reddit.com/r/MinecraftDungeons/comments/o8no8d/): 通常値は約188,000、報告上限191,710。下限は概数として扱う。
- [Double Axe Wiki revision 3004051](https://minecraft.wiki/w/Dungeons%3ADouble_Axe?oldid=3004051): P50〜108の13点とP251のrange。
- [Anchor Wiki](https://minecraft.wiki/w/Dungeons%3AAnchor): P50〜263の12 exact値。これらはruntime curveの結節点でもあるため、独立した武器間検証ではなく回帰検証。

Wikiは同じPowerでもdamageが変動すると明記しています。各rowのgame version、item sub-power、rarity rollは記載されていないため、rangeを別attack hitとはみなしません。Fighter's Bindingsは全4 hitがbase damage 25、Double Axeは両hitが100なので、表の幅はhit差ではありません。バージョン互換性は確定できず、1.17.0.0との不整合可能性を残します。

## Error metric

exact値は通常の相対絶対誤差です。

```text
absoluteError = |predicted − published|
relativeError = absoluteError ÷ published
```

rangeは範囲内を0とし、外れた場合だけ最寄り境界との差をその境界で割ります。

```text
predicted < min: (min − predicted) ÷ min
min <= predicted <= max: 0
predicted > max: (predicted − max) ÷ max
```

exact sampleは5%以内、range sampleはrange外距離8%以内を個別許容基準とします。range自体が同Powerのroll幅を含むため、さらに8%を許容するのは、Wiki表の丸め・item sub-power・row version未記載を考慮したcross-version比較用の上限です。集計はrelative errorのmedian、nearest-rank P90、maxを使用します。

## Cross-validation結果

### Fighter's Bindings

| Power | predicted | published | absolute error | relative error |
| ---: | ---: | ---: | ---: | ---: |
| 114 | 689 | 876–957 | 187 | 21.35% |
| 135 | 1,629 | 1,285–2,647 | 0 | 0% |
| 251 | 188,334 | 約188,000–191,710 | 0 | 0% |

samples 3、median 0%、P90 21.35%、max 21.35%、許容内2 / 3。P114は明確な外れ値です。

### Double Axe

| Power | predicted | published | absolute error | relative error |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 200 | 209–218 | 9 | 4.31% |
| 55 | 246 | 258–269 | 12 | 4.65% |
| 60 | 302 | 319–332 | 17 | 5.33% |
| 65 | 371 | 393–409 | 22 | 5.60% |
| 70 | 455 | 483–503 | 28 | 5.80% |
| 75 | 558 | 594–619 | 36 | 6.06% |
| 80 | 685 | 730–760 | 45 | 6.16% |
| 85 | 841 | 896–934 | 55 | 6.14% |
| 90 | 1,032 | 1,100–1,146 | 68 | 6.18% |
| 95 | 1,266 | 1,350–1,406 | 84 | 6.22% |
| 100 | 1,554 | 1,655–1,724 | 101 | 6.10% |
| 105 | 1,907 | 2,030–2,114 | 123 | 6.06% |
| 108 | 2,157 | 2,294–2,389 | 137 | 5.97% |
| 251 | 753,337 | 745,829–766,840 | 0 | 0% |

samples 14、median 6.02%、P90 6.18%、max 6.22%、許容内14 / 14。

### Anchor

| Power | predicted / published | absolute error | relative error |
| ---: | ---: | ---: | ---: |
| 50 | 477 | 0 | 0% |
| 75 | 1,329 | 0 | 0% |
| 100 | 3,699 | 0 | 0% |
| 125 | 10,298 | 0 | 0% |
| 150 | 28,665 | 0 | 0% |
| 175 | 79,791 | 0 | 0% |
| 200 | 222,108 | 0 | 0% |
| 225 | 618,262 | 0 | 0% |
| 250 | 1,721,003 | 0 | 0% |
| 251 | 1,792,941 | 0 | 0% |
| 256 | 2,200,329 | 0 | 0% |
| 263 | 2,930,746 | 0 | 0% |

samples 12、median / P90 / maxはいずれも0%。curve入力と同じ公開値なので、武器間比率の独立証拠には数えません。

## Model decision

**A. common base-damage ratioを暫定維持**します。武器別calibrationは導入しません。

- Double Axeは全14点が8%基準内で、P251は公開range内。
- Fighter's BindingsはP135とP251がrange内だが、P114だけ21.35%外れる。
- P114へ合わせる一定係数はP251をrange外へ押し出すため、Bの一定calibrationでは両立しない。
- 3点だけで武器別curveを作ると、広いP135 rangeとversion不明のP114へ過学習する。P50〜113とP252〜263では外挿も必要になり、今回の制約に反する。

したがってCへ進む公開根拠も不足しています。外れ値をテストとcaveatへ残し、正確な個体比較は`observedDamagePerHit`を優先します。追加の同一game version・同一roll条件の複数点が得られた時点で再判断します。

## 対応範囲とoverride

- Power Levelは50〜263の整数だけを自動換算し、外挿しない。
- `observedDamagePerHit`があればPower curveと武器間比率を完全に迂回する。
- 一部だけobserved、一部はestimatedという比較は`MIXED_DAMAGE_SCALE`で拒否する。
- 同じPowerでもitem card値に幅があるため、自動値は`power-curve-estimate`として扱う。
- 敵HP、被ダメージ、最大HP、Radiance回復量もdamageと同じゲーム内単位で入力する。

Golden testsは29件の独立fixtureに対する予測、range-aware error、3武器のmedian / P90 / max、およびP114外れ値を固定します。従来の範囲外拒否、observed override、混在拒否も維持します。
