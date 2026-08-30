import type { EnemyComposition } from '../core/types'

export function EnemyCompositionControl({ value, onChange }: {
  value: EnemyComposition
  onChange: (value: EnemyComposition) => void
}) {
  return (
    <label>
      <span>エンチャントされた敵の割合 <output>{Math.round(value.enchantedShare * 100)}%</output></span>
      <input
        aria-label="エンチャントされた敵の割合"
        aria-describedby="enchanted-share-help"
        type="range" min="0" max="1" step="0.05"
        value={value.enchantedShare}
        onChange={(event) => onChange({ ...value, enchantedShare: Number(event.target.value) })}
      />
      <small id="enchanted-share-help">Unchantingなど、敵の状態に依存する効果の期待値計算に使用。初期値25%は全シナリオ共通の仮定で、実測値ではありません。</small>
    </label>
  )
}
