# Build依存kill rateとCombatState

## 責務

Scenarioは実際の撃破数を固定せず、戦闘空間へ供給される敵数の上限`enemySupplyPerSecond`を定義します。BuildのDamage計算後に`CombatState`を生成し、そのBuildが倒せる推定撃破速度を求めます。

```text
effective DPS = AoE DPS
damage-limited kills/s = effective DPS ÷ average enemy health
estimated kills/s = min(enemy supply/s, damage-limited kills/s)
```

AoE DPSを使用するため、攻撃範囲と平均射程内敵数も撃破速度へ影響します。敵ごとの残HP、overkill、移動時間、同時出現のばらつきはまだ扱わないため、この式は`model-assumption`です。

## 利用箇所

- Leeching: `estimated kills/s × average enemy health × direct kill share × healing fraction`
- Guarding Strike: `1 − exp(−estimated kills/s × duration)`
- 将来のRefreshmentや撃破トリガーEnchantも同じ`CombatState`を利用する。

これにより、火力の異なるBuildが同じ撃破速度・回復・防御稼働率になる問題を防ぎます。Artifact ON/OFFを別評価する将来拡張では、状態ごとにDamageとCombatStateを再計算します。
