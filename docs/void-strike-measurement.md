# Void Strike 時間曲線の計測手順

## 確定している仕様

[Minecraft Wiki](https://minecraft.wiki/w/Dungeons:Void_Strike)に掲載されたゲーム内説明と仕様から、近接Void Strike IIIは最大+600%（合計7倍）で、Void Strike付き武器が対象へ命中するたびに倍率がリセットされることを確定情報として扱います。

最大到達時間、最初のフレームの倍率、最大到達後の消滅時間は公式表にないため、計測対象です。コミュニティでは線形増加、約3.6秒で7倍、約5秒で消滅という報告がありますが、実測前は仮説として扱います。

## 計測条件

- Minecraft Dungeons 1.17.0.0、Void Strike IIIの近接武器を使用する。
- ダメージを変える他のエンチャント、アーティファクト、防具効果を外す。
- 同じ攻撃モーション・同じ基礎ダメージのヒットを比較する。
- 最初の命中を時刻0として、次の命中までのフレーム数を記録する。
- 0秒付近から効果消滅後まで複数の待機時間を測る。
- 各待機時間で最低5回計測し、外れ値を削除せず保存する。

`multiplier = Void Strike適用後のダメージ ÷ 同じ攻撃の基礎ダメージ` で倍率を求めます。

## データ形式

`src/data/voidStrike.ts` を次の形式へ変更します。

```ts
{
  value: {
    method: 'frame-measured',
    points: [
      { elapsedSeconds: 0, multiplierSamples: [1.25, 1.24, 1.25, 1.26, 1.25] },
      { elapsedSeconds: 1, multiplierSamples: [2.8, 2.79, 2.81, 2.8, 2.8] },
      { elapsedSeconds: 3.6, multiplierSamples: [7, 7, 7, 7, 7] },
    ],
    expiresAfterSeconds: 5,
  },
  source: FRAME_MEASUREMENT_SOURCE,
  confidence: 'medium',
}
```

各時刻の中央値を線形補間します。`expiresAfterSeconds` 以降はVoid Strikeなしの1倍へ戻します。

## 受け入れ条件

- 各点に5件以上の倍率サンプルがある。
- 時刻0、最大倍率到達前後、効果消滅前後を含む。
- ゲームバージョン、フレームレート、武器、Power Levelを記録している。
- 現在の線形近似との順位差を記録している。
- `npm test`、`npm run lint`、`npm run build` が成功する。
