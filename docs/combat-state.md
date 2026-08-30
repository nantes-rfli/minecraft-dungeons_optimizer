# Build依存kill rateとCombatState

## 責務

Scenarioは実際の撃破数を固定せず、戦闘空間へ供給される敵数の上限`enemySupplyPerSecond`を定義します。BuildのDamage計算後に`CombatState`を生成し、そのBuildが倒せる推定撃破速度を求めます。

```text
effective DPS = AoE DPS
damage-limited kills/s = effective DPS ÷ average enemy health
estimated kills/s = min(enemy supply/s, damage-limited kills/s)
direct damage share = direct weapon AoE / total AoE（total=0なら1）
direct weapon kills/s = estimated kills/s × scenario.directKillShare × direct damage share
indirect estimated kills/s = estimated kills/s × (1 − direct damage share)
```

AoE DPSを使用するため、攻撃範囲と平均射程内敵数も撃破速度へ影響します。敵ごとの残HP、overkill、移動時間、同時出現のばらつきはまだ扱わないため、この式は`model-assumption`です。

## 利用箇所

- Leeching: `direct weapon kills/s × average enemy health × healing fraction`
- Guarding Strike: `1 − exp(−direct weapon kills/s × duration)`
- Refreshment: 同じ直接撃破rateからPotionStateのCDと追加回復容量を計算する。

`directKillShare`をLeechingやGuarding Strike側で再計算せず、`deriveCombatState()`だけが`directWeaponKillsPerSecond`を定義します。Phase 2-1DでShockwave・Swirling・Thunderingの間接damageを分離し、この境界の内部へdamage shareによる帰属を追加しました。

これにより、火力の異なるBuildが同じ撃破速度・回復・防御稼働率になる問題を防ぎます。Artifact ON/OFFを別評価する将来拡張では、状態ごとにDamageとCombatStateを再計算します。

## Phase 2-1Dの帰属proxy

procなしはdirectDamageShare=1で従来の結果を維持します。procありはdamage shareをfinal-blow shareの代わりに使うlow-confidenceモデルです。damage-limitedでは直接kill rateは変わらず、供給cap時は減少し得ます。RadianceはHPS依存なので変わりません。時刻・残HP・overkillを再現するexact final-blow modelではありません。[数値例・Evidence・制限](./damage-events.md#kill-attributionと具体例)。
