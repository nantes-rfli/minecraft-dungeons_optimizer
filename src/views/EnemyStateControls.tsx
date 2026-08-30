import type { EnemyComposition, EnemyStateAssumptions } from '../core/types'

export function UndeadShareControl({ value, onChange }: {
  value: EnemyComposition
  onChange: (value: EnemyComposition) => void
}) {
  return (
    <label>
      <span>アンデッドの割合 <output>{Math.round(value.undeadShare * 100)}%</output></span>
      <input aria-label="アンデッドの割合" aria-describedby="undead-share-help"
        type="range" min="0" max="1" step="0.05" value={value.undeadShare}
        onChange={(event) => onChange({ ...value, undeadShare: Number(event.target.value) })} />
      <small id="undead-share-help">攻撃対象のうちUndeadと想定するdamage-weighted割合。Smitingの期待値に使用。初期値50%は全シナリオ共通のlow-confidence仮定で、実測値ではありません。</small>
    </label>
  )
}

export function AmbushShareControl({ value, onChange }: {
  value: EnemyStateAssumptions
  onChange: (value: EnemyStateAssumptions) => void
}) {
  return (
    <label>
      <span>Ambush有効攻撃割合 <output>{Math.round(value.ambushEligibleDirectDamageShare * 100)}%</output></span>
      <input aria-label="Ambush有効攻撃割合" aria-describedby="ambush-share-help"
        type="range" min="0" max="1" step="0.05" value={value.ambushEligibleDirectDamageShare}
        onChange={(event) => onChange({ ...value, ambushEligibleDirectDamageShare: Number(event.target.value) })} />
      <small id="ambush-share-help">攻撃時に、対象が自分を狙っていないと想定する割合。Ambushの期待値に使用。初期値25%は全シナリオ共通のlow-confidence仮定で、実測値ではありません。</small>
    </label>
  )
}
