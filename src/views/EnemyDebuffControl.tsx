import type { EnemyDebuffAssumptions } from '../core/types'

export function EnemyDebuffControl({ value, onChange }: {
  value: EnemyDebuffAssumptions
  onChange: (value: EnemyDebuffAssumptions) => void
}) {
  return (
    <label>
      <span>弱体化の影響を受ける被ダメージ割合 <output>{Math.round(value.weakeningAffectedIncomingDamageShare * 100)}%</output></span>
      <input
        aria-label="弱体化の影響を受ける被ダメージ割合"
        aria-describedby="weakening-share-help"
        type="range" min="0" max="1" step="0.05"
        value={value.weakeningAffectedIncomingDamageShare}
        onChange={(event) => onChange({ ...value, weakeningAffectedIncomingDamageShare: Number(event.target.value) })}
      />
      <small id="weakening-share-help">Weakening中の敵から受けると想定するダメージの割合。位置・攻撃対象・5秒の効果時間などをまとめた仮定です。初期値50%は全シナリオ共通で、実測値ではありません。</small>
    </label>
  )
}
