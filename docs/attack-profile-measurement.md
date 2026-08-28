# Attack Profile 登録・独立検証手順

## 現在のデータ境界

闘士の締め具、ダブルアックス、アンカーの3武器は、Minecraft Dungeons 1.17.0.0について公開されているper-hitのAttack durationをruntimeへ登録しています。Speed RatingからHPSを推定せず、生timingから次の式で導出します。

```text
comboDurationSeconds = sum(hitDurationsSeconds)
hitsPerSecond = hitDurationsSeconds.length / comboDurationSeconds
```

runtime値は `src/data/attackProfiles.ts`、全82武器の調査値とsource contextは `research/melee-attack-profile-audit.json` を正本とします。今回の3件は直接的な数値表を持つため`exact`ですが、Wiki表が各値の一次game-file参照を公開していないためconfidenceは`medium`です。

## 公開timing形式

```ts
{
  value: {
    method: 'published-hit-timings',
    hitDurationsSeconds: [0.15, 0.15, 0.15, 0.125],
    comboFinisherHit: 4,
  },
  source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
  confidence: 'medium',
}
```

`comboFinisherHit`と各hit timingを保持するため、将来Shock Wave、Swirling、Void Strikeなどをcombo構造に沿って扱えます。durationなし、0以下のduration、範囲外のfinisherは計算前に拒否します。

## 独立実機検証を追加する場合

公開値のcross-checkや、startup / recovery / combo間delayを調べる場合は次の条件でフレーム計測します。

- Minecraft Dungeons 1.17.0.0を使用する。
- 攻撃速度を変えるエンチャント、アーティファクト、効果を外す。
- コンボ開始フレームから、次のコンボ開始直前までを1サンプルとする。
- 武器ごとに同一フレームレートで最低5回計測する。
- 外れ値を削除せず全サンプルを保存し、モデルでは中央値を使用する。

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

frame measured HPSは `hitsPerCombo × framesPerSecond ÷ comboFrameSamplesの中央値` です。公開timingとの差が測定誤差を超える場合、startup / recovery / cancel / animation overlapのどれを含むかを確認し、単純に平均して混ぜません。

## 受け入れ条件

- raw hit durationsとcombo finisherが保持される。
- HPSがraw durationsから一意に導出される。
- game version、source、confidence、未検証事項が明記される。
- 3武器のDPS・回復・Void Strike回帰テストを更新する。
- 推奨順位が変化した場合は原因を記録する。
- `npm run audit:melee`、`npm test`、`npm run lint`、`npm run build` が成功する。
