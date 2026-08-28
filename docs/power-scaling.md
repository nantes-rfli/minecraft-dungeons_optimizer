# Power Levelと実ダメージ

## 根拠と設計判断

[dungeons.toolsのゲームデータ調査](https://www.dungeons.tools/damage-calculator)によると、武器の絶対damageはpakへ保存されず、全itemに共通するGear Power Curveがゲーム実行ファイル側で適用されます。そのためゲームファイルから絶対曲線を直接取得することはできません。

一方、Minecraft WikiのAnchorページにはMinecraft Dungeons 1.17.0.0について、Power 50〜263の表示damageが掲載されています。この12点は一貫した指数曲線を形成し、Power 50と250から求めた単一指数でも全掲載点を0.1%未満の差で再現します。

runtimeでは推定式だけを保存せず、`src/data/powerScaling.ts` に12件のraw sampleを保持し、隣接点をlog-linear interpolationします。掲載範囲外は推測で外挿しません。

```text
logDamage(p) =
  logDamage(lower)
  + position × (logDamage(upper) − logDamage(lower))

weaponDamage =
  interpolatedAnchorDamage
  × weaponBaseHitDamage
  ÷ anchorBaseHitDamage
```

## 対応範囲

- Game version: 1.17.0.0
- Power Level: 50〜263の整数
- Runtime weapons: Fighter's Bindings / Double Axe / Anchor
- Confidence: medium
- Power 251換算:
  - Fighter's Bindings: 188,334 damage/hit
  - Double Axe: 753,337 damage/hit
  - Anchor: 1,792,941 damage/hit

Anchorの公開sampleはそのPower Levelで完全再現します。ほかの武器は、個別Stats表のbase hit damageへ同じGear Power倍率を適用します。

## 個体差と表示ダメージoverride

同じPower Levelでもitem cardの表示damageには幅があります。そのため自動換算は、個体値を断定する`exact`ではなく`power-curve-estimate`として扱います。

- 表示ダメージ未入力: 公開Power Curveから自動換算。
- 全武器に表示ダメージ入力: game内item card値を優先。
- 一部だけ入力: 推定値と個体値の混在を防ぐため計算を停止。
- Power 50未満または263超: 外挿せず、表示ダメージ入力を要求。

表示ダメージoverrideはPower Curveの対応範囲外でも利用できます。

## シナリオ値の単位

自動換算後のDPSはゲーム内damage単位です。次の値も同じ単位で入力してください。

- 平均敵HP
- 被ダメージ/秒
- 最大HP
- 輝き1回の回復量

標準シナリオ値は依然としてmodel assumptionです。Power換算が実装済みでも、敵HPや回復量を実際の難易度・装備へ合わせなければkill rateやUtilityは正確になりません。

## 検証

- 12件の公開Anchor sampleをGolden Testで完全再現する。
- 中間Powerはlog-linear interpolationの計算結果と一致する。
- base hit damage比が異なる3武器へ同じ倍率を適用する。
- 小数Power、範囲外Power、0以下のbase damageを拒否する。
- 表示ダメージoverrideはPower Curveを迂回する。
- `npm test`、`npm run lint`、`npm run build`を通す。
