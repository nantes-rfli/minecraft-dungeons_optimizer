# Attack Profile 計測手順

## 目的

現在のSpeed Rating由来の暫定攻撃速度を、再現可能なフレーム計測へ置き換えます。対象は闘士の締め具、ダブルアックス、アンカーの3武器です。

## 計測条件

- Minecraft Dungeons 1.17.0.0を使用する。
- 攻撃速度を変えるエンチャント、アーティファクト、効果を外す。
- 各武器について、同じPower Level・同じフレームレートで計測する。
- コンボ開始フレームから、次のコンボ開始直前までを1サンプルとする。
- 1コンボのヒット数を記録し、コンボ時間を最低5回計測する。
- 外れ値を削除せず、全サンプルを保存する。モデルでは中央値を使用する。

## データ形式

計測後は `src/data/attackProfiles.ts` の対象武器を次の形式へ変更します。

```ts
{
  value: {
    method: 'frame-measured',
    hitsPerCombo: 4,
    framesPerSecond: 60,
    comboFrameSamples: [42, 41, 42, 43, 42],
  },
  source: FRAME_MEASUREMENT_SOURCE,
  confidence: 'medium',
  note: 'Minecraft Dungeons 1.17.0.0, unmodified attack speed.',
}
```

`hitsPerSecond = hitsPerCombo × framesPerSecond ÷ comboFrameSamplesの中央値` で算出します。

## 受け入れ条件

- 3武器すべてに5件以上のフレームサンプルがある。
- 計測条件、ゲームバージョン、計測日をsourceまたはnoteへ記録している。
- `tests/core.test.ts` の期待攻撃回数を実測値へ更新している。
- 推奨順位の変更を確認し、意図しない変化があれば原因を記録している。
- `npm test`、`npm run lint`、`npm run build` が成功する。
