# DPSモデルの回帰検証と誤差範囲

## 目的

モデルが出す単体DPSを、同じビルド・シナリオで計測したゲーム内DPSと比較します。推測した誤差率は使わず、実測サンプルが5件揃うまではUIに「実測待ち」と表示します。

## サンプルの追加

`src/data/regressionSamples.ts` の `DAMAGE_REGRESSION_SAMPLES` へ次を記録します。

- 一意なサンプルID
- Minecraft Dungeonsのゲームバージョン
- 評価に使用する完全な `Build` と `Scenario`
- 同一条件で計測した単体DPS

表示ダメージを使用する場合は `build.weapon.observedDamagePerHit` を含め、敵HP・回復量なども同じゲーム内単位に揃えます。推定値、wiki記載値、モデル自身の出力は実測値として登録しません。

```ts
{
  id: 'bindings-no-enchants-001',
  gameVersion: '1.17.0.0',
  build: {
    weapon: {
      instanceId: 'bindings-regression',
      weaponId: 'fighters-bindings',
      powerLevel: 251,
      observedDamagePerHit: 123456,
      enchantmentSlots: [{ candidates: ['critical-hit'] }],
    },
    enchantments: ['critical-hit'],
    artifacts: [],
  },
  scenario: measuredScenario,
  observedSingleTargetDps: 864192,
}
```

`observedDamagePerHit` は必須です。正規化値と実測DPSを混在させたサンプルは集計時に拒否されます。

## 集計方法

各サンプルについて `signed error = (予測DPS − 実測DPS) ÷ 実測DPS` を計算します。

- 平均絶対パーセント誤差（MAPE）
- 絶対パーセント誤差のP90
- 最大絶対パーセント誤差
- 平均符号付きパーセント誤差（過大・過小評価の偏り）

UIの参考範囲は `予測DPS × (1 ± P90絶対誤差)` です。これは実測済み条件に対する経験的な目安であり、統計的な信頼区間ではありません。

## 受け入れ条件

- 最低5件を登録し、対応する武器を偏りなく含める。
- サンプルIDとゲームバージョンを必須にする。
- 元の計測記録から再現できること。
- モデル変更時に全サンプルを再評価し、誤差の悪化をテストで検出する。
- 実測条件外への一般化は保証せず、UI上でサンプル数を併記する。
