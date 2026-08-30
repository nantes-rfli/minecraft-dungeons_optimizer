import type { Evaluation } from '../core/types'

export function DirectDamageDetails({ evaluation }: { evaluation: Evaluation }) {
  if (!evaluation.build.enchantments.some((item) => ['sharpness', 'unchanting', 'ambush', 'smiting', 'committed'].includes(item.enchantmentId))) return null
  const damage = evaluation.damage
  const number = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
  const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`
  return (
    <details className="contributions">
      <summary>直接近接ダメージの倍率を見る</summary>
      <p>Base DPS {number.format(damage.baseDps)} × Sharpness {damage.sharpnessMultiplier.toFixed(3)} × Critical {damage.criticalMultiplier.toFixed(3)} × Void {damage.voidStrikeMultiplier.toFixed(3)} × Unchanting {damage.unchantingMultiplier.toFixed(3)} × Smiting {damage.smitingMultiplier.toFixed(5)} × Ambush {damage.ambushMultiplier.toFixed(3)} = Committed前 {number.format(damage.preCommittedDirectWeaponSingleTargetDps)} DPS。</p>
      <p>Committed適用前の非エンチャント敵DPS {number.format(damage.nonEnchantedTargetDps)} / エンチャント敵DPS {number.format(damage.enchantedTargetDps)}（想定割合 {percent(damage.enchantedShare)}）。他の条件は独立近似、proc/DoTは含みません。</p>
      <p>Undead {percent(damage.undeadShare)} → Smiting {damage.smitingMultiplier.toFixed(5)}倍（active {damage.smitingActiveUndeadMultiplier.toFixed(5)}倍） / Ambush有効 {percent(damage.ambushEligibleShare)} → {damage.ambushMultiplier.toFixed(3)}倍。</p>
      {evaluation.build.enchantments.some((item) => item.enchantmentId === 'committed') && <p>Committed: full HPから撃破までの連続モデル（AoEは同一HP推移近似）。直接DPS 単体 {number.format(damage.preCommittedDirectWeaponSingleTargetDps)} × {damage.committedSingleTargetMultiplier.toFixed(4)} = {number.format(damage.directWeaponSingleTargetDps)} / AoE {number.format(damage.preCommittedDirectWeaponAoeDps)} × {damage.committedAoeMultiplier.toFixed(4)} = {number.format(damage.directWeaponAoeDps)}。proc自体は増幅しません。</p>}
    </details>
  )
}
